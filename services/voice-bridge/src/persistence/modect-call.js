// Persistence des APPELS PLANIFIÉS Modect dans Supabase (table `calls`).
// Distinct de `tracking.js` qui gère `demo_calls` (vitrine).
//
// Le service-role est requis pour by-passer la RLS (les calls appartiennent à
// un aidant, mais le voice-bridge n'a pas de session aidant).
//
// Best-effort : si Supabase n'est pas configuré, les fonctions deviennent des
// no-op et le bridge continue à fonctionner (l'appel passera, mais sans persistance).

import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = url && key
  ? createClient(url, key, {
      auth:     { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket },
    })
  : null

if (!supabase) {
  console.warn('⚠️  [modect-call] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents — persistance désactivée.')
}

// Tarifs alignés sur tracking.js (utilisé pour les démos vitrine). Mêmes
// sources : openai.com/api/pricing pour gpt-realtime-2, ai.google.dev/pricing
// pour gemini live.
const USD_TO_EUR = 0.92
const RATES = {
  openai: {
    input_audio:        32   / 1_000_000,
    input_audio_cached:  0.40 / 1_000_000,
    output_audio:       64   / 1_000_000,
    input_text:          4   / 1_000_000,
    output_text:        24   / 1_000_000,
  },
  gemini: {
    input_audio:         3   / 1_000_000,
    input_audio_cached:  0,
    output_audio:       12   / 1_000_000,
    input_text:          0.50 / 1_000_000,
    output_text:         2   / 1_000_000,
  },
}

/** Coût IA réel en EUR à partir des tokens (4 décimales). engine = 'openai' | 'gemini' */
export function computeCallAiCostEur(tokens, engine = 'openai') {
  const r = RATES[engine] ?? RATES.openai
  const usd =
    (tokens.input_audio        ?? 0) * r.input_audio +
    (tokens.input_audio_cached ?? 0) * r.input_audio_cached +
    (tokens.output_audio       ?? 0) * r.output_audio +
    (tokens.input_text         ?? 0) * r.input_text +
    (tokens.output_text        ?? 0) * r.output_text
  return +(usd * USD_TO_EUR).toFixed(4)
}

/**
 * Marque le call comme en cours (le bénéficiaire a décroché).
 *   - status      → 'in_progress'
 *   - started_at  → now()
 *   - engine      → 'openai' | 'gemini' (le moteur effectivement utilisé)
 * Idempotent : ne fait rien si le call n'est pas en 'notified' ou 'scheduled'.
 */
export async function markCallInProgress(callId, engine = 'openai') {
  if (!supabase || !callId) return
  const { error } = await supabase
    .from('calls')
    .update({
      status:     'in_progress',
      started_at: new Date().toISOString(),
      engine,
    })
    .eq('id', callId)
    .in('status', ['scheduled', 'notified'])
  if (error) console.error(`❌ [modect-call] markInProgress ${callId}:`, error.message)
}

/**
 * Écrit les tokens + coût IA réel sur le call. À appeler EN PLUS de save-transcript
 * (qui s'occupe du transcript + status + duration + chaînage summary).
 *
 * Pourquoi ne pas tout faire ici ? save-transcript déclenche generate-summary
 * en arrière-plan via EdgeRuntime.waitUntil — on garde ce chaînage côté Edge
 * Function plutôt que de le re-implémenter côté Render.
 */
export async function recordCallTokens(callId, tokens, engine = 'openai') {
  if (!supabase || !callId) return
  const update = {
    tokens_input_audio:        tokens.input_audio        ?? 0,
    tokens_input_audio_cached: tokens.input_audio_cached ?? 0,
    tokens_output_audio:       tokens.output_audio       ?? 0,
    tokens_input_text:         tokens.input_text         ?? 0,
    tokens_output_text:        tokens.output_text        ?? 0,
    ai_cost_eur_real:          computeCallAiCostEur(tokens, engine),
  }
  const { error } = await supabase.from('calls').update(update).eq('id', callId)
  if (error) console.error(`❌ [modect-call] recordTokens ${callId}:`, error.message)
}

/**
 * Écrit le snapshot de fluidité sur le call (Étape 0 — observation pure).
 * Best-effort, jamais bloquant. metrics = objet renvoyé par
 * fluidity.compute() (cf. engines/fluidity.js).
 */
export async function recordCallFluidity(callId, metrics) {
  if (!supabase || !callId || !metrics) return
  const { error } = await supabase
    .from('calls')
    .update({ fluidity_metrics: metrics })
    .eq('id', callId)
  if (error) console.error(`❌ [modect-call] recordFluidity ${callId}:`, error.message)
}

/**
 * Marque un call selon un statut Twilio reçu via statusCallback.
 *   - no-answer / busy → 'missed' (court-circuite la passe B no-answer qui
 *     attendrait 120s par défaut)
 *   - failed / canceled → 'failed'
 *   - completed → on NE MARQUE PAS depuis ici, save-transcript le fait avec
 *     le transcript final. Le callback Twilio 'completed' arrive AVANT la WS
 *     close → on laisse le bridge gérer le flush et le statut.
 *
 * Idempotent : ne touche pas un call déjà 'completed' ou 'failed'.
 * Renvoie le nouveau statut effectif (ou null si on n'a pas écrit).
 */
export async function markCallByTwilioStatus(twilioSid, twilioStatus) {
  if (!supabase || !twilioSid) return null

  let nextStatus = null
  if (twilioStatus === 'no-answer' || twilioStatus === 'busy') nextStatus = 'missed'
  else if (twilioStatus === 'failed' || twilioStatus === 'canceled') nextStatus = 'failed'
  else return null  // 'queued', 'ringing', 'in-progress', 'completed' → on ignore

  const { data, error } = await supabase
    .from('calls')
    .update({ status: nextStatus, ended_at: new Date().toISOString() })
    .eq('twilio_call_sid', twilioSid)
    .in('status', ['notified', 'in_progress'])
    .select('id')
    .maybeSingle()
  if (error) {
    console.error(`❌ [modect-call] markByTwilio ${twilioSid}:`, error.message)
    return null
  }
  return data ? nextStatus : null
}

/**
 * Écrit le coût Twilio RÉEL (en EUR) sur le call identifié par son SID Twilio.
 * Appelé par le poller de server.js une fois que Twilio a renseigné le prix.
 * Idempotent : un simple UPDATE, on peut le rejouer sans dommage.
 */
export async function saveTwilioCostBySid(twilioSid, costEur) {
  if (!supabase || !twilioSid || costEur == null) return
  const { error } = await supabase
    .from('calls')
    .update({ twilio_cost_eur: costEur })
    .eq('twilio_call_sid', twilioSid)
  if (error) console.error(`❌ [modect-call] saveTwilioCost ${twilioSid}:`, error.message)
}

/**
 * Liste les appels terminés ayant un SID Twilio mais pas encore de coût réel.
 * Utilisé par le backfill (/backfill-twilio-costs). Renvoie [{ id, twilio_call_sid }].
 */
export async function listCallsMissingTwilioCost(limit = 200) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('calls')
    .select('id, twilio_call_sid')
    .eq('status', 'completed')
    .not('twilio_call_sid', 'is', null)
    .is('twilio_cost_eur', null)
    .order('scheduled_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('❌ [modect-call] listCallsMissingTwilioCost:', error.message)
    return []
  }
  return data ?? []
}

/** Lookup pour le statusCallback : trouve l'id Modect à partir du SID Twilio. */
export async function findCallIdByTwilioSid(twilioSid) {
  if (!supabase || !twilioSid) return null
  const { data } = await supabase
    .from('calls')
    .select('id')
    .eq('twilio_call_sid', twilioSid)
    .maybeSingle()
  return data?.id ?? null
}
