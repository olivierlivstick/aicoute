-- Achats de packs de minutes (nouveau modèle : crédit de minutes).
-- Alimente l'onglet « Mes achats » + le calcul des minutes disponibles
-- (stock acheté − consommé). Vide tant que le paiement n'est pas branché (Stripe = phase 2).
CREATE TABLE IF NOT EXISTS minute_purchases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id      TEXT NOT NULL,            -- 'rendezvous' | 'lien' | 'presence'
  pack_name    TEXT NOT NULL,            -- libellé snapshot ('Le lien')
  minutes      INT  NOT NULL,            -- minutes créditées
  amount_eur   NUMERIC(10,2) NOT NULL,   -- montant payé en EUR
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minute_purchases_caregiver ON minute_purchases (caregiver_id, created_at DESC);

ALTER TABLE minute_purchases ENABLE ROW LEVEL SECURITY;

-- Table créée par migration brute → sans GRANT, PostgREST renvoie « permission denied »
-- AVANT d'évaluer la RLS (cf. CLAUDE.md). On accorde explicitement.
GRANT SELECT, INSERT ON minute_purchases TO authenticated;

-- L'aidant ne voit (et ne crée) que ses propres achats.
CREATE POLICY "caregiver_owns_purchases" ON minute_purchases
  USING (caregiver_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid());

-- Lecture admin (pour de futurs écrans d'administration).
CREATE POLICY "admin_select_purchases" ON minute_purchases
  FOR SELECT USING (is_admin());
