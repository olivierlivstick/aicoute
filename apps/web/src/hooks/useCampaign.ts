import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beneficiary, Campaign, CampaignActivityPeriod } from '@modect/shared'

export interface PeriodWithStats extends CampaignActivityPeriod {
  calls_made: number
  connections: number
}

export interface CampaignStats {
  /** Appels effectués (tentatives terminées : abouti / sans réponse / échec). */
  calls_made: number
  /** Temps de conversation cumulé (minutes, appels aboutis). */
  minutes_spent: number
  /** Bénéficiaires restant à joindre (avec téléphone, ni joints ni épuisés). */
  calls_todo: number
}

export type JournalKind = 'go' | 'pause' | 'launched' | 'in_progress' | 'completed' | 'missed' | 'failed'
export interface JournalEntry {
  id: string
  at: string
  kind: JournalKind
  label: string
}

/**
 * Détail d'une campagne : configuration, membres (bénéficiaires), périodes
 * d'activité (segments GO→PAUSE) + actions. RLS scopée org.
 */
export function useCampaign(id: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [members, setMembers] = useState<Beneficiary[]>([])
  const [periods, setPeriods] = useState<PeriodWithStats[]>([])
  // beneficiary_id → date/heure de l'appel ABOUTI (si abouti)
  const [connectedAt, setConnectedAt] = useState<Record<string, string>>({})
  const [stats, setStats] = useState<CampaignStats>({ calls_made: 0, minutes_spent: 0, calls_todo: 0 })
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) { setLoading(false); return }
    const [campRes, memberRes, periodRes, callRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_beneficiaries').select('beneficiary_id, beneficiaries(*)').eq('campaign_id', id),
      supabase.from('campaign_activity_periods').select('*').eq('campaign_id', id).order('started_at', { ascending: false }),
      supabase.from('calls').select('id, beneficiary_id, status, notified_at, started_at, ended_at, duration_seconds, created_at').eq('campaign_id', id),
    ])
    if (campRes.error) { setError(campRes.error.message); setLoading(false); return }

    const camp = campRes.data as Campaign
    setCampaign(camp)
    const memberList = ((memberRes.data ?? []) as unknown as { beneficiaries: Beneficiary }[])
      .map((r) => r.beneficiaries)
      .filter(Boolean)
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
    setMembers(memberList)

    const calls = (callRes.data ?? []) as {
      id: string; beneficiary_id: string; status: string; notified_at: string | null
      started_at: string | null; ended_at: string | null; duration_seconds: number | null; created_at: string
    }[]

    // Date/heure d'aboutissement par bénéficiaire (appel `completed` le plus récent).
    const connected: Record<string, string> = {}
    for (const k of calls) {
      if (k.status !== 'completed') continue
      const t = k.started_at ?? k.ended_at ?? k.created_at
      if (!connected[k.beneficiary_id] || new Date(t) > new Date(connected[k.beneficiary_id])) {
        connected[k.beneficiary_id] = t
      }
    }
    setConnectedAt(connected)

    // KPI agrégés de la campagne (tous segments confondus).
    const TERMINAL = new Set(['completed', 'missed', 'failed'])
    const maxAttempts = camp.retry_count + 1
    const byBenef = new Map<string, typeof calls>()
    for (const k of calls) {
      const arr = byBenef.get(k.beneficiary_id) ?? []
      arr.push(k)
      byBenef.set(k.beneficiary_id, arr)
    }
    const callsMade = calls.filter((k) => TERMINAL.has(k.status)).length
    const minutesSpent = Math.round(
      calls.filter((k) => k.status === 'completed').reduce((s, k) => s + (k.duration_seconds ?? 0), 0) / 60,
    )
    let callsTodo = 0
    for (const m of memberList) {
      if (!m.phone || !m.phone.trim() || m.is_active === false) continue
      const bc = byBenef.get(m.id) ?? []
      if (bc.some((k) => k.status === 'completed')) continue                       // joint
      if (bc.filter((k) => TERMINAL.has(k.status)).length >= maxAttempts) continue // épuisé
      callsTodo++
    }
    setStats({ calls_made: callsMade, minutes_spent: minutesSpent, calls_todo: callsTodo })

    const rawPeriods = (periodRes.data ?? []) as CampaignActivityPeriod[]
    setPeriods(rawPeriods.map((p) => {
      const lo = new Date(p.started_at).getTime()
      const hi = p.ended_at ? new Date(p.ended_at).getTime() : Infinity
      const inWindow = calls.filter((k) => {
        const t = new Date(k.notified_at ?? k.started_at ?? k.created_at).getTime()
        return t >= lo && t <= hi
      })
      return {
        ...p,
        calls_made: inWindow.length,
        connections: inWindow.filter((k) => k.status === 'completed').length,
      }
    }))

    // Journal d'activité : GO/PAUSE + cycle de vie des appels, le plus récent d'abord.
    const nameOf = (bid: string) => {
      const m = memberList.find((x) => x.id === bid)
      return m ? `${m.first_name} ${m.last_name}` : 'un bénéficiaire'
    }
    const entries: JournalEntry[] = []
    for (const p of rawPeriods) {
      entries.push({ id: `go-${p.id}`, at: p.started_at, kind: 'go', label: 'Campagne lancée' })
      if (p.ended_at) entries.push({ id: `pause-${p.id}`, at: p.ended_at, kind: 'pause', label: 'Campagne mise en pause' })
    }
    for (const k of calls) {
      const who = nameOf(k.beneficiary_id)
      const fallback = k.ended_at ?? k.notified_at ?? k.started_at ?? k.created_at
      if (k.notified_at) entries.push({ id: `launch-${k.id}-${k.notified_at}`, at: k.notified_at, kind: 'launched', label: `Appel lancé vers ${who}` })
      if (k.status === 'completed') {
        const mins = k.duration_seconds ? ` (${Math.max(1, Math.round(k.duration_seconds / 60))} min)` : ''
        entries.push({ id: `done-${k.id}`, at: k.ended_at ?? fallback, kind: 'completed', label: `Conversation établie avec ${who}${mins}` })
      } else if (k.status === 'in_progress') {
        entries.push({ id: `prog-${k.id}`, at: k.started_at ?? fallback, kind: 'in_progress', label: `Conversation en cours avec ${who}` })
      } else if (k.status === 'missed') {
        entries.push({ id: `miss-${k.id}`, at: fallback, kind: 'missed', label: `Sans réponse — ${who}` })
      } else if (k.status === 'failed') {
        entries.push({ id: `fail-${k.id}`, at: fallback, kind: 'failed', label: `Échec de l'appel — ${who}` })
      }
    }
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    setJournal(entries.slice(0, 50))

    setLoading(false)
  }, [id])

  useEffect(() => { reload() }, [reload])

  // Tant que la campagne tourne, on rafraîchit (le worker passe des appels en
  // tâche de fond) → l'onglet Activité et les compteurs se mettent à jour seuls.
  useEffect(() => {
    if (campaign?.status !== 'running') return
    const t = setInterval(() => { reload() }, 20_000)
    return () => clearInterval(t)
  }, [campaign?.status, reload])

  const update = useCallback(async (patch: Partial<Campaign>) => {
    if (!id) return false
    const { error: err } = await supabase.from('campaigns').update(patch).eq('id', id)
    if (err) { setError(err.message); return false }
    setCampaign((prev) => (prev ? { ...prev, ...patch } : prev))
    return true
  }, [id])

  const remove = useCallback(async () => {
    if (!id) return false
    const { error: err } = await supabase.from('campaigns').delete().eq('id', id)
    return !err
  }, [id])

  const addMembers = useCallback(async (beneficiaryIds: string[]) => {
    if (!id || beneficiaryIds.length === 0) return false
    const existing = new Set(members.map((m) => m.id))
    const rows = beneficiaryIds
      .filter((bid) => !existing.has(bid))
      .map((bid) => ({ campaign_id: id, beneficiary_id: bid }))
    if (rows.length === 0) return true
    const { error: err } = await supabase.from('campaign_beneficiaries').insert(rows)
    if (err) { setError(err.message); return false }
    await reload()
    return true
  }, [id, members, reload])

  const removeMember = useCallback(async (beneficiaryId: string) => {
    if (!id) return false
    const { error: err } = await supabase
      .from('campaign_beneficiaries')
      .delete()
      .eq('campaign_id', id)
      .eq('beneficiary_id', beneficiaryId)
    if (err) { setError(err.message); return false }
    setMembers((prev) => prev.filter((m) => m.id !== beneficiaryId))
    return true
  }, [id])

  /**
   * Déclenche un appel IMMÉDIAT pour un bénéficiaire, hors file/plage horaire
   * (bouton « Appeler »). L'appel utilise le contexte de la campagne (prompt,
   * persona, langue, durée) car il porte `campaign_id`. Comme tout appel de
   * campagne, un aboutissement le marque `completed` → plus rappelé ensuite.
   */
  const callNow = useCallback(async (beneficiaryId: string) => {
    if (!id) return false
    const { data, error: insErr } = await supabase
      .from('calls')
      .insert({
        beneficiary_id: beneficiaryId,
        campaign_id:    id,
        origin:         'campaign',
        status:         'scheduled',
        scheduled_at:   new Date().toISOString(),
        attempt_number: 1,
      })
      .select('id')
      .single()
    if (insErr || !data) { setError(insErr?.message ?? 'insert échoué'); return false }
    const { error: invErr } = await supabase.functions.invoke('initiate-call', {
      body: { call_id: (data as { id: string }).id },
    })
    if (invErr) { setError(invErr.message); return false }
    await reload()
    return true
  }, [id, reload])

  /** GO : passe en `running` et ouvre une période d'activité si aucune n'est ouverte. */
  const start = useCallback(async () => {
    if (!id) return false
    const { data: open } = await supabase
      .from('campaign_activity_periods')
      .select('id').eq('campaign_id', id).is('ended_at', null).limit(1)
    if (!open || open.length === 0) {
      await supabase.from('campaign_activity_periods').insert({ campaign_id: id })
    }
    const { error: err } = await supabase.from('campaigns').update({ status: 'running' }).eq('id', id)
    if (err) { setError(err.message); return false }
    await reload()
    return true
  }, [id, reload])

  /** PAUSE : ferme la période ouverte et repasse en `paused`. */
  const pause = useCallback(async () => {
    if (!id) return false
    await supabase
      .from('campaign_activity_periods')
      .update({ ended_at: new Date().toISOString() })
      .eq('campaign_id', id).is('ended_at', null)
    const { error: err } = await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id)
    if (err) { setError(err.message); return false }
    await reload()
    return true
  }, [id, reload])

  return { campaign, members, periods, connectedAt, stats, journal, loading, error, reload, update, remove, addMembers, removeMember, callNow, start, pause }
}
