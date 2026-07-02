-- Offre « Le contrôle » — abonnement mensuel Stripe (18 €/mois) : 1 appel de
-- contrôle par jour + email aux proches si non-réponse.
--
-- Parcours « paiement d'abord » : au moment du paiement le compte n'existe pas
-- encore. L'abonnement Stripe est donc RETENU dans pending_control_subscriptions
-- (écrit par stripe-webhook), puis RATTACHÉ au compte à la création
-- (Edge claim-control-subscription), qui pose alors la ligne subscriptions
-- (plan_tier='controle') sur le compte aidant.

-- 1) Nouveau palier 'controle' sur subscriptions + ids Stripe (gestion future).
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_tier_check
  CHECK (plan_tier IN ('trial', 'discovery', 'comfort', 'serenity', 'controle'));

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN subscriptions.stripe_customer_id     IS 'Customer Stripe (abonnement « Le contrôle »). NULL pour les paliers non payants.';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Subscription Stripe récurrente (abonnement « Le contrôle »). NULL sinon.';

-- 2) Abonnements « Le contrôle » payés AVANT la création du compte (invité).
--    Jamais exposés au client : le prefill email de l'inscription passe par une
--    Edge service-role (get-control-checkout), le rattachement par une autre
--    (claim-control-subscription). RLS admin-only en lecture (audit).
CREATE TABLE IF NOT EXISTS pending_control_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id      TEXT NOT NULL UNIQUE,   -- idempotence webhook + clé de rattachement
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  buyer_email            TEXT,
  amount_eur             NUMERIC(10,2),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'claimed', 'canceled')),
  caregiver_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pending_control_subscriptions IS 'Abonnements « Le contrôle » payés via Stripe AVANT la création du compte (parcours paiement-d''abord). Rattachés au compte à l''inscription par claim-control-subscription. Accès client interdit → tout passe par des Edge Functions service-role.';

-- Rattachement de secours par email (si le session_id est perdu, ex. inscription
-- depuis un autre navigateur) : recherche des 'pending' par email normalisé.
CREATE INDEX IF NOT EXISTS idx_pending_control_email
  ON pending_control_subscriptions (lower(buyer_email))
  WHERE status = 'pending';

ALTER TABLE pending_control_subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement (is_admin() défini en 20260529000003). Aucune policy
-- d'écriture → écriture réservée au service_role (webhook + claim).
CREATE POLICY "admin_select_pending_control" ON pending_control_subscriptions
  FOR SELECT USING (is_admin());

-- GRANTs explicites (table créée par migration brute — cf. bug connu : sans
-- GRANT, PostgREST renvoie « permission denied » AVANT la RLS ; et le
-- service_role n'hérite pas des privilèges par défaut sur ce projet).
GRANT SELECT ON pending_control_subscriptions TO authenticated;             -- filtré par la RLS admin
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_control_subscriptions TO service_role;
