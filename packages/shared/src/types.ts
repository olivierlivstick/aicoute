// Types TypeScript partagés entre web, mobile et edge functions

export type UserRole = 'caregiver' | 'beneficiary' | 'admin'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  avatar_url: string | null
  phone: string | null
  timezone: string
  agent_model: string
  agent_extra_prompt: string | null
  created_at: string
  updated_at: string
}

export type Gender = 'male' | 'female' | 'other'
// Voix de l'agent (Realtime GA) : cedar = masculine, marin = féminine
export type AIVoice = 'cedar' | 'marin'
export type ConversationStyle = 'warm' | 'playful' | 'calm' | 'formal'

export interface Beneficiary {
  id: string
  caregiver_id: string
  first_name: string
  last_name: string
  birth_year: number | null
  gender: Gender | null
  phone: string | null
  push_token: string | null
  family_history: string | null
  life_story: string | null
  hobbies: string | null
  favorite_topics: string | null
  topics_to_avoid: string | null
  personality_notes: string | null
  health_notes: string | null
  language_preference: string
  report_language: string
  ai_voice: AIVoice
  ai_persona_name: string
  conversation_style: ConversationStyle
  custom_prompt: string | null
  report_recipients: string[]
  is_active: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface SessionSchedule {
  id: string
  beneficiary_id: string
  caregiver_id: string
  days_of_week: number[]
  time_of_day: string
  timezone: string
  calls_per_week: number
  max_duration_minutes: number
  retry_count: number
  retry_interval_minutes: number
  notify_on_no_answer: boolean
  no_answer_timeout_seconds: number
  suggested_topics: string[] | null
  special_instructions: string | null
  is_active: boolean
  next_scheduled_at: string | null
  last_call_at?: string | null
  created_at: string
  updated_at: string
}

export type CallStatus =
  | 'scheduled'
  | 'notified'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'failed'

export type MoodDetected = 'positive' | 'neutral' | 'concerned'

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

// Signaux faibles structurés extraits du transcript
export type AlertCategory =
  | 'health'     // douleur, sommeil, médication, fatigue physique
  | 'mood'       // tristesse, anxiété, lassitude
  | 'cognition'  // oublis, confusion, désorientation
  | 'social'     // solitude, isolement, conflit familial
  | 'autonomy'   // difficulté du quotidien, chute, alimentation
  | 'other'

export type AlertSeverity = 'low' | 'medium' | 'high'

export interface CallAlert {
  category: AlertCategory
  severity: AlertSeverity
  evidence: string  // citation ou paraphrase courte tirée du transcript
}

export interface Call {
  id: string
  beneficiary_id: string
  schedule_id: string | null
  livekit_room_name: string | null
  livekit_room_sid: string | null
  status: CallStatus
  scheduled_at: string
  notified_at: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  attempt_number: number
  transcript: TranscriptEntry[] | null
  raw_audio_url: string | null
  summary: string | null
  mood_detected: MoodDetected | null
  key_topics: string[] | null
  memorable_moments: string[] | null
  alerts: CallAlert[]
  report_available: boolean
  report_read_at: string | null
  created_at: string
  updated_at: string
}

export type MemoryType = 'fact' | 'preference' | 'event' | 'mood' | 'topic'

export interface ConversationMemory {
  id: string
  beneficiary_id: string
  memory_type: MemoryType
  content: string
  source_call_id: string | null
  importance: number
  created_at: string
}

// Types pour les Edge Functions
export interface InitiateCallPayload {
  call_id: string
}

export interface GenerateSummaryPayload {
  call_id: string
}

export interface SummaryResult {
  summary: string
  mood_detected: MoodDetected
  key_topics: string[]
  memorable_moments: string[]
  alerts: CallAlert[]
  new_memories: Array<{
    type: MemoryType
    content: string
    importance: number
  }>
}

// --- Abonnements -----------------------------------------------------------
// Forfaits de la vitrine : Découverte (1/sem) · Confort (3/sem) · Sérénité
// (7/sem). + un palier d'essai gratuit (3/sem, 1 mois) pour la phase de test.
export type PlanTier = 'trial' | 'discovery' | 'comfort' | 'serenity'
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'canceled'

export interface Subscription {
  id: string
  caregiver_id: string
  plan_tier: PlanTier
  status: SubscriptionStatus
  max_calls_per_week: number
  service_started_at: string | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface PlanDef {
  tier: PlanTier
  name: string
  callsPerWeek: number       // = max_calls_per_week autorisé
  priceEur: number | null    // 0 pour l'essai, prix mensuel pour les payants
  tagline: string
}

// Source de vérité partagée (UI + bridage). Aligné sur la page Tarifs vitrine.
export const PLAN_TIERS: Record<PlanTier, PlanDef> = {
  trial:     { tier: 'trial',     name: 'Essai gratuit', callsPerWeek: 3, priceEur: 0,   tagline: '1 mois offert pour découvrir le service.' },
  discovery: { tier: 'discovery', name: 'Découverte',    callsPerWeek: 1, priceEur: 22,  tagline: "Pour rester en lien sans s'engager." },
  comfort:   { tier: 'comfort',   name: 'Confort',       callsPerWeek: 3, priceEur: 65,  tagline: 'Pour une vraie régularité.' },
  serenity:  { tier: 'serenity',  name: 'Sérénité',      callsPerWeek: 7, priceEur: 150, tagline: 'Pour un accompagnement quotidien.' },
}
