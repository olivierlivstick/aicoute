/**
 * /admin/qualite — agrégation temps réel des métriques de fluidité capturées
 * par le voice-bridge (calls.fluidity_metrics). Étape 0 = observation.
 *
 * Filtres : périmètre (global / par aidant / par bénéficiaire) + période (8/30 j).
 * On compare aussi OpenAI vs Gemini (cœur du chantier fluidité). La latence du
 * « blanc » est calculée en POOLANT les échantillons bruts (samples_ms) de tous
 * les appels du périmètre → vraie distribution, pas une moyenne de moyennes.
 *
 * ⚠️ Gemini : la latence en conversation est approximative (pas d'event de fin
 * de parole) → repère « approx » affiché.
 */

import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw, BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FluidityMetrics } from '@/components/FluidityModal'

interface CallRow {
  id:               string
  scheduled_at:     string
  engine:           'openai' | 'gemini' | null
  fluidity_metrics: FluidityMetrics | null
  beneficiary_id:   string
  beneficiaries: {
    id:           string
    first_name:   string
    last_name:    string
    caregiver_id: string
    profiles:     { id: string; full_name: string | null } | null
  } | null
}

interface DemoRow {
  id:               string
  engine:           'openai' | 'gemini'
  started_at:       string
  fluidity_metrics: FluidityMetrics | null
}

type Period = '8d' | '30d'
type ScopeKind = 'global' | 'caregiver' | 'beneficiary'
type Source = 'calls' | 'demos' | 'both'

const PERIOD_DAYS: Record<Period, number> = { '8d': 8, '30d': 30 }

export function QualiteSection() {
  const [rows, setRows]         = useState<CallRow[]>([])
  const [demoRows, setDemoRows] = useState<DemoRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState<Period>('8d')
  const [scope, setScope]       = useState<ScopeKind>('global')
  const [scopeId, setScopeId]   = useState<string>('')   // caregiver_id ou beneficiary_id
  const [source, setSource]     = useState<Source>('both')

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    const sinceIso = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 3600 * 1000).toISOString()
    // On charge les 2 sources en parallèle (le filtre Source est appliqué côté
    // client → pas de refetch quand on change de source).
    const [callsRes, demosRes] = await Promise.all([
      supabase
        .from('calls')
        .select('id, scheduled_at, engine, fluidity_metrics, beneficiary_id, beneficiaries(id, first_name, last_name, caregiver_id, profiles(id, full_name))')
        .not('fluidity_metrics', 'is', null)
        .gte('scheduled_at', sinceIso)
        .order('scheduled_at', { ascending: false })
        .limit(3000),
      supabase
        .from('demo_calls')
        .select('id, engine, started_at, fluidity_metrics')
        .not('fluidity_metrics', 'is', null)
        .gte('started_at', sinceIso)
        .order('started_at', { ascending: false })
        .limit(3000),
    ])
    setRows((callsRes.data ?? []) as unknown as CallRow[])
    setDemoRows((demosRes.data ?? []) as unknown as DemoRow[])
    setLoading(false)
  }

  // Options de périmètre dérivées des données présentes (entités ayant ≥1 appel mesuré)
  const caregivers = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      const cid = r.beneficiaries?.caregiver_id
      if (cid) map.set(cid, r.beneficiaries?.profiles?.full_name || '(aidant sans nom)')
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const beneficiaries = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      const b = r.beneficiaries
      if (b?.id) map.set(b.id, `${b.first_name} ${b.last_name}`)
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  // Items unifiés (appels réels + démos) filtrés par Source ET Périmètre.
  // Les démos n'ont pas d'aidant/bénéficiaire → incluses seulement en Global.
  const items = useMemo(() => {
    const out: Array<{ engine: 'openai' | 'gemini' | null; m: FluidityMetrics }> = []

    if (source !== 'demos') {
      let cr = rows
      if (scope === 'caregiver' && scopeId)   cr = rows.filter((r) => r.beneficiaries?.caregiver_id === scopeId)
      else if (scope === 'beneficiary' && scopeId) cr = rows.filter((r) => r.beneficiary_id === scopeId)
      for (const r of cr) if (r.fluidity_metrics) out.push({ engine: r.engine, m: r.fluidity_metrics })
    }
    if (source !== 'calls' && scope === 'global') {
      for (const r of demoRows) if (r.fluidity_metrics) out.push({ engine: r.engine, m: r.fluidity_metrics })
    }
    return out
  }, [rows, demoRows, source, scope, scopeId])

  const all    = useMemo(() => aggregate(items.map((x) => x.m)), [items])
  const openai = useMemo(() => aggregate(items.filter((x) => x.engine === 'openai').map((x) => x.m)), [items])
  const gemini = useMemo(() => aggregate(items.filter((x) => x.engine === 'gemini').map((x) => x.m)), [items])

  function onScopeKind(k: ScopeKind) { setScope(k); setScopeId('') }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-brun-900">Qualité de la conversation</h2>
          <p className="text-slate-500 mt-1 text-sm">Métriques de fluidité agrégées (Étape 0 — observation). {all.count} appel{all.count > 1 ? 's' : ''} mesuré{all.count > 1 ? 's' : ''} sur la période.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-sm text-accent-700 border border-creme-sable rounded-lg px-3 py-2 hover:bg-accent-50"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Rafraîchir
        </button>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SelectField label="Périmètre" value={scope} onChange={(v) => onScopeKind(v as ScopeKind)}
          options={[
            { value: 'global',      label: 'Global (tous)' },
            { value: 'caregiver',   label: 'Par aidant' },
            { value: 'beneficiary', label: 'Par bénéficiaire' },
          ]} />
        {scope === 'caregiver' && (
          <SelectField label="Aidant" value={scopeId} onChange={setScopeId}
            options={[{ value: '', label: '— choisir —' }, ...caregivers.map((c) => ({ value: c.id, label: c.label }))]} />
        )}
        {scope === 'beneficiary' && (
          <SelectField label="Bénéficiaire" value={scopeId} onChange={setScopeId}
            options={[{ value: '', label: '— choisir —' }, ...beneficiaries.map((b) => ({ value: b.id, label: b.label }))]} />
        )}
        <SelectField label="Période" value={period} onChange={(v) => setPeriod(v as Period)}
          options={[{ value: '8d', label: '8 derniers jours' }, { value: '30d', label: '30 derniers jours' }]} />
        {scope === 'global' ? (
          <SelectField label="Source" value={source} onChange={(v) => setSource(v as Source)}
            options={[
              { value: 'both',  label: 'Appels réels + démos' },
              { value: 'calls', label: 'Appels réels' },
              { value: 'demos', label: 'Démos vitrine' },
            ]} />
        ) : (
          <span className="text-[11px] text-slate-400 self-center">Démos exclues hors périmètre Global (pas d'aidant/bénéficiaire).</span>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : all.count === 0 ? (
        <div className="bg-white rounded-2xl border border-creme-sable p-10 text-center text-slate-400">
          <BarChart3 size={24} className="mx-auto mb-2 text-slate-300" />
          Aucun appel mesuré sur ce périmètre / cette période.
        </div>
      ) : (
        <>
          {/* KPI combinés */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Kpi label="Appels mesurés"          value={String(all.count)} />
            <Kpi label="Blanc au démarrage"      value={fmtMs(all.blankStartAvgMs)} sub="moyenne" />
            <Kpi label="Blanc en conversation"   value={fmtMs(all.turnAvgMs)} sub={`moy · p90 ${fmtMs(all.turnP90Ms)}`} highlight />
            <Kpi label="Barge-ins / min"         value={all.bargePerMin != null ? all.bargePerMin.toFixed(2) : '—'} />
            <Kpi label="Faux barge-in (bruit)"   value={all.suspectedFalseRatio != null ? `${Math.round(all.suspectedFalseRatio * 100)} %` : '—'} sub={all.suspectedFalseTotal != null ? `${all.suspectedFalseTotal} au total` : 'non mesuré'} />
            <Kpi label="« Allô ? »"              value={all.presenceTotal != null ? String(all.presenceTotal) : '—'} sub={all.callsWithPresence != null ? `${all.callsWithPresence} appel(s)` : 'non mesuré'} />
          </div>

          {/* Comparaison OpenAI vs Gemini */}
          <h2 className="font-serif text-xl text-brun-900 mb-3">Comparaison par moteur</h2>
          <div className="bg-white rounded-2xl border border-creme-sable overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Métrique</th>
                  <th className="px-4 py-3 text-right">OpenAI</th>
                  <th className="px-4 py-3 text-right">Gemini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-creme-sable">
                <CmpRow label="Appels mesurés"        o={String(openai.count)} g={String(gemini.count)} />
                <CmpRow label="Blanc au démarrage (moy)"     o={fmtMs(openai.blankStartAvgMs)} g={fmtMs(gemini.blankStartAvgMs)} />
                <CmpRow label="Blanc en conversation (moy)"  o={fmtMs(openai.turnAvgMs)}       g={fmtMs(gemini.turnAvgMs)} gApprox={gemini.count > 0} />
                <CmpRow label="Blanc en conversation (p90)"  o={fmtMs(openai.turnP90Ms)}       g={fmtMs(gemini.turnP90Ms)} gApprox={gemini.count > 0} />
                <CmpRow label="Blanc en conversation (max)"  o={fmtMs(openai.turnMaxMs)}       g={fmtMs(gemini.turnMaxMs)} gApprox={gemini.count > 0} />
                <CmpRow label="Barge-ins / min"       o={openai.bargePerMin != null ? openai.bargePerMin.toFixed(2) : '—'} g={gemini.bargePerMin != null ? gemini.bargePerMin.toFixed(2) : '—'} />
                <CmpRow label="Faux barge-in (bruit)" o={fmtPct(openai.suspectedFalseRatio)} g={fmtPct(gemini.suspectedFalseRatio)} />
                <CmpRow label="« Allô ? » (total)"    o={openai.presenceTotal != null ? String(openai.presenceTotal) : '—'} g={gemini.presenceTotal != null ? String(gemini.presenceTotal) : '—'} />
                <CmpRow label="Temps de parole IA (ratio moy)" o={fmtPct(openai.speechRatioAvg)} g={fmtPct(gemini.speechRatioAvg)} />
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 mt-3">
            ⚠ Le « blanc en conversation » de Gemini est <strong>approximatif</strong> (Google ne fournit pas d'event de
            fin de parole ; latence estimée via le transcript). Les valeurs OpenAI sont précises (event <code>speech_stopped</code>).
            La latence est calculée en poolant les échantillons bruts de tous les appels du périmètre.
          </p>
        </>
      )}
    </div>
  )
}

// --- Agrégation -------------------------------------------------------------

interface Agg {
  count:               number
  blankStartAvgMs:     number | null
  turnAvgMs:           number | null
  turnP90Ms:           number | null
  turnMaxMs:           number | null
  bargePerMin:         number | null
  suspectedFalseTotal: number | null
  suspectedFalseRatio: number | null
  presenceTotal:       number | null
  callsWithPresence:   number | null
  speechRatioAvg:      number | null
}

function aggregate(list: FluidityMetrics[]): Agg {
  const count = list.length

  const starts = list.map((m) => m.blank?.start_ms).filter((x): x is number => x != null)
  const blankStartAvgMs = starts.length ? Math.round(mean(starts)) : null

  // Latence en conversation : pool de TOUS les échantillons bruts
  const samples: number[] = []
  for (const m of list) for (const s of m.blank?.samples_ms ?? []) samples.push(s)
  samples.sort((a, b) => a - b)
  const turnAvgMs = samples.length ? Math.round(mean(samples)) : null
  const turnP90Ms = samples.length ? samples[Math.ceil(0.9 * samples.length) - 1] : null
  const turnMaxMs = samples.length ? samples[samples.length - 1] : null

  const bargeTotal = sum(list.map((m) => m.barge_in?.total ?? 0))
  const totalMin   = sum(list.map((m) => m.duration_seconds ?? 0)) / 60
  const bargePerMin = totalMin > 0 ? +(bargeTotal / totalMin).toFixed(2) : null

  // Faux barge-in : seulement parmi les appels où c'est mesuré (transcription dispo)
  const measured = list.filter((m) => m.barge_in?.suspected_false != null)
  const suspectedFalseTotal = measured.length ? sum(measured.map((m) => m.barge_in!.suspected_false as number)) : null
  const bargeAmongMeasured  = sum(measured.map((m) => m.barge_in?.total ?? 0))
  const suspectedFalseRatio = (suspectedFalseTotal != null && bargeAmongMeasured > 0)
    ? +(suspectedFalseTotal / bargeAmongMeasured).toFixed(3) : null

  const presList = list.filter((m) => m.presence_checks != null)
  const presenceTotal     = presList.length ? sum(presList.map((m) => m.presence_checks!.count ?? 0)) : null
  const callsWithPresence = presList.length ? presList.filter((m) => (m.presence_checks!.count ?? 0) > 0).length : null

  const ratios = list.map((m) => m.speech_ratio).filter((x): x is number => x != null)
  const speechRatioAvg = ratios.length ? +mean(ratios).toFixed(2) : null

  return { count, blankStartAvgMs, turnAvgMs, turnP90Ms, turnMaxMs, bargePerMin, suspectedFalseTotal, suspectedFalseRatio, presenceTotal, callsWithPresence, speechRatioAvg }
}

function mean(arr: number[]): number { return arr.reduce((s, x) => s + x, 0) / arr.length }
function sum(arr: number[]): number { return arr.reduce((s, x) => s + x, 0) }

function fmtMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}
function fmtPct(r: number | null): string {
  return r == null ? '—' : `${Math.round(r * 100)} %`
}

// --- UI helpers -------------------------------------------------------------

function Kpi({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${highlight ? 'border-primary' : 'border-creme-sable'}`}>
      <p className="text-[11px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 font-serif text-2xl ${highlight ? 'text-primary' : 'text-brun-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

function CmpRow({ label, o, g, gApprox = false }: { label: string; o: string; g: string; gApprox?: boolean }) {
  return (
    <tr className="hover:bg-creme/40">
      <td className="px-4 py-2.5 text-brun-700">{label}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brun-900">{o}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brun-900">
        {g}{gApprox && g !== '—' && <span className="ml-1 text-[10px] text-accent-700">~</span>}
      </td>
    </tr>
  )
}

function SelectField({ label, value, onChange, options }: {
  label:    string
  value:    string
  onChange: (v: string) => void
  options:  Array<{ value: string; label: string }>
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-500 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-creme-sable bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
