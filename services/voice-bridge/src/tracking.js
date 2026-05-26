// Tracking des démos téléphone dans Supabase (table demo_calls).
// Best-effort : si Supabase n'est pas configuré ou si une requête échoue,
// le service voice-bridge continue à fonctionner normalement.

import { createClient } from '@supabase/supabase-js'
// supabase-js initialise un RealtimeClient en interne (souscriptions DB) qui
// exige WebSocket. Node 20 ne l'a pas en natif → on injecte 'ws' (déjà dep).
// Inutile pour nos INSERT/UPDATE mais évite un crash au démarrage.
import WebSocket from 'ws'

// Tarifs estimés (alignés sur supabase/functions/log-demo/index.ts)
//  - OpenAI Realtime gpt-realtime-2 audio mix : ~0,0077 EUR/s
//  - Twilio FR mobile sortant                : ~0,0007 EUR/s
const OPENAI_EUR_PER_SECOND = 0.0077
const TWILIO_EUR_PER_SECOND = 0.0007

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
 * Termine une démo téléphone en remplissant ended_at + duration + coûts.
 * Silencieux si l'id est null ou si l'UPDATE échoue.
 */
export async function recordDemoEnd(id, durationSeconds) {
  if (!supabase || !id) return
  const seconds = Math.max(1, Math.round(durationSeconds))
  const openaiCost = +(seconds * OPENAI_EUR_PER_SECOND).toFixed(4)
  const twilioCost = +(seconds * TWILIO_EUR_PER_SECOND).toFixed(4)
  const { error } = await supabase
    .from('demo_calls')
    .update({
      ended_at:         new Date().toISOString(),
      duration_seconds: seconds,
      openai_cost_eur:  openaiCost,
      twilio_cost_eur:  twilioCost,
    })
    .eq('id', id)
  if (error) {
    console.error('❌ tracking end UPDATE failed:', error.message)
  }
}
