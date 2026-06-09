-- Stripe — achat de minutes (modèle « bon d'achat / code à usage unique »).
--
-- Flux : la vitrine déclenche un paiement Stripe invité ; le webhook génère un
-- CODE et l'insère ici (+ email). L'aidant saisit ensuite le code dans le
-- back-office (Edge Fn `redeem-code`) → crédite `minute_purchases`.
--
-- Le CODE est le secret : cette table n'est JAMAIS exposée au client (pas de
-- GRANT anon/authenticated). Tout l'accès passe par les Edge Functions en
-- service-role (génération, lookup par session, crédit atomique).

CREATE TABLE IF NOT EXISTS minute_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,         -- ex. AICOUTE-7K3P-9QXM (alphabet sans ambiguïté)
  pack_id            TEXT NOT NULL,                -- 'rendezvous' | 'lien' | 'presence'
  pack_name          TEXT NOT NULL,                -- libellé snapshot ('Le lien')
  minutes            INT  NOT NULL,                -- minutes créditées à l'usage du code
  amount_eur         NUMERIC(10,2) NOT NULL,       -- montant payé en EUR
  buyer_email        TEXT,                         -- email de l'acheteur (Stripe) — support / renvoi
  stripe_session_id  TEXT NOT NULL UNIQUE,         -- idempotence : un webhook rejoué ne re-crée rien
  status             TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'redeemed'
                     CHECK (status IN ('active', 'redeemed')),
  redeemed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minute_codes_status ON minute_codes (status);

ALTER TABLE minute_codes ENABLE ROW LEVEL SECURITY;

-- AUCUN GRANT anon/authenticated : le client n'interroge jamais cette table
-- (pas d'énumération de codes possible). Le service-role (Edge Fn) a tous les
-- droits indépendamment de la RLS. On ouvre seulement la lecture admin pour un
-- futur écran d'administration.
CREATE POLICY "admin_select_minute_codes" ON minute_codes
  FOR SELECT USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Durcissement de minute_purchases : le crédit ne doit JAMAIS venir du client.
-- En l'état, un aidant connecté pouvait INSERT une ligne (WITH CHECK
-- caregiver_id = auth.uid()) et s'auto-créditer des minutes gratuites.
-- On retire ce droit : seul le service-role (webhook / redeem-code) crédite.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE INSERT ON minute_purchases FROM authenticated;

-- Traçabilité : par quel code cet achat a-t-il été crédité (NULL = achat direct
-- back-office, sans code).
ALTER TABLE minute_purchases ADD COLUMN IF NOT EXISTS source_code TEXT;

-- Idempotence du crédit DIRECT (achat back-office sans code) : un webhook Stripe
-- rejoué ne doit pas créditer deux fois. NULL pour les anciens achats et pour
-- les achats crédités via un code (l'idempotence est alors portée par
-- minute_codes.stripe_session_id). Les NULL sont distincts → UNIQUE OK.
ALTER TABLE minute_purchases ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_minute_purchases_session
  ON minute_purchases (stripe_session_id);

-- L'ancienne policy était FOR ALL (USING + WITH CHECK) → autorisait l'INSERT
-- client. On la remplace par une policy SELECT-only.
DROP POLICY IF EXISTS "caregiver_owns_purchases" ON minute_purchases;
CREATE POLICY "caregiver_owns_purchases" ON minute_purchases
  FOR SELECT USING (caregiver_id = auth.uid());
