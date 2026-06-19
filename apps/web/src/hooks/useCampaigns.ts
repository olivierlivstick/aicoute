import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Campaign } from '@modect/shared'

export interface CampaignWithStats extends Campaign {
  nb_beneficiaries: number
  /** Appels déjà tentés pour la campagne (toutes issues). */
  calls_made: number
  /** Appels restant à passer (≈ bénéficiaires pas encore joints). */
  calls_todo: number
  /** Communications abouties (bénéficiaires distincts avec un appel `completed`). */
  connections: number
}

/**
 * Liste des campagnes de l'organisation + compteurs dérivés (RLS scopée org).
 * Les compteurs sont calculés côté client à partir des membres + des appels
 * `campaign_id` ; tant que le moteur (Lot 3) n'a pas tourné, seuls les
 * bénéficiaires sont non nuls.
 */
export function useCampaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const [campRes, memberRes, callRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_beneficiaries').select('campaign_id, beneficiary_id'),
      supabase.from('calls').select('campaign_id, beneficiary_id, status').not('campaign_id', 'is', null),
    ])
    if (campRes.error) { setError(campRes.error.message); setLoading(false); return }

    const members = (memberRes.data ?? []) as { campaign_id: string; beneficiary_id: string }[]
    const calls = (callRes.data ?? []) as { campaign_id: string; beneficiary_id: string; status: string }[]

    const list = ((campRes.data ?? []) as Campaign[]).map((c) => {
      const nb = members.filter((m) => m.campaign_id === c.id).length
      const cCalls = calls.filter((k) => k.campaign_id === c.id)
      const connected = new Set(
        cCalls.filter((k) => k.status === 'completed').map((k) => k.beneficiary_id)
      )
      return {
        ...c,
        nb_beneficiaries: nb,
        calls_made: cCalls.length,
        connections: connected.size,
        calls_todo: Math.max(0, nb - connected.size),
      }
    })
    setCampaigns(list)
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Rafraîchissement périodique tant qu'une campagne tourne (compteurs vivants).
  const anyRunning = campaigns.some((c) => c.status === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => { refetch() }, 30_000)
    return () => clearInterval(t)
  }, [anyRunning, refetch])

  const create = useCallback(async (title: string): Promise<string | null> => {
    if (!user?.id) return null
    const { data, error: err } = await supabase
      .from('campaigns')
      .insert({ org_id: user.id, title })
      .select('id')
      .single()
    if (err) { setError(err.message); return null }
    await refetch()
    return (data as { id: string }).id
  }, [user?.id, refetch])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('campaigns').delete().eq('id', id)
    if (err) { setError(err.message); return false }
    await refetch()
    return true
  }, [refetch])

  return { campaigns, loading, error, refetch, create, remove }
}
