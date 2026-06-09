import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Phone, Check, Calendar, Notebook, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { computeAge } from './cards'
import type { Beneficiary } from '@modect/shared'

interface CaregiverInfo { id: string; full_name: string; email: string }

interface HeaderStats {
  callsTotal: number
  lastCall: string | null
  lastMood: string | null
  nextCall: string | null
  memories: number
}

const MOOD_DOT: Record<string, string> = {
  positive: 'bg-sauge',
  neutral: 'bg-slate-300',
  concerned: 'bg-accent',
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

/**
 * En-tête « fiche d'identité » de la page admin d'un bénéficiaire : lien retour,
 * sur-titre, ligne d'identité + rangée de 5 vignettes de stats. Réservé à l'admin
 * (monté dans AdminBeneficiaireDetail). Charge ses propres agrégats (léger).
 */
export function BeneficiaryAdminHeader({
  beneficiary,
  caregiver,
}: {
  beneficiary: Beneficiary
  caregiver: CaregiverInfo | null
}) {
  const [stats, setStats] = useState<HeaderStats | null>(null)
  const age = computeAge(beneficiary.birth_date, beneficiary.birth_year)
  const nowIso = new Date().toISOString()

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('calls').select('id', { count: 'exact', head: true })
        .eq('beneficiary_id', beneficiary.id).eq('status', 'completed'),
      supabase.from('calls').select('started_at, ended_at, scheduled_at, mood_detected')
        .eq('beneficiary_id', beneficiary.id).eq('status', 'completed')
        .order('scheduled_at', { ascending: false }).limit(1),
      supabase.from('calls').select('scheduled_at')
        .eq('beneficiary_id', beneficiary.id).in('status', ['scheduled', 'notified'])
        .gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(1),
      supabase.from('conversation_memory').select('id', { count: 'exact', head: true })
        .eq('beneficiary_id', beneficiary.id),
    ]).then(([callsCount, lastRes, nextRes, memRes]) => {
      if (!active) return
      const last = (lastRes.data as { started_at: string | null; ended_at: string | null; scheduled_at: string; mood_detected: string | null }[] | null)?.[0]
      const next = (nextRes.data as { scheduled_at: string }[] | null)?.[0]
      setStats({
        callsTotal: callsCount.count ?? 0,
        lastCall: last ? (last.started_at ?? last.ended_at ?? last.scheduled_at) : null,
        lastMood: last?.mood_detected ?? null,
        nextCall: next?.scheduled_at ?? null,
        memories: memRes.count ?? 0,
      })
    })
    return () => { active = false }
  }, [beneficiary.id])

  return (
    <header className="mb-6">
      <Link to="/admin/beneficiaires" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brun-700 mb-4">
        <ArrowLeft size={15} /> Tous les bénéficiaires
      </Link>
      <p className="text-[11px] uppercase tracking-widest text-accent-700 font-semibold mb-2.5">Administration · Bénéficiaire</p>

      <div className="flex flex-wrap items-center gap-5">
        <div className="grid place-items-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-primary to-primary-700 text-white font-title text-3xl shadow-sm shrink-0">
          {beneficiary.first_name[0]}{beneficiary.last_name[0]}
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-title text-[28px] leading-tight font-semibold text-brun-900">
              {beneficiary.first_name} {beneficiary.last_name}
            </h1>
            <span className={cn(
              'text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap',
              beneficiary.is_active ? 'bg-sauge/10 text-sauge' : 'bg-slate-100 text-slate-400',
            )}>
              {beneficiary.is_active ? '● Actif' : '○ Archivé'}
            </span>
          </div>
          <p className="text-slate-500 mt-2 text-[14px]">
            {age ? `${age} ans · ` : ''}Aidant : <strong className="text-brun-700">{caregiver?.full_name || caregiver?.email || '—'}</strong>
            {caregiver?.email && <span className="text-slate-400"> · {caregiver.email}</span>}
          </p>
        </div>
      </div>

      {/* Stats en un coup d'œil */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mt-5">
        <StatChip icon={Phone} label="Appels" value={stats ? String(stats.callsTotal) : '…'} />
        <StatChip
          icon={Check}
          label="Dernier appel"
          value={stats?.lastCall ? fmtDateTime(stats.lastCall) : '—'}
          dot={stats?.lastMood ? MOOD_DOT[stats.lastMood] : undefined}
        />
        <StatChip icon={Calendar} label="Prochain" value={stats?.nextCall ? fmtDateTime(stats.nextCall) : '—'} />
        <StatChip icon={Notebook} label="Souvenirs" value={stats ? String(stats.memories) : '…'} />
        {/* Solde aidant : placeholder — le modèle « crédit minutes » n'existe pas
            encore (abonnement = appels/semaine). À brancher quand il sera exposé. */}
        <StatChip icon={Wallet} label="Solde aidant" value="— min" dot="bg-slate-300" title="Bientôt disponible" />
      </div>
    </header>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
  dot,
  title,
}: {
  icon: React.ElementType
  label: string
  value: string
  dot?: string
  title?: string
}) {
  return (
    <div title={title} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface border border-creme-sable">
      <span className="grid place-items-center w-8 h-8 rounded-lg bg-creme text-primary shrink-0"><Icon size={15} /></span>
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 whitespace-nowrap">{label}</p>
        <p className="text-[14px] font-semibold text-brun-900 flex items-center gap-1.5 whitespace-nowrap">
          {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />}{value}
        </p>
      </div>
    </div>
  )
}
