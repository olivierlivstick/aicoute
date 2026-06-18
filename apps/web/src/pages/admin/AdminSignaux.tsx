import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink, ShieldAlert, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { RecordingButton } from '@/components/RecordingButton'
import { CATEGORY_LABELS } from '@/lib/reportI18n'

/**
 * /admin/signaux — « boîte de réception » des signaux faibles GRAVES.
 *
 * Regroupe tous les appels dont `calls.alerts` contient au moins un signal
 * `severity='high'` (la vignette rouge « ⚠ haute » de /admin/appels). But :
 * si on détecte quelque chose de potentiellement dangereux, AGIR (prévenir
 * l'aidant) et GARDER LA TRACE des actions menées (qui / quand / quoi).
 *
 * Le suivi vit dans `signal_actions` (journal append-only, cf. migration
 * 20260618000003) : statut courant = action la plus récente d'un appel ;
 * un appel sans action est « à traiter ».
 */

type Severity = 'low' | 'medium' | 'high'
type Category = 'health' | 'mood' | 'cognition' | 'social' | 'autonomy' | 'other'
type FollowStatus = 'todo' | 'in_progress' | 'done' | 'dismissed'

interface Alert {
  category: Category
  severity: Severity
  evidence: string
}

interface SignalAction {
  id:          string
  call_id:     string
  status:      FollowStatus
  comment:     string
  author_name: string
  created_at:  string
}

interface SignalRow {
  id:               string
  scheduled_at:     string
  started_at:       string | null
  notified_at:      string | null
  origin:           'scheduled' | 'inbound' | null
  alerts:           Alert[] | null
  recording_path:   string | null
  beneficiaries: {
    id: string
    first_name: string
    last_name:  string
    profiles: { email: string; full_name: string } | null
  } | null
}

const STATUS_META: Record<FollowStatus, { label: string; tone: string }> = {
  todo:        { label: 'À traiter',  tone: 'bg-brique/15 text-brique'      },
  in_progress: { label: 'En cours',   tone: 'bg-accent-50 text-accent-700'  },
  done:        { label: 'Traité',     tone: 'bg-sauge/15 text-sauge'        },
  dismissed:   { label: 'Sans suite', tone: 'bg-slate-100 text-slate-600'   },
}

const STATUS_ORDER: FollowStatus[] = ['todo', 'in_progress', 'done', 'dismissed']

// Tri : les non-résolus (todo > in_progress) d'abord, puis par date décroissante.
const STATUS_PRIORITY: Record<FollowStatus, number> = {
  todo: 0, in_progress: 1, dismissed: 2, done: 3,
}

type StatusFilter = 'open' | 'all' | FollowStatus

function effectiveDate(r: SignalRow): string {
  return r.started_at ?? r.notified_at ?? r.scheduled_at
}

function catLabel(cat: Category): string {
  return CATEGORY_LABELS.fr[cat] ?? cat
}

export function AdminSignauxPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<SignalRow[]>([])
  // Map call_id → actions (plus récente d'abord)
  const [actions, setActions] = useState<Record<string, SignalAction[]>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [followFor, setFollowFor] = useState<SignalRow | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Appels portant ≥1 signal high. Containment JSONB : alerts @> [{"severity":"high"}]
    // est vrai si un élément du tableau contient severity='high'.
    const { data: callsData } = await supabase
      .from('calls')
      .select('id, scheduled_at, started_at, notified_at, origin, alerts, recording_path, beneficiaries(id, first_name, last_name, profiles(email, full_name))')
      .contains('alerts', [{ severity: 'high' }])
      .order('scheduled_at', { ascending: false })
      .limit(300)

    const signalRows = (callsData ?? []) as unknown as SignalRow[]
    setRows(signalRows)

    // Charge le journal de suivi de ces appels.
    const callIds = signalRows.map((r) => r.id)
    if (callIds.length) {
      const { data: actionsData } = await supabase
        .from('signal_actions')
        .select('id, call_id, status, comment, author_name, created_at')
        .in('call_id', callIds)
        .order('created_at', { ascending: false })
      const byCall: Record<string, SignalAction[]> = {}
      for (const a of (actionsData ?? []) as SignalAction[]) {
        ;(byCall[a.call_id] ??= []).push(a)
      }
      setActions(byCall)
    } else {
      setActions({})
    }
    setLoading(false)
  }

  // Statut courant d'un appel = statut de l'action la plus récente, sinon 'todo'.
  function currentStatus(callId: string): FollowStatus {
    return actions[callId]?.[0]?.status ?? 'todo'
  }

  const visible = useMemo(() => {
    let list = rows
    if (filter === 'open') {
      list = rows.filter((r) => {
        const s = currentStatus(r.id)
        return s === 'todo' || s === 'in_progress'
      })
    } else if (filter !== 'all') {
      list = rows.filter((r) => currentStatus(r.id) === filter)
    }
    return [...list].sort((a, b) => {
      const pa = STATUS_PRIORITY[currentStatus(a.id)]
      const pb = STATUS_PRIORITY[currentStatus(b.id)]
      if (pa !== pb) return pa - pb
      return new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, actions, filter])

  const openCount = useMemo(
    () => rows.filter((r) => ['todo', 'in_progress'].includes(currentStatus(r.id))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, actions],
  )

  async function addAction(callId: string, status: FollowStatus, comment: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = supabase.from('signal_actions') as any
    const { error } = await table.insert({
      call_id:     callId,
      status,
      comment:     comment.trim(),
      author_id:   profile?.id ?? null,
      author_name: profile?.full_name ?? '',
    })
    if (error) throw new Error(error.message)
    await load()
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900 flex items-center gap-2">
          <ShieldAlert size={26} className="text-brique" /> Signaux
        </h1>
        <p className="text-slate-500 mt-1">
          Appels portant un signal faible <strong className="text-brique">grave</strong>.
          Notre responsabilité : prévenir l'aidant et garder la trace des actions menées.
          {openCount > 0 && (
            <span className="ml-2 inline-block bg-brique/15 text-brique px-2 py-0.5 rounded-full text-xs font-semibold">
              {openCount} à traiter
            </span>
          )}
        </p>
      </header>

      {/* Filtres de statut */}
      <div className="flex flex-wrap gap-1 mb-5">
        {([
          { value: 'open', label: 'À traiter' },
          { value: 'all',  label: 'Tous' },
          ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label })),
        ] as Array<{ value: StatusFilter; label: string }>).map((o) => (
          <button
            key={o.value}
            onClick={() => setFilter(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === o.value
                ? 'bg-primary text-white'
                : 'bg-white border border-creme-sable text-slate-600 hover:bg-creme'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Aidant</th>
                <th className="px-4 py-3">Suivi</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {visible.map((r) => {
                const ben = r.beneficiaries
                const aidant = ben?.profiles
                const highAlerts = (r.alerts ?? []).filter((a) => a.severity === 'high')
                const status = currentStatus(r.id)
                const journal = actions[r.id] ?? []
                return (
                  <tr key={r.id} className="hover:bg-creme/40 transition-colors align-top">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(effectiveDate(r)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        r.origin === 'inbound' ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.origin === 'inbound' ? '📞 Émis' : 'Reçu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brun-900 whitespace-nowrap">
                      {ben ? `${ben.first_name} ${ben.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="space-y-1.5">
                        {highAlerts.map((a, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="mt-0.5 inline-flex items-center gap-1 bg-brique/15 text-brique px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
                              <AlertTriangle size={11} /> {catLabel(a.category)}
                            </span>
                            <span className="text-slate-600 text-xs italic">« {a.evidence} »</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <p className="text-brun-700">{aidant?.full_name ?? '—'}</p>
                      <p>{aidant?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${STATUS_META[status].tone}`}>
                        {STATUS_META[status].label}
                      </span>
                      {journal.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {journal.length} action{journal.length > 1 ? 's' : ''}
                          {' · '}
                          {journal[0].author_name || 'admin'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <Link
                          to={`/historique/${r.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink size={12} /> Détail
                        </Link>
                        <RecordingButton path={r.recording_path} />
                        <button
                          onClick={() => setFollowFor(r)}
                          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
                        >
                          <Send size={12} /> Suivi
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <ShieldAlert size={24} className="mx-auto mb-2 text-slate-300" />
                    {filter === 'open'
                      ? 'Aucun signal grave en attente de traitement. 🎉'
                      : 'Aucun signal grave ne correspond à ce filtre.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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

/** Modal de suivi : statut + commentaire (nouvelle entrée de journal) + historique. */
function FollowUpModal({
  row, journal, currentStatus, onSubmit, onClose,
}: {
  row:           SignalRow
  journal:       SignalAction[]
  currentStatus: FollowStatus
  onSubmit:      (callId: string, status: FollowStatus, comment: string) => Promise<void>
  onClose:       () => void
}) {
  const [status, setStatus] = useState<FollowStatus>(currentStatus === 'todo' ? 'in_progress' : currentStatus)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const ben = row.beneficiaries
  const highAlerts = (row.alerts ?? []).filter((a) => a.severity === 'high')

  async function submit() {
    if (!comment.trim() && status === currentStatus) {
      alert('Ajoute un commentaire ou change le statut.')
      return
    }
    setSaving(true)
    try {
      await onSubmit(row.id, status, comment)
      setComment('')
      onClose()
    } catch (err) {
      alert(`Échec de l'enregistrement : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-creme-sable">
          <div>
            <h2 className="font-serif text-xl font-semibold text-brun-900">Suivi du signal</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {ben ? `${ben.first_name} ${ben.last_name}` : '—'}
              {' · '}
              {new Date(effectiveDate(row)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-brun-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Rappel des signaux */}
          <div className="bg-brique/5 border border-brique/20 rounded-xl p-3 space-y-1.5">
            {highAlerts.map((a, i) => (
              <p key={i} className="text-xs">
                <span className="font-semibold text-brique">{catLabel(a.category)}</span>
                <span className="text-slate-600 italic"> — « {a.evidence} »</span>
              </p>
            ))}
          </div>

          {/* Nouvelle action */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">Statut</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      status === s ? STATUS_META[s].tone + ' ring-2 ring-offset-1 ring-primary/40' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
                Commentaire (que s'est-il passé ?)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Ex. J'ai appelé l'aidant ce matin pour le prévenir de la chute mentionnée…"
                className="w-full rounded-xl border border-creme-sable bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
            <button
              onClick={submit}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            >
              <Send size={14} className={saving ? 'animate-pulse' : ''} />
              Enregistrer l'action
            </button>
          </div>

          {/* Journal */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Historique des actions</h3>
            {journal.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune action enregistrée pour l'instant.</p>
            ) : (
              <ol className="space-y-3">
                {journal.map((a) => (
                  <li key={a.id} className="border-l-2 border-creme-sable pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_META[a.status].tone}`}>
                        {STATUS_META[a.status].label}
                      </span>
                      <span className="text-xs text-brun-700 font-medium">{a.author_name || 'admin'}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(a.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    {a.comment && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
