CREATE USER app_ro WITH PASSWORD 'devpassword';
GRANT CONNECT ON DATABASE chinook TO app_ro;
GRANT USAGE ON SCHEMA public TO app_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;

ALTER ROLE app_ro SET statement_timeout = '5s';
ALTER ROLE app_ro SET default_transaction_read_only = on;