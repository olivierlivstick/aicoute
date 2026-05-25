import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Call } from '@modect/shared'

export interface CallWithBeneficiary extends Call {
  beneficiary_first_name: string
  beneficiary_last_name:  string
}

export function useCalls(beneficiaryId?: string) {
  const [calls,   setCalls]   = useState<CallWithBeneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('calls')
      .select(`
        *,
        beneficiaries ( first_name, last_name )
      `)
      .order('scheduled_at', { ascending: false })
      .limit(100)

    if (beneficiaryId) query = query.eq('beneficiary_id', beneficiaryId)

    try {
      const { data, error: err } = await query
      if (err) { setError(err.message); return }

      const enriched = (data ?? []).map((c: Call & { beneficiaries: { first_name: string; last_name: string } | null }) => ({
        ...c,
        beneficiary_first_name: c.beneficiaries?.first_name ?? '',
        beneficiary_last_name:  c.beneficiaries?.last_name  ?? '',
      })) as CallWithBeneficiary[]

      setCalls(enriched)
      setUnreadCount(enriched.filter((c) => c.report_available && !c.report_read_at).length)
    } finally {
      setLoading(false)
    }
  }, [beneficiaryId])

  useEffect(() => { fetch() }, [fetch])

  return { calls, loading, error, unreadCount, refetch: fetch }
}

export async function markReportRead(callId: string): Promise<void> {
  await supabase
    .from('calls')
    .update({ report_read_at: new Date().toISOString() })
    .eq('id', callId)
    .is('report_read_at', null)
}
