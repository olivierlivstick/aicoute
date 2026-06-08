-- Migration : GRANT service_role manquant sur app_settings
--
-- Cause : 20260608000001 a accordé SELECT/UPDATE à `authenticated` (back-office)
-- mais PAS à `service_role`. Or le voice-bridge lit app_settings avec la
-- SUPABASE_SERVICE_ROLE_KEY → « permission denied for table app_settings », donc
-- readAppSettings échouait en silence (retour neutre 0) et l'enregistrement de
-- calibration ne s'armait jamais malgré keepRec > 0 en base.
--
-- Même piège déjà rencontré sur system_events (…0008) et demo_calls
-- (20260526000002) : le service_role bypasse la RLS mais a besoin du GRANT
-- niveau-table.

GRANT SELECT, UPDATE ON app_settings TO service_role;
