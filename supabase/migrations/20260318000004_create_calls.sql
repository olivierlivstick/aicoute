-- Migration 004: Table calls (historique des appels)

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  schedule_id UUID REFERENCES session_schedules(id),

  -- LiveKit
  livekit_room_name TEXT UNIQUE,
  livekit_room_sid TEXT,

  -- Statut
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'notified', 'in_progress', 'completed', 'missed', 'failed')),

  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,

  -- Contenu
  transcript JSONB,          -- [{role: 'user'|'assistant', text: '...', timestamp: ...}]
  raw_audio_url TEXT,

  -- Compte-rendu
  summary TEXT,
  mood_detected TEXT CHECK (mood_detected IN ('positive', 'neutral', 'concerned')),
  key_topics TEXT[],
  memorable_moments TEXT[],
  alerts TEXT[],
  report_available BOOLEAN DEFAULT FALSE,
  report_read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- L'aidant voit tous les calls de ses bénéficiaires
CREATE POLICY "caregiver_sees_calls" ON calls
  USING (
    beneficiary_id IN (
      SELECT id FROM beneficiaries WHERE caregiver_id = auth.uid()
    )
  );

CREATE TRIGGER calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index pour les requêtes fréquentes
CREATE INDEX idx_calls_beneficiary_id ON calls(beneficiary_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_scheduled_at ON calls(scheduled_at);
CREATE INDEX idx_calls_report_available ON calls(report_available) WHERE report_available = TRUE;
