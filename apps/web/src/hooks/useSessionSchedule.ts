import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SessionSchedule } from '@modect/shared'

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
  return result as SessionSchedule
}

export async function updateSchedule(
  id: string,
  updates: Partial<SessionSchedule>
): Promise<boolean> {
  const { error } = await supabase
    .from('session_schedules')
    .update(updates)
    .eq('id', id)
  return !error
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('session_schedules')
    .delete()
    .eq('id', id)
  return !error
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<boolean> {
  return updateSchedule(id, { is_active: isActive })
}

/**
 * Mettre un planning en pause : désactive + reset next_scheduled_at + supprime
 * les calls futurs encore en 'scheduled' (pas encore notifiés). Les calls déjà
 * en 'notified', 'in_progress' ou complétés sont laissés intacts.
 */
export async function pauseSchedule(id: string): Promise<boolean> {
  const { error: updErr } = await supabase
    .from('session_schedules')
    .update({ is_active: false, next_scheduled_at: null })
    .eq('id', id)
  if (updErr) return false

  // Supprimer les calls futurs encore 'scheduled' pour ce planning
  const nowIso = new Date().toISOString()
  await supabase
    .from('calls')
    .delete()
    .eq('schedule_id', id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', nowIso)

  return true
}

/**
 * Réactiver un planning : remet is_active=true. Le trigger SQL
 * `session_schedule_calc_next` recalcule automatiquement next_scheduled_at.
 */
export async function activateSchedule(id: string): Promise<boolean> {
  return updateSchedule(id, { is_active: true })
}
