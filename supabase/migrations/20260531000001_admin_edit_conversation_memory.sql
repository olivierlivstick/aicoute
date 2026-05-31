-- Migration : autorise les admins à MODIFIER la mémoire des bénéficiaires
--
-- Contexte : le panneau « Mémoire » de la fiche bénéficiaire (onglet de
-- BeneficiaryContextEditor) est éditable côté admin via /admin/beneficiaires/:id.
-- L'admin avait déjà le SELECT (policy `admin_all_conversation_memory`,
-- migration 20260529000003) mais pas INSERT/UPDATE/DELETE. On complète, en
-- réutilisant la fonction is_admin() existante (SECURITY DEFINER + STABLE).
--
-- Policies ADDITIVES : la policy aidant `caregiver_owns_memory` (couvre ALL
-- pour les bénéficiaires de l'aidant) et le SELECT admin restent en place ;
-- Postgres OU-ise les policies.

DROP POLICY IF EXISTS "admin_insert_conversation_memory" ON conversation_memory;
CREATE POLICY "admin_insert_conversation_memory" ON conversation_memory
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_conversation_memory" ON conversation_memory;
CREATE POLICY "admin_update_conversation_memory" ON conversation_memory
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_conversation_memory" ON conversation_memory;
CREATE POLICY "admin_delete_conversation_memory" ON conversation_memory
  FOR DELETE
  USING (is_admin());
