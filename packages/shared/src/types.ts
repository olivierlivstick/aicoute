// Types TypeScript partagés entre web, mobile et edge functions

export type UserRole = 'caregiver' | 'beneficiary' | 'admin'

/** Type de compte aidant : personne physique (individual) ou morale (organization). */
export type AccountType = 'individual' | 'organization'

export interface Profile {
  id: string
  /** Type de compte : personne physique ou morale. */
  account_type: AccountType
  /**
   * Nom d'affichage, CONSERVÉ et synchronisé : « prénom nom » (physique) ou
   * raison sociale (morale). Voir computeFullName().
   */
  full_name: string
  /** Prénom (physique) ou prénom du contact principal (morale). */
  first_name: string | null
  /** Nom (physique) ou nom du contact principal (morale). */
  last_name: string | null
  /** Raison sociale (personne morale uniquement). */
  company_name: string | null
  email: string
  role: UserRole
  avatar_url: string | null
  phone: string | null
  timezone: string
  /** Adresse postale. */
  address_line: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  agent_model: string
  agent_extra_prompt: string | null
  created_at: string
  updated_at: string
}

/**
 * full_name dérivé de l'identité structurée : raison sociale pour une personne
 * morale, « prénom nom » pour une personne physique. À appeler à chaque
 * écriture d'identité côté client (le trigger SQL fait l'équivalent au signup,
 * l'Edge Fn admin-update-caregiver à l'édition admin).
 */
export function computeFullName(identity: {
  account_type?: AccountType | null
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
}): string {
  if (identity.account_type === 'organization') {
    return (identity.company_name ?? '').trim()
  }
  return [identity.first_name, identity.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export type Gender = 'male' | 'female' | 'other'
// Voix OpenAI (Realtime GA) sélectionnables par bénéficiaire (stockées dans
// beneficiaries.ai_voice). Catalogue détaillé + échantillons : ./voices.ts
export type AIVoice = 'cedar' | 'marin' | 'coral' | 'sage' | 'echo' | 'ballad'
// Voix Gemini Live sélectionnables par bénéficiaire (beneficiaries.gemini_voice).
export type GeminiVoice = 'Aoede' | 'Sulafat' | 'Callirrhoe' | 'Kore' | 'Charon' | 'Orus'
export type ConversationStyle = 'warm' | 'playful' | 'calm' | 'formal'

export interface Beneficiary {
  id: string
  caregiver_id: string
  first_name: string
  last_name: string
  birth_year: number | null
  /** Date de naissance complète (YYYY-MM-DD). birth_year reste synchronisé à partir d'elle. */
  birth_date: string | null
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
  /** Commentaire libre (dashboard organisation : ex. « Chambre 12 », « malentendant »). */
  comment: string | null
  language_preference: string
  report_language: string
  ai_voice: AIVoice
  gemini_voice: GeminiVoice
  ai_persona_name: string
  conversation_style: ConversationStyle
  custom_prompt: string | null
  /** Paire de prompts (table prompts) choisie comme source des snapshots émis + entrant. NULL = défaut. */
  prompt_id: string | null
  report_recipients: string[]
  is_active: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

/**
 * Bibliothèque de prompts sélectionnables (table `prompts`). Un prompt = une PAIRE :
 *   - outbound_body : personnalité + règles (AICOUTE appelle le bénéficiaire)
 *   - inbound_body  : ouverture des appels entrants (le bénéficiaire appelle)
 * `is_default` = paire proposée par défaut pour la langue (1 par langue) + fallback edge.
 */
export interface Prompt {
  id: string
  title: string
  language: string
  outbound_body: string
  inbound_body: string
  is_default: boolean
  created_at: string
  updated_at: string
}

// ── Campagnes d'appels en masse (dashboard organisation) ─────────────────────
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'

export interface Campaign {
  id: string
  org_id: string
  title: string
  comment: string | null
  starts_on: string | null
  ends_on: string | null
  prompt_id: string | null
  language: string
  /** Prénom que l'IA utilise pour se présenter ({{persona}}) sur les appels de la campagne. */
  ai_persona_name: string
  daily_start_time: string
  daily_end_time: string
  timezone: string
  max_concurrent_calls: number
  max_call_minutes: number
  retry_count: number
  retry_interval_minutes: number
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export interface CampaignActivityPeriod {
  id: string
  campaign_id: string
  started_at: string
  ended_at: string | null
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

// Packs de minutes (nouveau modèle : achat de minutes, dégressif, sans abonnement).
// SOURCE UNIQUE partagée entre la vitrine (#tarifs) et le back-office (PlanChooser).
export type MinutePackId = 'rendezvous' | 'lien' | 'presence'

export interface MinutePack {
  id: MinutePackId
  name: string
  minutes: string       // quantité achetée, ex. '50'
  price: string         // prix du pack en €, ex. '25'
  perMinute: string     // tarif unitaire, ex. '0,50 € / minute'
  saving?: string       // badge d'économie, ex. '−10 %'
  cadence: string       // rythme d'appels mis en avant, ex. '≈ 1 appel par semaine'
  detail: string        // équivalence en conversations
  featured: boolean
}

// Un achat de pack (table minute_purchases). Vide tant que le paiement n'est pas branché.
export interface MinutePurchase {
  id: string
  caregiver_id: string
  pack_id: string
  pack_name: string
  minutes: number
  amount_eur: number
  created_at: string
}

export const MINUTE_PACKS: MinutePack[] = [
  {
    id: 'rendezvous',
    name: 'Le rendez-vous',
    minutes: '50',
    price: '25',
    perMinute: '0,50 € / minute',
    cadence: '≈ 1 appel par semaine',
    detail: 'Soit 5 à 7 conversations, pendant environ un mois.',
    featured: false,
  },
  {
    id: 'lien',
    name: 'Le lien',
    minutes: '100',
    price: '45',
    perMinute: '0,45 € / minute',
    saving: '−10 %',
    cadence: '≈ 2 à 3 appels par semaine',
    detail: 'Soit 10 à 14 conversations, pendant environ un mois.',
    featured: true,
  },
  {
    id: 'presence',
    name: 'La présence',
    minutes: '250',
    price: '100',
    perMinute: '0,40 € / minute',
    saving: '−20 %',
    cadence: '≈ presque 1 appel par jour',
    detail: 'Soit 25 à 35 conversations, pendant environ un mois.',
    featured: false,
  },
]
