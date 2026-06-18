-- Migration : suivi des « signaux faibles » graves (page /admin/signaux).
--
-- Contexte : `generate-summary` écrit des signaux faibles dans `calls.alerts`
-- (JSONB `[{category, severity, evidence}]`). La page /admin/signaux regroupe
-- tous les appels portant AU MOINS un signal `severity='high'` pour que l'équipe
-- AICOUTE puisse AGIR (prévenir l'aidant) et GARDER LA TRACE des actions menées.
--
-- Modèle (décision produit 2026-06-18) : suivi AU NIVEAU DE L'APPEL (un appel =
-- une ligne dans la page, même s'il porte plusieurs signaux). On veut un JOURNAL
-- append-only « qui / quand / quoi » plutôt qu'un simple booléen « traité ».
--
-- Table `signal_actions` = une ligne PAR ACTION (entrée de journal) :
--   - le STATUT COURANT d'un appel = le `status` de son action la PLUS RÉCENTE ;
--   - un appel sans aucune action est implicitement « à traiter » (todo) ;
--   - rien n'est jamais modifié ni supprimé (intégrité de l'audit) → pas de
--     policy UPDATE/DELETE pour authenticated.
--
-- Réservé aux admins (is_admin(), cf. 20260529000003). `author_id` est forcé à
-- auth.uid() côté policy (WITH CHECK) → impossible de signer une action au nom
-- d'un autre. `author_name` est un SNAPSHOT du nom au moment de l'action (pour
-- que le journal reste lisible même si le profil change/disparaît plus tard).

CREATE TABLE IF NOT EXISTS signal_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'dismissed')),
  comment     TEXT NOT NULL DEFAULT '',
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  author_name TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lecture par appel, plus récent d'abord (statut courant + journal).
CREATE INDEX IF NOT EXISTS idx_signal_actions_call
  ON signal_actions (call_id, created_at DESC);

ALTER TABLE signal_actions ENABLE ROW LEVEL SECURITY;

-- Lecture : admins uniquement.
DROP POLICY IF EXISTS "admin_select_signal_actions" ON signal_actions;
CREATE POLICY "admin_select_signal_actions" ON signal_actions
  FOR SELECT
  USING (is_admin());

-- Écriture : admins uniquement, et toujours signée par l'auteur connecté.
DROP POLICY IF EXISTS "admin_insert_signal_actions" ON signal_actions;
CREATE POLICY "admin_insert_signal_actions" ON signal_actions
  FOR INSERT
  WITH CHECK (is_admin() AND author_id = auth.uid());

-- GRANTs explicites (table créée par migration brute → pas de privilèges hérités,
-- cf. CLAUDE.md « Table créée par migration SQL brute = pas de GRANT »).
GRANT SELECT, INSERT ON signal_actions TO authenticated;
GRANT ALL ON signal_actions TO service_role;
