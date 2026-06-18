-- Migration : BIBLIOTHÈQUE DE PROMPTS sélectionnables
--
-- Remplace le défaut UNIQUE (singleton `prompt_templates`) par une BIBLIOTHÈQUE
-- de prompts segmentés par LANGUE + TYPE (`kind`), avec un défaut par couple.
--   - kind = 'outbound' : personnalité + règles (AICOUTE appelle le bénéficiaire)
--                         → ex-`prompt_templates.template`
--   - kind = 'inbound'  : ouverture des appels entrants (le bénéficiaire appelle)
--                         → ex-`prompt_templates.inbound_opening`
--
-- `is_default` désigne le prompt proposé par défaut dans les menus déroulants
-- (onboarding / fiche bénéficiaire / admin) POUR un couple (langue, type) ET sert
-- de FALLBACK côté Edge (cascade : custom_prompt bénéficiaire → défaut bibliothèque
-- (langue, kind) → défaut bibliothèque (fr, kind) → CODE_DEFAULT_* codé en dur).
--
-- Le mécanisme « copie concrète éditable » par bénéficiaire ne change pas :
-- `beneficiaries.custom_prompt` / `inbound_custom_prompt` restent les snapshots
-- résolus, éditables. On ajoute seulement la MÉMOIRE du prompt source choisi
-- (`custom_prompt_id` / `inbound_prompt_id`) pour réafficher la sélection.
--
-- ⚠️ Les textes par défaut restent dupliqués en filet codé : CODE_DEFAULT_TEMPLATE
--    / CODE_DEFAULT_INBOUND_OPENING (edge) + DEFAULT_PROMPT_TEMPLATE /
--    DEFAULT_INBOUND_OPENING (shared). La bibliothèque est désormais la source
--    sélectionnable ; le code reste l'ultime garde-fou.

CREATE TABLE IF NOT EXISTS prompts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  language    TEXT NOT NULL CHECK (language IN ('fr', 'en', 'es', 'de', 'it')),
  kind        TEXT NOT NULL CHECK (kind IN ('outbound', 'inbound')),
  body        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

-- Un SEUL défaut par (langue, type). Index partiel → on ne fait JAMAIS d'ON CONFLICT
-- dessus (cf. piège connu PostgREST) : la mise en défaut se fait en 2 temps côté
-- Edge admin-prompts (dé-cocher les autres PUIS cocher).
CREATE UNIQUE INDEX IF NOT EXISTS prompts_one_default_per_lang_kind
  ON prompts (language, kind) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_prompts_lang_kind ON prompts (language, kind);

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

-- Seed : migre le contenu du singleton `prompt_templates` → défauts fr (2 types).
INSERT INTO prompts (title, language, kind, body, is_default)
SELECT 'Compagnon chaleureux', 'fr', 'outbound', t.template, true
FROM prompt_templates t
WHERE t.id = 1
  AND NOT EXISTS (SELECT 1 FROM prompts WHERE language = 'fr' AND kind = 'outbound');

INSERT INTO prompts (title, language, kind, body, is_default)
SELECT 'Accueil chaleureux', 'fr', 'inbound', t.inbound_opening, true
FROM prompt_templates t
WHERE t.id = 1 AND t.inbound_opening IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM prompts WHERE language = 'fr' AND kind = 'inbound');

-- Mémoire du prompt source choisi par bénéficiaire. Le texte CONCRET reste dans
-- custom_prompt / inbound_custom_prompt (éditable). ON DELETE SET NULL : supprimer
-- un prompt de la bibliothèque ne casse pas un bénéficiaire (il garde sa copie).
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS custom_prompt_id  UUID REFERENCES prompts(id) ON DELETE SET NULL;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS inbound_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

COMMENT ON TABLE prompts IS 'Bibliothèque de prompts sélectionnables (titre + langue + kind). kind=outbound (personnalité, AICOUTE appelle) | inbound (ouverture, le bénéficiaire appelle). is_default = proposé par défaut pour (langue, type) ET fallback edge.';
COMMENT ON COLUMN beneficiaries.custom_prompt_id  IS 'Prompt de la bibliothèque (kind=outbound) choisi comme source du snapshot custom_prompt. NULL = défaut plateforme.';
COMMENT ON COLUMN beneficiaries.inbound_prompt_id IS 'Prompt de la bibliothèque (kind=inbound) choisi comme source du snapshot inbound_custom_prompt. NULL = défaut plateforme.';
