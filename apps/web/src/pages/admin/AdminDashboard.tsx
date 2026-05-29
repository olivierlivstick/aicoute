import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserRound, Phone, AlertOctagon, Coins, Activity, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Kpis {
  caregivers:      number
  beneficiaries:   number
  calls24h:        number
  calls7d:         number
  completed7d:     number
  missed7d:        number
  failed7d:        number
  highAlertsToday: number
  aiCost7dEur:     number
  stuckNotified:   number   // calls bloqués en 'notified' depuis > 5 min
}

export function AdminDashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const now      = new Date()
    const ms24h    = 24 * 60 * 60 * 1000
    const ms7d     = 7 * ms24h
    const since24h = new Date(now.getTime() - ms24h).toISOString()
    const since7d  = new Date(now.getTime() - ms7d).toISOString()
    const todayIso = new Date(now.toDateString()).toISOString()
    const stuck5m  = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    const [
      caregiversRes,
      beneficiariesRes,
      calls24hRes,
      calls7dRes,
      completed7dRes,
      missed7dRes,
      failed7dRes,
      stuckNotifiedRes,
      callsForCost,
      callsForAlerts,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'caregiver'),
      supabase.from('beneficiaries').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('calls').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
      supabase.from('calls').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('ended_at', since7d),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('status', 'missed').gte('created_at', since7d),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since7d),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('status', 'notified').lt('notified_at', stuck5m),
      supabase.from('calls').select('ai_cost_eur_real').gte('created_at', since7d),
      supabase.from('calls').select('alerts').gte('ended_at', todayIso),
    ])

    const aiCost7dEur = (callsForCost.data ?? []).reduce(
      (acc: number, c: { ai_cost_eur_real: number | null }) => acc + (c.ai_cost_eur_real ?? 0),
      0,
    )

    const highAlertsToday = (callsForAlerts.data ?? []).reduce((acc: number, c: { alerts: unknown }) => {
      if (!Array.isArray(c.alerts)) return acc
      return acc + (c.alerts as Array<{ severity: string }>).filter((a) => a.severity === 'high').length
    }, 0)

    setKpis({
      caregivers:      caregiversRes.count ?? 0,
      beneficiaries:   beneficiariesRes.count ?? 0,
      calls24h:        calls24hRes.count ?? 0,
      calls7d:         calls7dRes.count ?? 0,
      completed7d:     completed7dRes.count ?? 0,
      missed7d:        missed7dRes.count ?? 0,
      failed7d:        failed7dRes.count ?? 0,
      highAlertsToday,
      aiCost7dEur:     +aiCost7dEur.toFixed(2),
      stuckNotified:   stuckNotifiedRes.count ?? 0,
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
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard icon={Users}        label="Aidants"           value={kpis.caregivers} />
            <KpiCard icon={UserRound}    label="Bénéficiaires actifs" value={kpis.beneficiaries} />
            <KpiCard icon={Phone}        label="Appels 24h"        value={kpis.calls24h} hint={`${kpis.calls7d} sur 7 j`} />
            <KpiCard icon={Coins}        label="Coût IA 7 j"       value={`€${kpis.aiCost7dEur.toFixed(2)}`} />
          </section>

          {/* Détail 7 jours */}
          <section className="bg-white rounded-2xl border border-creme-sable p-6 mb-8">
            <h2 className="font-serif text-lg font-semibold text-brun-900 mb-4">Sur les 7 derniers jours</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusTile label="Complétés"  value={kpis.completed7d} tone="ok" />
              <StatusTile label="No-answer"  value={kpis.missed7d}    tone="warn" />
              <StatusTile label="Échecs"     value={kpis.failed7d}    tone="bad" />
            </div>
          </section>

          {/* Alertes du jour + santé */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AlertCard
              icon={AlertOctagon}
              label="Alertes haute sévérité aujourd'hui"
              value={kpis.highAlertsToday}
              tone={kpis.highAlertsToday > 0 ? 'bad' : 'ok'}
              cta={{ to: '/admin/appels?period=today&severity=high', label: 'Voir les appels concernés' }}
            />
            <AlertCard
              icon={Activity}
              label="Calls bloqués en notified (> 5 min)"
              value={kpis.stuckNotified}
              tone={kpis.stuckNotified > 0 ? 'warn' : 'ok'}
              cta={{ to: '/admin/sante', label: 'Page santé système' }}
            />
          </section>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-creme-sable p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
        <Icon size={16} className="text-accent-700" />
        {label}
      </div>
      <p className="font-serif text-3xl font-semibold text-brun-900">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function StatusTile({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'ok'   ? 'text-sauge'
                  : tone === 'warn' ? 'text-accent-700'
                  : 'text-brique'
  return (
    <div className="bg-creme rounded-xl p-4">
      <p className={`font-serif text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-sm text-brun-700 mt-1">{label}</p>
    </div>
  )
}

function AlertCard({ icon: Icon, label, value, tone, cta }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: number
  tone: 'ok' | 'warn' | 'bad'
  cta: { to: string; label: string }
}) {
  const toneClass = tone === 'ok'   ? 'text-sauge bg-sauge/10 border-sauge/20'
                  : tone === 'warn' ? 'text-accent-700 bg-accent-50 border-accent-200'
                  : 'text-brique bg-brique/10 border-brique/20'
  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm mb-2">
            <Icon size={16} />
            {label}
          </div>
          <p className="font-serif text-3xl font-semibold">{value}</p>
        </div>
        <Link to={cta.to} className="text-xs underline hover:no-underline flex items-center gap-1 mt-2">
          {cta.label} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}
