"""FastAPI layer over the agent.

Response models mirror frontend/lib/types.ts; the two must stay in step.
"""

from __future__ import annotations

import logging
import os

import psycopg
from agent import AgentResult, answer_question
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from db import Schema, fetch_schema, format_as_ddl, get_connection

load_dotenv()

log = logging.getLogger("uvicorn.error")

# Every /query call spends money at the model provider, so the public endpoint
# is capped per client. Without this a stranger can drain the API budget.
RATE_LIMIT = os.getenv("RATE_LIMIT", "10/minute")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Text-to-SQL Agent", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# --- response models --------------------------------------------------------


class AttemptOut(BaseModel):
    n: int
    sql: str | None
    status: str
    error: str | None
    duration_ms: int


class QueryResultsOut(BaseModel):
    columns: list[str]
    rows: list[list[object]]
    row_count: int
    truncated: bool


class QueryResponse(BaseModel):
    question: str
    sql: str | None
    results: QueryResultsOut | None
    attempts: list[AttemptOut]
    error: str | None
    refused: bool


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class SchemaColumnOut(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool = False
    references: dict[str, str] | None = None


class SchemaTableOut(BaseModel):
    name: str
    columns: list[SchemaColumnOut]


class SchemaResponse(BaseModel):
    tables: list[SchemaTableOut]


# --- schema cache -----------------------------------------------------------

# The schema is static for the life of the process, and every request would
# otherwise re-read information_schema before calling the model.
_schema_cache: Schema | None = None
_ddl_cache: str | None = None


def _load_schema(conn: psycopg.Connection) -> tuple[Schema, str]:
    global _schema_cache, _ddl_cache
    if _schema_cache is None or _ddl_cache is None:
        _schema_cache = fetch_schema(conn)
        _ddl_cache = format_as_ddl(_schema_cache)
    return _schema_cache, _ddl_cache


# --- endpoints --------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness only -- no database or model call, so it stays cheap enough for
    a container healthcheck to hit frequently."""
    return {"status": "ok"}


@app.get("/schema", response_model=SchemaResponse)
def get_schema() -> SchemaResponse:
    with get_connection() as conn:
        schema, _ = _load_schema(conn)

    return SchemaResponse(
        tables=[
            SchemaTableOut(
                name=table,
                columns=[
                    SchemaColumnOut(name=c.name, type=c.data_type, nullable=c.nullable)
                    for c in columns
                ],
            )
            for table, columns in schema.items()
        ]
    )


@app.post("/query", response_model=QueryResponse)
@limiter.limit(RATE_LIMIT)
def post_query(request: Request, body: QueryRequest) -> QueryResponse:
    """Answer a question.

    A refusal is a 200 with refused=true, not an error: declining to run unsafe
    SQL is correct behaviour, and the frontend renders it as its own state.
    """
    try:
        with get_connection() as conn:
            _, ddl = _load_schema(conn)
            result = answer_question(conn, body.question.strip(), ddl)
    except psycopg.OperationalError as e:
        log.error("database unavailable: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable.") from e
    except Exception as e:
        # Anything left is the model provider timing out or erroring. That is
        # not the caller's fault and not a permanent failure, so 503 rather
        # than 500 -- and the provider's message never reaches the client,
        # since it can carry key material.
        log.error("generation failed: %s: %s", type(e).__name__, e)
        raise HTTPException(
            status_code=503, detail="The model is unavailable. Try again shortly."
        ) from e

    return _to_response(result)


def _to_response(result: AgentResult) -> QueryResponse:
    return QueryResponse(
        question=result.question,
        sql=result.sql,
        results=(
            QueryResultsOut(
                columns=result.results.columns,
                rows=result.results.rows,
                row_count=result.results.row_count,
                truncated=result.results.truncated,
            )
            if result.results
            else None
        ),
        attempts=[
            AttemptOut(
                n=a.n,
                sql=a.sql,
                status=a.status,
                error=a.error,
                duration_ms=a.duration_ms,
            )
            for a in result.attempts
        ],
        error=result.error,
        refused=result.refused,
    )
