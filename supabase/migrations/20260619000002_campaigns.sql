-- Lot 2 dashboard ORGANISATION : modèle de données des CAMPAGNES d'appels en masse.
--
-- Une campagne = un lot de bénéficiaires appelés UNE fois (avec relances si pas
-- de réponse) pendant une fenêtre de dates + une plage horaire quotidienne, en
-- respectant une limite d'appels SIMULTANÉS propre à la campagne. Le déclenchement
-- réel (file d'appels) est le Lot 3 ; ici on pose le schéma + l'UI CRUD.
--
-- Toutes les tables sont créées en migration brute → GRANT explicites obligatoires
-- (cf. CLAUDE.md : sinon PostgREST « permission denied » AVANT la RLS, et le
-- service_role n'hérite pas non plus). L'org écrit DIRECTEMENT via le client (RLS) ;
-- le service_role est requis pour le worker de dispatch (Lot 3).

-- ── campaigns ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title        TEXT NOT NULL,
  comment      TEXT,

  starts_on    DATE,
  ends_on      DATE,

  -- Prompt (paire de la bibliothèque) utilisé pour tous les appels de la campagne.
  prompt_id    UUID REFERENCES prompts(id) ON DELETE SET NULL,
  -- Langue de conversation (la campagne la porte ; bénéficiaires « légers »).
  language     TEXT NOT NULL DEFAULT 'fr',

  -- Plage horaire quotidienne d'émission des appels (dans `timezone`).
  daily_start_time TIME NOT NULL DEFAULT '09:00',
  daily_end_time   TIME NOT NULL DEFAULT '18:00',
  timezone     TEXT NOT NULL DEFAULT 'Europe/Paris',

  -- Limite d'appels SIMULTANÉS de la campagne (cœur du moteur Lot 3).
  max_concurrent_calls INT NOT NULL DEFAULT 1 CHECK (max_concurrent_calls >= 1),
  -- Durée maximale d'un appel (minutes) → coupure dure côté voice-bridge.
  max_call_minutes     INT NOT NULL DEFAULT 5 CHECK (max_call_minutes >= 1),

  -- Politique de relance si pas de réponse (éditable dans l'onglet Administratif).
  retry_count            INT NOT NULL DEFAULT 2 CHECK (retry_count >= 0),
  retry_interval_minutes INT NOT NULL DEFAULT 60 CHECK (retry_interval_minutes >= 1),

  status       TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'completed')),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status) WHERE status = 'running';

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO authenticated;
GRANT ALL ON campaigns TO service_role;

CREATE POLICY "org_owns_campaigns" ON campaigns
  FOR ALL USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());
CREATE POLICY "admin_select_campaigns" ON campaigns
  FOR SELECT USING (is_admin());

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── campaign_beneficiaries (jointure) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_beneficiaries (
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_beneficiaries_benef
  ON campaign_beneficiaries (beneficiary_id);

ALTER TABLE campaign_beneficiaries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON campaign_beneficiaries TO authenticated;
GRANT ALL ON campaign_beneficiaries TO service_role;

-- Accès si la campagne appartient à l'organisation courante.
CREATE POLICY "org_owns_campaign_beneficiaries" ON campaign_beneficiaries
  FOR ALL
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.org_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.org_id = auth.uid()));
CREATE POLICY "admin_select_campaign_beneficiaries" ON campaign_beneficiaries
  FOR SELECT USING (is_admin());

-- ── campaign_activity_periods (segments GO→PAUSE) ────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_activity_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_periods_campaign
  ON campaign_activity_periods (campaign_id, started_at DESC);

ALTER TABLE campaign_activity_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON campaign_activity_periods TO authenticated;
GRANT ALL ON campaign_activity_periods TO service_role;

CREATE POLICY "org_owns_campaign_periods" ON campaign_activity_periods
  FOR ALL
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.org_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.org_id = auth.uid()));
CREATE POLICY "admin_select_campaign_periods" ON campaign_activity_periods
  FOR SELECT USING (is_admin());

-- ── calls : rattachement à une campagne + nouvelle origine ───────────────────
-- Les appels de campagne sont des SORTANTS sans schedule_id, avec campaign_id et
-- origin='campaign'. ON DELETE SET NULL : supprimer une campagne ne détruit pas
-- l'historique d'appels (on garde la trace, juste détachée).
ALTER TABLE calls ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_origin_check;
ALTER TABLE calls ADD CONSTRAINT calls_origin_check
  CHECK (origin IN ('scheduled', 'inbound', 'campaign'));

COMMENT ON COLUMN calls.campaign_id IS 'Campagne d''origine (org). NULL = appel hors campagne (aidant). ON DELETE SET NULL.';

-- Index du dispatcher Lot 3 : appels en vol par campagne + comptage par statut.
CREATE INDEX IF NOT EXISTS idx_calls_campaign
  ON calls (campaign_id, status)
  WHERE campaign_id IS NOT NULL;
