-- Migration 002: Table beneficiaries

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Informations personnelles
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_year INT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT,
  push_token TEXT,

  -- Contexte biographique (rempli par l'aidant)
  family_history TEXT,
  life_story TEXT,
  hobbies TEXT,
  favorite_topics TEXT,
  topics_to_avoid TEXT,
  personality_notes TEXT,
  health_notes TEXT,
  language_preference TEXT DEFAULT 'fr',

  -- Paramètres de l'agent IA
  ai_voice TEXT DEFAULT 'alloy',
  ai_persona_name TEXT DEFAULT 'Marie',
  conversation_style TEXT DEFAULT 'warm'
    CHECK (conversation_style IN ('warm', 'playful', 'calm', 'formal')),

  -- Statut
  is_active BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caregiver_owns" ON beneficiaries
  USING (caregiver_id = auth.uid());

CREATE TRIGGER beneficiaries_updated_at
  BEFORE UPDATE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
