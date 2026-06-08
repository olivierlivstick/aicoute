-- Migration : Diagnostic fluidité — réglages globaux + bucket d'enregistrements
--
-- Objectif : piloter depuis /admin/sante (sans toucher aux env Render) une phase
-- de DIAGNOSTIC de la fluidité vocale (mesure du « blanc »). Deux leviers :
--   1. fluidity_diagnostic_enabled       : active l'analyse fine côté voice-bridge
--      (phase 2 : analyse VAD offline en fin d'appel, audio jeté — métriques seules).
--   2. fluidity_keep_recording_remaining : compteur dégressif. Tant qu'il est > 0,
--      l'appel démo suivant est ENREGISTRÉ (Twilio dual-channel) pour CALIBRATION :
--      le voice-bridge récupère le WAV, le dépose dans Storage et publie un lien
--      cliquable (via system_events) → écoute/analyse à l'œil dans Audacity. Le
--      bridge décrémente le compteur à chaque enregistrement lancé.
--
-- PÉRIMÈTRE : démos vitrine + appels test uniquement (décision produit). Les vrais
-- appels bénéficiaires ne sont pas enregistrés (RGPD données de santé).
--
-- Le voice-bridge lit/écrit cette table via le service role (bypass RLS).
-- L'admin la lit/écrit via /admin/sante (RLS is_admin() + GRANTs explicites — cf.
-- bug connu : sans GRANT niveau-table, PostgREST refuse avant la RLS).

CREATE TABLE IF NOT EXISTS app_settings (
  id                                INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  fluidity_diagnostic_enabled       BOOLEAN NOT NULL DEFAULT false,
  fluidity_keep_recording_remaining INT     NOT NULL DEFAULT 0 CHECK (fluidity_keep_recording_remaining >= 0),
  updated_at                        TIMESTAMPTZ DEFAULT NOW(),
  updated_by                        UUID REFERENCES profiles(id)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Lecture + écriture : admin uniquement (le service role bypass pour le bridge).
DROP POLICY IF EXISTS "admin_read_app_settings" ON app_settings;
CREATE POLICY "admin_read_app_settings" ON app_settings
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "admin_update_app_settings" ON app_settings;
CREATE POLICY "admin_update_app_settings" ON app_settings
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- GRANTs niveau-table (sinon PostgREST refuse avant d'évaluer la RLS).
GRANT SELECT, UPDATE ON app_settings TO authenticated;

-- Bucket privé pour les WAV de calibration. Le voice-bridge y dépose via service
-- role et génère des liens signés (le web ouvre juste le lien → pas besoin de
-- policy storage.objects côté authenticated).
INSERT INTO storage.buckets (id, name, public)
VALUES ('fluidity-recordings', 'fluidity-recordings', false)
ON CONFLICT (id) DO NOTHING;
