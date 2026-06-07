-- Voix Gemini sélectionnable par bénéficiaire.
--
-- Jusqu'ici la voix Gemini était figée à 'Aoede' au niveau du voice-bridge
-- (env GEMINI_VOICE) et le choix par bénéficiaire n'existait que pour OpenAI
-- (colonne ai_voice). On ajoute une colonne dédiée afin que chaque moteur
-- garde sa propre voix retenue.
--
-- Pas de contrainte CHECK : le catalogue de voix est amené à évoluer ; la
-- validation se fait en code (packages/shared/src/voices.ts côté web,
-- _shared/callContext.ts côté edge) avec repli sûr sur le défaut.

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS gemini_voice TEXT NOT NULL DEFAULT 'Aoede';
