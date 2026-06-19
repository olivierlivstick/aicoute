-- Lot 4 dashboard ORGANISATION : la page Signaux côté org (et aidant) doit pouvoir
-- LIRE et JOURNALISER le suivi des signaux de SES propres appels.
--
-- Jusqu'ici `signal_actions` était admin-only (20260618000003). On ajoute des
-- policies ADDITIVES pour le PROPRIÉTAIRE = l'aidant/organisation à qui appartient
-- le bénéficiaire de l'appel. `author_id` reste forcé à auth.uid() (pas
-- d'usurpation), `author_name` reste un snapshot. Modèle append-only inchangé
-- (toujours pas d'UPDATE/DELETE pour authenticated).
--
-- GRANTs déjà posés par 20260618000003 (authenticated : SELECT, INSERT).

DROP POLICY IF EXISTS "caregiver_select_signal_actions" ON signal_actions;
CREATE POLICY "caregiver_select_signal_actions" ON signal_actions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls c
    JOIN beneficiaries b ON b.id = c.beneficiary_id
    WHERE c.id = signal_actions.call_id AND b.caregiver_id = auth.uid()
  ));

DROP POLICY IF EXISTS "caregiver_insert_signal_actions" ON signal_actions;
CREATE POLICY "caregiver_insert_signal_actions" ON signal_actions
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM calls c
      JOIN beneficiaries b ON b.id = c.beneficiary_id
      WHERE c.id = signal_actions.call_id AND b.caregiver_id = auth.uid()
    )
  );
