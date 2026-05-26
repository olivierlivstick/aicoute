-- Grant permissions sur demo_calls aux rôles standard Supabase.
-- Sans ces GRANT, les Edge Functions (rôle service_role) plantent avec
-- une erreur Postgres 42501 "permission denied for table demo_calls".
-- Supabase ne propage pas toujours les ALTER DEFAULT PRIVILEGES aux tables
-- créées via migration ; ce GRANT explicite garantit l'accès dans tous les cas.

GRANT ALL ON demo_calls TO postgres, anon, authenticated, service_role;
