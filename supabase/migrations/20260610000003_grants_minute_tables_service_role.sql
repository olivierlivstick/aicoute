-- Sur ce projet, le service_role n'hérite PAS automatiquement des privilèges sur
-- les tables créées par migration brute (même piège que app_settings, cf.
-- migration …0002 et CLAUDE.md « Bugs connus »). Les Edge Functions écrivent en
-- service-role → sans GRANT explicite, l'INSERT échoue en « permission denied ».
--
-- Symptôme rencontré : crédit admin → « permission denied for table
-- minute_adjustments ». Aurait aussi touché le webhook Stripe (minute_codes) et
-- le crédit de code (minute_purchases). On accorde tout au service_role (qui
-- contourne de toute façon la RLS).

GRANT ALL ON minute_adjustments TO service_role;
GRANT ALL ON minute_codes       TO service_role;
GRANT ALL ON minute_purchases   TO service_role;
