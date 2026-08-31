#!/bin/bash
# Creates the read-only role the application connects as.
#
# A shell script rather than plain .sql because the Postgres entrypoint runs
# .sql files through psql with no variable substitution, which would mean
# hardcoding the password in the repository. Scripts, by contrast, see the
# container's environment.
set -e

: "${APP_RO_PASSWORD:?APP_RO_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE USER app_ro WITH PASSWORD '${APP_RO_PASSWORD}';
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO app_ro;
    GRANT USAGE ON SCHEMA public TO app_ro;

    -- A snapshot of the tables that exist right now, which is why this runs
    -- after the dump.
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;

    -- Enforced by the server, so they hold regardless of what the app does.
    ALTER ROLE app_ro SET statement_timeout = '5s';
    ALTER ROLE app_ro SET default_transaction_read_only = on;
SQL
