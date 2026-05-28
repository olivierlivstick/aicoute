-- Discriminant du moteur conversationnel utilisé pour chaque démo vitrine.
-- Permet d'A/B tester OpenAI Realtime vs Google Gemini Live et de comparer
-- coût / qualité par moteur. Les rows existantes ont toutes été créées avec
-- OpenAI → DEFAULT 'openai' (le ADD COLUMN ... DEFAULT remplit les rows
-- existantes en place côté Postgres ≥ 11, pas de backfill manuel à faire).

ALTER TABLE demo_calls
  ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'openai'
    CHECK (engine IN ('openai', 'gemini'));

COMMENT ON COLUMN demo_calls.engine IS 'Moteur Realtime utilisé : openai (gpt-realtime-2) ou gemini (gemini-2.5-flash-native-audio). Les colonnes tokens_* et openai_cost_eur_real sont réutilisées pour les deux moteurs et discriminées par cette colonne.';
