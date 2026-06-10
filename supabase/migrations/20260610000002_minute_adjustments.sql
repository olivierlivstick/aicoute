-- Ajustements manuels de minutes (geste commercial, cadeau, test prolongé…)
-- crédités par un admin depuis /admin/comptes/:id.
--
-- Table SÉPARÉE de minute_purchases : un cadeau n'est pas un achat (ni prix ni
-- pack). Alimente la carte « Minutes disponibles » + le relevé « Mon solde »
-- (calculés à la volée → la ligne « Minutes offertes » apparaît automatiquement
-- dans le relevé de l'aidant, par transparence).
--
-- `minutes` est SIGNÉ (crédit > 0) : l'UI ne propose que du crédit pour l'instant,
-- mais le schéma permet une correction/reprise plus tard sans migration.

CREATE TABLE IF NOT EXISTS minute_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minutes      INT  NOT NULL,            -- signé : crédit > 0
  reason       TEXT NOT NULL,            -- motif (obligatoire, traçabilité)
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- admin auteur
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minute_adjustments_caregiver
  ON minute_adjustments (caregiver_id, created_at DESC);

ALTER TABLE minute_adjustments ENABLE ROW LEVEL SECURITY;

-- Table créée par migration brute → GRANT explicite sinon PostgREST renvoie
-- « permission denied » AVANT la RLS (cf. CLAUDE.md). Lecture client seulement :
-- l'écriture passe par l'Edge Fn admin-credit-minutes (service-role).
GRANT SELECT ON minute_adjustments TO authenticated;

-- L'aidant lit SES ajustements (pour le relevé).
CREATE POLICY "caregiver_owns_adjustments" ON minute_adjustments
  FOR SELECT USING (caregiver_id = auth.uid());

-- L'admin lit tout.
CREATE POLICY "admin_select_adjustments" ON minute_adjustments
  FOR SELECT USING (is_admin());
