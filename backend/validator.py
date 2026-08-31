"""Decides whether model-generated SQL is safe to execute.

The database is the wall: app_ro holds SELECT only, plus statement_timeout and
default_transaction_read_only on the role. Writes are already impossible.

This layer exists for the two things the database cannot do:

  * cap the number of rows returned -- statement_timeout limits how long a
    query runs, not how much it returns, and a cross join can produce millions
    of rows well inside the timeout;
  * explain a refusal in terms the model can act on. "permission denied for
    table customer" teaches the retry loop nothing; naming the rule that was
    broken teaches it what to do differently.

Table and column existence is deliberately NOT checked here. Postgres does it
better -- it knows the real catalogue and suggests corrections -- so it is left
to execution, and the database's error goes back to the model as-is.
"""

from __future__ import annotations

import sqlglot
from sqlglot import exp

DIALECT = "postgres"
DEFAULT_LIMIT = 100


class SqlRefused(Exception):
    """Generated SQL must not be executed. The message goes back to the model."""


# Checking the root node alone is not enough: Postgres allows data-modifying
# CTEs, so `WITH x AS (DELETE FROM customer RETURNING *) SELECT * FROM x`
# genuinely is a SELECT at the root. Every node gets inspected.
_FORBIDDEN = {
    "Insert", "Update", "Delete", "Drop", "Create", "Alter", "TruncateTable",
    "Grant", "Revoke", "Command", "Set", "Copy", "Merge", "Attach", "Transaction",
}


def _walk(statement: exp.Expression):
    """sqlglot has yielded both bare nodes and (node, parent, key) tuples."""
    for item in statement.walk():
        yield item[0] if isinstance(item, tuple) else item


def validate(sql: str, max_rows: int = DEFAULT_LIMIT) -> str:
    """Return executable SQL, or raise SqlRefused with a reason for the model."""

    try:
        statements = [s for s in sqlglot.parse(sql, dialect=DIALECT) if s is not None]
    except sqlglot.ParseError as e:
        raise SqlRefused(f"Could not parse as PostgreSQL: {e}") from e

    if not statements:
        raise SqlRefused("No SQL statement found.")
    if len(statements) > 1:
        raise SqlRefused(
            f"Expected a single statement, got {len(statements)}. "
            "Only one SELECT may be executed."
        )

    statement = statements[0]
    if not isinstance(statement, exp.Select):
        raise SqlRefused(
            f"Statement type {type(statement).__name__.upper()} is not allowed; "
            "only a single SELECT may be executed."
        )

    for node in _walk(statement):
        kind = type(node).__name__
        if kind in _FORBIDDEN:
            raise SqlRefused(
                f"{kind.upper()} is not allowed anywhere in the query, "
                "including inside a CTE or subquery."
            )

    # The one guarantee nothing else in the stack provides. args["limit"] is
    # absent when the model omitted one.
    if not statement.args.get("limit"):
        statement = statement.limit(max_rows)

    return statement.sql(dialect=DIALECT)
