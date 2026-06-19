import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Beneficiary } from '@modect/shared'

/** Champs « légers » d'un bénéficiaire d'organisation (le reste a des défauts DB). */
export interface OrgBeneficiaryInput {
  first_name: string
  last_name: string
  phone: string | null
  comment: string | null
}

/**
 * Gestion des bénéficiaires d'une ORGANISATION. La RLS `caregiver_owns` scope
 * déjà tout (lecture + écriture) au compte courant (caregiver_id = auth.uid()),
 * donc un simple select renvoie uniquement les bénéficiaires de l'organisation.
 *
 * Modèle « léger » : on n'expose que prénom / nom / téléphone / commentaire ;
 * la personnalité, la voix et le prompt sont portés par la CAMPAGNE.
 */
export function useOrgBeneficiaries() {
  const { user } = useAuth()
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('beneficiaries')
      .select('*')
      .order('last_name', { ascending: true })
    if (err) setError(err.message)
    else setBeneficiaries((data ?? []) as Beneficiary[])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const create = useCallback(async (input: OrgBeneficiaryInput) => {
    if (!user?.id) return false
    const { error: err } = await supabase
      .from('beneficiaries')
      // preferred_engine='gemini' : décision produit Gemini-only (le défaut DB est
      // 'openai', non exposé côté org). Le moteur effectif des appels de campagne.
      .insert({ caregiver_id: user.id, preferred_engine: 'gemini', ...input })
    if (err) { setError(err.message); return false }
    await refetch()
    return true
  }, [user?.id, refetch])

  const update = useCallback(async (id: string, input: OrgBeneficiaryInput) => {
    const { error: err } = await supabase
      .from('beneficiaries')
      .update(input)
      .eq('id', id)
    if (err) { setError(err.message); return false }
    await refetch()
    return true
  }, [refetch])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', id)
    if (err) { setError(err.message); return false }
    await refetch()
    return true
  }, [refetch])

  /** Insertion en masse (import CSV). Renvoie le nombre inséré, ou null en erreur. */
  const bulkCreate = useCallback(async (inputs: OrgBeneficiaryInput[]) => {
    if (!user?.id || inputs.length === 0) return 0
    const rows = inputs.map((i) => ({ caregiver_id: user.id, preferred_engine: 'gemini', ...i }))
    const { error: err } = await supabase.from('beneficiaries').insert(rows)
    if (err) { setError(err.message); return null }
    await refetch()
    return inputs.length
  }, [user?.id, refetch])

  return { beneficiaries, loading, error, refetch, create, update, remove, bulkCreate }
}
