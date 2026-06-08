// Persistence des APPELS ENTRANTS (le bénéficiaire appelle AICOUTE).
//
// Distinct de modect-call.js (appels sortants planifiés) et tracking.js (démos).
// Réutilise le MÊME client service-role (by-pass RLS : le voice-bridge n'a pas
// de session aidant). Best-effort : si Supabase absent, no-op → le webhook
// /inbound-voice refusera l'appel (pas d'identification possible).
//
// Garde-fous (cf. migration 20260608000004 + 20260608000005) :
//   - inbound_enabled           : interrupteur maître par bénéficiaire
//   - inbound_max_minutes_per_day : budget de conversation entrante / 24h
//   - inbound_cooldown_minutes  : délai mini entre deux appels entrants
//   - inbound_max_duration_seconds : coupe-circuit de durée (appliqué côté WS)

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

/**
 * Normalise un numéro pour comparaison : ne garde que `+` et les chiffres.
 * Élimine espaces, tirets, parenthèses ET les caractères Unicode invisibles
 * (U+202D/U+202C) que les répertoires téléphoniques collent parfois — cf. le
 * piège connu côté appels Twilio. Les `beneficiaries.phone` qui reçoivent déjà
 * des appels planifiés sont en E.164 (Twilio l'exige), donc la comparaison
 * exacte après normalisation suffit.
 */
export function normalizePhone(s) {
  return String(s || '').replace(/[^\d+]/g, '')
}

/**
 * Identifie le bénéficiaire à partir du numéro appelant (Twilio `From`).
 *
 * On ne scanne QUE les bénéficiaires `inbound_enabled = true` (ensemble réduit :
 * l'option est OFF par défaut). On normalise leur `phone` en JS et on compare au
 * `From` normalisé → robuste au piège Unicode + aux variations d'espaces, sans
 * colonne dénormalisée ni scan de toute la table.
 *
 * @returns {object|null} le bénéficiaire (id + config inbound + preferred_engine)
 *   ou null si numéro inconnu / canal désactivé.
 */
export async function findBeneficiaryForInbound(fromPhone) {
  if (!supabase) return null
  const fromNorm = normalizePhone(fromPhone)
  if (!fromNorm) return null

  const { data, error } = await supabase
    .from('beneficiaries')
    .select('id, first_name, phone, preferred_engine, inbound_max_minutes_per_day, inbound_cooldown_minutes, inbound_max_duration_seconds')
    .eq('inbound_enabled', true)
  if (error) {
    console.error('❌ [inbound-call] findBeneficiary:', error.message)
    return null
  }
  return (data ?? []).find((b) => normalizePhone(b.phone) === fromNorm) ?? null
}

/**
 * Évalue les garde-fous de coût pour un bénéficiaire identifié.
 * Une seule requête : les appels entrants des dernières 24h (cooldown = le plus
 * récent ; budget = somme des durées).
 *
 * @returns {{ ok: boolean, reason: 'cooldown'|'quota'|null, detail?: object }}
 */
export async function evaluateInboundQuota(beneficiary) {
  if (!supabase) return { ok: false, reason: 'quota' }

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('calls')
    .select('created_at, duration_seconds')
    .eq('beneficiary_id', beneficiary.id)
    .eq('origin', 'inbound')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('❌ [inbound-call] evaluateQuota:', error.message)
    return { ok: false, reason: 'quota' }  // en cas de doute, on refuse (coût d'abord)
  }

  const rows = data ?? []

  // Cooldown : délai depuis le dernier appel entrant (quel que soit son statut).
  const cooldownMin = beneficiary.inbound_cooldown_minutes ?? 30
  if (cooldownMin > 0 && rows.length > 0) {
    const lastMs = Date.parse(rows[0].created_at)
    const elapsedMin = (Date.now() - lastMs) / 60000
    if (elapsedMin < cooldownMin) {
      return { ok: false, reason: 'cooldown', detail: { elapsedMin: Math.round(elapsedMin), cooldownMin } }
    }
  }

  // Budget quotidien en minutes : somme des durées des appels entrants /24h.
  const maxMin = beneficiary.inbound_max_minutes_per_day ?? 30
  const usedSec = rows.reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0)
  if (usedSec / 60 >= maxMin) {
    return { ok: false, reason: 'quota', detail: { usedMin: Math.round(usedSec / 60), maxMin } }
  }

  return { ok: true, reason: null }
}

/**
 * Crée la ligne `calls` d'un appel entrant, déjà en cours (le bénéficiaire est
 * en ligne). origin='inbound', sans schedule_id, attempt_number=1.
 * scheduled_at = now() (colonne NOT NULL ; = instant de l'appel).
 *
 * @returns {string|null} l'id du call créé, ou null si échec.
 */
export async function createInboundCall(beneficiaryId, engine, twilioSid) {
  if (!supabase || !beneficiaryId) return null
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('calls')
    .insert({
      beneficiary_id:  beneficiaryId,
      origin:          'inbound',
      status:          'in_progress',
      attempt_number:  1,
      scheduled_at:    nowIso,
      started_at:      nowIso,
      engine,
      twilio_call_sid: twilioSid ?? null,
    })
    .select('id')
    .single()
  if (error) {
    console.error('❌ [inbound-call] createInboundCall:', error.message)
    return null
  }
  return data?.id ?? null
}
