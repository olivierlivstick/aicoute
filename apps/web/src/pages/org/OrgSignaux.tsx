import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { RecordingButton } from '@/components/RecordingButton'
import { Modal } from '@/pages/org/Modal'
import { CallTranscriptModal } from '@/pages/org/CallTranscriptModal'
import { AlertList, SEVERITY_META, severityRank } from '@/pages/org/alerts'
import type { CallAlert, AlertSeverity } from '@modect/shared'

type FollowStatus = 'todo' | 'in_progress' | 'done' | 'dismissed'

interface SignalAction {
  id: string
  call_id: string
  status: FollowStatus
  comment: string
  author_name: string
  created_at: string
}

interface SignalRow {
  id: string
  scheduled_at: string
  started_at: string | null
  notified_at: string | null
  alerts: CallAlert[] | null
  recording_path: string | null
  beneficiaries: { id: string; first_name: string; last_name: string } | null
}

const STATUS_META: Record<FollowStatus, { label: string; tone: string }> = {
  todo:        { label: 'À traiter',  tone: 'bg-brique/15 text-brique'     },
  in_progress: { label: 'En cours',   tone: 'bg-accent-50 text-accent-700' },
  done:        { label: 'Traité',     tone: 'bg-sauge/15 text-sauge'       },
  dismissed:   { label: 'Sans suite', tone: 'bg-slate-100 text-slate-600'  },
}
const STATUS_ORDER: FollowStatus[] = ['todo', 'in_progress', 'done', 'dismissed']

function effectiveDate(r: SignalRow): string {
  return r.started_at ?? r.notified_at ?? r.scheduled_at
}
function maxSeverityRank(r: SignalRow): number {
  return Math.min(99, ...(r.alerts ?? []).map((a) => severityRank(a.severity)))
}

/**
 * /org/signaux — boîte de réception des signaux faibles de l'organisation
 * (reprise de /admin/signaux, scopée par la RLS). Journal d'actions append-only
 * dans signal_actions (RLS propriétaire — migration 20260619000004).
 */
export function OrgSignauxPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<SignalRow[]>([])
  const [actions, setActions] = useState<Record<string, SignalAction[]>>({})
  const [loading, setLoading] = useState(true)
  const [statusSel, setStatusSel] = useState<Set<FollowStatus>>(new Set(['todo', 'in_progress']))
  const [sevSel, setSevSel] = useState<Set<AlertSeverity>>(new Set())
  const [followFor, setFollowFor] = useState<SignalRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: callsData } = await supabase
      .from('calls')
      .select('id, scheduled_at, started_at, notified_at, alerts, recording_path, beneficiaries(id, first_name, last_name)')
      .neq('alerts', '[]')
      .order('scheduled_at', { ascending: false })
      .limit(300)
    const signalRows = (callsData ?? []) as unknown as SignalRow[]
    setRows(signalRows)

    const callIds = signalRows.map((r) => r.id)
    if (callIds.length) {
      const { data: actionsData } = await supabase
        .from('signal_actions')
        .select('id, call_id, status, comment, author_name, created_at')
        .in('call_id', callIds)
        .order('created_at', { ascending: false })
      const byCall: Record<string, SignalAction[]> = {}
      for (const a of (actionsData ?? []) as SignalAction[]) (byCall[a.call_id] ??= []).push(a)
      setActions(byCall)
    } else {
      setActions({})
    }
    setLoading(false)
  }

  const currentStatus = (callId: string): FollowStatus => actions[callId]?.[0]?.status ?? 'todo'

  function toggle<T>(set: Set<T>, setter: (s: Set<T>) => void, v: T) {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    setter(next)
  }

  const visible = useMemo(() => {
    let list = rows
    if (statusSel.size > 0) list = list.filter((r) => statusSel.has(currentStatus(r.id)))
    if (sevSel.size > 0) list = list.filter((r) => (r.alerts ?? []).some((a) => sevSel.has(a.severity)))
    return [...list].sort((a, b) => {
      const da = new Date(effectiveDate(a)).getTime()
      const db = new Date(effectiveDate(b)).getTime()
      return da !== db ? db - da : maxSeverityRank(a) - maxSeverityRank(b)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, actions, statusSel, sevSel])

  const openCount = useMemo(
    () => rows.filter((r) => ['todo', 'in_progress'].includes(currentStatus(r.id))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, actions],
  )

  async function addAction(callId: string, status: FollowStatus, comment: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = supabase.from('signal_actions') as any
    const { error } = await table.insert({
      call_id: callId, status, comment: comment.trim(),
      author_id: profile?.id ?? null, author_name: profile?.full_name ?? '',
    })
    if (error) throw new Error(error.message)
    await load()
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-serif font-semibold text-slate-800">
        <ShieldAlert size={24} className="text-brique" /> Signaux
        {openCount > 0 && (
          <span className="rounded-full bg-brique/15 px-2 py-0.5 text-xs font-semibold text-brique">{openCount} à traiter</span>
        )}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Signaux faibles détectés en conversation, les plus graves en tête.</p>

      {/* Filtres */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-slate-400">Statut</span>
          <Pill active={statusSel.size === 0} onClick={() => setStatusSel(new Set())}>Tous</Pill>
          {STATUS_ORDER.map((s) => (
            <Pill key={s} active={statusSel.has(s)} onClick={() => toggle(statusSel, setStatusSel, s)}>{STATUS_META[s].label}</Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-slate-400">Sévérité</span>
          <Pill active={sevSel.size === 0} onClick={() => setSevSel(new Set())}>Toutes</Pill>
          {(['high', 'medium', 'low'] as AlertSeverity[]).map((s) => (
            <Pill key={s} active={sevSel.has(s)} onClick={() => toggle(sevSel, setSevSel, s)}>{SEVERITY_META[s].label}</Pill>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Chargement…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Bénéficiaire</th>
                <th className="px-4 py-3 font-semibold">Signal</th>
                <th className="px-4 py-3 font-semibold">Suivi</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map((r) => {
                const ben = r.beneficiaries
                const status = currentStatus(r.id)
                const journal = actions[r.id] ?? []
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {new Date(effectiveDate(r)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-800">{ben ? `${ben.last_name} ${ben.first_name}` : '—'}</td>
                    <td className="max-w-md px-4 py-3"><AlertList alerts={r.alerts} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_META[status].tone}`}>{STATUS_META[status].label}</span>
                      {journal.length > 0 && (
                        <p className="mt-1 text-[10px] text-slate-400">{journal.length} action{journal.length > 1 ? 's' : ''}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <button onClick={() => setDetailId(r.id)} className="text-xs text-brun-700 hover:underline">Détail</button>
                        <RecordingButton path={r.recording_path} />
                        <button onClick={() => setFollowFor(r)} className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline">
                          <Send size={12} /> Suivi
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                  <ShieldAlert size={24} className="mx-auto mb-2 text-slate-300" />
                  {statusSel.size === 0 && sevSel.size === 0 ? 'Aucun signal détecté pour l’instant. 🎉' : 'Aucun signal ne correspond à ces filtres.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailId && <CallTranscriptModal callId={detailId} title="Détail du signal" onClose={() => setDetailId(null)} />}
      {followFor && (
        <FollowUpModal
          row={followFor}
          journal={actions[followFor.id] ?? []}
          currentStatus={currentStatus(followFor.id)}
          onSubmit={addAction}
          onClose={() => setFollowFor(null)}
        />
      )}
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function FollowUpModal({ row, journal, currentStatus, onSubmit, onClose }: {
  row: SignalRow
  journal: SignalAction[]
  currentStatus: FollowStatus
  onSubmit: (callId: string, status: FollowStatus, comment: string) => Promise<void>
  onClose: () => void
}) {
  const [status, setStatus] = useState<FollowStatus>(currentStatus === 'todo' ? 'in_progress' : currentStatus)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const ben = row.beneficiaries

  async function submit() {
    if (!comment.trim() && status === currentStatus) { alert('Ajoute un commentaire ou change le statut.'); return }
    setSaving(true)
    try { await onSubmit(row.id, status, comment); setComment(''); onClose() }
    catch (err) { alert(`Échec : ${err instanceof Error ? err.message : 'erreur inconnue'}`) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Suivi du signal" onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {ben ? `${ben.first_name} ${ben.last_name}` : '—'}
      </p>

      <div className="mb-4 space-y-1.5 rounded-xl bg-slate-50 p-3"><AlertList alerts={row.alerts} /></div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Statut</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === s ? STATUS_META[s].tone + ' ring-2 ring-offset-1 ring-primary/40' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Commentaire</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            placeholder="Ex. J'ai prévenu la famille de la chute mentionnée…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={submit} disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
          <Send size={14} className={saving ? 'animate-pulse' : ''} /> Enregistrer l'action
        </button>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Historique des actions</h3>
        {journal.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune action enregistrée.</p>
        ) : (
          <ol className="space-y-3">
            {journal.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[a.status].tone}`}>{STATUS_META[a.status].label}</span>
                  <span className="text-xs font-medium text-brun-700">{a.author_name || '—'}</span>
                  <span className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                {a.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  )
}
