// Réglages « Diagnostic fluidité » (table singleton app_settings) + stockage des
// WAV de calibration. Lu/écrit par le voice-bridge via le service role.
//
// Deux usages :
//   - readAppSettings()      : l'appel démo doit-il être enregistré pour calibration ?
//   - setKeepRecording(n)    : décrémente le compteur après avoir lancé un enregistrement.
//   - storeRecordingWav(...)  : dépose un WAV dans le bucket privé + renvoie un lien signé.
//
// Best-effort : si Supabase n'est pas configuré, tout renvoie des valeurs neutres
// (pas d'enregistrement, pas d'upload) sans jamais planter l'appel.

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

const BUCKET = 'fluidity-recordings'

/** @returns {Promise<{ diagnosticEnabled: boolean, keepRecordingRemaining: number }>} */
export async function readAppSettings() {
  const neutral = { diagnosticEnabled: false, keepRecordingRemaining: 0 }
  if (!supabase) return neutral
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('fluidity_diagnostic_enabled, fluidity_keep_recording_remaining')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return neutral
    return {
      diagnosticEnabled:      !!data.fluidity_diagnostic_enabled,
      keepRecordingRemaining: data.fluidity_keep_recording_remaining ?? 0,
    }
  } catch (err) {
    console.error('[fluidity-diag] readAppSettings:', err?.message || err)
    return neutral
  }
}

/**
 * Fixe la valeur absolue du compteur d'enregistrements restants (best-effort).
 * On lit puis on écrit la valeur cible côté appelant — les appels démo sont rares
 * (tests manuels) donc la course est négligeable.
 */
export async function setKeepRecording(remaining) {
  if (!supabase) return
  try {
    const { error } = await supabase
      .from('app_settings')
      .update({ fluidity_keep_recording_remaining: Math.max(0, remaining), updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) console.error(`[fluidity-diag] setKeepRecording: ${error.message}`)
  } catch (err) {
    console.error('[fluidity-diag] setKeepRecording exception:', err?.message || err)
  }
}

/**
 * Dépose un WAV dans le bucket privé et renvoie un lien signé (7 jours), ou null.
 * @param {Uint8Array|Buffer} bytes  contenu WAV
 * @param {string} path              chemin dans le bucket (ex: "demo/CAxxx.wav")
 */
export async function storeRecordingWav(bytes, path) {
  if (!supabase) return null
  try {
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'audio/wav',
      upsert:      true,
    })
    if (up.error) {
      console.error(`[fluidity-diag] upload: ${up.error.message}`)
      return null
    }
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
    if (signed.error) {
      console.error(`[fluidity-diag] signedUrl: ${signed.error.message}`)
      return null
    }
    return signed.data?.signedUrl ?? null
  } catch (err) {
    console.error('[fluidity-diag] storeRecordingWav exception:', err?.message || err)
    return null
  }
}

/**
 * Attache le chemin d'un WAV à sa ligne d'appel, par Twilio CallSid.
 * On essaie d'abord `calls` (appels planifiés + entrants AICOUTE), puis
 * `demo_calls` (démos vitrine/test) — les SID Twilio sont uniques, pas de
 * collision. Best-effort : aucun match → no-op silencieux.
 *
 * @param {string} callSid  Twilio CallSid (RecordingStatus.CallSid)
 * @param {string} path     chemin dans le bucket (ex: "calls/CAxxx.wav")
 */
export async function attachRecordingPath(callSid, path) {
  if (!supabase || !callSid || !path) return
  try {
    const { data, error } = await supabase
      .from('calls')
      .update({ recording_path: path })
      .eq('twilio_call_sid', callSid)
      .select('id')
    if (!error && data && data.length) return  // matché côté appels AICOUTE
    await supabase.from('demo_calls').update({ recording_path: path }).eq('twilio_call_sid', callSid)
  } catch (err) {
    console.error('[fluidity-diag] attachRecordingPath:', err?.message || err)
  }
}
