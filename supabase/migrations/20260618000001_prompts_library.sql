-- Migration : BIBLIOTHÈQUE DE PROMPTS sélectionnables (modèle PAIRE)
--
-- Remplace le défaut UNIQUE (singleton `prompt_templates`) par une BIBLIOTHÈQUE
-- de prompts. **Un prompt = une PAIRE** (les deux vont ensemble) :
--   - `outbound_body` : personnalité + règles (AICOUTE appelle le bénéficiaire)
--                       → ex-`prompt_templates.template`
--   - `inbound_body`  : ouverture des appels entrants (le bénéficiaire appelle)
--                       → ex-`prompt_templates.inbound_opening`
-- Chaque paire a un titre, une langue, une date. Créer un prompt = créer la paire.
--
-- `is_default` désigne la paire proposée par défaut (un défaut PAR LANGUE) dans les
-- menus déroulants (onboarding / fiche / admin) ET sert de FALLBACK côté Edge
-- (cascade : custom_prompt bénéficiaire → défaut paire (langue) → défaut paire (fr)
-- → CODE_DEFAULT_* codé en dur).
--
-- Le mécanisme « copie concrète éditable » par bénéficiaire ne change pas :
-- `beneficiaries.custom_prompt` / `inbound_custom_prompt` restent les snapshots
-- résolus, éditables. On ajoute `beneficiaries.prompt_id` = la PAIRE source choisie.
--
-- ⚠️ Les textes par défaut restent dupliqués en filet codé : CODE_DEFAULT_TEMPLATE
--    / CODE_DEFAULT_INBOUND_OPENING (edge) + DEFAULT_PROMPT_TEMPLATE /
--    DEFAULT_INBOUND_OPENING (shared). La bibliothèque est la source sélectionnable ;
--    le code reste l'ultime garde-fou.

CREATE TABLE IF NOT EXISTS prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  language      TEXT NOT NULL CHECK (language IN ('fr', 'en', 'es', 'de', 'it')),
  outbound_body TEXT NOT NULL,   -- appel émis par AICOUTE (personnalité + règles)
  inbound_body  TEXT NOT NULL,   -- appel entrant (ouverture quand le bénéficiaire appelle)
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES profiles(id)
);

-- Une SEULE paire par défaut PAR LANGUE. Index partiel → on ne fait JAMAIS d'ON
-- CONFLICT dessus (cf. piège connu PostgREST) : la mise en défaut se fait en 2 temps
-- côté Edge admin-prompts (dé-cocher les autres PUIS cocher).
CREATE UNIQUE INDEX IF NOT EXISTS prompts_one_default_per_lang
  ON prompts (language) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_prompts_language ON prompts (language);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authentifié (menus déroulants wizard / fiche + admin). Pas secret.
DROP POLICY IF EXISTS "authenticated_read_prompts" ON prompts;
CREATE POLICY "authenticated_read_prompts" ON prompts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Écriture : admin. Les writes passent surtout par l'Edge `admin-prompts` en
-- service-role (gestion atomique du défaut) ; cette policy couvre un accès direct.
DROP POLICY IF EXISTS "admin_write_prompts" ON prompts;
CREATE POLICY "admin_write_prompts" ON prompts
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- GRANTs (table créée par migration brute → sans GRANT, PostgREST = « permission
-- denied » AVANT la RLS ; le service_role n'hérite pas non plus → GRANT explicite).
GRANT SELECT ON prompts TO anon, authenticated;
GRANT ALL    ON prompts TO service_role;

-- Seed : migre le contenu du singleton `prompt_templates` → paire fr par défaut.
INSERT INTO prompts (title, language, outbound_body, inbound_body, is_default)
SELECT 'Compagnon chaleureux', 'fr', t.template, t.inbound_opening, true
FROM prompt_templates t
WHERE t.id = 1 AND t.template IS NOT NULL AND t.inbound_opening IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM prompts WHERE language = 'fr');

-- Mémoire de la PAIRE source choisie par bénéficiaire. Le texte CONCRET reste dans
-- custom_prompt / inbound_custom_prompt (éditable). ON DELETE SET NULL : supprimer
-- une paire de la bibliothèque ne casse pas un bénéficiaire (il garde ses copies).
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

COMMENT ON TABLE prompts IS 'Bibliothèque de prompts sélectionnables. Un prompt = une PAIRE (outbound_body = personnalité/AICOUTE appelle ; inbound_body = ouverture/le bénéficiaire appelle), dans une langue. is_default = paire par défaut pour la langue (1 par langue) ET fallback edge.';
COMMENT ON COLUMN beneficiaries.prompt_id IS 'Paire de prompts (table prompts) choisie comme source des snapshots custom_prompt + inbound_custom_prompt. NULL = défaut plateforme.';
