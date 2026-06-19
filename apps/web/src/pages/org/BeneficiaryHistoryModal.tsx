import { useEffect, useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDuration } from '@/lib/utils'
import { FluidityModal, type FluidityMetrics, type RecordingAnalysis, type TuningSnapshot } from '@/components/FluidityModal'
import { RecordingButton } from '@/components/RecordingButton'
import { Modal } from '@/pages/org/Modal'
import { CallStatusBadge } from '@/pages/org/callStatus'
import type { Beneficiary, Call } from '@modect/shared'

interface HistoryCall extends Call {
  fluidity_metrics: FluidityMetrics | null
  recording_analysis: RecordingAnalysis | null
  tuning_snapshot: TuningSnapshot | null
  recording_path: string | null
  engine: string | null
}

/** Historique des appels reçus par un bénéficiaire (transcript / qualité / .wav). */
export function BeneficiaryHistoryModal({
  beneficiary,
  onClose,
}: {
  beneficiary: Beneficiary
  onClose: () => void
}) {
  const [calls, setCalls] = useState<HistoryCall[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [quality, setQuality] = useState<HistoryCall | null>(null)

  useEffect(() => {
    supabase
      .from('calls')
      .select('id, status, scheduled_at, started_at, ended_at, duration_seconds, transcript, summary, alerts, engine, fluidity_metrics, recording_analysis, tuning_snapshot, recording_path')
      .eq('beneficiary_id', beneficiary.id)
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => {
        setCalls((data ?? []) as unknown as HistoryCall[])
        setLoading(false)
      })
  }, [beneficiary.id])

  return (
    <Modal title={`Historique — ${beneficiary.first_name} ${beneficiary.last_name}`} onClose={onClose} maxWidth="max-w-3xl">
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>
      ) : calls.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun appel pour ce bénéficiaire.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {calls.map((c) => {
            const when = c.started_at ?? c.scheduled_at
            const isOpen = expanded === c.id
            return (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-slate-600">
                    {formatDate(when, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <CallStatusBadge status={c.status} />
                  <span className="w-20 text-slate-500">
                    {c.duration_seconds ? formatDuration(c.duration_seconds) : '—'}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    {c.transcript && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                        className="inline-flex items-center gap-1 text-xs text-brun-700 hover:underline"
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Transcript
                      </button>
                    )}
                    {(c.recording_analysis || c.fluidity_metrics) && (
                      <button onClick={() => setQuality(c)} className="text-xs text-brun-700 hover:underline">
                        Qualité
                      </button>
                    )}
                    <RecordingButton path={c.recording_path} />
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    {c.summary && <p className="mb-3 text-slate-700">{c.summary}</p>}
                    <div className="space-y-2">
                      {(c.transcript ?? []).map((t, i) => (
                        <div key={i} className="flex gap-2">
                          <MessageSquare
                            size={13}
                            className={`mt-0.5 shrink-0 ${t.role === 'assistant' ? 'text-primary' : 'text-slate-400'}`}
                          />
                          <p className={t.role === 'assistant' ? 'text-slate-700' : 'text-slate-500'}>{t.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
    </Modal>
  )
}
