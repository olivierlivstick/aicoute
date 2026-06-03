import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PLAN_TIERS, type Subscription, type PlanTier } from '@modect/shared'

/**
 * Abonnement du compte aidant courant (un seul abonnement « vivant » par compte).
 *
 * Expose l'abonnement actif (trial/active), des dérivés utiles (limite d'appels,
 * jours d'essai restants, expiration) et `startTrial()` pour démarrer l'essai
 * gratuit (3 appels/semaine, 1 mois à compter du 1er appel).
 */
export function useSubscription() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) { setSubscription(null); setLoading(false); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('caregiver_id', user.id)
      .in('status', ['trial', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (err) setError(err.message)
    else setSubscription((data as Subscription | null) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  // Démarre l'essai gratuit (idempotent : l'index unique partiel empêche un
  // second abonnement vivant ; en cas de doublon on recharge simplement).
  const startTrial = useCallback(async (): Promise<boolean> => {
    if (!user) return false
    const tier: PlanTier = 'trial'
    const { error: err } = await supabase.from('subscriptions').insert({
      caregiver_id:       user.id,
      plan_tier:          tier,
      status:             'trial',
      max_calls_per_week: PLAN_TIERS[tier].callsPerWeek,
    })
    if (err) {
      setError(err.message)
      // Un abonnement vivant existe déjà → on recharge et on considère OK.
      await fetch()
      return !err.message.includes('duplicate') ? false : true
    }
    await fetch()
    return true
  }, [user, fetch])

  // --- Dérivés ---
  const maxCallsPerWeek = subscription?.max_calls_per_week ?? 0
  const isExpired = subscription?.status === 'expired'
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null

  return {
    subscription,
    loading,
    error,
    refetch: fetch,
    startTrial,
    maxCallsPerWeek,
    isExpired,
    trialDaysLeft,
  }
}
