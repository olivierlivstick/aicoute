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
    // .select().maybeSingle() : on récupère la ligne modifiée pour détecter un
    // échec silencieux (RLS qui n'autorise aucune ligne → pas d'erreur mais data null).
    const { data, error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .maybeSingle()
    setLoading(false)
    if (err) {
      setError(err.message)
      return false
    }
    if (!data) {
      setError("Mise à jour refusée : aucune ligne modifiée (droits insuffisants ?).")
      return false
    }
    return true
  }, [])

  return { updateProfile, loading, error }
}
