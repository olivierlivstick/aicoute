-- Migration : table system_events pour l'observabilité du worker + voice-bridge
--
-- Toute Edge Function ou le voice-bridge peut écrire un événement structuré
-- (level, source, optional call_id, message, optional JSONB payload).
-- Consultable uniquement par les admins via /admin/sante.

CREATE TABLE IF NOT EXISTS system_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level       TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  source      TEXT NOT NULL,                                       -- 'schedule-calls/A', 'initiate-call', 'voice-bridge/scheduled', etc.
  call_id     UUID REFERENCES calls(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  payload     JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at
  ON system_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_call_id
  ON system_events (call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_events_level_recent
  ON system_events (created_at DESC)
  WHERE level IN ('warn', 'error');

-- RLS : seul un admin peut lire ; l'écriture passe par service-role qui
-- by-passe la RLS de toute façon. Pas de policy INSERT pour empêcher
-- toute écriture client-side.

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_system_events" ON system_events
  FOR SELECT
  USING (is_admin());
