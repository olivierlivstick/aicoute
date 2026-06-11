/**
 * Onglet « Démos vitrine » de /admin/appels — logs des conversations de démo
 * (table demo_calls), rapatriés depuis l'ancienne page ad-hoc /track_calls.
 *
 * Lecture directe via le client Supabase (admin) : la policy admin_all_demo_calls
 * (migration 20260529000003) ouvre le SELECT à tout admin → pas besoin de la clé
 * DEMO_TRACK_KEY ni de l'Edge Function list-demos ici.
 */

import { useEffect, useMemo, useState } from 'react'
import { Activity, MonitorSmartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FluidityModal, type FluidityMetrics } from '@/components/FluidityModal'
import { RecordingButton } from '@/components/RecordingButton'

interface DemoRow {
  id:                   string
  mode:                 'web' | 'phone'
  engine:               'openai' | 'gemini'
  started_at:           string
  ended_at:             string | null
  duration_seconds:     number | null
  phone_prefix:         string | null
  twilio_cost_eur:      number | null
  openai_cost_eur:      number | null
  openai_cost_eur_real: number | null
  fluidity_metrics:     FluidityMetrics | null
  recording_path:       string | null
}

const PERIOD_LABEL = { '7d': '7 derniers jours', '30d': '30 derniers jours', all: 'Tout' } as const
type Period = keyof typeof PERIOD_LABEL

export function DemosTab() {
  const [rows, setRows]     = useState<DemoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('7d')
  const [qualityFor, setQualityFor] = useState<FluidityMetrics | null>(null)

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('demo_calls')
      .select('id, mode, engine, started_at, ended_at, duration_seconds, phone_prefix, twilio_cost_eur, openai_cost_eur, openai_cost_eur_real, fluidity_metrics, recording_path')
      .order('started_at', { ascending: false })
      .limit(200)

    if (period !== 'all') {
      const sinceMs = period === '7d' ? Date.now() - 7 * 24 * 3600 * 1000
                    :                    Date.now() - 30 * 24 * 3600 * 1000
      q = q.gte('started_at', new Date(sinceMs).toISOString())
    }

    const { data } = await q
    setRows((data ?? []) as unknown as DemoRow[])
    setLoading(false)
  }

  const totals = useMemo(() => {
    const eff = (r: DemoRow) => r.openai_cost_eur_real != null ? Number(r.openai_cost_eur_real) : Number(r.openai_cost_eur) || 0
    const twilio = rows.reduce((s, r) => s + (Number(r.twilio_cost_eur) || 0), 0)
    const real   = rows.reduce((s, r) => s + (Number(r.openai_cost_eur_real) || 0), 0)
    const total  = twilio + rows.reduce((s, r) => s + eff(r), 0)
    return { count: rows.length, twilio, real, total }
  }, [rows])

  return (
    <div>
      {/* Filtre période (sur started_at) */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="inline-flex items-center gap-2 text-xs">
          <span className="text-slate-500 uppercase tracking-wider">Période</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-creme-sable bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            {(Object.keys(PERIOD_LABEL) as Period[]).map((v) => (
              <option key={v} value={v}>{PERIOD_LABEL[v]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Démos"        value={String(totals.count)} />
        <KpiCard label="Twilio cumulé" value={formatEur(totals.twilio)} />
        <KpiCard label="IA réel (tokens)" value={formatEur(totals.real)} sub="appels avec tokens" />
        <KpiCard label="Coût total" value={formatEur(totals.total)} sub="réel si dispo, sinon estimé" highlight />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3 text-center">Mode</th>
                <th className="px-4 py-3 text-center">Moteur</th>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3 text-right">Twilio</th>
                <th className="px-4 py-3 text-right">IA est.</th>
                <th className="px-4 py-3 text-right">IA réel</th>
                <th className="px-4 py-3">Qualité / Audio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-creme/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                    {new Date(r.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-brun-700 font-mono">
                    {r.duration_seconds ? formatDuration(r.duration_seconds) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${r.mode === 'web' ? 'bg-accent-50 text-accent-700' : 'bg-primary-50 text-primary'}`}>
                      {r.mode === 'web' ? 'Navigateur' : 'Téléphone'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${r.engine === 'gemini' ? 'bg-accent-50 text-accent-700' : 'bg-sauge/15 text-sauge'}`}>
                      {r.engine === 'gemini' ? 'Gemini' : 'OpenAI'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{r.phone_prefix ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                    {r.twilio_cost_eur != null ? formatEur(r.twilio_cost_eur) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                    {r.openai_cost_eur != null ? formatEur(r.openai_cost_eur) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-brun-700">
                    {r.openai_cost_eur_real != null ? formatEur(r.openai_cost_eur_real) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {r.fluidity_metrics && (
                        <button
                          onClick={() => setQualityFor(r.fluidity_metrics)}
                          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
                          title="Métriques de fluidité de la démo"
                        >
                          <Activity size={12} /> Qualité
                        </button>
                      )}
                      <RecordingButton path={r.recording_path} />
                      {!r.fluidity_metrics && !r.recording_path && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <MonitorSmartphone size={24} className="mx-auto mb-2 text-slate-300" />
                    Aucune démo sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {qualityFor && (
        <FluidityModal metrics={qualityFor} onClose={() => setQualityFor(null)} subtitle="Démo vitrine" />
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${highlight ? 'border-primary' : 'border-creme-sable'}`}>
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 font-serif text-2xl ${highlight ? 'text-primary' : 'text-brun-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}
