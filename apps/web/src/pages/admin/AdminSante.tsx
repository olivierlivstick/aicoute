import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw, Sparkles, ExternalLink, Activity, Mic, Download, Phone, SlidersHorizontal, Save, RotateCcw } from 'lucide-react'
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
  const [tab, setTab] = useState<'sante' | 'veille' | 'tuning'>('sante')

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
    <div className="max-w-[1400px] mx-auto px-4 py-8">
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
          {/* Onglets : Santé (monitoring) / Veille (modèles + tests) */}
          <div className="flex gap-1 mb-6 border-b border-creme-sable">
            <TabButton active={tab === 'sante'}  onClick={() => setTab('sante')}  icon={Activity}  label="Santé" />
            <TabButton active={tab === 'veille'} onClick={() => setTab('veille')} icon={Sparkles}  label="Veille" />
            <TabButton active={tab === 'tuning'} onClick={() => setTab('tuning')} icon={SlidersHorizontal} label="Fine-tuning" />
          </div>

          {tab === 'tuning' ? (
            <FineTuningSection />
          ) : tab === 'sante' ? (
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

              {/* Diagnostic fluidité : enregistrement de calibration + analyse fine */}
              <FluidityDiagnosticSection />

              {/* Événements système — flux des 50 derniers logs structurés */}
              <SystemEventsSection events={snap.events} />
            </>
          ) : (
            <>
              {/* Veille modèles voix (self-service, recherche web via Edge Fn) */}
              <ModelWatchSection />

              {/* Test d'appel comparatif OpenAI / Gemini (téléphone uniquement) */}
              <PhoneTestSection />
            </>
          )}
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

// --- Test d'appel comparatif (téléphone uniquement, admin) ------------------
// Réutilise l'endpoint /call du voice-bridge (même chemin que la démo vitrine,
// tracé dans demo_calls) mais en laissant le choix du moteur OpenAI / Gemini,
// pour pouvoir continuer à comparer les deux après que la vitrine ait figé Gemini.

const PHONE_TEST_LANGUAGES = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]
const PHONE_TEST_DEFAULT_OPENER =
  "Bonjour, c'est Olivier, je vous appelle pour prendre de vos nouvelles, comment allez-vous ?"
const PHONE_TEST_OPENER_MAX = 500

// Versions de Gemini Live testables par téléphone. Le 1er = celle EN PROD.
// Doit rester aligné avec ALLOWED_GEMINI_MODELS (voice-bridge server.js) : une
// valeur hors de cette whitelist serveur retombe sur le défaut prod.
const GEMINI_TEST_MODELS = [
  { value: 'models/gemini-3.1-flash-live-preview',                 label: '3.1 Flash Live · en prod (le + récent)' },
  { value: 'models/gemini-2.5-flash-native-audio-preview-12-2025', label: '2.5 Native Audio · génération précédente' },
]
const VOICE_BRIDGE_URL = import.meta.env.VITE_VOICE_BRIDGE_URL as string | undefined

function sanitizePhone(input: string): string {
  const trimmed = input.trim()
  const plus    = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/\D/g, '')
}

function PhoneTestSection() {
  const [engine, setEngine] = useState<'openai' | 'gemini'>('gemini')
  const [lang,   setLang]   = useState('fr')
  const [geminiModel, setGeminiModel] = useState(GEMINI_TEST_MODELS[0].value)
  const [phone,  setPhone]  = useState('')
  const [opener, setOpener] = useState(PHONE_TEST_DEFAULT_OPENER)
  const [state,  setState]  = useState<'idle' | 'calling' | 'ringing'>('idle')
  const [error,  setError]  = useState<string | null>(null)

  const cleaned = sanitizePhone(phone)
  const isValid = /^\+\d{8,15}$/.test(cleaned)

  async function call(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || state === 'calling') return
    setError(null)
    if (!VOICE_BRIDGE_URL) {
      setError('Service téléphonique non configuré (VITE_VOICE_BRIDGE_URL manquant).')
      return
    }
    setState('calling')
    try {
      const res = await fetch(`${VOICE_BRIDGE_URL.replace(/\/$/, '')}/call`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phoneNumber: cleaned,
          opener:      opener.trim().slice(0, PHONE_TEST_OPENER_MAX) || undefined,
          engine,
          lang,
          geminiModel: engine === 'gemini' ? geminiModel : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`)
      setState('ringing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer l\'appel')
      setState('idle')
    }
  }

  const toggleBase = 'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors'

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Phone size={16} className="text-accent-700" />
        <h2 className="font-serif text-lg font-semibold text-brun-900">Test d'appel OpenAI / Gemini</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Lance un appel téléphonique de test avec le moteur de ton choix, pour comparer les deux voix.
        Même tuyau que la démo vitrine (tracé dans « Démos vitrine », coupé à 2 min).
      </p>

      <div className="bg-white rounded-xl border border-creme-sable p-4">
        {state === 'ringing' ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="relative w-14 h-14 rounded-full bg-accent-50 flex items-center justify-center">
              <span className="absolute w-14 h-14 rounded-full bg-accent-200/40 animate-ping" />
              <Phone size={22} className="text-accent-700 animate-pulse" />
            </div>
            <p className="font-medium text-brun-900">Ton téléphone sonne</p>
            <p className="text-sm text-slate-500">
              Appel <span className="font-medium text-brun-700">{cleaned}</span> via{' '}
              <span className="font-mono">{engine}</span>
              {engine === 'gemini' && <> · <span className="font-mono">{geminiModel.replace('models/', '')}</span></>}
              . Décroche pour discuter.
            </p>
            <button
              onClick={() => { setState('idle'); setError(null) }}
              className="mt-1 px-4 py-2 rounded-lg border border-creme-sable bg-white text-sm text-brun-700 hover:bg-creme"
            >
              Nouveau test
            </button>
          </div>
        ) : (
          <form onSubmit={call} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Moteur */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1.5">Moteur</label>
                <div className="flex p-1 bg-creme border border-creme-sable rounded-lg">
                  <button type="button" onClick={() => setEngine('gemini')}
                    className={`${toggleBase} ${engine === 'gemini' ? 'bg-accent-600 text-white shadow-sm' : 'text-brun-700 hover:text-brun-900'}`}>
                    Gemini
                  </button>
                  <button type="button" onClick={() => setEngine('openai')}
                    className={`${toggleBase} ${engine === 'openai' ? 'bg-accent-600 text-white shadow-sm' : 'text-brun-700 hover:text-brun-900'}`}>
                    OpenAI
                  </button>
                </div>
              </div>
              {/* Langue */}
              <div>
                <label htmlFor="pt-lang" className="block text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1.5">Langue</label>
                <select id="pt-lang" value={lang} onChange={(e) => setLang(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-creme-sable rounded-lg text-sm text-brun-900 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-600/20 cursor-pointer">
                  {PHONE_TEST_LANGUAGES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Version Gemini — uniquement pour le moteur Gemini, pour tester
                de nouvelles versions (half-cascade, native audio) par téléphone. */}
            {engine === 'gemini' && (
              <div>
                <label htmlFor="pt-gemini-model" className="block text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1.5">Version Gemini</label>
                <select id="pt-gemini-model" value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} disabled={state === 'calling'}
                  className="w-full px-3 py-2 bg-white border border-creme-sable rounded-lg text-sm text-brun-900 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-600/20 cursor-pointer disabled:opacity-60">
                  {GEMINI_TEST_MODELS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 font-mono break-all">{geminiModel}</p>
              </div>
            )}

            {/* Numéro */}
            <div>
              <label htmlFor="pt-phone" className="block text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1.5">Numéro à appeler</label>
              <input id="pt-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+33 6 12 34 56 78"
                value={phone} onChange={(e) => setPhone(e.target.value)} disabled={state === 'calling'}
                className="w-full px-3 py-2 rounded-lg border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-600/20 disabled:opacity-60" />
              <p className="mt-1 text-xs text-slate-500">Format international, commençant par +.</p>
            </div>

            {/* Ouverture */}
            <div>
              <label htmlFor="pt-opener" className="block text-xs uppercase tracking-wider text-brun-700 font-semibold mb-1.5">Phrase d'ouverture</label>
              <textarea id="pt-opener" rows={2} value={opener}
                onChange={(e) => setOpener(e.target.value.slice(0, PHONE_TEST_OPENER_MAX))} disabled={state === 'calling'}
                className="w-full px-3 py-2 rounded-lg border border-creme-sable bg-white text-brun-900 focus:outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-600/20 disabled:opacity-60 resize-none" />
              <p className="mt-1 text-xs text-slate-500 flex justify-between gap-2">
                <span>L'IA dira exactement cette phrase au décroché.</span>
                <span className="font-mono tabular-nums">{opener.length}/{PHONE_TEST_OPENER_MAX}</span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-brique bg-brique/10 border border-brique/20 rounded-md px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={!isValid || state === 'calling'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-600 text-white text-sm hover:bg-accent-700 transition-colors disabled:opacity-50">
              <Phone size={14} />
              {state === 'calling' ? 'Appel en cours…' : 'M\'appeler maintenant'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

interface FluidityRecording {
  url:        string | null
  duration_s: number | null
  created_at: string
}

function FluidityDiagnosticSection() {
  const [enabled, setEnabled]       = useState(false)
  const [remaining, setRemaining]   = useState(0)
  const [recordings, setRecordings] = useState<FluidityRecording[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  async function load() {
    const [settings, events] = await Promise.all([
      supabase.from('app_settings')
        .select('fluidity_diagnostic_enabled, fluidity_keep_recording_remaining')
        .eq('id', 1).maybeSingle(),
      supabase.from('system_events')
        .select('created_at, payload')
        .eq('source', 'voice-bridge/fluidity-diag')
        .order('created_at', { ascending: false }).limit(10),
    ])
    const s = settings.data as { fluidity_diagnostic_enabled: boolean; fluidity_keep_recording_remaining: number } | null
    if (s) { setEnabled(!!s.fluidity_diagnostic_enabled); setRemaining(s.fluidity_keep_recording_remaining ?? 0) }
    const evs = (events.data ?? []) as { created_at: string; payload: { recording_url?: string | null; duration_s?: number | null } | null }[]
    setRecordings(evs.map((e) => ({
      url:        e.payload?.recording_url ?? null,
      duration_s: e.payload?.duration_s ?? null,
      created_at: e.created_at,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleEnabled() {
    setSaving(true)
    const next = !enabled
    const { error } = await supabase.from('app_settings')
      .update({ fluidity_diagnostic_enabled: next, updated_at: new Date().toISOString() }).eq('id', 1)
    if (!error) setEnabled(next)
    setSaving(false)
  }

  async function setRecordingsTo(next: number) {
    setSaving(true)
    const val = Math.max(0, next)
    const { error } = await supabase.from('app_settings')
      .update({ fluidity_keep_recording_remaining: val, updated_at: new Date().toISOString() }).eq('id', 1)
    if (!error) setRemaining(val)
    setSaving(false)
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Activity size={16} className="text-accent-700" />
        <h2 className="font-serif text-lg font-semibold text-brun-900">Diagnostic fluidité</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Mesure du « blanc » sur les appels <strong>démo / test</strong> uniquement (jamais les bénéficiaires).
      </p>

      <div className="bg-white rounded-xl border border-creme-sable divide-y divide-creme-sable">
        {/* Enregistrement de calibration */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Mic size={15} className="text-primary" />
            <span className="font-medium text-brun-900 text-sm">Enregistrement de calibration</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${remaining > 0 ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500'}`}>
              {remaining > 0 ? `${remaining} appel${remaining > 1 ? 's' : ''} à enregistrer` : 'inactif'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Les prochains appels démo seront enregistrés en stéréo (canal toi / canal IA), déposés ici en lien
            téléchargeable, puis supprimés de Twilio. Ouvre le WAV dans Audacity pour mesurer le vrai blanc.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRecordingsTo(remaining + 1)} disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-creme-sable bg-white text-sm text-brun-700 hover:bg-creme disabled:opacity-50">+1 appel</button>
            <button onClick={() => setRecordingsTo(remaining + 3)} disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-creme-sable bg-white text-sm text-brun-700 hover:bg-creme disabled:opacity-50">+3 appels</button>
            {remaining > 0 && (
              <button onClick={() => setRecordingsTo(0)} disabled={saving}
                className="px-3 py-1.5 rounded-lg border border-brique/30 bg-white text-sm text-brique hover:bg-brique/5 disabled:opacity-50">Arrêter (0)</button>
            )}
          </div>

          {/* Liens des enregistrements récents */}
          <div className="mt-3">
            {recordings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun enregistrement pour l'instant.</p>
            ) : (
              <ul className="space-y-1">
                {recordings.map((r, i) => (
                  <li key={i} className="text-xs flex items-center gap-2">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download size={12} /> WAV
                      </a>
                    ) : (
                      <span className="text-slate-400">upload KO</span>
                    )}
                    <span className="text-slate-500">{r.duration_s != null ? `${r.duration_s}s` : '—'}</span>
                    <span className="text-slate-400">· {formatRelative(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Analyse fine automatique (phase 2) */}
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="flex-1">
            <span className="font-medium text-brun-900 text-sm">Analyse fine automatique</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Quand activé, le bridge mesure le blanc en fin d'appel par analyse VAD offline (audio jeté, métriques
              seules). <span className="italic">À calibrer d'abord via un enregistrement ci-dessus.</span>
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={saving || loading}
            className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-sauge' : 'bg-slate-300'} disabled:opacity-50`}
            aria-pressed={enabled}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>
    </section>
  )
}

// --- Fine-tuning fluidité --------------------------------------------------
// Miroir UI des paramètres réglables (cf. services/voice-bridge/src/persistence/
// tuning.js → TUNING_DEFS). À GARDER EN PHASE (clés, types, bornes, défauts).
// Stocké dans app_settings.fluidity_tuning (JSONB des seules clés surchargées).

type TFieldType = 'int' | 'float' | 'bool' | 'enum'
interface TField {
  key:      string
  label:    string
  help?:    string
  type:     TFieldType
  def:      number | string | boolean | null
  min?:     number
  max?:     number
  step?:    number
  unit?:    string
  options?: { value: string; label: string }[]
}
interface TSection { id: string; title: string; subtitle: string; danger?: boolean; fields: TField[] }

const TUNING_SECTIONS: TSection[] = [
  {
    id: 'wav', title: 'Analyse WAV (mesure « vérité terrain »)',
    subtitle: 'Hors-ligne, zéro risque sur les appels. Effet sur la mesure du « blanc » des PROCHAINS appels.',
    fields: [
      { key: 'wav_hang_ms', label: 'Silence → fin de parole (hang)', help: '↑ regroupe les pauses internes (moins de fragmentation des tours)', type: 'int', def: 250, min: 50, max: 1000, unit: 'ms' },
      { key: 'wav_onset_ms', label: 'Parole soutenue → début', help: '↑ rejette mieux les clics / bruits brefs', type: 'int', def: 90, min: 20, max: 400, unit: 'ms' },
      { key: 'wav_vad_factor', label: 'Seuil voix = bruit de fond ×', help: '↑ = exige une voix plus franche', type: 'float', def: 3.5, min: 1.5, max: 10, step: 0.1 },
      { key: 'wav_vad_min_rms', label: 'Plancher d\'énergie (PCM16)', help: 'plancher absolu sous lequel = silence', type: 'int', def: 250, min: 50, max: 2000 },
      { key: 'wav_greeting_min_ms', label: 'Durée mini du « bonjour »', help: 'segment ≥ cette durée = vraie parole (détection du canal IA, anti-clic)', type: 'int', def: 400, min: 100, max: 2000, unit: 'ms' },
      { key: 'wav_frame_ms', label: 'Fenêtre d\'analyse (frame)', help: 'granularité RMS', type: 'int', def: 20, min: 5, max: 50, unit: 'ms' },
      { key: 'wav_ai_channel', label: 'Canal IA (forcer)', help: 'vide = canal 1 (jambe sortante Twilio = l\'IA)', type: 'enum', def: null, options: [{ value: '', label: 'Auto (canal 1)' }, { value: '0', label: 'Canal 0 (piste du haut)' }, { value: '1', label: 'Canal 1 (piste du bas)' }] },
    ],
  },
  {
    id: 'gemini', title: 'VAD Gemini (live)', danger: true,
    subtitle: '⚠️ Affecte le comportement des VRAIS appels Gemini, à chaud. Vide = défaut.',
    fields: [
      { key: 'gemini_vad_prefix_padding_ms', label: 'Parole soutenue avant interruption', help: '↑ = un « oui » bref ou un bruit ne coupe plus l\'IA (anti barge-in nerveux)', type: 'int', def: 300, min: 0, max: 2000, unit: 'ms' },
      { key: 'gemini_vad_start_sensitivity', label: 'Sensibilité début de parole', help: 'LOW = moins nerveux (moins de faux barge-in)', type: 'enum', def: 'START_SENSITIVITY_LOW', options: [{ value: 'START_SENSITIVITY_LOW', label: 'LOW (moins nerveux)' }, { value: 'START_SENSITIVITY_HIGH', label: 'HIGH (plus réactif)' }] },
      { key: 'gemini_vad_end_sensitivity', label: 'Sensibilité fin de parole', help: 'HIGH = fin détectée plus tôt (réduit le blanc, risque de couper une pause)', type: 'enum', def: null, options: [{ value: '', label: 'Défaut Gemini' }, { value: 'END_SENSITIVITY_LOW', label: 'LOW' }, { value: 'END_SENSITIVITY_HIGH', label: 'HIGH (plus tôt)' }] },
      { key: 'gemini_vad_silence_duration_ms', label: 'Silence avant fin de tour', help: 'vide = défaut Gemini', type: 'int', def: null, min: 0, max: 3000, unit: 'ms' },
      { key: 'gemini_vad_disabled', label: 'Désactiver la VAD Gemini', help: 'kill-switch → comportement Gemini par défaut', type: 'bool', def: false },
    ],
  },
  {
    id: 'openai', title: 'VAD OpenAI (live)', danger: true,
    subtitle: '⚠️ Affecte le comportement des VRAIS appels OpenAI, à chaud. Vide = défaut.',
    fields: [
      { key: 'openai_vad_type', label: 'Type de détection de tour', help: 'semantic_vad = décide selon les MOTS (anti-blanc) ; server_vad = sur le silence', type: 'enum', def: 'semantic_vad', options: [{ value: 'semantic_vad', label: 'semantic_vad' }, { value: 'server_vad', label: 'server_vad' }] },
      { key: 'openai_vad_eagerness', label: 'Rapidité de prise de parole', help: 'semantic_vad : high = répond vite après une phrase finie', type: 'enum', def: 'high', options: [{ value: 'low', label: 'low' }, { value: 'medium', label: 'medium' }, { value: 'high', label: 'high' }, { value: 'auto', label: 'auto' }] },
      { key: 'openai_noise_reduction', label: 'Réduction de bruit en entrée', help: 'far_field = haut-parleur / pièce ; near_field = combiné', type: 'enum', def: 'far_field', options: [{ value: 'far_field', label: 'far_field' }, { value: 'near_field', label: 'near_field' }, { value: 'off', label: 'off' }] },
      { key: 'openai_vad_threshold', label: 'Seuil voix (server_vad)', help: '↑ = exige une voix plus franche', type: 'float', def: 0.5, min: 0, max: 1, step: 0.05 },
      { key: 'openai_vad_prefix_padding_ms', label: 'Prefix padding (server_vad)', type: 'int', def: 300, min: 0, max: 2000, unit: 'ms' },
      { key: 'openai_vad_silence_duration_ms', label: 'Silence avant fin (server_vad)', help: '↓ = répond plus vite', type: 'int', def: 500, min: 0, max: 3000, unit: 'ms' },
      { key: 'openai_vad_disabled', label: 'Désactiver la VAD OpenAI', help: 'kill-switch → défauts OpenAI', type: 'bool', def: false },
    ],
  },
]

function FineTuningSection() {
  const [draft, setDraft]   = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function load() {
    const { data } = await supabase.from('app_settings').select('fluidity_tuning').eq('id', 1).maybeSingle()
    setDraft(((data as { fluidity_tuning?: Record<string, unknown> } | null)?.fluidity_tuning) ?? {})
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function setField(key: string, value: unknown) {
    setDraft((d) => {
      const next = { ...d }
      if (value === '' || value === undefined || value === null) delete next[key]
      else next[key] = value
      return next
    })
  }

  async function save(payload: Record<string, unknown>) {
    setSaving(true)
    const { error } = await supabase.from('app_settings')
      .update({ fluidity_tuning: payload, updated_at: new Date().toISOString() }).eq('id', 1)
    if (!error) { setDraft(payload); setSavedAt(Date.now()) }
    else alert(`Échec de l'enregistrement : ${error.message}`)
    setSaving(false)
  }

  const overrideCount = Object.keys(draft).length

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <SlidersHorizontal size={16} className="text-accent-700" />
        <h2 className="font-serif text-lg font-semibold text-brun-900">Fine-tuning fluidité</h2>
        {overrideCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-50 text-accent-700">{overrideCount} réglage{overrideCount > 1 ? 's' : ''} actif{overrideCount > 1 ? 's' : ''}</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4 max-w-3xl">
        Réglages lus <strong>à chaud</strong> par le voice-bridge (~15 s, sans redémarrer Render). Cascade : valeur saisie ici →
        variable d'env Render → défaut codé. Une valeur saisie ici <strong>prime toujours</strong>. Champ vide : on retombe sur
        l'env Render si elle existe, sinon le défaut (montré en placeholder). Les valeurs hors bornes sont ramenées dans la plage côté serveur.
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="space-y-5">
          {TUNING_SECTIONS.map((sec) => (
            <div key={sec.id} className={`bg-white rounded-xl border ${sec.danger ? 'border-brique/30' : 'border-creme-sable'}`}>
              <div className="px-4 py-3 border-b border-creme-sable">
                <h3 className="text-sm font-semibold text-brun-900">{sec.title}</h3>
                <p className={`text-xs mt-0.5 ${sec.danger ? 'text-brique' : 'text-slate-500'}`}>{sec.subtitle}</p>
              </div>
              <div className="divide-y divide-creme-sable">
                {sec.fields.map((f) => (
                  <TuningField key={f.key} field={f} value={draft[f.key]} onChange={(v) => setField(f.key, v)} />
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={() => save(draft)} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm hover:bg-primary-600 disabled:opacity-50">
              <Save size={14} className={saving ? 'animate-pulse' : ''} /> Enregistrer
            </button>
            <button onClick={() => { if (confirm('Tout réinitialiser aux défauts (vider tous les réglages) ?')) save({}) }} disabled={saving || overrideCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-creme-sable bg-white text-sm text-brun-700 hover:bg-creme disabled:opacity-50">
              <RotateCcw size={14} /> Réinitialiser tout
            </button>
            {savedAt && <span className="text-xs text-sauge">Enregistré · effet sous ~15 s</span>}
          </div>
        </div>
      )}
    </section>
  )
}

function TuningField({ field, value, onChange }: { field: TField; value: unknown; onChange: (v: unknown) => void }) {
  const id = `tuning-${field.key}`
  return (
    <div className="px-4 py-3 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm text-brun-900">{field.label}</label>
        {field.help && <p className="text-xs text-slate-500 mt-0.5">{field.help}</p>}
      </div>
      <div className="shrink-0 w-44 flex items-center justify-end gap-1.5">
        {field.type === 'bool' ? (
          <button
            onClick={() => onChange(value === true ? '' : true)}
            className={`w-12 h-6 rounded-full transition-colors relative ${value === true ? 'bg-brique' : 'bg-slate-300'}`}
            aria-pressed={value === true}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value === true ? 'translate-x-6' : ''}`} />
          </button>
        ) : field.type === 'enum' ? (
          <select
            id={id}
            value={value != null ? String(value) : (field.def != null ? String(field.def) : '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-creme-sable bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            {field.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <>
            <input
              id={id}
              type="number"
              value={value == null ? '' : String(value)}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              placeholder={field.def == null ? 'défaut' : String(field.def)}
              onChange={(e) => {
                const raw = e.target.value
                onChange(raw === '' ? '' : (field.type === 'float' ? parseFloat(raw) : parseInt(raw, 10)))
              }}
              className="w-24 rounded-lg border border-creme-sable bg-white px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-300"
            />
            {field.unit && <span className="text-xs text-slate-400 w-6">{field.unit}</span>}
          </>
        )}
      </div>
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

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-accent-600 text-accent-700'
          : 'border-transparent text-brun-700 hover:text-brun-900 hover:border-creme-sable'
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
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
