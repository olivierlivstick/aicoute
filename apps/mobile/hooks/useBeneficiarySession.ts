/**
 * Récupère le profil bénéficiaire lié à la session Supabase courante,
 * ainsi que le prochain appel planifié.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beneficiary, Call } from '@modect/shared'

export interface BeneficiarySession {
  beneficiary: Beneficiary | null
  nextCall:    Call | null
  loading:     boolean
  error:       string | null
}

export function useBeneficiarySession(): BeneficiarySession {
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [nextCall,    setNextCall]    = useState<Call | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        // Le bénéficiaire est lié à l'utilisateur via son profil
        const { data: ben, error: benErr } = await supabase
          .from('beneficiaries')
          .select('*')
          .eq('id', user.id)   // L'app mobile connecte le bénéficiaire directement
          .maybeSingle()

        if (benErr) throw new Error(benErr.message)
        setBeneficiary(ben)

        if (ben) {
          const { data: call } = await supabase
            .from('calls')
            .select('*')
            .eq('beneficiary_id', ben.id)
            .in('status', ['scheduled', 'notified'])
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          setNextCall(call)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    load()

    // Réécouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  return { beneficiary, nextCall, loading, error }
}
