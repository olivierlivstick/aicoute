import { useEffect, useMemo, useState } from 'react'
import { Search, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDuration } from '@/lib/utils'
import { FluidityModal, type FluidityMetrics, type RecordingAnalysis, type TuningSnapshot } from '@/components/FluidityModal'
import { RecordingButton } from '@/components/RecordingButton'
import { CallStatusBadge } from '@/pages/org/callStatus'
import { CallTranscriptModal } from '@/pages/org/CallTranscriptModal'
import type { CallStatus } from '@modect/shared'

interface CallRow {
  id: string
  status: CallStatus
  scheduled_at: string
  started_at: string | null
  duration_seconds: number | null
  campaign_id: string | null
  engine: string | null
  fluidity_metrics: FluidityMetrics | null
  recording_analysis: RecordingAnalysis | null
  tuning_snapshot: TuningSnapshot | null
  recording_path: string | null
  beneficiaries: { first_name: string; last_name: string } | null
}

/** Appels réalisés de l'organisation (RLS scopée). date · bénéficiaire · statut · durée + détail/qualité/.wav. */
export function OrgAppelsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [quality, setQuality] = useState<CallRow | null>(null)
  const [campaignTitles, setCampaignTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase
      .from('calls')
      .select('id, status, scheduled_at, started_at, duration_seconds, campaign_id, engine, fluidity_metrics, recording_analysis, tuning_snapshot, recording_path, beneficiaries(first_name, last_name)')
      .neq('status', 'scheduled')
      .order('scheduled_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { setCalls((data ?? []) as unknown as CallRow[]); setLoading(false) })
  }, [])

  useEffect(() => {
    supabase.from('campaigns').select('id, title').then(({ data }) => {
      const map: Record<string, string> = {}
      for (const c of (data ?? []) as { id: string; title: string }[]) map[c.id] = c.title
      setCampaignTitles(map)
    })
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return calls
    return calls.filter((c) => {
      const b = c.beneficiaries
      return b && `${b.first_name} ${b.last_name}`.toLowerCase().includes(q)
    })
  }, [calls, query])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-serif font-semibold text-slate-800">Appels réalisés</h1>
      <p className="mt-1 text-sm text-slate-500">{calls.length} appel(s)</p>

      <div className="relative mt-6 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un bénéficiaire…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Bénéficiaire</th>
              <th className="px-4 py-3 font-semibold">Campagne</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold">Durée</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Chargement…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                <Phone size={26} className="mx-auto mb-2 text-slate-300" />
                {query ? 'Aucun résultat.' : 'Aucun appel réalisé pour l’instant.'}
              </td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {formatDate(c.started_at ?? c.scheduled_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-slate-800">
                  {c.beneficiaries ? `${c.beneficiaries.last_name} ${c.beneficiaries.first_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {c.campaign_id ? (campaignTitles[c.campaign_id] ?? '—') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3"><CallStatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-slate-500">{c.duration_seconds ? formatDuration(c.duration_seconds) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <button onClick={() => setDetailId(c.id)} className="text-xs text-brun-700 hover:underline">Détail</button>
                    {(c.recording_analysis || c.fluidity_metrics) && (
                      <button onClick={() => setQuality(c)} className="text-xs text-brun-700 hover:underline">Qualité</button>
                    )}
                    <RecordingButton path={c.recording_path} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailId && <CallTranscriptModal callId={detailId} onClose={() => setDetailId(null)} />}
      {quality && (
        <FluidityModal
          metrics={quality.fluidity_metrics}
          analysis={quality.recording_analysis}
          engine={quality.engine}
          durationSeconds={quality.duration_seconds}
          tuningSnapshot={quality.tuning_snapshot}
          onClose={() => setQuality(null)}
        />
      )}
    </div>
  )
}
