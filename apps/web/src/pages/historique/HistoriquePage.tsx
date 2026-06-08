import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, AlertTriangle, Clock, CheckCircle, XCircle, Phone, CalendarClock,
} from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useCalls } from '@/hooks/useCalls'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { formatDate, formatDuration, MOOD_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { CallWithBeneficiary } from '@/hooks/useCalls'
import type { CallStatus, SessionSchedule } from '@modect/shared'

type Tab = 'past' | 'upcoming'

const STATUS_CONFIG: Record<CallStatus, { label: string; icon: React.ElementType; color: string }> = {
  completed:   { label: 'Terminé',  icon: CheckCircle, color: 'text-green-600' },
  missed:      { label: 'Manqué',   icon: XCircle,     color: 'text-red-500' },
  failed:      { label: 'Échoué',   icon: XCircle,     color: 'text-red-500' },
  in_progress: { label: 'En cours', icon: Phone,       color: 'text-blue-500' },
  notified:    { label: 'Notifié',  icon: Phone,       color: 'text-blue-400' },
  scheduled:   { label: 'Planifié', icon: Clock,       color: 'text-slate-400' },
}

const PAST_STATUSES: CallStatus[] = ['completed', 'missed', 'failed', 'in_progress']

export function HistoriquePage() {
  const { selected } = useSelectedBeneficiary()
  const { calls, loading: loadingCalls, unreadCount } = useCalls(selected?.id)
  const { schedules, loading: loadingSchedules } = useSessionSchedules(selected?.id)

  const [tab, setTab] = useState<Tab>('past')

  if (!selected) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">Sélectionnez un bénéficiaire pour voir son historique.</p>
        </div>
      </div>
    )
  }

  const pastCalls = calls.filter((c) => PAST_STATUSES.includes(c.status))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Historique</h1>
          <p className="text-slate-500 mt-1">
            Appels avec <strong>{selected.first_name}</strong>
          </p>
        </div>
        {unreadCount > 0 && tab === 'past' && (
          <div className="bg-accent text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <FileText size={14} />
            {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setTab('past')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
            tab === 'past' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <FileText size={16} />
          Appels passés
          {pastCalls.length > 0 && (
            <span className="text-xs text-slate-400 font-normal">({pastCalls.length})</span>
          )}
          {tab === 'past' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => setTab('upcoming')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
            tab === 'upcoming' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <CalendarClock size={16} />
          Appels prévus
          {tab === 'upcoming' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {tab === 'past' && (
        <PastCallsTab calls={pastCalls} loading={loadingCalls} />
      )}

      {tab === 'upcoming' && (
        <UpcomingCallsTab schedules={schedules} loading={loadingSchedules} />
      )}
    </div>
  )
}

// ============================================================================
// Onglet 1 — Appels passés
// ============================================================================

function PastCallsTab({ calls, loading }: { calls: CallWithBeneficiary[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
        <FileText size={40} className="mx-auto text-slate-200 mb-3" />
        <p className="text-slate-400">Aucun appel passé pour l'instant.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => <PastCallRow key={call.id} call={call} />)}
    </div>
  )
}

function PastCallRow({ call }: { call: CallWithBeneficiary }) {
  const mood       = call.mood_detected ? MOOD_LABELS[call.mood_detected] : null
  const statusConf = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.scheduled
  const StatusIcon = statusConf.icon
  const isUnread   = call.report_available && !call.report_read_at
  const hasAlert   = call.alerts && call.alerts.length > 0

  return (
    <Link to={`/historique/${call.id}`}>
      <div className={cn(
        'bg-white rounded-2xl border p-5 hover:shadow-md transition-all cursor-pointer flex gap-4 items-start',
        isUnread ? 'border-accent/40 ring-1 ring-accent/20' : 'border-slate-100 shadow-sm',
        hasAlert && 'border-orange-200'
      )}>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
          mood ? 'bg-slate-50' : 'bg-slate-100'
        )}>
          {mood ? mood.emoji : <FileText size={20} className="text-slate-300" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">
              {call.beneficiary_first_name} {call.beneficiary_last_name}
            </span>
            {isUnread && (
              <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                Nouveau
              </span>
            )}
            {hasAlert && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> {call.alerts.length} signal{call.alerts.length > 1 ? 'aux' : ''}
              </span>
            )}
            {(call as unknown as { origin?: string }).origin === 'inbound' && (
              <span className="text-xs text-accent-700 bg-accent-50 px-2 py-0.5 rounded-full" title={`${call.beneficiary_first_name} a appelé AICOUTE`}>
                📞 Entrant
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span>{formatDate(call.scheduled_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {call.duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(call.duration_seconds)}
              </span>
            )}
          </div>

          {call.summary && (
            <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
              {call.summary}
            </p>
          )}

          {call.key_topics && call.key_topics.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {call.key_topics.slice(0, 4).map((t, i) => (
                <span key={i} className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusIcon size={16} className={statusConf.color} />
          <span className={cn('text-xs font-medium', statusConf.color)}>
            {statusConf.label}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ============================================================================
// Onglet 2 — Appels prévus (projection +14 jours)
// ============================================================================

interface UpcomingSlot {
  at:        Date
  scheduleId: string
  duration:  number
}

function UpcomingCallsTab({ schedules, loading }: { schedules: SessionSchedule[]; loading: boolean }) {
  // 1 seul planning par bénéficiaire (cf. contrainte SQL). On garde le 1er pour
  // éviter les doublons si la migration n'est pas encore appliquée.
  const primary = useMemo(() => (schedules.length > 0 ? [schedules[0]] : []), [schedules])
  const slots = useMemo(() => projectUpcomingSlots(primary, 15), [primary])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasAnySchedule = primary.length > 0
  const activeCount = primary.filter((s) => s.is_active).length

  if (!hasAnySchedule) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
        <CalendarClock size={40} className="mx-auto text-slate-200 mb-3" />
        <p className="text-slate-400 mb-2">Aucun planning enregistré pour ce bénéficiaire.</p>
        <Link to="/planning" className="text-primary text-sm font-medium hover:underline">
          Créer le planning →
        </Link>
      </div>
    )
  }

  if (activeCount === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
        <CalendarClock size={40} className="mx-auto text-slate-200 mb-3" />
        <p className="text-slate-400 mb-2">Le planning est en pause.</p>
        <Link to="/planning" className="text-primary text-sm font-medium hover:underline">
          Réactiver le planning →
        </Link>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
        <CalendarClock size={40} className="mx-auto text-slate-200 mb-3" />
        <p className="text-slate-400">Aucun appel prévu dans les 15 prochains jours.</p>
      </div>
    )
  }

  // Grouper par semaine (lundi → dimanche)
  const weeks = groupByWeek(slots)

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">
        Projection sur les 15 prochains jours, basée sur votre planning actif.
      </p>
      {weeks.map(({ weekStart, items }) => (
        <div key={weekStart.toISOString()}>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">
            Semaine du lundi {weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </h3>
          <div className="flex gap-3 flex-wrap">
            {items.map((slot) => (
              <UpcomingCard key={`${slot.scheduleId}-${slot.at.toISOString()}`} slot={slot} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const SHORT_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function UpcomingCard({ slot }: { slot: UpcomingSlot }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 min-w-[180px]">
      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
        <CalendarClock size={18} />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {SHORT_DAYS[slot.at.getDay()]} {slot.at.getDate()}
        </p>
        <p className="font-semibold text-slate-800 leading-tight">
          {slot.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-[11px] text-slate-400">{slot.duration} min</p>
      </div>
    </div>
  )
}

function projectUpcomingSlots(schedules: SessionSchedule[], days: number): UpcomingSlot[] {
  const now = new Date()
  const slots: UpcomingSlot[] = []

  for (const s of schedules) {
    if (!s.is_active) continue
    const [hStr, mStr] = s.time_of_day.split(':')
    const hour = parseInt(hStr, 10)
    const minute = parseInt(mStr, 10)

    for (let d = 0; d <= days; d++) {
      const day = new Date(now)
      day.setDate(now.getDate() + d)
      day.setHours(hour, minute, 0, 0)

      if (!s.days_of_week.includes(day.getDay())) continue
      if (day <= now) continue

      slots.push({
        at:         day,
        scheduleId: s.id,
        duration:   s.max_duration_minutes,
      })
    }
  }

  return slots.sort((a, b) => a.at.getTime() - b.at.getTime())
}

// Retourne le lundi 00:00 de la semaine contenant `date` (semaine ISO commence le lundi)
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function groupByWeek(slots: UpcomingSlot[]): Array<{ weekStart: Date; items: UpcomingSlot[] }> {
  const map = new Map<string, { weekStart: Date; items: UpcomingSlot[] }>()
  for (const slot of slots) {
    const monday = getMondayOfWeek(slot.at)
    const key = monday.toISOString().slice(0, 10)
    if (!map.has(key)) map.set(key, { weekStart: monday, items: [] })
    map.get(key)!.items.push(slot)
  }
  return Array.from(map.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
}
