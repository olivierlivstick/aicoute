-- Migration 008: Paramètres agent IA par aidant

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_model TEXT NOT NULL DEFAULT 'gpt-4o-realtime-preview',
  ADD COLUMN IF NOT EXISTS agent_extra_prompt TEXT;

GRANT ALL ON TABLE public.profiles TO service_role;
