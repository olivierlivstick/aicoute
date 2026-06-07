// Tracking des démos téléphone dans Supabase (table demo_calls).
// Best-effort : si Supabase n'est pas configuré ou si une requête échoue,
// le service voice-bridge continue à fonctionner normalement.

import { createClient } from '@supabase/supabase-js'
// supabase-js initialise un RealtimeClient en interne (souscriptions DB) qui
// exige WebSocket. Node 20 ne l'a pas en natif → on injecte 'ws' (déjà dep).
// Inutile pour nos INSERT/UPDATE mais évite un crash au démarrage.
import WebSocket from 'ws'

// Tarifs ESTIMÉS par durée (alignés sur supabase/functions/log-demo/index.ts).
// Approximation grossière utilisée comme fallback quand on n'a pas les tokens
// réels (ex : appel coupé tôt, ou moteur sans tokens reportés).
//  - Realtime audio mix ~ 0,50 USD/min → ~0,0077 EUR/s (OpenAI ; Gemini est
//    nettement moins cher mais on conserve la même estimation par durée comme
//    borne sup. — le coût RÉEL via tokens reste l'indicateur de référence)
//  - Twilio FR mobile sortant : ~0,0007 EUR/s
const AI_EUR_PER_SECOND     = 0.0077
const TWILIO_EUR_PER_SECOND = 0.0007

// Tarifs RÉELS par token (USD / million de tokens), par moteur.
// Sources :
//   - OpenAI :  https://openai.com/api/pricing/        (gpt-realtime-2)
//   - Gemini :  https://ai.google.dev/pricing          (gemini 2.5 flash native audio)
// Mise à jour : 2026-05. À ajuster si les fournisseurs changent leurs prix.
const RATES_USD_PER_TOKEN = {
  openai: {
    input_audio:        32   / 1_000_000, // non-cached audio in
    input_audio_cached:  0.40 / 1_000_000, // cached audio in (×80 moins cher)
    output_audio:       64   / 1_000_000,
    input_text:          4   / 1_000_000,
    output_text:        24   / 1_000_000,
  },
  // Gemini 2.5 Flash Native Audio : tarification distincte audio vs texte.
  // Pas de cache audio facturé séparément → input_audio_cached à 0.
  gemini: {
    input_audio:         3   / 1_000_000,
    input_audio_cached:  0,
    output_audio:       12   / 1_000_000,
    input_text:          0.50 / 1_000_000,
    output_text:         2   / 1_000_000,
  },
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
export async function recordDemoStart(phoneNumber, engine = 'openai') {
  if (!supabase) return null
  const phonePrefix = phoneNumber.slice(0, 6) // ex: "+33619"
  const { data, error } = await supabase
    .from('demo_calls')
    .insert({
      mode:         'phone',
      engine,
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
 * Calcule le coût IA RÉEL en EUR à partir des tokens accumulés, pour le moteur
 * indiqué. tokens = { input_audio, input_audio_cached, output_audio, input_text, output_text }
 * Retourne un nombre arrondi à 4 décimales (ex: 0.0843).
 */
export function computeAiCostEur(engine, tokens) {
  const r = RATES_USD_PER_TOKEN[engine] ?? RATES_USD_PER_TOKEN.openai
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
 * on calcule en plus le coût IA RÉEL (tarif selon `engine`) et on stocke les
 * tokens. Sinon seule l'estimation par durée est enregistrée (fallback si
 * aucun event usage n'a été reçu — appel coupé trop tôt typiquement).
 *
 * Le coût "réel" est écrit dans la colonne `openai_cost_eur_real` quel que
 * soit le moteur (colonne réutilisée pour les deux engines, discriminée par
 * la colonne `engine` au niveau du dashboard).
 *
 * Silencieux si l'id est null ou si l'UPDATE échoue.
 */
export async function recordDemoEnd(id, durationSeconds, tokens, engine = 'openai', fluidity = null) {
  if (!supabase || !id) return
  const seconds    = Math.max(1, Math.round(durationSeconds))
  const aiCost     = +(seconds * AI_EUR_PER_SECOND).toFixed(4)
  const twilioCost = +(seconds * TWILIO_EUR_PER_SECOND).toFixed(4)

  const update = {
    ended_at:         new Date().toISOString(),
    duration_seconds: seconds,
    openai_cost_eur:  aiCost,
    twilio_cost_eur:  twilioCost,
  }

  // Snapshot de fluidité (Étape 0 — observation). Best-effort.
  if (fluidity) update.fluidity_metrics = fluidity

  if (tokens) {
    update.openai_cost_eur_real      = computeAiCostEur(engine, tokens)
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

/**
 * Écrit UNIQUEMENT le coût IA RÉEL + tokens sur une démo (typiquement web Gemini).
 *
 * Pour les démos WEB, ended_at/duration/estimation sont écrits par le CLIENT via
 * l'Edge Function log-demo. Mais les tokens (donc le coût réel) ne sont visibles
 * que côté SERVEUR : pour Gemini web, ils sont captés par le proxy
 * gemini-bridge-web.js. On complète donc la row avec le coût réel sans toucher
 * aux colonnes gérées par log-demo (colonnes disjointes → pas de course d'écriture).
 *
 * Silencieux si id null / supabase absent / pas de tokens.
 */
export async function recordDemoRealCost(id, tokens, engine = 'openai', fluidity = null) {
  if (!supabase || !id || !tokens) return
  const update = {
    openai_cost_eur_real:      computeAiCostEur(engine, tokens),
    tokens_input_audio:        tokens.input_audio        ?? 0,
    tokens_input_audio_cached: tokens.input_audio_cached ?? 0,
    tokens_output_audio:       tokens.output_audio       ?? 0,
    tokens_input_text:         tokens.input_text         ?? 0,
    tokens_output_text:        tokens.output_text        ?? 0,
  }
  // Snapshot de fluidité (Étape 0). Colonne disjointe de log-demo → pas de course.
  if (fluidity) update.fluidity_metrics = fluidity
  const { error } = await supabase.from('demo_calls').update(update).eq('id', id)
  if (error) console.error('❌ tracking realCost UPDATE failed:', error.message)
}
