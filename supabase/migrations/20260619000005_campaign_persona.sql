-- Lot 5+ : prénom que l'IA utilise pour SE PRÉSENTER pendant les appels de la
-- campagne (variable {{persona}} du prompt). Porté par la campagne — les
-- bénéficiaires d'org sont « légers » et n'ont pas de persona propre.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_persona_name TEXT NOT NULL DEFAULT 'Marie';
COMMENT ON COLUMN campaigns.ai_persona_name IS 'Prénom que l''IA utilise pour se présenter ({{persona}}) sur tous les appels de la campagne.';
