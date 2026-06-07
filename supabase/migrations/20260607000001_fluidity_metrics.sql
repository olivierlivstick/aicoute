-- Étape 0 « observabilité fluidité » : un snapshot technique par appel, écrit
-- par le voice-bridge en fin d'appel (best-effort). Pure observation — aucun
-- réglage automatique. Analysé manuellement via le CTA « Qualité » de
-- /admin/appels (table calls) et de /track_calls (table demo_calls).
--
-- Forme du JSON (cf. services/voice-bridge/src/engines/fluidity.js) :
--   { engine, duration_seconds, turns:{assistant,user},
--     blank:{ start_ms, turn_avg_ms, turn_p90_ms, turn_max_ms, samples,
--             samples_ms:[…], approx },
--     barge_in:{ total, per_min, suspected_false },
--     presence_checks:{ count, matches:[…] } | null,
--     assistant_speech_ms, speech_ratio }
--
-- Nullable : appels antérieurs, missed/failed (pas de conversation) → NULL.
-- Pas de GRANT nécessaire (colonnes ajoutées à des tables déjà exposées) ; la
-- lecture admin de calls passe par les policies admin existantes, demo_calls
-- par l'Edge Function list-demos (service-role).

ALTER TABLE public.calls      ADD COLUMN IF NOT EXISTS fluidity_metrics JSONB;
ALTER TABLE public.demo_calls ADD COLUMN IF NOT EXISTS fluidity_metrics JSONB;

COMMENT ON COLUMN public.calls.fluidity_metrics      IS 'Snapshot technique de fluidité de l''appel (latence prise de parole, barge-ins, présence). Écrit par le voice-bridge en fin d''appel. NULL si pas de conversation.';
COMMENT ON COLUMN public.demo_calls.fluidity_metrics IS 'Idem calls.fluidity_metrics, pour les démos vitrine.';
