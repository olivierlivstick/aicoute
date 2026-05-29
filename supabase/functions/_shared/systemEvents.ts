/**
 * Helper d'écriture dans `system_events` depuis les Edge Functions.
 *
 * Best-effort, jamais bloquant : si l'INSERT échoue, on logue console.error
 * mais on ne fait pas remonter l'erreur (les flows métier ne doivent pas
 * planter parce que la table de log est down).
 */

type SupabaseLike = {
  from: (table: string) => {
    insert: (row: object) => Promise<{ error: { message: string } | null }>
  }
}

export type EventLevel = 'debug' | 'info' | 'warn' | 'error'

export interface SystemEventInput {
  level:    EventLevel
  source:   string
  message:  string
  call_id?: string | null
  payload?: Record<string, unknown> | null
}

export async function logEvent(supabase: SupabaseLike, ev: SystemEventInput): Promise<void> {
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
    console.error('[system_events] insert exception:', err instanceof Error ? err.message : err)
  }
}
