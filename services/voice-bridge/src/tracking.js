// Tracking des démos téléphone dans Supabase (table demo_calls).
// Best-effort : si Supabase n'est pas configuré ou si une requête échoue,
// le service voice-bridge continue à fonctionner normalement.

import { createClient } from '@supabase/supabase-js'
// supabase-js initialise un RealtimeClient en interne (souscriptions DB) qui
// exige WebSocket. Node 20 ne l'a pas en natif → on injecte 'ws' (déjà dep).
// Inutile pour nos INSERT/UPDATE mais évite un crash au démarrage.
import WebSocket from 'ws'

// Tarifs ESTIMÉS par durée (alignés sur supabase/functions/log-demo/index.ts)
//  - OpenAI Realtime gpt-realtime-2 audio mix : ~0,0077 EUR/s
//  - Twilio FR mobile sortant                : ~0,0007 EUR/s
const OPENAI_EUR_PER_SECOND = 0.0077
const TWILIO_EUR_PER_SECOND = 0.0007

// Tarifs RÉELS par token (gpt-realtime-2, USD / million de tokens)
// Source : https://openai.com/api/pricing/
// Mise à jour : 2026-05. À ajuster si OpenAI change ses tarifs.
const OPENAI_RATES_USD_PER_TOKEN = {
  input_audio:        32   / 1_000_000, // non-cached audio in
  input_audio_cached:  0.40 / 1_000_000, // cached audio in (×80 moins cher)
  output_audio:       64   / 1_000_000,
  input_text:          4   / 1_000_000,
  output_text:        24   / 1_000_000,
}
// Conversion USD → EUR : approximation hardcodée (pas d'API de change pour
// éviter une dépendance). À ajuster manuellement si le taux dérive.
const USD_TO_EUR = 0.92

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = url && key
  ? createClient(url, key, {
      auth:     { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket },
    })
  : null

if (!supabase) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non configurés — tracking demo_calls désactivé.')
}

/**
 * Enregistre le début d'une démo téléphone. Renvoie l'id de la row créée,
 * ou null si Supabase n'est pas configuré / si l'INSERT échoue.
 */
export async function recordDemoStart(phoneNumber) {
  if (!supabase) return null
  const phonePrefix = phoneNumber.slice(0, 6) // ex: "+33619"
  const { data, error } = await supabase
    .from('demo_calls')
    .insert({
      mode:         'phone',
      started_at:   new Date().toISOString(),
      phone_prefix: phonePrefix,
    })
    .select('id')
    .single()
  if (error) {
    console.error('❌ tracking start INSERT failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Calcule le coût OpenAI RÉEL en EUR à partir des tokens accumulés.
 * tokens = { input_audio, input_audio_cached, output_audio, input_text, output_text }
 * Retourne un nombre arrondi à 4 décimales (ex: 0.0843).
 */
export function computeOpenAICostEur(tokens) {
  const r = OPENAI_RATES_USD_PER_TOKEN
  const usd =
    (tokens.input_audio        ?? 0) * r.input_audio +
    (tokens.input_audio_cached ?? 0) * r.input_audio_cached +
    (tokens.output_audio       ?? 0) * r.output_audio +
    (tokens.input_text         ?? 0) * r.input_text +
    (tokens.output_text        ?? 0) * r.output_text
  return +(usd * USD_TO_EUR).toFixed(4)
}

/**
 * Termine une démo téléphone en remplissant ended_at + duration + coûts.
 *
 * Si `tokens` est fourni (objet avec input_audio, input_audio_cached, etc.),
 * on calcule en plus le coût OpenAI RÉEL et on stocke les tokens. Sinon seule
 * l'estimation par durée est enregistrée (rétrocompatibilité, et fallback si
 * aucun response.done n'a été reçu).
 *
 * Silencieux si l'id est null ou si l'UPDATE échoue.
 */
export async function recordDemoEnd(id, durationSeconds, tokens) {
  if (!supabase || !id) return
  const seconds    = Math.max(1, Math.round(durationSeconds))
  const openaiCost = +(seconds * OPENAI_EUR_PER_SECOND).toFixed(4)
  const twilioCost = +(seconds * TWILIO_EUR_PER_SECOND).toFixed(4)

  const update = {
    ended_at:         new Date().toISOString(),
    duration_seconds: seconds,
    openai_cost_eur:  openaiCost,
    twilio_cost_eur:  twilioCost,
  }

  if (tokens) {
    update.openai_cost_eur_real      = computeOpenAICostEur(tokens)
    update.tokens_input_audio        = tokens.input_audio        ?? 0
    update.tokens_input_audio_cached = tokens.input_audio_cached ?? 0
    update.tokens_output_audio       = tokens.output_audio       ?? 0
    update.tokens_input_text         = tokens.input_text         ?? 0
    update.tokens_output_text        = tokens.output_text        ?? 0
  }

  const { error } = await supabase.from('demo_calls').update(update).eq('id', id)
  if (error) {
    console.error('❌ tracking end UPDATE failed:', error.message)
  }
}
