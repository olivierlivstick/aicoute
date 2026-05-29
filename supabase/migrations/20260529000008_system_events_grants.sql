-- Migration : GRANTs manquants pour system_events
--
-- Cause : la migration 20260529000004 a ENABLE ROW LEVEL SECURITY + créé une
-- policy SELECT pour les admins, mais sans GRANT explicite. En théorie le
-- rôle service_role bypasse la RLS, mais il a quand même besoin du GRANT
-- niveau-table pour INSERT/SELECT. Sans ça, les Edge Functions et le
-- voice-bridge qui utilisent SUPABASE_SERVICE_ROLE_KEY reçoivent
-- « permission denied for table system_events ».
--
-- On garde la RLS active (la policy admin_select_system_events filtre les
-- lectures côté client back-office), on ajoute juste les GRANTs côté postgres.

GRANT INSERT, SELECT ON system_events TO service_role;
