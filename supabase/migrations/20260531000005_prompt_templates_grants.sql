-- Migration : GRANTs manquants pour prompt_templates
--
-- Cause : la table a été créée par migration SQL brute avec RLS activée, mais
-- sans GRANT niveau-table pour anon/authenticated. PostgREST refuse l'accès
-- AVANT d'évaluer la RLS → « permission denied for table prompt_templates »
-- sur /admin/prompt (lecture) et au snapshot wizard. (service_role a déjà les
-- privilèges, d'où le bon fonctionnement côté Edge.)
--
-- SELECT ouvert (template non secret, RLS read = USING(true)).
-- UPDATE pour authenticated, restreint aux admins par la policy
-- admin_update_prompt_templates (is_admin()).

GRANT SELECT ON prompt_templates TO anon, authenticated;
GRANT UPDATE ON prompt_templates TO authenticated;
