-- Migration 005: Table conversation_memory (mémoire long-terme)

CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,

  memory_type TEXT NOT NULL
    CHECK (memory_type IN ('fact', 'preference', 'event', 'mood', 'topic')),
  content TEXT NOT NULL,
  source_call_id UUID REFERENCES calls(id),
  importance INT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caregiver_owns_memory" ON conversation_memory
  USING (
    beneficiary_id IN (
      SELECT id FROM beneficiaries WHERE caregiver_id = auth.uid()
    )
  );

-- Index pour récupérer les mémoires les plus importantes en premier
CREATE INDEX idx_memory_beneficiary_importance
  ON conversation_memory(beneficiary_id, importance DESC);
