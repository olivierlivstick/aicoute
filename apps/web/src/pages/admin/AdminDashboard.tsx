import { useEffect, useMemo, useState } from 'react'
import { Users, Phone, Coins } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'

interface Kpis {
  caregivers:      number
  beneficiaries:   number
  passed24h:       number   // appels dont le créneau tombe dans les dernières 24h
  upcoming24h:     number   // appels 'scheduled' dans les prochaines 24h
  aiCost7dEur:     number
  twilioCost7dEur: number
}

type Period = 'day' | 'week' | 'month'

interface RawCall {
  ended_at:         string
  duration_seconds: number | null
  ai_cost_eur_real: number | null
  twilio_cost_eur:  number | null
}

interface Bucket {
  label:      string
  calls:      number
  minutes:    number
  aiCost:     number
  twilioCost: number
}

export function AdminDashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [rawCalls, setRawCalls] = useState<RawCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const now      = new Date()
    const ms24h    = 24 * 60 * 60 * 1000
    const ms7d     = 7 * ms24h
    const nowIso   = now.toISOString()
    const since24h = new Date(now.getTime() - ms24h).toISOString()
    const next24h  = new Date(now.getTime() + ms24h).toISOString()
    const since7d  = new Date(now.getTime() - ms7d).toISOString()

    const [
      caregiversRes,
      beneficiariesRes,
      passed24hRes,
      upcoming24hRes,
      callsForCost,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'caregiver'),
      supabase.from('beneficiaries').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Appels dont le créneau prévu tombe dans les dernières 24h (tous statuts)
      supabase.from('calls').select('id', { count: 'exact', head: true }).gte('scheduled_at', since24h).lte('scheduled_at', nowIso),
      // Appels encore à venir planifiés dans les prochaines 24h
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gt('scheduled_at', nowIso).lte('scheduled_at', next24h),
      supabase.from('calls').select('ai_cost_eur_real, twilio_cost_eur').gte('created_at', since7d),
    ])

    // Appels terminés sur 6 mois : données brutes, bucketisées côté client selon la fréquence choisie
    const since6mo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
    const { data: rawRows } = await supabase
      .from('calls')
      .select('ended_at, duration_seconds, ai_cost_eur_real, twilio_cost_eur')
      .eq('status', 'completed')
      .gte('ended_at', since6mo)
      .order('ended_at', { ascending: true })
    setRawCalls((rawRows ?? []) as RawCall[])

    const aiCost7dEur = (callsForCost.data ?? []).reduce(
      (acc: number, c: { ai_cost_eur_real: number | null }) => acc + (c.ai_cost_eur_real ?? 0),
      0,
    )

    const twilioCost7dEur = (callsForCost.data ?? []).reduce(
      (acc: number, c: { twilio_cost_eur: number | null }) => acc + (c.twilio_cost_eur ?? 0),
      0,
    )

    setKpis({
      caregivers:      caregiversRes.count ?? 0,
      beneficiaries:   beneficiariesRes.count ?? 0,
      passed24h:       passed24hRes.count ?? 0,
      upcoming24h:     upcoming24hRes.count ?? 0,
      aiCost7dEur:     +aiCost7dEur.toFixed(2),
      twilioCost7dEur: +twilioCost7dEur.toFixed(2),
    })
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Vue d'ensemble</h1>
        <p className="text-slate-500 mt-1">Indicateurs système et activité globale sur tous les comptes.</p>
      </header>

      {loading || !kpis ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <>
          {/* KPI principales */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <KpiCard icon={Users}        label="Aidants / Bénéficiaires" value={`${kpis.caregivers} / ${kpis.beneficiaries}`} />
            <KpiCard icon={Phone}        label="Appels 24h"              value={`${kpis.passed24h} / ${kpis.upcoming24h}`} hint="passés / à venir" />
            <KpiCard icon={Coins}        label="Coût IA/TW 7 j"          value={`€${kpis.aiCost7dEur.toFixed(2)} / €${kpis.twilioCost7dEur.toFixed(2)}`} />
          </section>

          {/* Activité & coûts — fréquence sélectionnable */}
          <ActivityCharts rows={rawCalls} />

          {/* Coût moyen par minute — indicateur clé */}
          <CostPerMinuteTable rows={rawCalls} />
        </>
      )}
    </div>
  )
}

// ─── Graphes activité & coûts (fréquence sélectionnable) ───────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day',   label: '10 jours' },
  { key: 'week',  label: '8 semaines' },
  { key: 'month', label: '6 mois' },
]

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function dayKey(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (x.getDay() + 6) % 7 // 0 = lundi
  x.setDate(x.getDate() - offset)
  return x
}

function buildBuckets(rows: RawCall[], period: Period): Bucket[] {
  const now = new Date()
  const order: string[] = []
  const map = new Map<string, Bucket>()
  const add = (key: string, label: string) => {
    order.push(key)
    map.set(key, { label, calls: 0, minutes: 0, aiCost: 0, twilioCost: 0 })
  }

  if (period === 'day') {
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      add(dayKey(d), `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`)
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const monday = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7))
      add(dayKey(monday), `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`)
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, MONTHS_FR[d.getMonth()])
    }
  }

  const keyOf = (date: Date) =>
    period === 'day'  ? dayKey(date)
    : period === 'week' ? dayKey(startOfWeek(date))
    : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

  for (const r of rows) {
    if (!r.ended_at) continue
    const b = map.get(keyOf(new Date(r.ended_at)))
    if (!b) continue
    b.calls      += 1
    b.minutes    += (r.duration_seconds ?? 0) / 60
    b.aiCost     += r.ai_cost_eur_real ?? 0
    b.twilioCost += r.twilio_cost_eur ?? 0
  }

  return order.map((k) => {
    const b = map.get(k)!
    return {
      ...b,
      minutes:    +b.minutes.toFixed(1),
      aiCost:     +b.aiCost.toFixed(2),
      twilioCost: +b.twilioCost.toFixed(2),
    }
  })
}

function ActivityCharts({ rows }: { rows: RawCall[] }) {
  const [period, setPeriod] = useState<Period>('day')
  const buckets = useMemo(() => buildBuckets(rows, period), [rows, period])

  const axisTick = { fontSize: 11, fill: '#6B4423' }
  const tooltipStyle = { borderRadius: 12, border: '1px solid #EFE7DB', fontSize: 12 }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold text-brun-900">Activité &amp; coûts</h2>
        <div className="inline-flex rounded-xl border border-creme-sable bg-white p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                period === p.key ? 'bg-primary text-white' : 'text-slate-500 hover:text-brun-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graphe 1 — appels + minutes (double axe Y) */}
        <div className="bg-white rounded-2xl border border-creme-sable p-5">
          <h3 className="text-sm font-semibold text-brun-700 mb-4">Appels &amp; minutes</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7DB" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="calls" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="minutes" orientation="right" tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => (name === 'Minutes' ? [`${v} min`, name] : [v, name])}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="calls" dataKey="calls" name="Appels" fill="#D9943E" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Line yAxisId="minutes" type="monotone" dataKey="minutes" name="Minutes" stroke="#C75D3A" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Graphe 2 — coûts IA + Twilio (€) */}
        <div className="bg-white rounded-2xl border border-creme-sable p-5">
          <h3 className="text-sm font-semibold text-brun-700 mb-4">Coûts IA &amp; Twilio (€)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7DB" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => `€${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [`€${Number(v).toFixed(2)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="aiCost" name="Coût IA" fill="#C75D3A" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="twilioCost" name="Coût Twilio" fill="#D9943E" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

// ─── Coût moyen par minute (3 fenêtres fixes) ──────────────────────────────

const COST_WINDOWS: { label: string; days: number }[] = [
  { label: '8 derniers jours',     days: 8 },
  { label: '8 dernières semaines', days: 56 },
  { label: '6 derniers mois',      days: 182 },
]

function avgCostPerMin(rows: RawCall[], cutoff: Date) {
  let minutes = 0, ai = 0, tw = 0
  for (const r of rows) {
    if (!r.ended_at || new Date(r.ended_at) < cutoff) continue
    minutes += (r.duration_seconds ?? 0) / 60
    ai      += r.ai_cost_eur_real ?? 0
    tw      += r.twilio_cost_eur ?? 0
  }
  return {
    minutes,
    ai:    minutes > 0 ? ai / minutes : 0,
    tw:    minutes > 0 ? tw / minutes : 0,
    total: minutes > 0 ? (ai + tw) / minutes : 0,
  }
}

function CostPerMinuteTable({ rows }: { rows: RawCall[] }) {
  const data = useMemo(() => {
    const now = Date.now()
    return COST_WINDOWS.map((w) => ({
      ...w,
      ...avgCostPerMin(rows, new Date(now - w.days * 24 * 60 * 60 * 1000)),
    }))
  }, [rows])

  return (
    <section className="mb-8 bg-white rounded-2xl border border-creme-sable p-6">
      <h2 className="font-serif text-lg font-semibold text-brun-900">Coût moyen par minute</h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        Indicateur clé de marge — coût réel rapporté aux minutes d'appels terminés sur chaque fenêtre.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-creme-sable">
              <th className="py-2 font-medium text-left">Période</th>
              <th className="py-2 font-medium text-right">Coût IA /min</th>
              <th className="py-2 font-medium text-right">Coût Twilio /min</th>
              <th className="py-2 font-medium text-right">Coût total /min</th>
              <th className="py-2 font-medium text-right">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-creme-sable last:border-0">
                <td className="py-3 text-brun-700">{d.label}</td>
                <td className="py-3 text-right font-mono text-brun-900">€{d.ai.toFixed(3)}</td>
                <td className="py-3 text-right font-mono text-brun-900">€{d.tw.toFixed(3)}</td>
                <td className="py-3 text-right font-mono font-semibold text-primary">€{d.total.toFixed(3)}</td>
                <td className="py-3 text-right text-slate-400">{Math.round(d.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function KpiCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-creme-sable px-4 py-3 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-500 text-sm min-w-0">
        <Icon size={16} className="text-accent-700 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="font-serif text-2xl font-semibold text-brun-900">{value}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
    </div>
  )
}

