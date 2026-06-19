import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDuration } from '@/lib/utils'
import { Modal } from '@/pages/org/Modal'
import { AlertList } from '@/pages/org/alerts'
import type { CallAlert, TranscriptEntry } from '@modect/shared'

interface CallDetail {
  summary: string | null
  key_topics: string[] | null
  alerts: CallAlert[] | null
  transcript: TranscriptEntry[] | null
  started_at: string | null
  scheduled_at: string
  duration_seconds: number | null
}

/** Détail d'un appel (compte-rendu + signaux + transcript) sans quitter le dashboard org. */
export function CallTranscriptModal({ callId, title, onClose }: { callId: string; title?: string; onClose: () => void }) {
  const [call, setCall] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('calls')
      .select('summary, key_topics, alerts, transcript, started_at, scheduled_at, duration_seconds')
      .eq('id', callId)
      .single()
      .then(({ data }) => { setCall((data ?? null) as unknown as CallDetail | null); setLoading(false) })
  }, [callId])

  return (
    <Modal title={title ?? 'Détail de l’appel'} onClose={onClose} maxWidth="max-w-2xl">
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>
      ) : !call ? (
        <p className="py-8 text-center text-sm text-slate-400">Appel introuvable.</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-slate-500">
            {formatDate(call.started_at ?? call.scheduled_at, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {call.duration_seconds ? ` · ${formatDuration(call.duration_seconds)}` : ''}
          </p>

          {call.summary && (
            <div>
              <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">Compte-rendu</h3>
              <p className="text-sm text-slate-700">{call.summary}</p>
            </div>
          )}

          {(call.alerts ?? []).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Signaux détectés</h3>
              <AlertList alerts={call.alerts} />
            </div>
          )}

          {(call.transcript ?? []).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Transcription</h3>
              <div className="max-h-72 space-y-2 overflow-auto rounded-xl bg-slate-50 px-4 py-3">
                {(call.transcript ?? []).map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <MessageSquare size={13} className={`mt-0.5 shrink-0 ${t.role === 'assistant' ? 'text-primary' : 'text-slate-400'}`} />
                    <p className={`text-sm ${t.role === 'assistant' ? 'text-slate-700' : 'text-slate-500'}`}>{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!call.summary && (call.transcript ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Pas encore de compte-rendu ni de transcription pour cet appel.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
