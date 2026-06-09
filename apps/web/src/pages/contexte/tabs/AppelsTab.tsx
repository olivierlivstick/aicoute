import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Phone, PhoneIncoming, PhoneOutgoing, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Beneficiary } from '@modect/shared'

// Coût Twilio estimé par la durée tant que le coût réel n'est pas remonté
// (même constante que /admin/appels).
const TWILIO_EUR_PER_SECOND = 0.0007

// Point de vue bénéficiaire (validé) :
//   received = AICOUTE → bénéficiaire (sortant, origin != 'inbound')
//   emitted  = bénéficiaire → AICOUTE (entrant, origin = 'inbound')
const TYPE_META = {
  received: { label: 'Reçu', sub: 'AICOUTE → bénéficiaire', icon: PhoneIncoming, swatch: '#C75D3A', chip: 'bg-primary-50 text-primary border-primary/15' },
  emitted:  { label: 'Émis', sub: 'Bénéficiaire → AICOUTE', icon: PhoneOutgoing, swatch: '#D9943E', chip: 'bg-accent-50 text-accent-700 border-accent/25' },
} as const

const STATUS_TONE: Record<string, string> = {
  missed: 'bg-accent-100 text-accent-800',
  failed: 'bg-brique/10 text-brique',
}
const STATUS_LABEL: Record<string, string> = { missed: 'Sans réponse', failed: 'Échec' }

interface CallRow {
  id: string
  status: string
  scheduled_at: string
  started_at: string | null
  duration_seconds: number | null
  ai_cost_eur_real: number | null
  twilio_cost_eur: number | null
  origin: string | null
}

type CallType = 'received' | 'emitted'
const callType = (origin: string | null): CallType => (origin === 'inbound' ? 'emitted' : 'received')

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
const fmtDur = (s: number | null) =>
  s ? `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}` : '—'

const twilioCost = (c: CallRow): { value: number; estimated: boolean } => {
  if (c.twilio_cost_eur != null) return { value: c.twilio_cost_eur, estimated: false }
  if (c.duration_seconds != null) return { value: c.duration_seconds * TWILIO_EUR_PER_SECOND, estimated: true }
  return { value: 0, estimated: false }
}

function mondayKey(iso: string): { key: string; monday: Date } {
  const d = new Date(iso)
  const day = (d.getDay() + 6) % 7 // 0 = lundi
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return { key: monday.toISOString().slice(0, 10), monday }
}

export function AppelsTab({ beneficiary }: { beneficiary: Beneficiary }) {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('calls')
      .select('id, status, scheduled_at, started_at, duration_seconds, ai_cost_eur_real, twilio_cost_eur, origin')
      .eq('beneficiary_id', beneficiary.id)
      .in('status', ['completed', 'missed', 'failed'])
      .order('scheduled_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!active) return
        setCalls((data as CallRow[] | null) ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [beneficiary.id])

  // Buckets hebdomadaires (lun-dim) pour le graphe — uniquement les appels avec durée.
  const weeks = useMemo(() => {
    const map = new Map<string, { key: string; monday: Date; recu: number; emis: number }>()
    for (const c of calls) {
      if (!c.duration_seconds) continue
      const { key, monday } = mondayKey(c.started_at ?? c.scheduled_at)
      if (!map.has(key)) map.set(key, { key, monday, recu: 0, emis: 0 })
      const bucket = map.get(key)!
      const minutes = c.duration_seconds / 60
      if (callType(c.origin) === 'received') bucket.recu += minutes
      else bucket.emis += minutes
    }
    return [...map.values()]
      .sort((a, b) => a.monday.getTime() - b.monday.getTime())
      .slice(-12)
      .map((w) => ({
        ...w,
        label: w.monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        recu: Math.round(w.recu),
        emis: Math.round(w.emis),
      }))
  }, [calls])

  const totals = useMemo(() => {
    let duration = 0, ai = 0, twilio = 0
    for (const c of calls) {
      duration += c.duration_seconds ?? 0
      ai += c.ai_cost_eur_real ?? 0
      twilio += twilioCost(c).value
    }
    return { duration, ai, twilio, total: ai + twilio, count: calls.length }
  }, [calls])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Graphe minutes par semaine */}
      <section className="bg-surface rounded-2xl border border-creme-sable shadow-[0_1px_2px_rgba(61,40,23,0.04)]">
        <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-creme text-primary">
            <Phone size={15} />
          </span>
          <h3 className="font-title text-[15px] font-semibold text-slate-800 flex-1">Minutes d'appel par semaine</h3>
        </header>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center gap-5 mb-4">
            {(['received', 'emitted'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-2 text-[13px] text-slate-600">
                <span className="w-3 h-3 rounded-[3px]" style={{ background: TYPE_META[k].swatch }} />
                {TYPE_META[k].label}
                <span className="text-slate-400">· {TYPE_META[k].sub}</span>
              </span>
            ))}
          </div>

          {weeks.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-8 text-center">Aucun appel avec durée à afficher pour l'instant.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeks} barGap={4} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="#F5EBDC" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#AD9A82' }} tickLine={false} axisLine={{ stroke: '#F5EBDC' }} />
                <YAxis tick={{ fontSize: 11, fill: '#AD9A82' }} tickLine={false} axisLine={false} width={32} unit="′" />
                <Tooltip
                  cursor={{ fill: 'rgba(199,93,58,0.06)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #F5EBDC', fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value} min`, name === 'recu' ? 'Reçu' : 'Émis']}
                  labelFormatter={(l) => `Semaine du ${l}`}
                />
                <Bar dataKey="recu" name="recu" fill={TYPE_META.received.swatch} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="emis" name="emis" fill={TYPE_META.emitted.swatch} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Tableau historique des coûts */}
      <section className="bg-surface rounded-2xl border border-creme-sable shadow-[0_1px_2px_rgba(61,40,23,0.04)]">
        <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-creme text-primary">
            <Phone size={15} />
          </span>
          <h3 className="font-title text-[15px] font-semibold text-slate-800 flex-1">Historique des appels</h3>
        </header>
        <div className="px-5 pb-5">
          {calls.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-8 text-center">Aucun appel pour ce bénéficiaire.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13.5px] border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="font-semibold px-2 py-2.5">Date</th>
                    <th className="font-semibold px-2 py-2.5">Type</th>
                    <th className="font-semibold px-2 py-2.5 text-right">Durée</th>
                    <th className="font-semibold px-2 py-2.5 text-right">Coût IA</th>
                    <th className="font-semibold px-2 py-2.5 text-right">Coût Twilio</th>
                    <th className="font-semibold px-2 py-2.5 text-right">Coût total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-creme-sable">
                  {calls.map((c) => {
                    const t = TYPE_META[callType(c.origin)]
                    const tw = twilioCost(c)
                    const ai = c.ai_cost_eur_real ?? 0
                    const total = ai + tw.value
                    const d = new Date(c.started_at ?? c.scheduled_at)
                    return (
                      <tr key={c.id} className="hover:bg-creme/40 transition-colors">
                        <td className="px-2 py-3 whitespace-nowrap">
                          <span className="text-slate-700">{d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                          <span className="text-slate-400"> · {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-2 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-0.5 rounded-full border', t.chip)}>
                            <t.icon size={11} /> {t.label}
                          </span>
                          {c.status !== 'completed' && (
                            <span className={cn('ml-1.5 inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full', STATUS_TONE[c.status])}>
                              {STATUS_LABEL[c.status] ?? c.status}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">{fmtDur(c.duration_seconds)}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-500 font-mono text-[12.5px]">{ai > 0 ? eur(ai) : '—'}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-500 font-mono text-[12.5px]">
                          {tw.value > 0 ? `${tw.estimated ? '~' : ''}${eur(tw.value)}` : '—'}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums font-mono text-[12.5px] font-semibold text-brun-900">{total > 0 ? eur(total) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-creme-sable font-semibold text-brun-900">
                    <td className="px-2 py-3" colSpan={2}>Total ({totals.count} appel{totals.count > 1 ? 's' : ''})</td>
                    <td className="px-2 py-3 text-right tabular-nums">{fmtDur(totals.duration)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-mono text-[12.5px]">{eur(totals.ai)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-mono text-[12.5px]">{eur(totals.twilio)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-mono text-[12.5px] text-primary">{eur(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
            <Lightbulb size={12} /> Coût total = coût IA (moteur conversationnel) + coût Twilio (téléphonie). « ~ » = estimation par la durée tant que le coût réel n'est pas remonté.
          </p>
        </div>
      </section>
    </div>
  )
}
