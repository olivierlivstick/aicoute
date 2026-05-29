import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCcw, ExternalLink, PhoneCall } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CallStatus = 'scheduled' | 'notified' | 'in_progress' | 'completed' | 'missed' | 'failed'

interface CallRow {
  id:               string
  status:           CallStatus
  scheduled_at:     string
  ended_at:         string | null
  duration_seconds: number | null
  attempt_number:   number
  ai_cost_eur_real: number | null
  alerts:           Array<{ severity: string }> | null
  beneficiaries: {
    id: string
    first_name: string
    last_name:  string
    profiles: { email: string; full_name: string } | null
  } | null
}

const STATUS_LABEL: Record<CallStatus, string> = {
  scheduled:   'Planifié',
  notified:    'Sonne',
  in_progress: 'En cours',
  completed:   'Complété',
  missed:      'No-answer',
  failed:      'Échec',
}

const STATUS_TONE: Record<CallStatus, string> = {
  scheduled:   'bg-slate-100 text-slate-700',
  notified:    'bg-accent-50 text-accent-700',
  in_progress: 'bg-primary-50 text-primary',
  completed:   'bg-sauge/15 text-sauge',
  missed:      'bg-accent-100 text-accent-800',
  failed:      'bg-brique/15 text-brique',
}

const PERIOD_LABEL = {
  today: 'Aujourd\'hui',
  '7d':  '7 derniers jours',
  '30d': '30 derniers jours',
  all:   'Tout',
} as const
type Period = keyof typeof PERIOD_LABEL

export function AdminAppelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const period   = (searchParams.get('period') as Period) ?? '7d'
  const status   = searchParams.get('status') ?? 'all'
  const severity = searchParams.get('severity') ?? 'all'   // 'all' | 'high'

  const [rows, setRows] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [relaunching, setRelaunching] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [period, status])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('calls')
      .select('id, status, scheduled_at, ended_at, duration_seconds, attempt_number, ai_cost_eur_real, alerts, beneficiaries(id, first_name, last_name, profiles(email, full_name))')
      .order('scheduled_at', { ascending: false })
      .limit(200)

    if (period !== 'all') {
      const sinceMs = period === 'today' ? Date.now() - 24 * 3600 * 1000
                    : period === '7d'    ? Date.now() - 7  * 24 * 3600 * 1000
                    :                      Date.now() - 30 * 24 * 3600 * 1000
      q = q.gte('scheduled_at', new Date(sinceMs).toISOString())
    }
    if (status !== 'all') {
      q = q.eq('status', status)
    }

    const { data } = await q
    setRows((data ?? []) as unknown as CallRow[])
    setLoading(false)
  }

  const visible = useMemo(() => {
    if (severity === 'high') {
      return rows.filter((r) => Array.isArray(r.alerts) && r.alerts.some((a) => a.severity === 'high'))
    }
    return rows
  }, [rows, severity])

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value === 'all' || (name === 'period' && value === '7d')) {
      next.delete(name)
    } else {
      next.set(name, value)
    }
    setSearchParams(next, { replace: true })
  }

  async function relaunch(callId: string, beneficiaryId: string) {
    setRelaunching(callId)
    try {
      const { data: created, error } = await supabase
        .from('calls')
        .insert({
          beneficiary_id: beneficiaryId,
          status:         'scheduled',
          scheduled_at:   new Date().toISOString(),
          attempt_number: 1,
        })
        .select('id')
        .single()
      if (error || !created) throw new Error(error?.message ?? 'Insert failed')

      const { error: invokeErr } = await supabase.functions.invoke('initiate-call', {
        body: { call_id: created.id },
      })
      if (invokeErr) throw new Error(invokeErr.message)

      await load()
    } catch (err) {
      alert(`Échec de la relance : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    } finally {
      setRelaunching(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Appels (tous comptes)</h1>
        <p className="text-slate-500 mt-1">200 résultats max. Triés par date planifiée décroissante.</p>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Filter
          label="Période"
          value={period}
          options={Object.entries(PERIOD_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          onChange={(v) => setParam('period', v)}
        />
        <Filter
          label="Statut"
          value={status}
          options={[
            { value: 'all', label: 'Tous' },
            ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]}
          onChange={(v) => setParam('status', v)}
        />
        <Filter
          label="Sévérité"
          value={severity}
          options={[
            { value: 'all',  label: 'Toutes alertes' },
            { value: 'high', label: 'Avec alerte haute' },
          ]}
          onChange={(v) => setParam('severity', v)}
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Bénéficiaire</th>
                <th className="px-5 py-3">Aidant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-center">Durée</th>
                <th className="px-5 py-3 text-right">Coût IA</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {visible.map((c) => {
                const ben = c.beneficiaries
                const aidant = ben?.profiles
                const dur = c.duration_seconds
                  ? `${Math.floor(c.duration_seconds / 60)}m${(c.duration_seconds % 60).toString().padStart(2, '0')}`
                  : '—'
                const canRelaunch = (c.status === 'missed' || c.status === 'failed') && ben?.id
                const hasHighAlert = Array.isArray(c.alerts) && c.alerts.some((a) => a.severity === 'high')
                return (
                  <tr key={c.id} className="hover:bg-creme/40 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(c.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      {c.attempt_number > 1 && (
                        <span className="ml-2 inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                          T{c.attempt_number}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-brun-900">
                      {ben ? `${ben.first_name} ${ben.last_name}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      <p className="text-brun-700">{aidant?.full_name ?? '—'}</p>
                      <p>{aidant?.email ?? ''}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                      {hasHighAlert && (
                        <span className="ml-2 inline-block bg-brique/15 text-brique px-2 py-1 rounded-full text-xs font-semibold">
                          ⚠ haute
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-brun-700">{dur}</td>
                    <td className="px-5 py-3 text-right text-brun-700 font-mono text-xs">
                      {c.ai_cost_eur_real != null ? `€${c.ai_cost_eur_real.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/historique/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink size={12} /> Détail
                        </Link>
                        {canRelaunch && (
                          <button
                            onClick={() => relaunch(c.id, ben!.id)}
                            disabled={relaunching === c.id}
                            className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline disabled:opacity-50"
                          >
                            <RefreshCcw size={12} className={relaunching === c.id ? 'animate-spin' : ''} />
                            Relancer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <PhoneCall size={24} className="mx-auto mb-2 text-slate-300" />
                    Aucun appel ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Filter({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-500 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-creme-sable bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
