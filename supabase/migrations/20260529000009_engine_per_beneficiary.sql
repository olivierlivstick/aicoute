-- Migration : moteur conversationnel par bénéficiaire + trace par appel
--
-- Lot 5 du chantier appels planifiés. Permet de choisir OpenAI ou Gemini par
-- bénéficiaire dans /contexte → Configuration IA. Chaque call écrit le moteur
-- effectivement utilisé pour traçabilité / facturation / debug.

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS preferred_engine TEXT NOT NULL DEFAULT 'openai'
    CHECK (preferred_engine IN ('openai', 'gemini'));

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS engine TEXT
    CHECK (engine IS NULL OR engine IN ('openai', 'gemini'));

-- Index sur calls.engine pour les futurs filtres /admin/appels et stats.
CREATE INDEX IF NOT EXISTS idx_calls_engine ON calls(engine) WHERE engine IS NOT NULL;
