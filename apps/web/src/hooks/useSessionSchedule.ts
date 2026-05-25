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
      let query = supabase.from('session_schedules').select('*')
      if (beneficiaryId) query = query.eq('beneficiary_id', beneficiaryId)
      const { data, error: err } = await query.order('time_of_day', { ascending: true })
      if (err) setError(err.message)
      else setSchedules(data as SessionSchedule[])
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
