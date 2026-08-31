"""Read-only access to the Chinook database, and schema extraction.

The app connects as app_ro, which is granted SELECT only and carries
statement_timeout and default_transaction_read_only on the role itself. The
database enforces the read-only contract regardless of what this code does.
"""

from __future__ import annotations

import datetime
import os
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg
from dotenv import load_dotenv

load_dotenv()

CONNINFO = (
    f"postgresql://{os.getenv('DB_USER', 'app_ro')}"
    f":{os.environ['APP_RO_PASSWORD']}"
    f"@{os.getenv('DB_HOST', 'localhost')}"
    f":{os.getenv('DB_PORT', '5432')}"
    f"/{os.getenv('DB_NAME', 'chinook')}"
)


@dataclass(frozen=True)
class Column:
    name: str
    data_type: str
    nullable: bool


# Schema = {table_name: [Column, ...]}, read once from the live database and
# rendered into the prompt by format_as_ddl().
Schema = dict[str, list[Column]]


@dataclass(frozen=True)
class QueryResults:
    """Mirrors QueryResults in frontend/lib/types.ts -- keep the two in step."""

    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool


class QueryFailed(Exception):
    """The database rejected the query. The message is Postgres' own, which names
    the offending column and often suggests a correction."""


def get_connection() -> psycopg.Connection:
    return psycopg.connect(CONNINFO)


_SCHEMA_QUERY = """
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
"""


def fetch_schema(conn: psycopg.Connection) -> Schema:
    """Read the live schema. ordinal_position keeps columns in table order."""
    schema: Schema = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(_SCHEMA_QUERY)
        for table, column, data_type, is_nullable in cur.fetchall():
            schema[table].append(
                Column(name=column, data_type=data_type, nullable=is_nullable == "YES")
            )
    return dict(schema)


def format_as_ddl(schema: Schema) -> str:
    """Render the schema as CREATE TABLE statements for the prompt.

    Models follow DDL far more reliably than a prose description of the tables.
    """
    blocks = []
    for table, columns in schema.items():
        lines = ",\n".join(
            f"    {c.name} {c.data_type}{'' if c.nullable else ' NOT NULL'}"
            for c in columns
        )
        blocks.append(f"CREATE TABLE {table} (\n{lines}\n);")
    return "\n\n".join(blocks)


def _json_safe(value: Any) -> Any:
    """numeric arrives as Decimal and timestamps as datetime; both would raise
    when FastAPI serialises the response."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    return value


def run_query(
    conn: psycopg.Connection, sql: str, row_limit: int | None = None
) -> QueryResults:
    """Execute already-validated SQL. Does no checking of its own -- `sql` must
    have been through validator.validate(). `row_limit` only reports truncation."""
    try:
        with conn.cursor() as cur:
            cur.execute(sql)  # type: ignore[arg-type]
            # A statement returning nothing (no SELECT) leaves description None.
            columns = [d.name for d in cur.description] if cur.description else []
            rows = [[_json_safe(v) for v in row] for row in cur.fetchall()]
    except psycopg.Error as e:
        # Roll back so the connection stays usable for the next attempt in the
        # retry loop; a failed statement leaves the transaction aborted.
        conn.rollback()
        raise QueryFailed(str(e).strip()) from e

    return QueryResults(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        # Best guess: the cap was reached. A query whose honest answer is
        # exactly row_limit rows reports a false positive, which is the safe
        # direction to be wrong in.
        truncated=row_limit is not None and len(rows) == row_limit,
    )


if __name__ == "__main__":
    with get_connection() as conn:
        schema = fetch_schema(conn)
        print(format_as_ddl(schema))
        print(f"\n-- {len(schema)} tables")
