"""Read-only access to the Chinook database, and schema extraction.

The app connects as app_ro, which is granted SELECT only and carries
statement_timeout and default_transaction_read_only on the role itself. The
database enforces the read-only contract regardless of what this code does.
"""

from __future__ import annotations

import os
from collections import defaultdict
from dataclasses import dataclass

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


# Schema = {table_name: [Column, ...]}. The validator checks generated SQL
# against this; format_as_ddl() turns the same dict into prompt text. One
# source, two consumers.
Schema = dict[str, list[Column]]


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


if __name__ == "__main__":
    with get_connection() as conn:
        schema = fetch_schema(conn)
        print(format_as_ddl(schema))
        print(f"\n-- {len(schema)} tables")
