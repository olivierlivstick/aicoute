-- Migration : autorise les admins à MODIFIER les plannings d'appels
--
-- Contexte : l'onglet « Planning » de la fiche bénéficiaire admin
-- (/admin/beneficiaires/:id → BeneficiaryContextEditor withSchedule) permet
-- d'éditer/créer le planning récurrent (session_schedules) après confirmation.
-- L'admin avait déjà le SELECT (policy `admin_all_session_schedules`,
-- migration 20260529000003) mais pas INSERT/UPDATE/DELETE. On complète, en
-- réutilisant la fonction is_admin() existante (SECURITY DEFINER + STABLE).
--
-- Policies ADDITIVES : la policy aidant (couvre ALL pour SES bénéficiaires) et
-- le SELECT admin restent en place ; Postgres OU-ise les policies. L'éditeur
-- conserve le caregiver_id du bénéficiaire (pas celui de l'admin) côté client,
-- donc le planning reste rattaché au bon aidant.

DROP POLICY IF EXISTS "admin_insert_session_schedules" ON session_schedules;
CREATE POLICY "admin_insert_session_schedules" ON session_schedules
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_session_schedules" ON session_schedules;
CREATE POLICY "admin_update_session_schedules" ON session_schedules
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_session_schedules" ON session_schedules;
CREATE POLICY "admin_delete_session_schedules" ON session_schedules
  FOR DELETE
  USING (is_admin());
