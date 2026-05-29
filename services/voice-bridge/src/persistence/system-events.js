// Helper d'écriture dans `system_events` depuis le voice-bridge.
//
// Best-effort, jamais bloquant. Réutilise le client Supabase déjà initialisé
// dans persistence/modect-call.js (même URL/clé) — on duplique l'init plutôt
// que de croiser les imports, c'est 5 lignes.

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
 * @param {{
 *   level:    'debug'|'info'|'warn'|'error',
 *   source:   string,
 *   message:  string,
 *   call_id?: string|null,
 *   payload?: object|null,
 * }} ev
 */
export async function logEvent(ev) {
  if (!supabase) return  // pas de Supabase configuré → silent skip
  try {
    const { error } = await supabase.from('system_events').insert({
      level:   ev.level,
      source:  ev.source,
      message: ev.message,
      call_id: ev.call_id ?? null,
      payload: ev.payload ?? null,
    })
    if (error) console.error(`[system_events] insert failed: ${error.message}`)
  } catch (err) {
    console.error('[system_events] exception:', err?.message || err)
  }
}
