"""Generates SQL from a question, validates it, runs it, and retries on failure."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal

import psycopg
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from prompts import build_messages
from pydantic import BaseModel, Field
from validator import DEFAULT_LIMIT, SqlRefused, validate

from db import QueryFailed, QueryResults, run_query

load_dotenv()

# Both are rows in the evaluation table, so both are overridable.
MODEL = os.getenv("LLM_MODEL", "gemini-3.1-flash-lite")
MAX_ATTEMPTS = int(os.getenv("MAX_ATTEMPTS", "3"))

# Gemini 3.x reasons before answering by default; for a query this small that
# cost 60s+ per call. The timeout guards against the provider hanging.
THINKING_LEVEL = "low"
TIMEOUT_SECONDS = 30


class SqlQuery(BaseModel):
    """The response schema. Constrains the form of the answer, never its safety:
    `sql` is still an arbitrary string, so the validator still runs on it."""

    sql: str = Field(description="A single PostgreSQL SELECT answering the question.")


@lru_cache(maxsize=1)
def _get_model():
    """Cached: the client is stateless, and rebuilding it on every attempt is
    pure overhead."""
    return ChatGoogleGenerativeAI(
        model=MODEL,
        thinking_level=THINKING_LEVEL,
        timeout=TIMEOUT_SECONDS,
        max_retries=2,
        google_api_key=os.environ["GOOGLE_API_KEY"],
    ).with_structured_output(SqlQuery)


def generate_sql(
    question: str,
    schema_ddl: str,
    history: list[tuple[str, str]] | None = None,
) -> str:
    """Ask the model for SQL. Returns it unvalidated."""
    result = _get_model().invoke(build_messages(schema_ddl, question, history))
    # None when nothing the model produced fit the schema. Return empty and let
    # the validator refuse it, rather than crashing here.
    return result.sql.strip() if result else ""


AttemptStatus = Literal["validation_failed", "execution_failed", "succeeded"]


@dataclass(frozen=True)
class Attempt:
    """One pass through generate -> validate -> execute.
    Mirrors Attempt in frontend/lib/types.ts."""

    n: int
    sql: str | None
    status: AttemptStatus
    error: str | None
    duration_ms: int


@dataclass(frozen=True)
class AgentResult:
    """Mirrors QueryResponse in frontend/lib/types.ts."""

    question: str
    sql: str | None
    results: QueryResults | None
    attempts: list[Attempt] = field(default_factory=list)
    error: str | None = None
    refused: bool = False


def answer_question(
    conn: psycopg.Connection,
    question: str,
    schema_ddl: str,
    max_attempts: int = MAX_ATTEMPTS,
    max_rows: int = DEFAULT_LIMIT,
) -> AgentResult:
    """Generate, validate and run SQL, feeding each failure back into the next
    prompt. Gives up honestly rather than inventing an answer.

    Provider errors (timeout, 503) propagate rather than consuming an attempt:
    "the API is down" is not a SQL correctness problem.
    """
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1")

    history: list[tuple[str, str]] = []
    attempts: list[Attempt] = []

    for n in range(1, max_attempts + 1):
        started = time.perf_counter()
        sql = generate_sql(question, schema_ddl, history)

        try:
            safe_sql = validate(sql, max_rows=max_rows)
        except SqlRefused as e:
            reason = str(e)
            status: AttemptStatus = "validation_failed"
        else:
            try:
                results = run_query(conn, safe_sql, row_limit=max_rows)
            except QueryFailed as e:
                # Postgres' own message names the column and often suggests a
                # correction, so it is better retry feedback than a rewording.
                reason = str(e).splitlines()[0]
                status = "execution_failed"
            else:
                attempts.append(Attempt(n, sql, "succeeded", None, _ms_since(started)))
                return AgentResult(question, safe_sql, results, attempts)

        attempts.append(Attempt(n, sql or None, status, reason, _ms_since(started)))
        history.append((sql, reason))

    # Every attempt, not just the last: a run that mixed refusals with database
    # errors did reach the database, so the refusal wording would be untrue.
    refused = all(a.status == "validation_failed" for a in attempts)
    if refused:
        error = (
            "This request was refused. The generated statement was not a single "
            "read-only SELECT, so it was never sent to the database."
        )
    else:
        error = (
            f"Could not produce a working query after {len(attempts)} attempts. "
            f"The last error was: {attempts[-1].error}"
        )
    return AgentResult(question, None, None, attempts, error, refused)


def _ms_since(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


if __name__ == "__main__":
    import sys

    from db import fetch_schema, format_as_ddl, get_connection

    question = " ".join(sys.argv[1:]) or "How many customers are from Germany?"

    with get_connection() as conn:
        ddl = format_as_ddl(fetch_schema(conn))
        result = answer_question(conn, question, ddl)

    for a in result.attempts:
        print(f"[{a.n}] {a.status} ({a.duration_ms}ms)")
        if a.sql:
            print(f"    {a.sql}")
        if a.error:
            print(f"    -> {a.error}")

    if result.results:
        print(f"\n{result.results.columns}")
        for row in result.results.rows[:10]:
            print(f"  {row}")
        print(f"\n{result.results.row_count} rows")
    else:
        print(f"\n{result.error}")
