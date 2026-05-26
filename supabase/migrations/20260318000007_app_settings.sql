-- Migration 007: Variables d'application pour pg_cron
-- Ces valeurs doivent être définies manuellement dans le dashboard Supabase
-- Settings → Database → Configuration → custom_settings
-- OU via la CLI : supabase secrets set APP_SUPABASE_URL=...

-- Valeurs placeholder (à remplacer en production)
ALTER DATABASE postgres
  SET app.settings.supabase_url  = 'https://VOTRE_PROJECT_REF.supabase.co';

ALTER DATABASE postgres
  SET app.settings.service_role_key = 'VOTRE_SERVICE_ROLE_KEY';

-- Note : ne pas committer les vraies valeurs dans git.
-- En production, utiliser les Supabase Secrets :
--   supabase secrets set SUPABASE_URL=https://...
--   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
