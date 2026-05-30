import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCcw, ExternalLink, PhoneCall, Zap, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CallStatus = 'scheduled' | 'notified' | 'in_progress' | 'completed' | 'missed' | 'failed'

// Tarif Twilio FR mobile sortant — même taux que services/voice-bridge/src/tracking.js
// (le coût Twilio n'est pas stocké sur `calls`, on l'approxime depuis la durée).
const TWILIO_EUR_PER_SECOND = 0.0007

const PAST_STATUSES:     CallStatus[] = ['completed', 'missed', 'failed']
const UPCOMING_STATUSES: CallStatus[] = ['scheduled', 'notified', 'in_progress']

interface CallRow {
  id:               string
  status:           CallStatus
  scheduled_at:     string
  started_at:       string | null
  notified_at:      string | null
  ended_at:         string | null
  duration_seconds: number | null
  attempt_number:   number
  ai_cost_eur_real: number | null
  twilio_cost_eur:  number | null
  engine:           'openai' | 'gemini' | null
  alerts:           Array<{ severity: string }> | null
  beneficiaries: {
    id: string
    first_name: string
    last_name:  string
    profiles: { email: string; full_name: string } | null
  } | null
}

const ENGINE_LABEL: Record<'openai' | 'gemini', { label: string; tone: string }> = {
  openai: { label: 'OpenAI', tone: 'bg-sauge/15 text-sauge'     },
  gemini: { label: 'Gemini', tone: 'bg-accent-50 text-accent-700' },
}

/**
 * Extrait le vrai message d'erreur d'un échec `supabase.functions.invoke`.
 * Quand l'Edge Function renvoie un non-2xx, supabase-js lève une
 * FunctionsHttpError dont le `.message` est générique ("Edge Function returned
 * a non-2xx status code") — le détail métier (ex: "voice-bridge a refusé la
 * demande", "pas de numéro de téléphone") n'est que dans le corps de la
 * réponse, accessible via `error.context` (un objet Response). On le lit ici.
 */
async function invokeErrorMessage(err: unknown): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (err as any)?.context
  const httpStatus = ctx && typeof ctx.status === 'number' ? ` (HTTP ${ctx.status})` : ''
  if (ctx && typeof ctx.json === 'function') {
    // Cas nominal : l'Edge Function renvoie son propre JSON { error, detail }.
    try {
      const body = await ctx.clone().json()
      const parts = [body?.error, body?.detail].filter(Boolean)
      if (parts.length) return `${parts.join(' — ')}${httpStatus}`
    } catch { /* pas du JSON → on tente le texte brut ci-dessous */ }
    // Erreur niveau plateforme (timeout/crash gateway) : corps non-JSON (HTML,
    // texte ou vide). On remonte quand même le code HTTP + un extrait lisible
    // plutôt que le message générique « non-2xx status code ».
    try {
      const text = (await ctx.clone().text())?.trim()
      if (text) return `${text.slice(0, 200)}${httpStatus}`
    } catch { /* corps illisible → on retombe sur le message générique */ }
    if (httpStatus) return `Erreur Edge Function${httpStatus}`
  }
  return err instanceof Error ? err.message : 'erreur inconnue'
}

interface BeneficiaryOption {
  id:         string
  first_name: string
  last_name:  string
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

type Tab = 'past' | 'upcoming'

export function AdminAppelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const tab         = (searchParams.get('tab') as Tab) ?? 'past'
  const period      = (searchParams.get('period') as Period) ?? '7d'
  const severity    = searchParams.get('severity')    ?? 'all'   // 'all' | 'high'
  const beneficiary = searchParams.get('beneficiary') ?? 'all'

  const [rows, setRows] = useState<CallRow[]>([])
  const [beneficiariesList, setBeneficiariesList] = useState<BeneficiaryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // Liste des bénéficiaires pour le dropdown (chargée une seule fois)
  useEffect(() => {
    supabase
      .from('beneficiaries')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('first_name', { ascending: true })
      .then(({ data }) => setBeneficiariesList((data ?? []) as BeneficiaryOption[]))
  }, [])

  useEffect(() => {
    load()
  }, [tab, period, beneficiary])

  async function load() {
    setLoading(true)
    const statuses = tab === 'past' ? PAST_STATUSES : UPCOMING_STATUSES

    // Tri : passés desc (plus récents en haut), prévus asc (prochain en haut)
    let q = supabase
      .from('calls')
      .select('id, status, scheduled_at, started_at, notified_at, ended_at, duration_seconds, attempt_number, ai_cost_eur_real, twilio_cost_eur, engine, alerts, beneficiaries(id, first_name, last_name, profiles(email, full_name))')
      .in('status', statuses)
      .order('scheduled_at', { ascending: tab === 'upcoming' })
      .limit(200)

    if (tab === 'past') {
      // Onglet passés : on remonte au plus jusqu'à now - X (sauf 'all').
      if (period !== 'all') {
        const sinceMs = period === 'today' ? Date.now() - 24 * 3600 * 1000
                      : period === '7d'    ? Date.now() - 7  * 24 * 3600 * 1000
                      :                      Date.now() - 30 * 24 * 3600 * 1000
        q = q.gte('scheduled_at', new Date(sinceMs).toISOString())
      }
    } else {
      // Onglet prévus : strict futur, borné à now + X (sauf 'all').
      // Le >= now exclut les vieux résidus en scheduled/notified qui ont
      // pourri en base (cf. cas Suzette mars 2026).
      q = q.gte('scheduled_at', new Date().toISOString())
      if (period !== 'all') {
        const horizonMs = period === 'today' ? Date.now() + 24 * 3600 * 1000
                        : period === '7d'    ? Date.now() + 7  * 24 * 3600 * 1000
                        :                      Date.now() + 30 * 24 * 3600 * 1000
        q = q.lte('scheduled_at', new Date(horizonMs).toISOString())
      }
    }

    if (beneficiary !== 'all') {
      q = q.eq('beneficiary_id', beneficiary)
    }

    const { data } = await q
    setRows((data ?? []) as unknown as CallRow[])
    setLoading(false)
  }

  // Filtre client-side sévérité + tri (sur le subset déjà chargé)
  const visible = useMemo(() => {
    let list = severity === 'high'
      ? rows.filter((r) => Array.isArray(r.alerts) && r.alerts.some((a) => a.severity === 'high'))
      : rows

    // Onglet passés : tri par date EFFECTIVE (décroché réel started_at, fallback
    // notified_at) décroissante, puis par date planifiée décroissante. Évite que
    // les échecs jamais connectés — surtout ceux datés dans le futur via
    // scheduled_at — remontent en tête. Le tri DB par scheduled_at ne sert plus
    // qu'à borner le limit(200) ; l'ordre d'affichage est décidé ici.
    if (tab === 'past') {
      const effTime = (r: CallRow): number | null => {
        const d = r.started_at ?? r.notified_at
        return d ? new Date(d).getTime() : null
      }
      list = [...list].sort((a, b) => {
        const ea = effTime(a)
        const eb = effTime(b)
        if (ea !== eb) {
          if (ea === null) return 1   // jamais connecté → en bas
          if (eb === null) return -1
          return eb - ea              // date effective décroissante
        }
        return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime() // planifiée décroissante
      })
    }
    return list
  }, [rows, severity, tab])

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value === 'all' || (name === 'period' && value === '7d') || (name === 'tab' && value === 'past')) {
      next.delete(name)
    } else {
      next.set(name, value)
    }
    setSearchParams(next, { replace: true })
  }

  /** Relance d'un appel passé en missed/failed → crée un nouveau call.
   *  Cast `as any` localisé : les types Database générés sont incomplets pour
   *  certaines colonnes de `calls` (cf. CLAUDE.md "Build Netlify : utiliser
   *  vite build sans tsc"). Le runtime PostgREST fonctionne. */
  async function relaunch(callId: string, beneficiaryId: string) {
    setBusy(callId)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callsTable = supabase.from('calls') as any
      const { data: created, error } = await callsTable
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
        body: { call_id: (created as { id: string }).id },
      })
      if (invokeErr) throw invokeErr

      await load()
    } catch (err) {
      alert(`Échec de la relance : ${await invokeErrorMessage(err)}`)
    } finally {
      setBusy(null)
    }
  }

  /**
   * Anticipe un appel prévu (status='scheduled') → on invoque directement
   * initiate-call sans toucher à scheduled_at (= créneau prévu, immutable).
   * initiate-call écrit notified_at = now() en interne. Sur les rapports, la
   * différence (notified_at - scheduled_at) montrera la durée d'anticipation.
   */
  async function triggerNow(callId: string) {
    if (!confirm('Déclencher cet appel maintenant ? Le créneau d\'origine sera conservé pour la traçabilité.')) return
    setBusy(callId)
    try {
      const { error: invokeErr } = await supabase.functions.invoke('initiate-call', {
        body: { call_id: callId },
      })
      if (invokeErr) throw invokeErr

      await load()
    } catch (err) {
      alert(`Échec du déclenchement : ${await invokeErrorMessage(err)}`)
    } finally {
      setBusy(null)
    }
  }

  /** Supprime définitivement un appel (prévu ou en échec) — DELETE direct, RLS admin autorise. */
  async function deleteCall(callId: string) {
    if (!confirm('Effacer définitivement cet appel ? Cette action est irréversible.')) return
    setBusy(callId)
    try {
      const { error } = await supabase.from('calls').delete().eq('id', callId)
      if (error) throw new Error(error.message)
      await load()
    } catch (err) {
      alert(`Échec de la suppression : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Appels (tous comptes)</h1>
        <p className="text-slate-500 mt-1">200 résultats max. {tab === 'past' ? 'Plus récents en premier.' : 'Plus proches dans le temps en premier.'}</p>
      </header>

      {/* Onglets */}
      <div className="flex gap-1 mb-5 border-b border-creme-sable">
        <TabButton active={tab === 'past'}     onClick={() => setParam('tab', 'past')}>Appels passés</TabButton>
        <TabButton active={tab === 'upcoming'} onClick={() => setParam('tab', 'upcoming')}>Appels prévus</TabButton>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Filter
          label="Bénéficiaire"
          value={beneficiary}
          options={[
            { value: 'all', label: 'Tous les bénéficiaires' },
            ...beneficiariesList.map((b) => ({
              value: b.id,
              label: `${b.first_name} ${b.last_name}`,
            })),
          ]}
          onChange={(v) => setParam('beneficiary', v)}
        />
        <Filter
          label="Période"
          value={period}
          options={Object.entries(PERIOD_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          onChange={(v) => setParam('period', v)}
        />
        {tab === 'past' && (
          <Filter
            label="Sévérité"
            value={severity}
            options={[
              { value: 'all',  label: 'Toutes alertes' },
              { value: 'high', label: 'Avec alerte haute' },
            ]}
            onChange={(v) => setParam('severity', v)}
          />
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                {tab === 'past' ? (
                  <>
                    <th className="px-5 py-3">Planifié</th>
                    <th className="px-5 py-3">Effectif</th>
                  </>
                ) : (
                  <th className="px-5 py-3">Date</th>
                )}
                <th className="px-5 py-3">Bénéficiaire</th>
                <th className="px-5 py-3">Aidant</th>
                <th className="px-5 py-3">Statut</th>
                {tab === 'past' && <th className="px-5 py-3 text-center">Moteur</th>}
                {tab === 'past' && <th className="px-5 py-3 text-center">Durée</th>}
                {tab === 'past' && <th className="px-5 py-3 text-right">Coût IA</th>}
                {tab === 'past' && <th className="px-5 py-3 text-right">Coût Twilio</th>}
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
                // Heure effective = décroché réel (started_at), fallback sur le
                // déclenchement Twilio (notified_at) pour les missed/failed.
                const effective = c.started_at ?? c.notified_at
                // Coût Twilio : valeur réelle remontée par l'API Twilio si dispo,
                // sinon estimation par la durée (préfixée « ~ »).
                const twilioReal = c.twilio_cost_eur != null
                const twilioCost = twilioReal
                  ? `€${c.twilio_cost_eur!.toFixed(4)}`
                  : c.duration_seconds != null
                    ? `~€${(c.duration_seconds * TWILIO_EUR_PER_SECOND).toFixed(4)}`
                    : '—'
                const canRelaunch  = tab === 'past'     && (c.status === 'missed' || c.status === 'failed') && ben?.id
                const canTriggerNow = tab === 'upcoming' && c.status === 'scheduled'
                // Suppression : appels prévus (résidus en base) + appels en échec
                // (nettoyage des tentatives ratées qui polluent l'historique).
                const canDelete     = tab === 'upcoming' || (tab === 'past' && c.status === 'failed')
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
                    {tab === 'past' && (
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {effective
                          ? new Date(effective).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                    )}
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
                    {tab === 'past' && (
                      <td className="px-5 py-3 text-center">
                        {c.engine ? (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${ENGINE_LABEL[c.engine].tone}`}>
                            {ENGINE_LABEL[c.engine].label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    {tab === 'past' && (
                      <td className="px-5 py-3 text-center text-brun-700">{dur}</td>
                    )}
                    {tab === 'past' && (
                      <td className="px-5 py-3 text-right text-brun-700 font-mono text-xs">
                        {c.ai_cost_eur_real != null ? `€${c.ai_cost_eur_real.toFixed(4)}` : '—'}
                      </td>
                    )}
                    {tab === 'past' && (
                      <td
                        className={`px-5 py-3 text-right font-mono text-xs ${twilioReal ? 'text-brun-700' : 'text-slate-400'}`}
                        title={twilioReal ? 'Coût réel facturé par Twilio' : 'Estimation à partir de la durée (≈ 0,0007 €/s) — coût réel pas encore remonté'}
                      >
                        {twilioCost}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/historique/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink size={12} /> Détail
                        </Link>
                        {canRelaunch && (
                          <button
                            onClick={() => relaunch(c.id, ben!.id)}
                            disabled={busy === c.id}
                            className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline disabled:opacity-50"
                          >
                            <RefreshCcw size={12} className={busy === c.id ? 'animate-spin' : ''} />
                            Relancer
                          </button>
                        )}
                        {canTriggerNow && (
                          <button
                            onClick={() => triggerNow(c.id)}
                            disabled={busy === c.id}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            <Zap size={12} className={busy === c.id ? 'animate-pulse' : ''} />
                            Déclencher maintenant
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => deleteCall(c.id)}
                            disabled={busy === c.id}
                            className="inline-flex items-center gap-1 text-xs text-brique hover:underline disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={tab === 'past' ? 10 : 5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <PhoneCall size={24} className="mx-auto mb-2 text-slate-300" />
                    {tab === 'past'
                      ? 'Aucun appel passé ne correspond aux filtres.'
                      : 'Aucun appel prévu ne correspond aux filtres.'}
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

function TabButton({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'text-primary'
          : 'text-slate-500 hover:text-brun-700'
      }`}
    >
      {children}
      {active && (
        <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full" />
      )}
    </button>
  )
}

function Filter({ label, value, options, onChange }: {
  label:    string
  value:    string
  options:  Array<{ value: string; label: string }>
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
