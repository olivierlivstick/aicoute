-- Abonnements — rattachés au COMPTE AIDANT (un abonnement actif par compte ;
-- hypothèse mono-bénéficiaire pour l'instant).
--
-- Phase de test : essai gratuit (plan_tier='trial') = 3 appels/semaine pendant
-- 1 mois. Le compteur démarre au PREMIER APPEL (service_started_at, écrit par
-- l'Edge `initiate-call`), pas à la souscription. Le paiement réel des 3
-- forfaits (discovery/comfort/serenity) viendra en phase 2 (Stripe).
--
-- Bridage : `max_calls_per_week` (snapshot de la limite du forfait) borne le
-- planning (session_schedules.calls_per_week). Source de vérité du nombre
-- d'appels autorisés.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_tier          TEXT NOT NULL CHECK (plan_tier IN ('trial', 'discovery', 'comfort', 'serenity')),
  status             TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'canceled')),
  max_calls_per_week INT  NOT NULL CHECK (max_calls_per_week BETWEEN 1 AND 7),
  service_started_at TIMESTAMPTZ,   -- date du 1er appel (écrite une seule fois)
  trial_ends_at      TIMESTAMPTZ,   -- service_started_at + 1 mois (NULL tant qu'aucun appel)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Abonnement par compte aidant (mono-bénéficiaire). Essai gratuit 3 appels/sem pendant 1 mois à compter du 1er appel ; paiement réel en phase 2.';
COMMENT ON COLUMN subscriptions.service_started_at IS 'Horodatage du premier appel passé pour ce compte — écrit une seule fois par initiate-call. Origine du compte à rebours de l''essai.';
COMMENT ON COLUMN subscriptions.trial_ends_at IS 'Fin de l''essai gratuit = service_started_at + 1 mois. NULL tant qu''aucun appel n''a démarré le service.';

-- Un seul abonnement « vivant » (trial ou active) par compte.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_caregiver
  ON subscriptions (caregiver_id)
  WHERE status IN ('trial', 'active');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS : l'aidant gère uniquement sa propre ligne.
CREATE POLICY "caregiver_owns_subscription" ON subscriptions
  FOR ALL
  USING (caregiver_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid());

-- RLS : l'admin voit/gère tout (is_admin() défini en 20260529000003).
CREATE POLICY "admin_all_subscriptions" ON subscriptions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- GRANTs explicites : table créée par migration brute → sans GRANT, PostgREST
-- renvoie « permission denied » côté client AVANT d'évaluer la RLS (cf. bug
-- connu prompt_templates / system_events). Le service_role a ses propres
-- privilèges (Edge Functions).
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO authenticated;
