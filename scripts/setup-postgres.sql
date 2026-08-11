-- Al-Nabi local DB bootstrap (run as postgres superuser)
-- psql -U postgres -h 127.0.0.1 -p 5432 -f scripts/setup-postgres.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alnabiy') THEN
    CREATE USER alnabiy WITH PASSWORD 'alnabiy';
  ELSE
    ALTER USER alnabiy WITH PASSWORD 'alnabiy';
  END IF;
END
$$;

SELECT 'CREATE DATABASE alnabiy OWNER alnabiy'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'alnabiy')\gexec

GRANT ALL PRIVILEGES ON DATABASE alnabiy TO alnabiy;
\c alnabiy
GRANT ALL ON SCHEMA public TO alnabiy;
ALTER SCHEMA public OWNER TO alnabiy;
