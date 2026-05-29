import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SessionSchedule } from '@modect/shared'

/**
 * Belt+suspenders avec le trigger SQL session_schedules_regenerate_calls
 * (migration 20260529000005). Si le trigger DB plante (réseau, secret, ...),
 * le client-side garde la cohérence. Idempotent grâce au UNIQUE index sur
 * calls(schedule_id, scheduled_at). Best-effort : on n'attend pas la réponse
 * pour ne pas ralentir le retour UI.
 */
function regenerateFutureCalls(scheduleId?: string): void {
  void supabase.functions.invoke('regenerate-future-calls', {
    body: scheduleId ? { schedule_id: scheduleId } : {},
  }).catch((err) => console.warn('[regenerate-future-calls] invoke failed:', err))
}

export function useSessionSchedules(beneficiaryId?: string) {
  const [schedules, setSchedules] = useState<SessionSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      // Préférence : vue v_schedules_with_history (ajoute last_call_at + total_calls_completed).
      let query = supabase.from('v_schedules_with_history').select('*')
      if (beneficiaryId) query = query.eq('beneficiary_id', beneficiaryId)
      let { data, error: err } = await query.order('time_of_day', { ascending: true })

      // Fallback : si la vue n'existe pas (migration v2 pas appliquée), retomber sur la table.
      if (err) {
        console.warn('[useSessionSchedules] vue indisponible, fallback table:', err.message)
        let tableQuery = supabase.from('session_schedules').select('*')
        if (beneficiaryId) tableQuery = tableQuery.eq('beneficiary_id', beneficiaryId)
        const r = await tableQuery.order('time_of_day', { ascending: true })
        data = r.data
        err  = r.error
      }

      if (err) setError(err.message)
      else setSchedules((data ?? []) as SessionSchedule[])
    } finally {
      setLoading(false)
    }
  }, [beneficiaryId])

  useEffect(() => { fetch() }, [fetch])

  return { schedules, loading, error, refetch: fetch }
}

export async function createSchedule(
  data: Omit<SessionSchedule, 'id' | 'created_at' | 'updated_at'>
): Promise<SessionSchedule | null> {
  const { data: result, error } = await supabase
    .from('session_schedules')
    .insert(data)
    .select('*')
    .single()
  if (error) return null
  const schedule = result as SessionSchedule
  regenerateFutureCalls(schedule.id)
  return schedule
}

export async function updateSchedule(
  id: string,
  updates: Partial<SessionSchedule>
): Promise<boolean> {
  const { error } = await supabase
    .from('session_schedules')
    .update(updates)
    .eq('id', id)
  if (error) return false
  regenerateFutureCalls(id)
  return true
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('session_schedules')
    .delete()
    .eq('id', id)
  if (error) return false
  // Le trigger SQL DELETE va régénérer (= supprimer les futurs calls), mais on
  // le déclenche aussi côté client pour ne pas laisser de calls orphelins
  // visibles entre-temps si le trigger est lent.
  regenerateFutureCalls(id)
  return true
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<boolean> {
  return updateSchedule(id, { is_active: isActive })
}

/**
 * Mettre un planning en pause : désactive + reset next_scheduled_at. La
 * régénération (côté client + trigger SQL) supprime ensuite les futurs
 * calls 'scheduled' liés à ce planning. Les calls déjà en 'notified',
 * 'in_progress' ou complétés sont laissés intacts par regenerate-future-calls
 * (qui ne touche qu'aux status='scheduled' avec scheduled_at >= now).
 */
export async function pauseSchedule(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('session_schedules')
    .update({ is_active: false, next_scheduled_at: null })
    .eq('id', id)
  if (error) return false
  regenerateFutureCalls(id)
  return true
}

/**
 * Réactiver un planning : remet is_active=true. Le trigger SQL
 * `session_schedule_calc_next` recalcule next_scheduled_at, et notre nouveau
 * trigger session_schedules_regenerate_calls + l'appel client ci-dessous
 * pré-créent les futurs calls.
 */
export async function activateSchedule(id: string): Promise<boolean> {
  return updateSchedule(id, { is_active: true })
}
