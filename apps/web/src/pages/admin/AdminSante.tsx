import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw, Sparkles, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface StuckCall {
  id: string
  status: string
  attempt_number: number
  scheduled_at: string
  notified_at: string | null
  beneficiaries: { first_name: string; last_name: string } | null
}

interface SystemEvent {
  id:         string
  created_at: string
  level:      'debug' | 'info' | 'warn' | 'error'
  source:     string
  call_id:    string | null
  message:    string
  payload:    Record<string, unknown> | null
}

interface HealthSnapshot {
  stuckNotified:   StuckCall[]    // status='notified' depuis > 5 min (passe B censée les détecter)
  stuckInProgress: StuckCall[]    // status='in_progress' depuis > 30 min (bridge crashé ?)
  stuckScheduled:  StuckCall[]    // status='scheduled' avec attempt > 1 et scheduled_at < now-5min (passe C bloquée)
  callsLastHour:   number
  lastCallEndedAt: string | null
  events:          SystemEvent[]
}

export function AdminSantePage() {
  const [snap, setSnap] = useState<HealthSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    const now           = Date.now()
    const cutoff5min    = new Date(now - 5 * 60 * 1000).toISOString()
    const cutoff30min   = new Date(now - 30 * 60 * 1000).toISOString()
    const cutoff1hour   = new Date(now - 60 * 60 * 1000).toISOString()
    const nowIso        = new Date(now).toISOString()

    const benSelect = 'id, status, attempt_number, scheduled_at, notified_at, beneficiaries(first_name, last_name)'

    const [stuckNot, stuckProg, stuckSched, hourCount, lastEnded, events] = await Promise.all([
      supabase.from('calls').select(benSelect).eq('status', 'notified').lt('notified_at', cutoff5min).order('notified_at', { ascending: true }).limit(50),
      supabase.from('calls').select(benSelect).eq('status', 'in_progress').lt('started_at', cutoff30min).order('started_at', { ascending: true }).limit(50),
      supabase.from('calls').select(benSelect).eq('status', 'scheduled').gt('attempt_number', 1).lt('scheduled_at', cutoff5min).lte('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(50),
      supabase.from('calls').select('id', { count: 'exact', head: true }).gte('created_at', cutoff1hour),
      supabase.from('calls').select('ended_at').eq('status', 'completed').order('ended_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('system_events').select('id, created_at, level, source, call_id, message, payload').order('created_at', { ascending: false }).limit(50),
    ])

    setSnap({
      stuckNotified:   (stuckNot.data   ?? []) as unknown as StuckCall[],
      stuckInProgress: (stuckProg.data  ?? []) as unknown as StuckCall[],
      stuckScheduled:  (stuckSched.data ?? []) as unknown as StuckCall[],
      callsLastHour:   hourCount.count ?? 0,
      lastCallEndedAt: (lastEnded.data as { ended_at: string } | null)?.ended_at ?? null,
      events:          (events.data ?? []) as SystemEvent[],
    })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    load()
    const intv = setInterval(load, 30_000)   // auto-refresh toutes les 30 s
    return () => clearInterval(intv)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
          <h1 className="font-serif text-3xl font-semibold text-brun-900">Santé système</h1>
          <p className="text-slate-500 mt-1">Calls bloqués + signaux du worker schedule-calls. Auto-refresh 30 s.</p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-creme-sable bg-white text-sm text-brun-700 hover:bg-creme transition-colors disabled:opacity-50"
        >
          <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </header>

      {loading || !snap ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <>
          {/* Pulse */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <PulseCard
              icon={Clock}
              label="Appels créés la dernière heure"
              value={snap.callsLastHour}
              tone={snap.callsLastHour > 0 ? 'ok' : 'idle'}
            />
            <PulseCard
              icon={CheckCircle2}
              label="Dernier appel terminé"
              value={snap.lastCallEndedAt ? formatRelative(snap.lastCallEndedAt) : 'jamais'}
              tone={snap.lastCallEndedAt && (Date.now() - new Date(snap.lastCallEndedAt).getTime() < 60 * 60 * 1000) ? 'ok' : 'idle'}
            />
          </section>

          {/* Veille modèles voix (self-service, recherche web via Edge Fn) */}
          <ModelWatchSection />

          {/* Alertes bloquages */}
          <StuckSection
            title="Calls bloqués en « notified » (> 5 min)"
            hint="Devraient être détectés par la passe B de schedule-calls. Si non vidé, le worker est en panne."
            rows={snap.stuckNotified}
            timeField="notified_at"
          />
          <StuckSection
            title="Calls bloqués en « in_progress » (> 30 min)"
            hint="Le bridge n'a jamais flushé save-transcript. Probable crash voice-bridge ou WS coupée sans close."
            rows={snap.stuckInProgress}
            timeField="scheduled_at"
          />
          <StuckSection
            title="Retries planifiés en retard (passe C)"
            hint="Calls scheduled avec attempt > 1 et scheduled_at < now - 5 min. Si non vidé, la passe C ne tourne pas."
            rows={snap.stuckScheduled}
            timeField="scheduled_at"
          />

          {/* Événements système — flux des 50 derniers logs structurés */}
          <SystemEventsSection events={snap.events} />
        </>
      )}
    </div>
  )
}

interface EngineWatch {
  in_use:    string
  latest:    string
  is_latest: boolean
  note:      string
}
interface ModelWatchResult {
  checked_at:       string
  research_model?:  string
  up_to_date:       boolean
  verdict:          string
  openai:           EngineWatch
  gemini:           EngineWatch
  recommendations:  string[]
  sources:          { url: string; title: string }[]
}

function ModelWatchSection() {
  const [result, setResult] = useState<ModelWatchResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Au montage : réaffiche la dernière veille journalisée dans system_events.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_events')
        .select('payload')
        .eq('source', 'model-watch')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const payload = (data as { payload: ModelWatchResult } | null)?.payload
      if (payload?.verdict) setResult(payload)
    })()
  }, [])

  async function run() {
    setRunning(true)
    setError(null)
    const { data, error: invokeErr } = await supabase.functions.invoke('model-watch')
    if (invokeErr) {
      let msg = 'La veille a échoué. Réessayez dans un instant.'
      try {
        const body = await (invokeErr as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.()
        if (body?.error) msg = body.error
      } catch { /* garde le message générique */ }
      setError(msg)
    } else {
      setResult(data as ModelWatchResult)
    }
    setRunning(false)
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} className="text-accent-700" />
        <h2 className="font-serif text-lg font-semibold text-brun-900">Veille modèles voix</h2>
        <button
          onClick={run}
          disabled={running}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-600 text-white text-sm hover:bg-accent-700 transition-colors disabled:opacity-60"
        >
          <Sparkles size={14} className={running ? 'animate-pulse' : ''} />
          {running ? 'Recherche en cours…' : 'Lancer la veille'}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Recherche web : existe-t-il un modèle voix temps réel plus récent qu'OpenAI Realtime / Gemini Live actuels ?
      </p>

      {error && (
        <div className="bg-brique/10 border border-brique/30 text-brique rounded-xl px-4 py-3 text-sm mb-3">
          {error}
        </div>
      )}

      {!result && !error && (
        <p className="text-sm text-slate-400 italic">
          {running ? 'Première veille en cours…' : 'Aucune veille lancée. Cliquez sur « Lancer la veille ».'}
        </p>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-creme-sable overflow-hidden">
          {/* Verdict global */}
          <div className={`px-4 py-3 flex items-start gap-2 ${result.up_to_date ? 'bg-sauge/10' : 'bg-accent-50'}`}>
            {result.up_to_date
              ? <CheckCircle2 size={18} className="text-sauge shrink-0 mt-0.5" />
              : <AlertTriangle size={18} className="text-accent-700 shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm text-brun-900 font-medium">{result.verdict}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Vérifié {formatRelative(result.checked_at)}
                {result.research_model ? ` · via ${result.research_model}` : ''}
              </p>
            </div>
          </div>

          {/* Détail par moteur */}
          <div className="divide-y divide-creme-sable">
            <EngineRow label="OpenAI Realtime" data={result.openai} />
            <EngineRow label="Google Gemini Live" data={result.gemini} />
          </div>

          {/* Recommandations */}
          {result.recommendations?.length > 0 && (
            <div className="px-4 py-3 border-t border-creme-sable">
              <p className="text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1">Recommandations</p>
              <ul className="list-disc list-inside text-sm text-brun-900 space-y-0.5">
                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Sources */}
          {result.sources?.length > 0 && (
            <div className="px-4 py-3 border-t border-creme-sable">
              <p className="text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1">Sources</p>
              <ul className="space-y-0.5">
                {result.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={11} />
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function EngineRow({ label, data }: { label: string; data: EngineWatch }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-brun-900 text-sm">{label}</span>
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${data.is_latest ? 'bg-sauge/15 text-sauge' : 'bg-accent-50 text-accent-700'}`}>
          {data.is_latest ? 'À jour' : 'Amélioration possible'}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        En service : <span className="font-mono text-brun-700">{data.in_use}</span>
        {data.latest && data.latest !== data.in_use && (
          <> · Dernier : <span className="font-mono text-brun-700">{data.latest}</span></>
        )}
      </p>
      {data.note && <p className="text-sm text-brun-900 mt-1">{data.note}</p>}
    </div>
  )
}

function SystemEventsSection({ events }: { events: SystemEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-brun-900 mb-2">Événements système (50 derniers)</h2>
        <p className="text-sm text-slate-400 italic">Aucun événement enregistré pour l'instant.</p>
      </section>
    )
  }

  const levelTone: Record<string, string> = {
    debug: 'bg-slate-100 text-slate-500',
    info:  'bg-sauge/15 text-sauge',
    warn:  'bg-accent-50 text-accent-700',
    error: 'bg-brique/15 text-brique',
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-lg font-semibold text-brun-900">Événements système (50 derniers)</h2>
        <span className="text-xs text-slate-500">{events.length} entrée{events.length > 1 ? 's' : ''}</span>
      </div>
      <div className="bg-white rounded-xl border border-creme-sable overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2">Quand</th>
              <th className="px-4 py-2">Niveau</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-creme-sable">
            {events.map((ev) => (
              <tr key={ev.id} className="align-top">
                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{formatRelative(ev.created_at)}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${levelTone[ev.level] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ev.level}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-brun-700 font-mono whitespace-nowrap">{ev.source}</td>
                <td className="px-4 py-2 text-brun-900 text-sm">
                  {ev.message}
                  {ev.payload && (
                    <details className="mt-1">
                      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">payload</summary>
                      <pre className="text-[10px] text-slate-500 bg-creme rounded p-2 mt-1 overflow-x-auto">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {ev.call_id && (
                    <Link to={`/historique/${ev.call_id}`} className="text-xs text-primary hover:underline">
                      Call
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PulseCard({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string | number
  tone: 'ok' | 'idle'
}) {
  const toneClass = tone === 'ok' ? 'text-sauge' : 'text-slate-400'
  return (
    <div className="bg-white rounded-2xl border border-creme-sable p-5">
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
        <Icon size={16} className={toneClass} />
        {label}
      </div>
      <p className={`font-serif text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function StuckSection({ title, hint, rows, timeField }: {
  title: string
  hint: string
  rows: StuckCall[]
  timeField: 'notified_at' | 'scheduled_at'
}) {
  const empty = rows.length === 0
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        {empty ? (
          <CheckCircle2 size={16} className="text-sauge" />
        ) : (
          <AlertTriangle size={16} className="text-brique" />
        )}
        <h2 className="font-serif text-lg font-semibold text-brun-900">{title}</h2>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${empty ? 'bg-sauge/15 text-sauge' : 'bg-brique/15 text-brique'}`}>
          {rows.length}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{hint}</p>
      {empty ? (
        <p className="text-sm text-slate-400 italic">Rien à signaler.</p>
      ) : (
        <div className="bg-white rounded-xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2">Bénéficiaire</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Tentative</th>
                <th className="px-4 py-2">Depuis</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {rows.map((r) => {
                const since = r[timeField]
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-brun-900">
                      {r.beneficiaries ? `${r.beneficiaries.first_name} ${r.beneficiaries.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{r.status}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">T{r.attempt_number}</td>
                    <td className="px-4 py-2 text-xs text-brun-700">{since ? formatRelative(since) : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`/historique/${r.id}`} className="text-xs text-primary hover:underline">Détail</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1)   return 'à l\'instant'
  if (min < 60)  return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h${min % 60 > 0 ? ` ${min % 60}` : ''}`
  const d = Math.floor(h / 24)
  return `${d} j`
}
