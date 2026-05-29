/**
 * Helper partagé : charge le contexte complet d'un appel et construit le
 * system prompt à injecter dans OpenAI Realtime.
 *
 * Utilisé par :
 *   - realtime-token       (back-office : WebRTC direct navigateur ↔ OpenAI)
 *   - get-call-context     (voice-bridge : appel Twilio scheduled)
 *
 * Garantit que les deux canaux construisent le MÊME prompt à partir des
 * MÊMES sources (bénéficiaire + mémoires long-terme + extra prompt aidant
 * + planning).
 */

import { buildSystemPrompt } from './systemPrompt.ts'

const DEFAULT_GA_MODEL = 'gpt-realtime-2'
const DEFAULT_VOICE    = 'cedar'

const FEMININE_VOICES = ['marin', 'nova', 'shimmer', 'coral', 'sage']
function resolveVoice(aiVoice: string | null | undefined): string {
  if (aiVoice === 'cedar' || aiVoice === 'marin') return aiVoice
  return FEMININE_VOICES.includes(aiVoice ?? '') ? 'marin' : DEFAULT_VOICE
}

function normalizeModel(model: string | null | undefined): string {
  if (!model) return DEFAULT_GA_MODEL
  if (!model.includes('realtime') || model.includes('preview')) return DEFAULT_GA_MODEL
  return model
}

export interface CallContext {
  call: {
    id: string
    beneficiary_id: string
    schedule_id: string | null
    attempt_number: number
  }
  beneficiary: {
    id: string
    first_name: string
    last_name: string
    phone: string | null
    ai_persona_name: string
    language_preference: string
  }
  caregiver: {
    id: string
  }
  model: string
  voice: string
  instructions: string
  max_duration_minutes: number
}

// Shape minimal du client supabase-js (évite d'importer le type complet)
interface SupabaseLike {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        single(): Promise<{ data: unknown; error: { message: string } | null }>
        order(col: string, opts: { ascending: boolean }): {
          limit(n: number): Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  }
}

export async function loadCallContext(
  supabase: SupabaseLike,
  callId: string,
): Promise<CallContext> {
  // 1. Call + schedule joint
  const callRes = await supabase
    .from('calls')
    .select('*, session_schedules(*)')
    .eq('id', callId)
    .single()
  if (callRes.error || !callRes.data) {
    throw new Error(`Call introuvable: ${callRes.error?.message ?? callId}`)
  }
  const call = callRes.data as {
    id: string
    beneficiary_id: string
    schedule_id: string | null
    attempt_number: number
    session_schedules: {
      max_duration_minutes: number
      suggested_topics: string[] | null
      special_instructions: string | null
    } | null
  }

  // 2. Bénéficiaire
  const benRes = await supabase
    .from('beneficiaries')
    .select('*')
    .eq('id', call.beneficiary_id)
    .single()
  if (benRes.error || !benRes.data) {
    throw new Error(`Bénéficiaire introuvable: ${benRes.error?.message ?? call.beneficiary_id}`)
  }
  const beneficiary = benRes.data as {
    id: string
    first_name: string
    last_name: string
    phone: string | null
    caregiver_id: string
    ai_voice: string | null
    ai_persona_name: string
    language_preference: string
    birth_year: number | null
    gender: string | null
    family_history: string | null
    life_story: string | null
    hobbies: string | null
    favorite_topics: string | null
    topics_to_avoid: string | null
    personality_notes: string | null
    health_notes: string | null
    conversation_style: string
  }

  // 3. Mémoires long-terme (top 20)
  const memRes = await supabase
    .from('conversation_memory')
    .select('memory_type, content, importance')
    .eq('beneficiary_id', beneficiary.id)
    .order('importance', { ascending: false })
    .limit(20)
  const memories = (memRes.data as Array<{ memory_type: string; content: string; importance: number }> | null) ?? []

  // 4. Profil aidant (model + extra prompt)
  const profRes = await supabase
    .from('profiles')
    .select('agent_model, agent_extra_prompt')
    .eq('id', beneficiary.caregiver_id)
    .single()
  const caregiverProfile = (profRes.data as { agent_model: string | null; agent_extra_prompt: string | null } | null)

  const model            = normalizeModel(caregiverProfile?.agent_model)
  const agentExtraPrompt = caregiverProfile?.agent_extra_prompt ?? null

  // 5. Planning (sinon défauts)
  const schedule = call.session_schedules ?? {
    max_duration_minutes: 15,
    suggested_topics:     null,
    special_instructions: null,
  }

  // 6. Construction du prompt
  const basePrompt   = buildSystemPrompt(beneficiary, memories, schedule)
  const instructions = agentExtraPrompt ? `${agentExtraPrompt}\n\n${basePrompt}` : basePrompt

  return {
    call: {
      id:             call.id,
      beneficiary_id: call.beneficiary_id,
      schedule_id:    call.schedule_id,
      attempt_number: call.attempt_number,
    },
    beneficiary: {
      id:                  beneficiary.id,
      first_name:          beneficiary.first_name,
      last_name:           beneficiary.last_name,
      phone:               beneficiary.phone,
      ai_persona_name:     beneficiary.ai_persona_name,
      language_preference: beneficiary.language_preference,
    },
    caregiver: { id: beneficiary.caregiver_id },
    model,
    voice:                resolveVoice(beneficiary.ai_voice),
    instructions,
    max_duration_minutes: schedule.max_duration_minutes,
  }
}
