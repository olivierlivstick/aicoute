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
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_GA_MODEL = 'gpt-realtime-2'
const DEFAULT_VOICE    = 'cedar'
const DEFAULT_GEMINI_VOICE = 'Aoede'

// ⚠️ Catalogues DUPLIQUÉS de packages/shared/src/voices.ts (Deno n'importe pas
// packages/shared). À garder en phase.
const OPENAI_VOICES = ['cedar', 'marin', 'coral', 'sage', 'echo', 'ballad']
const GEMINI_VOICES = ['Aoede', 'Sulafat', 'Callirrhoe', 'Kore', 'Charon', 'Orus']
const LEGACY_FEMININE = ['marin', 'nova', 'shimmer', 'coral', 'sage']

function resolveVoice(aiVoice: string | null | undefined): string {
  if (aiVoice && OPENAI_VOICES.includes(aiVoice)) return aiVoice
  return LEGACY_FEMININE.includes(aiVoice ?? '') ? 'marin' : DEFAULT_VOICE
}

function resolveGeminiVoice(voice: string | null | undefined): string {
  if (voice && GEMINI_VOICES.includes(voice)) return voice
  return DEFAULT_GEMINI_VOICE
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
  voice: string         // voix OpenAI (Realtime GA)
  geminiVoice: string   // voix Gemini Live (lue par le bridge Gemini)
  instructions: string
  max_duration_minutes: number
}

export async function loadCallContext(
  supabase: SupabaseClient,
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
    campaign_id: string | null
    attempt_number: number
    origin: string | null            // 'scheduled' (défaut) | 'inbound' | 'campaign'
    session_schedules: {
      max_duration_minutes: number
      suggested_topics: string[] | null
      special_instructions: string | null
    } | null
  }
  const isInbound  = call.origin === 'inbound'
  const isCampaign = call.origin === 'campaign' && !!call.campaign_id

  // Appel de CAMPAGNE (org) : la campagne porte le prompt, la langue et la durée
  // (les bénéficiaires d'org sont « légers », sans config IA propre).
  let campaign: { prompt_id: string | null; language: string; max_call_minutes: number } | null = null
  if (isCampaign) {
    const campRes = await supabase
      .from('campaigns')
      .select('prompt_id, language, max_call_minutes')
      .eq('id', call.campaign_id)
      .single()
    campaign = (campRes.data as { prompt_id: string | null; language: string; max_call_minutes: number } | null) ?? null
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
    gemini_voice: string | null
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
    custom_prompt: string | null
    inbound_custom_prompt: string | null
    inbound_max_duration_seconds: number | null
  }

  // 3. Mémoires long-terme (top 20)
  const memRes = await supabase
    .from('conversation_memory')
    .select('memory_type, content, importance')
    .eq('beneficiary_id', beneficiary.id)
    .order('importance', { ascending: false })
    .limit(20)
  const memories = (memRes.data as Array<{ memory_type: string; content: string; importance: number }> | null) ?? []

  // 3.5 Dernier appel terminé (pour rappeler la dernière conversation au démarrage)
  //     On exclut l'appel courant (.neq id) et la chaîne sentinelle écrite par
  //     generate-summary quand le transcript est vide.
  const SENTINEL_SUMMARY = "La conversation n'a pas pu être enregistrée."
  const prevRes = await supabase
    .from('calls')
    .select('summary, key_topics, memorable_moments, ended_at, started_at')
    .eq('beneficiary_id', beneficiary.id)
    .eq('status', 'completed')
    .neq('id', call.id)
    .not('summary', 'is', null)
    .neq('summary', SENTINEL_SUMMARY)
    .order('ended_at',   { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const prev = (prevRes.data as {
    summary: string
    key_topics: string[] | null
    memorable_moments: string[] | null
    ended_at: string | null
    started_at: string | null
  } | null) ?? null

  const previousCall = prev
    ? {
        ended_at:          prev.ended_at ?? prev.started_at,
        summary:           prev.summary,
        key_topics:        prev.key_topics,
        memorable_moments: prev.memorable_moments,
      }
    : null

  // 4. Profil aidant (model + extra prompt)
  const profRes = await supabase
    .from('profiles')
    .select('agent_model, agent_extra_prompt')
    .eq('id', beneficiary.caregiver_id)
    .single()
  const caregiverProfile = (profRes.data as { agent_model: string | null; agent_extra_prompt: string | null } | null)

  const model            = normalizeModel(caregiverProfile?.agent_model)
  const agentExtraPrompt = caregiverProfile?.agent_extra_prompt ?? null

  // 4.5 Paire de prompts par DÉFAUT depuis la BIBLIOTHÈQUE `prompts` pour la langue
  //     du bénéficiaire. Le service role bypass la RLS. Cascade de fallback :
  //       défaut paire (langue) → défaut paire (fr) → null → CODE_DEFAULT_* (edge).
  //     custom_prompt étant quasi toujours snapshotté, ce chemin sert surtout de
  //     filet (bénéficiaire sans copie concrète).
  // Pour une campagne, la LANGUE et le prompt sont ceux de la campagne (pas du
  // bénéficiaire « léger »).
  const lang = (campaign?.language ?? beneficiary.language_preference ?? 'fr').toLowerCase()
  const promptsRes = await supabase
    .from('prompts')
    .select('language, outbound_body, inbound_body')
    .eq('is_default', true)
    .in('language', [lang, 'fr'])
  const promptRows = (promptsRes.data as Array<{ language: string; outbound_body: string; inbound_body: string }> | null) ?? []
  const defaultPair = promptRows.find((r) => r.language === lang) ?? promptRows.find((r) => r.language === 'fr') ?? null
  const defaultInboundOpening = defaultPair?.inbound_body ?? null

  // Template par défaut = celui de la langue. Pour une campagne avec un prompt
  // explicite, ce prompt PRIME (il EST le template appliqué à tous les appels).
  let defaultTemplate = defaultPair?.outbound_body ?? null
  if (campaign?.prompt_id) {
    const cpRes = await supabase
      .from('prompts')
      .select('outbound_body')
      .eq('id', campaign.prompt_id)
      .single()
    defaultTemplate = (cpRes.data as { outbound_body: string } | null)?.outbound_body ?? defaultTemplate
  }

  // La campagne porte la langue → on l'aligne sur le bénéficiaire en mémoire pour
  // la résolution des variables ({{langue}}) et le bloc LANGUE du contexte.
  if (isCampaign) beneficiary.language_preference = lang

  // 5. Planning (sinon défauts). Pour un appel ENTRANT il n'y a pas de schedule →
  //    la durée cible suit le coupe-circuit entrant du bénéficiaire (sinon 10 min).
  const schedule = call.session_schedules ?? {
    max_duration_minutes: isCampaign
      ? (campaign?.max_call_minutes ?? 5)
      : isInbound
        ? Math.max(1, Math.round((beneficiary.inbound_max_duration_seconds ?? 600) / 60))
        : 15,
    suggested_topics:     null,
    special_instructions: null,
  }

  // 6. Construction du prompt : custom_prompt (concret, par bénéficiaire) prioritaire,
  //    sinon le template par défaut interpolé. Pour un appel ENTRANT, on ajoute le
  //    bloc d'ouverture (surcharge bénéficiaire concrète → défaut DB → filet code).
  // Campagne : pas de custom_prompt par bénéficiaire (le template campagne fait foi)
  // ni d'ouverture entrante (un appel de campagne est SORTANT).
  const customForPrompt = isCampaign ? null : beneficiary.custom_prompt
  const basePrompt   = buildSystemPrompt(
    beneficiary, memories, schedule, previousCall, defaultTemplate, customForPrompt,
    isInbound
      ? { defaultOpening: defaultInboundOpening, customOpening: beneficiary.inbound_custom_prompt }
      : null,
  )
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
    geminiVoice:          resolveGeminiVoice(beneficiary.gemini_voice),
    instructions,
    max_duration_minutes: schedule.max_duration_minutes,
  }
}
