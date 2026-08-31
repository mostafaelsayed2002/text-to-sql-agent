"""Tests for the SQL validator.

No database and no model: the validator is pure string-in, string-out, which
makes it the one part of the system that is cheap to test exhaustively. These
run in CI and gate the build.
"""

import pytest
import sqlglot

from validator import DEFAULT_LIMIT, SqlRefused, validate


# --- statements that must be allowed through -------------------------------


def test_simple_select_passes():
    assert "customer" in validate("SELECT COUNT(*) FROM customer")


def test_join_with_output_alias_passes():
    """An ORDER BY on a SELECT alias must not be mistaken for something invalid.

    This is the shape of the demo query, so a false refusal here would be
    visible on the front page.
    """
    sql = """
        SELECT ar.name AS artist, SUM(il.unit_price * il.quantity) AS revenue
        FROM invoice_line AS il
        JOIN track AS t ON t.track_id = il.track_id
        JOIN album AS al ON al.album_id = t.album_id
        JOIN artist AS ar ON ar.artist_id = al.artist_id
        GROUP BY ar.name
        ORDER BY revenue DESC
    """
    assert "revenue" in validate(sql)


def test_read_only_cte_passes():
    """CTEs are fine; it is writes inside them that are not."""
    sql = """
        WITH per_artist AS (
            SELECT artist_id, COUNT(*) AS n FROM album GROUP BY artist_id
        )
        SELECT * FROM per_artist
    """
    assert "per_artist" in validate(sql)


# --- the row cap ------------------------------------------------------------


def test_limit_is_injected_when_absent():
    assert f"LIMIT {DEFAULT_LIMIT}" in validate("SELECT * FROM track")


def test_existing_limit_is_preserved():
    """The model's own narrower limit must win; never widen a result set."""
    result = validate("SELECT * FROM track LIMIT 5")
    assert "LIMIT 5" in result
    assert str(DEFAULT_LIMIT) not in result


def test_limit_override_is_respected():
    assert "LIMIT 10" in validate("SELECT * FROM track", max_rows=10)


# --- statements that must be refused ---------------------------------------


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM customer",
        "UPDATE customer SET country = 'DE'",
        "INSERT INTO genre (name) VALUES ('x')",
        "DROP TABLE track",
        "ALTER TABLE track ADD COLUMN x INT",
        "TRUNCATE TABLE customer",
    ],
)
def test_non_select_statements_are_refused(sql):
    with pytest.raises(SqlRefused):
        validate(sql)


def test_multiple_statements_are_refused():
    with pytest.raises(SqlRefused, match="single statement"):
        validate("SELECT 1; DROP TABLE track")


def test_write_hidden_in_cte_is_refused():
    """Postgres allows data-modifying CTEs, so this really is a SELECT at the
    root -- checking only the top-level node would let it through."""
    sql = "WITH x AS (DELETE FROM customer RETURNING *) SELECT * FROM x"
    with pytest.raises(SqlRefused, match="DELETE"):
        validate(sql)


def test_unparseable_sql_is_refused():
    with pytest.raises(SqlRefused, match="parse"):
        validate("SELECT FROM WHERE")


def test_empty_input_is_refused():
    with pytest.raises(SqlRefused):
        validate("")


# --- the refusal message is the retry loop's only feedback ------------------


def test_refusal_names_the_offending_statement_type():
    """The message is fed straight back into the next prompt, so it has to say
    what was wrong -- not merely that something was."""
    with pytest.raises(SqlRefused) as excinfo:
        validate("DELETE FROM customer")
    assert "DELETE" in str(excinfo.value)


# --- output must be executable ---------------------------------------------


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT COUNT(*) FROM customer",
        "SELECT * FROM track LIMIT 5",
        "SELECT name FROM artist ORDER BY name",
    ],
)
def test_output_is_still_valid_postgres(sql):
    """Guards the rewrite step: injecting a LIMIT must not corrupt the query."""
    sqlglot.parse_one(validate(sql), dialect="postgres")
