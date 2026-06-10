import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Minutes offertes pendant l'essai (cf. useMinutesBalance — même valeur).
const TRIAL_FREE_MINUTES = 30

export interface LedgerEntry {
  id: string
  date: string            // ISO — date de l'opération
  label: string
  credit: number          // minutes créditées (0 si débit)
  debit: number           // minutes débitées (0 si crédit)
  balance: number         // solde cumulé APRÈS cette opération
  kind: 'trial' | 'purchase' | 'call' | 'adjustment'
}

/**
 * Relevé de compte de minutes (crédit / débit / solde), calculé À LA VOLÉE à
 * partir des sources de vérité — PAS de table dédiée :
 *   crédits = minute_purchases + crédits admin (minute_adjustments) + 30 min essai
 *   débits  = appels `completed` (reçus + émis), arrondis à la minute SUPÉRIEURE
 *             par appel — même règle que la carte « Minutes disponibles ».
 * Solde cumulé du plus ancien au plus récent, renvoyé du plus récent au plus ancien.
 *
 * `caregiverId` optionnel : par défaut l'utilisateur connecté ; renseigné, lit le
 * relevé d'un autre aidant (vue admin, autorisée par la RLS admin).
 */
export function useMinuteLedger(caregiverId?: string) {
  const { user } = useAuth()
  const id = caregiverId ?? user?.id ?? null
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase
        .from('minute_purchases')
        .select('id, pack_name, minutes, created_at')
        .eq('caregiver_id', id),
      supabase
        .from('calls')
        .select('id, duration_seconds, ended_at, started_at, scheduled_at, origin, beneficiaries!inner(first_name, caregiver_id)')
        .eq('beneficiaries.caregiver_id', id)
        .eq('status', 'completed'),
      // Crédits admin. On NE lit PAS le motif : côté aidant c'est volontairement
      // neutre (« Minutes offertes ») — le motif reste interne (vu côté admin).
      supabase
        .from('minute_adjustments')
        .select('id, minutes, created_at')
        .eq('caregiver_id', id),
      supabase
        .from('subscriptions')
        .select('plan_tier, status, created_at, service_started_at')
        .eq('caregiver_id', id)
        .in('status', ['trial', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([pRes, cRes, aRes, sRes]) => {
      if (!active) return

      const raw: Omit<LedgerEntry, 'balance'>[] = []

      // Crédit d'ouverture : minutes offertes de l'essai (si essai en cours).
      const sub = sRes.data as { plan_tier?: string; status?: string; created_at?: string; service_started_at?: string | null } | null
      if (sub?.plan_tier === 'trial' && sub.status === 'trial') {
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

      // Crédits admin (geste commercial / cadeau / test prolongé). Libellé neutre.
      for (const a of (aRes.data as Array<{ id: string; minutes: number; created_at: string }> | null) ?? []) {
        const m = a.minutes ?? 0
        if (m === 0) continue
        raw.push({
          id: `a_${a.id}`,
          date: a.created_at,
          label: m > 0 ? 'Minutes offertes' : 'Ajustement',
          credit: m > 0 ? m : 0,
          debit: m < 0 ? -m : 0,
          kind: 'adjustment',
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
  }, [id, reloadKey])

  return { entries, loading, reload }
}
