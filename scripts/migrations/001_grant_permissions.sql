-- NeoTopia · Migration 001 · Supabase GRANT fix
-- Run via: Supabase dashboard SQL editor OR Supabase MCP
-- WHY: Tables created via raw SQL do not auto-grant privileges.
--      Supabase dashboard auto-grants. Raw SQL does not.
--      RLS policies are meaningless without the base GRANT.
-- RULE: Run this ONCE after any new table is created via raw SQL.

-- Grant DML to anon and authenticated roles on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;

-- Grant usage on sequences (needed for INSERT with serial/uuid)
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated;

-- Ensure future tables created via SQL also get grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- Verify (run after migration to confirm):
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
-- AND grantee IN ('anon', 'authenticated')
-- ORDER BY table_name, grantee, privilege_type;
