-- Migration : idempotence de l'envoi du rapport email post-appel
--
-- Empêche le double envoi si generate-summary est rejouée (retry transitoire,
-- relance manuelle depuis le futur admin dashboard…). Le marquage se fait
-- APRÈS l'envoi Resend réussi.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS report_email_sent_at TIMESTAMPTZ;
