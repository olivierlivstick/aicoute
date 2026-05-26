-- Coût OpenAI RÉEL par appel (basé sur les events response.done) en plus
-- de l'estimation actuelle (openai_cost_eur, basée sur la durée). Permet de
-- comparer les deux et d'auditer la précision de l'approximation.
-- Mesuré uniquement pour le mode téléphone (le mode web continue d'utiliser
-- l'estimation par durée tant que le browser n'accumule pas les tokens).
--
-- Les colonnes restent NULL pour les rows existantes et pour les démos web ;
-- le dashboard /track_calls affiche "—" dans ces cas-là.

ALTER TABLE demo_calls
  ADD COLUMN IF NOT EXISTS openai_cost_eur_real      numeric(8, 4),
  ADD COLUMN IF NOT EXISTS tokens_input_audio        integer,
  ADD COLUMN IF NOT EXISTS tokens_input_audio_cached integer,
  ADD COLUMN IF NOT EXISTS tokens_output_audio       integer,
  ADD COLUMN IF NOT EXISTS tokens_input_text         integer,
  ADD COLUMN IF NOT EXISTS tokens_output_text        integer;

COMMENT ON COLUMN demo_calls.openai_cost_eur_real      IS 'Coût OpenAI calculé depuis les events response.done (tokens réels). NULL = inconnu (ancienne row, mode web, ou échec tracking).';
COMMENT ON COLUMN demo_calls.tokens_input_audio        IS 'Audio input tokens NON CACHÉS (cumul sur tous les response.done de l''appel).';
COMMENT ON COLUMN demo_calls.tokens_input_audio_cached IS 'Audio input tokens CACHÉS (tarif réduit ×80).';
COMMENT ON COLUMN demo_calls.tokens_output_audio       IS 'Audio output tokens.';
COMMENT ON COLUMN demo_calls.tokens_input_text         IS 'Text input tokens (généralement faibles, ex: instructions de session.update).';
COMMENT ON COLUMN demo_calls.tokens_output_text        IS 'Text output tokens (généralement faibles).';
