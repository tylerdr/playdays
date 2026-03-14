# Database Rules

Apply these rules when working on files matching: lib/db/**, supabase/migrations/**, and database queries

- Never run raw SQL in components — use helper functions from lib/db/
- All migrations must be reversible (include down migration)
- Index foreign keys and columns used in WHERE clauses
- Never return passwords, tokens, or sensitive fields in queries
- Use transactions for multi-table writes
- Name migrations: YYYYMMDD_descriptive_name.sql
