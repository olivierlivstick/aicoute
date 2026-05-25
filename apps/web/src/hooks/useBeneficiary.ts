import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beneficiary } from '@modect/shared'

export function useBeneficiaries() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('beneficiaries')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) setError(err.message)
      else setBeneficiaries(data as Beneficiary[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { beneficiaries, loading, error, refetch: fetch }
}

export function useBeneficiary(id: string | undefined) {
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    supabase
      .from('beneficiaries')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setBeneficiary(data as Beneficiary)
        setLoading(false)
      })
  }, [id])

  const update = useCallback(async (updates: Partial<Beneficiary>) => {
    if (!id) return false
    const { error: err } = await supabase
      .from('beneficiaries')
      .update(updates)
      .eq('id', id)
    if (err) { setError(err.message); return false }
    setBeneficiary((prev) => prev ? { ...prev, ...updates } : prev)
    return true
  }, [id])

  const deleteBeneficiary = useCallback(async () => {
    if (!id) return false
    const { error: err } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', id)
    return !err
  }, [id])

  return { beneficiary, loading, error, update, deleteBeneficiary }
}

export async function createBeneficiary(
  data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>
): Promise<{ id: string } | null> {
  const { data: result, error } = await supabase
    .from('beneficiaries')
    .insert(data)
    .select('id')
    .single()
  if (error) return null
  return result as { id: string }
}
