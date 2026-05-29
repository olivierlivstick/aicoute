-- Migration : édition + suppression depuis le back-office admin
--
-- 1. Permet à un admin de MODIFIER et SUPPRIMER un bénéficiaire (RLS additive).
-- 2. Ajoute ON DELETE CASCADE sur calls.beneficiary_id pour que l'effacement
--    définitif d'un bénéficiaire emporte son historique d'appels (sinon la FK
--    bloque le DELETE). session_schedules + conversation_memory cascadent déjà.
--
-- NB : l'édition et la suppression d'un AIDANT (profiles + auth.users) ne passent
-- PAS par la RLS mais par les Edge Functions admin-update-caregiver /
-- admin-delete-caregiver (service role), car :
--   - changer l'email doit se propager à auth.users.email (service role only) ;
--   - supprimer le compte doit supprimer auth.users (cascade vers profiles).
-- On ne crée donc volontairement aucune policy UPDATE/DELETE sur profiles ici.

-- ============================================================================
-- 1. Cascade calls → permet l'effacement définitif d'un bénéficiaire
-- ============================================================================
-- La FK d'origine (migration 004) était sans action → un bénéficiaire ayant des
-- appels ne pouvait pas être supprimé. On la recrée en CASCADE.

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_beneficiary_id_fkey;
ALTER TABLE calls
  ADD CONSTRAINT calls_beneficiary_id_fkey
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. Policies admin sur beneficiaries (additives ; OU-isées avec caregiver_owns)
-- ============================================================================

DROP POLICY IF EXISTS "admin_update_beneficiaries" ON beneficiaries;
CREATE POLICY "admin_update_beneficiaries" ON beneficiaries
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_beneficiaries" ON beneficiaries;
CREATE POLICY "admin_delete_beneficiaries" ON beneficiaries
  FOR DELETE
  USING (is_admin());
