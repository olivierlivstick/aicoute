import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beneficiary, Campaign, CampaignActivityPeriod } from '@modect/shared'

export interface PeriodWithStats extends CampaignActivityPeriod {
  calls_made: number
  connections: number
}

/**
 * Détail d'une campagne : configuration, membres (bénéficiaires), périodes
 * d'activité (segments GO→PAUSE) + actions. RLS scopée org.
 */
export function useCampaign(id: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [members, setMembers] = useState<Beneficiary[]>([])
  const [periods, setPeriods] = useState<PeriodWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) { setLoading(false); return }
    const [campRes, memberRes, periodRes, callRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_beneficiaries').select('beneficiary_id, beneficiaries(*)').eq('campaign_id', id),
      supabase.from('campaign_activity_periods').select('*').eq('campaign_id', id).order('started_at', { ascending: false }),
      supabase.from('calls').select('status, notified_at, started_at, created_at').eq('campaign_id', id),
    ])
    if (campRes.error) { setError(campRes.error.message); setLoading(false); return }

    setCampaign(campRes.data as Campaign)
    setMembers(
      ((memberRes.data ?? []) as unknown as { beneficiaries: Beneficiary }[])
        .map((r) => r.beneficiaries)
        .filter(Boolean)
        .sort((a, b) => a.last_name.localeCompare(b.last_name))
    )

    const calls = (callRes.data ?? []) as { status: string; notified_at: string | null; started_at: string | null; created_at: string }[]
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

  return { campaign, members, periods, loading, error, reload, update, remove, addMembers, removeMember, callNow, start, pause }
}
