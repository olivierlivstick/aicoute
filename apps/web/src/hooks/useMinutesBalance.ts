import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import type { MinutePurchase } from '@modect/shared'

// Minutes offertes pendant l'essai gratuit (« 30 minutes offertes »).
const TRIAL_FREE_MINUTES = 30

/**
 * Solde de minutes du compte aidant :
 *   disponibles = (minutes offertes essai + minutes achetées) − minutes consommées
 * Les minutes consommées = somme des durées des appels TERMINÉS (reçus + émis)
 * de tous les bénéficiaires de l'aidant. Lecture seule (le paiement = phase 2).
 */
export function useMinutesBalance() {
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const [purchases, setPurchases] = useState<MinutePurchase[]>([])
  const [consumedSeconds, setConsumedSeconds] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase
        .from('minute_purchases')
        .select('*')
        .eq('caregiver_id', user.id)
        .order('created_at', { ascending: false }),
      // Appels terminés (reçus + émis) des bénéficiaires de l'aidant.
      supabase
        .from('calls')
        .select('duration_seconds, beneficiaries!inner(caregiver_id)')
        .eq('beneficiaries.caregiver_id', user.id)
        .eq('status', 'completed'),
    ]).then(([pRes, cRes]) => {
      if (!active) return
      setPurchases((pRes.data as MinutePurchase[] | null) ?? [])
      const secs = ((cRes.data as { duration_seconds: number | null }[] | null) ?? [])
        .reduce((s, c) => s + (c.duration_seconds ?? 0), 0)
      setConsumedSeconds(secs)
      setLoading(false)
    })
    return () => { active = false }
  }, [user?.id])

  const purchasedMinutes = purchases.reduce((s, p) => s + p.minutes, 0)
  const trialMinutes =
    subscription?.plan_tier === 'trial' && subscription.status === 'trial' ? TRIAL_FREE_MINUTES : 0
  const consumedMinutes = Math.round(consumedSeconds / 60)
  const stockMinutes = trialMinutes + purchasedMinutes
  const availableMinutes = stockMinutes - consumedMinutes

  return {
    purchases,
    purchasedMinutes,
    trialMinutes,
    consumedMinutes,
    stockMinutes,
    availableMinutes,
    loading,
  }
}
