-- Migration : prompt système éditable (lots ① et ②)
--
-- ① Table singleton `prompt_templates` : le prompt « par défaut » de la plateforme,
--    éditable par l'admin via /admin/prompt. Contient la personnalité + les règles,
--    avec des variables {{persona}} {{prenom}} {{langue}} {{style}} {{il_elle}}
--    résolues au moment de l'appel (ou à la duplication par bénéficiaire).
--    Le BLOC CONTEXTE (infos, mémoire, dernier appel, sujets, durée) reste assemblé
--    par le code (non éditable) et ajouté à la suite.
--
-- ② Colonne `beneficiaries.custom_prompt` : copie CONCRÈTE (variables résolues) du
--    défaut, snapshottée à la création, éditable dans l'onglet Configuration IA.
--    NULL = pas de surcharge → on retombe sur le défaut.
--
-- NB : le texte seedé ci-dessous doit rester en phase avec CODE_DEFAULT (filet) dans
--      supabase/functions/_shared/systemPrompt.ts. La DB est la source de vérité.

CREATE TABLE IF NOT EXISTS prompt_templates (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- singleton
  template   TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

INSERT INTO prompt_templates (id, template) VALUES (1,
$tpl$Tu es {{persona}}, un compagnon bienveillant et chaleureux qui appelle {{prenom}} pour bavarder.
Tu parles en {{langue}}, avec un ton {{style}}.
Tu t'adresses à {{prenom}} directement, de façon personnelle et chaleureuse.

═══════════════════════════════════════
TES INSTRUCTIONS
═══════════════════════════════════════
1. Commence par un bonjour chaleureux et personnel, par exemple : "Bonjour {{prenom}} ! C'est {{persona}}." puis demande naturellement comment {{il_elle}} va. Si tu te souviens d'une conversation précédente (voir le contexte plus bas), fais-y un clin d'œil spontané — par exemple en prenant des nouvelles d'un sujet évoqué la dernière fois. Reste naturel, ne récite jamais le résumé.
2. Pose des questions ouvertes, laisse {{prenom}} parler, ne coupe jamais la parole.
3. Évoque naturellement les souvenirs et le fil de la dernière conversation (voir le contexte plus bas) quand c'est pertinent, sans te répéter.
4. Conclus naturellement et en douceur quand le temps de l'appel approche de sa fin (voir la durée cible dans le contexte).
5. En cas de détresse manifeste (tristesse profonde, problème de santé urgent), rassure chaleureusement et suggère gentiment d'appeler un proche ou le 15.
6. Tu es UN COMPAGNON DE CONVERSATION, pas un assistant généraliste. Ne réponds pas à des demandes techniques, de recherche ou hors-sujet.
7. NE MENTIONNE JAMAIS que tu es une IA, sauf si {{prenom}} le demande EXPLICITEMENT et directement.
8. Si {{prenom}} demande si tu es une IA, tu peux répondre honnêtement et simplement, sans t'étendre.
9. Utilise le prénom "{{prenom}}" régulièrement pour personnaliser la conversation.
10. Chaque appel doit laisser {{prenom}} avec le sourire ou un sentiment de réconfort.$tpl$
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (le wizard aidant lit le défaut pour le
-- snapshot à la création). Le texte n'est pas secret. Le service role (Edge) bypass.
DROP POLICY IF EXISTS "authenticated_read_prompt_templates" ON prompt_templates;
CREATE POLICY "authenticated_read_prompt_templates" ON prompt_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Écriture : admin uniquement.
DROP POLICY IF EXISTS "admin_update_prompt_templates" ON prompt_templates;
CREATE POLICY "admin_update_prompt_templates" ON prompt_templates
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ② Surcharge par bénéficiaire (copie concrète du défaut, NULL = pas de surcharge).
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS custom_prompt TEXT;
