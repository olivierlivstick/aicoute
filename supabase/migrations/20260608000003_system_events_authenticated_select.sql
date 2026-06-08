-- Migration : GRANT SELECT system_events manquant pour `authenticated`
--
-- Cause : 20260529000008 a accordé INSERT/SELECT à `service_role` (écriture
-- voice-bridge/edge) mais PAS le SELECT à `authenticated`. Du coup le back-office
-- (client admin = authenticated) reçoit « permission denied for table
-- system_events » AVANT même la RLS → la section « Événements système » de
-- /admin/sante ET la liste des enregistrements de calibration (qui lit
-- system_events.source='voice-bridge/fluidity-diag') renvoyaient toujours vide.
--
-- La policy admin_select_system_events (is_admin()) restreint déjà la lecture aux
-- admins ; on ajoute juste le GRANT niveau-table.

GRANT SELECT ON system_events TO authenticated;
