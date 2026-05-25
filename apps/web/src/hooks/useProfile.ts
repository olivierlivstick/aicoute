import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@modect/shared'

export function useProfile() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProfile = useCallback(async (
    userId: string,
    updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'timezone' | 'avatar_url' | 'agent_model' | 'agent_extra_prompt'>>
  ) => {
    setLoading(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    if (err) setError(err.message)
    setLoading(false)
    return !err
  }, [])

  return { updateProfile, loading, error }
}
