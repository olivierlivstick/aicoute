-- Migration : enregistrement systématique des appels (phase de TEST qualité)
--
-- Contexte : aicoute.fr est en TEST (pas encore en prod). Pour analyser la qualité
-- des conversations, on enregistre désormais TOUS les appels (démos vitrine +
-- appels planifiés sortants + appels entrants) en WAV dual-channel et on attache
-- le fichier à sa ligne d'appel, pour un bouton « .wav » par appel dans le
-- back-office admin (/admin/appels : passés / émis / démos).
--
-- ⚠️ RGPD : ceci enregistre aussi les VRAIS appels bénéficiaires (données de
-- santé), ce que le diagnostic fluidité (20260608000001) excluait volontairement.
-- Décision assumée pour la phase de test fermée. Kill-switch côté voice-bridge :
-- env RECORD_ALL_CALLS=0. Repenser le périmètre avant la mise en production.
--
-- Le WAV est déposé dans le bucket privé existant `fluidity-recordings` par le
-- voice-bridge (service role), keyé par le Twilio CallSid. On stocke le CHEMIN
-- (pas un lien signé qui expire) → le back-office mint un lien signé à la volée
-- via la policy storage ci-dessous (lecture admin).

-- Chemin du WAV dans le bucket fluidity-recordings (ex: "calls/CAxxxx.wav").
ALTER TABLE calls      ADD COLUMN IF NOT EXISTS recording_path TEXT;
ALTER TABLE demo_calls ADD COLUMN IF NOT EXISTS recording_path TEXT;

-- Les démos n'avaient pas de quoi corréler le WAV (CallSid Twilio) → on l'ajoute.
-- (calls.twilio_call_sid existe déjà : écrit par initiate-call / createInboundCall.)
ALTER TABLE demo_calls ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT;
CREATE INDEX IF NOT EXISTS idx_demo_calls_twilio_sid ON demo_calls (twilio_call_sid);

-- Lecture admin du bucket privé → permet supabase.storage.createSignedUrl() depuis
-- le client back-office (RLS storage.objects). Le voice-bridge écrit en service role
-- (bypass RLS), donc pas besoin d'INSERT ici.
DROP POLICY IF EXISTS "admin_read_fluidity_recordings" ON storage.objects;
CREATE POLICY "admin_read_fluidity_recordings" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fluidity-recordings' AND public.is_admin());
