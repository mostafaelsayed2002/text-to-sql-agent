"""Prompt construction. Kept separate because prompt wording is the main thing
the evaluation varies."""

from __future__ import annotations

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate

SYSTEM = """\
You write PostgreSQL queries against the Chinook music-store database.

Schema:
{schema}

Rules:
- Return exactly one SELECT statement. Never INSERT, UPDATE, DELETE, DROP,
  ALTER, or any other statement type.
- Use only tables and columns that appear in the schema above.
- All identifiers are lowercase and unquoted. Write `invoice_line`, not
  "InvoiceLine".
- Prefer explicit JOIN ... ON over comma joins.
- When the question implies a ranking or a "top N", include ORDER BY and LIMIT.\
"""

# The model is shown its own previous query and the exact error; a vague "that
# was wrong" produces another guess rather than a correction.
RETRY = """\
That query failed.

Query:
{sql}

Error:
{error}

Write a corrected query.\
"""

_BASE = ChatPromptTemplate.from_messages(
    [("system", SYSTEM), ("human", "{question}")]
)


def build_messages(
    schema: str,
    question: str,
    history: list[tuple[str, str]] | None = None,
) -> list[BaseMessage]:
    """`history` is [(sql, error), ...]. Every failure stays in the conversation,
    so the model does not return to a query it has already been told is wrong."""
    messages = _BASE.format_messages(schema=schema, question=question)

    for sql, error in history or []:
        messages.append(AIMessage(content=sql))
        messages.append(HumanMessage(content=RETRY.format(sql=sql, error=error)))

    return messages
