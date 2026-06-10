import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MinutePurchase } from '@modect/shared'

// Minutes offertes pendant l'essai gratuit (« 30 minutes offertes »).
const TRIAL_FREE_MINUTES = 30

/**
 * Solde de minutes d'un compte aidant :
 *   disponibles = (offertes essai + achetées + crédits admin) − consommées
 * Les minutes consommées = somme des appels TERMINÉS (reçus + émis), chacun
 * arrondi à la minute SUPÉRIEURE (« toute minute entamée est due ») — même règle
 * que le relevé (useMinuteLedger) → carte et relevé se réconcilient toujours.
 *
 * `caregiverId` optionnel : par défaut l'utilisateur connecté (back-office aidant).
 * Renseigné, lit le solde d'un AUTRE aidant (vue admin) — la RLS admin autorise
 * la lecture de minute_purchases / calls / minute_adjustments / subscriptions.
 */
export function useMinutesBalance(caregiverId?: string) {
  const { user } = useAuth()
  const id = caregiverId ?? user?.id ?? null

  const [purchases, setPurchases] = useState<MinutePurchase[]>([])
  const [consumedMinutes, setConsumedMinutes] = useState(0)
  const [adjustmentMinutes, setAdjustmentMinutes] = useState(0)
  const [trialMinutes, setTrialMinutes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  // Rafraîchit le solde après un crédit (code, achat direct, crédit admin).
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase
        .from('minute_purchases')
        .select('*')
        .eq('caregiver_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('calls')
        .select('duration_seconds, beneficiaries!inner(caregiver_id)')
        .eq('beneficiaries.caregiver_id', id)
        .eq('status', 'completed'),
      supabase
        .from('minute_adjustments')
        .select('minutes')
        .eq('caregiver_id', id),
      supabase
        .from('subscriptions')
        .select('plan_tier, status')
        .eq('caregiver_id', id)
        .in('status', ['trial', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([pRes, cRes, aRes, sRes]) => {
      if (!active) return
      setPurchases((pRes.data as MinutePurchase[] | null) ?? [])
      const mins = ((cRes.data as { duration_seconds: number | null }[] | null) ?? [])
        .reduce((s, c) => s + Math.ceil((c.duration_seconds ?? 0) / 60), 0)
      setConsumedMinutes(mins)
      const adj = ((aRes.data as { minutes: number }[] | null) ?? [])
        .reduce((s, a) => s + (a.minutes ?? 0), 0)
      setAdjustmentMinutes(adj)
      const sub = sRes.data as { plan_tier?: string; status?: string } | null
      setTrialMinutes(sub?.plan_tier === 'trial' && sub.status === 'trial' ? TRIAL_FREE_MINUTES : 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [id, reloadKey])

  const purchasedMinutes = purchases.reduce((s, p) => s + p.minutes, 0)
  const stockMinutes = trialMinutes + purchasedMinutes + adjustmentMinutes
  const availableMinutes = stockMinutes - consumedMinutes

  return {
    purchases,
    purchasedMinutes,
    trialMinutes,
    adjustmentMinutes,
    consumedMinutes,
    stockMinutes,
    availableMinutes,
    loading,
    reload,
  }
}
