-- Prompt éditable propre à une campagne (onglet Administratif). C'est un TEMPLATE
-- (il garde les variables {{persona}} {{prenom}} {{langue}} {{style}} {{il_elle}},
-- résolues à chaque appel) car une campagne sert plusieurs bénéficiaires.
-- Cascade à l'appel : custom_prompt (édité) → prompt_id (bibliothèque) → défaut langue.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS custom_prompt TEXT;
COMMENT ON COLUMN campaigns.custom_prompt IS 'Prompt (template à variables) propre à la campagne, éditable. NULL → on utilise prompt_id, sinon le défaut de la langue.';
