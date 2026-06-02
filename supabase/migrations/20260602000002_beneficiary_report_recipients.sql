-- Destinataires supplémentaires des emails de compte-rendu.
--
-- Cas d'usage : l'aidant principal « gère » sa mère (bénéficiaire) mais souhaite
-- que ses 2 frères reçoivent aussi l'email post-appel. On stocke leurs adresses
-- dans un tableau sur le bénéficiaire. L'email post-appel part alors à
-- l'aidant + ces adresses (cf. generate-summary / resend-report).
--
-- L'opt-in global `notify_call_report` continue de gouverner l'envoi : s'il est
-- désactivé, personne (ni aidant ni destinataires) ne reçoit l'email.

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS report_recipients TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN beneficiaries.report_recipients IS 'Adresses email supplémentaires (proches) qui reçoivent l''email de compte-rendu en plus de l''aidant. Vide par défaut.';
