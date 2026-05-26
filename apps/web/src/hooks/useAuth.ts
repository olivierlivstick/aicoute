import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@modect/shared'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data as Profile | null
  }, [])

  useEffect(() => {
    // Récupérer la session initiale — session en priorité, profil en background
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({ ...prev, session, user: session?.user ?? null, loading: false }))
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) =>
          setState((prev) => ({ ...prev, profile }))
        ).catch(() => {/* profile optionnel */})
      }
    }).catch(() => {
      setState((prev) => ({ ...prev, loading: false }))
    })

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState((prev) => ({ ...prev, session, user: session?.user ?? null, loading: false }))
        if (session?.user) {
          fetchProfile(session.user.id).then((profile) =>
            setState((prev) => ({ ...prev, profile }))
          ).catch(() => {/* profile optionnel */})
        }
      }
    )

    return () => { subscription.unsubscribe() }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { ...state, signOut }
}
