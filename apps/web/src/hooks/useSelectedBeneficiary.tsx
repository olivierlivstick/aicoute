import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beneficiary } from '@modect/shared'

const STORAGE_KEY = 'modect.selected_beneficiary_id'

interface SelectedBeneficiaryValue {
  beneficiaries: Beneficiary[]
  selected:      Beneficiary | null
  loading:       boolean
  selectBeneficiary: (id: string) => void
  refetch:       () => Promise<void>
}

const Ctx = createContext<SelectedBeneficiaryValue | null>(null)

export function SelectedBeneficiaryProvider({ children }: { children: React.ReactNode }) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(STORAGE_KEY)
  })
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) {
      setBeneficiaries(data as Beneficiary[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // Garantir qu'on a toujours un sélectionné valide
  useEffect(() => {
    if (beneficiaries.length === 0) return
    const exists = selectedId && beneficiaries.some((b) => b.id === selectedId)
    if (!exists) {
      const fallback = beneficiaries[0]?.id ?? null
      setSelectedId(fallback)
      if (fallback) window.localStorage.setItem(STORAGE_KEY, fallback)
    }
  }, [beneficiaries, selectedId])

  const selectBeneficiary = (id: string) => {
    setSelectedId(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }

  const selected = useMemo(
    () => beneficiaries.find((b) => b.id === selectedId) ?? null,
    [beneficiaries, selectedId],
  )

  const value: SelectedBeneficiaryValue = {
    beneficiaries,
    selected,
    loading,
    selectBeneficiary,
    refetch: fetchAll,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSelectedBeneficiary(): SelectedBeneficiaryValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSelectedBeneficiary must be used inside SelectedBeneficiaryProvider')
  return ctx
}
