import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'

// Minutes offertes pendant l'essai (cf. useMinutesBalance — même valeur).
const TRIAL_FREE_MINUTES = 30

export interface LedgerEntry {
  id: string
  date: string            // ISO — date de l'opération
  label: string
  credit: number          // minutes créditées (0 si débit)
  debit: number           // minutes débitées (0 si crédit)
  balance: number         // solde cumulé APRÈS cette opération
  kind: 'trial' | 'purchase' | 'call'
}

/**
 * Relevé de compte de minutes (crédit / débit / solde), calculé À LA VOLÉE à
 * partir des sources de vérité — PAS de table dédiée (qui dériverait) :
 *   crédits = minute_purchases (+ 30 min offertes de l'essai)
 *   débits  = appels `completed` (reçus + émis), arrondis à la minute SUPÉRIEURE
 *             par appel (« toute minute entamée est due ») — même règle que la
 *             carte « Minutes disponibles » (useMinutesBalance) → les deux
 *             totaux se réconcilient toujours.
 * Le solde cumulé est calculé du plus ancien au plus récent, puis la liste est
 * renvoyée du plus récent au plus ancien (pour l'affichage).
 */
export function useMinuteLedger() {
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase
        .from('minute_purchases')
        .select('id, pack_name, minutes, created_at')
        .eq('caregiver_id', user.id),
      supabase
        .from('calls')
        .select('id, duration_seconds, ended_at, started_at, scheduled_at, origin, beneficiaries!inner(first_name, caregiver_id)')
        .eq('beneficiaries.caregiver_id', user.id)
        .eq('status', 'completed'),
    ]).then(([pRes, cRes]) => {
      if (!active) return

      const raw: Omit<LedgerEntry, 'balance'>[] = []

      // Crédit d'ouverture : minutes offertes de l'essai (si essai en cours).
      if (subscription?.plan_tier === 'trial' && subscription.status === 'trial') {
        const sub = subscription as unknown as { created_at?: string; service_started_at?: string | null }
        raw.push({
          id: 'trial',
          date: sub.created_at ?? sub.service_started_at ?? new Date(0).toISOString(),
          label: `${TRIAL_FREE_MINUTES} minutes offertes`,
          credit: TRIAL_FREE_MINUTES,
          debit: 0,
          kind: 'trial',
        })
      }

      // Crédits : achats de minutes.
      for (const p of (pRes.data as Array<{ id: string; pack_name: string; minutes: number; created_at: string }> | null) ?? []) {
        raw.push({
          id: `p_${p.id}`,
          date: p.created_at,
          label: `Achat — ${p.pack_name}`,
          credit: p.minutes,
          debit: 0,
          kind: 'purchase',
        })
      }

      // Débits : appels terminés (reçus = sortants AICOUTE ; émis = entrants).
      // deno-lint-ignore no-explicit-any
      for (const c of (cRes.data as any[] | null) ?? []) {
        const minutes = Math.ceil((c.duration_seconds ?? 0) / 60)
        if (minutes <= 0) continue
        const benef = Array.isArray(c.beneficiaries) ? c.beneficiaries[0] : c.beneficiaries
        const prenom: string = benef?.first_name ?? ''
        const recu = c.origin !== 'inbound'
        raw.push({
          id: `c_${c.id}`,
          date: c.ended_at ?? c.started_at ?? c.scheduled_at,
          label: `${recu ? 'Appel reçu' : 'Appel émis'}${prenom ? ` — ${prenom}` : ''}`,
          credit: 0,
          debit: minutes,
          kind: 'call',
        })
      }

      // Solde cumulé : du plus ancien au plus récent.
      raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      let balance = 0
      const withBalance: LedgerEntry[] = raw.map((e) => {
        balance += e.credit - e.debit
        return { ...e, balance }
      })

      // Affichage : plus récent en haut.
      withBalance.reverse()
      setEntries(withBalance)
      setLoading(false)
    })
    return () => { active = false }
  }, [user?.id, subscription?.id])

  return { entries, loading }
}
