import { Pencil, Trash2 } from 'lucide-react'
import type { SessionSchedule } from '@modect/shared'
import { cn } from '@/lib/utils'

interface Props {
  schedules: SessionSchedule[]
  loading: boolean
  onEdit: (s: SessionSchedule) => void
  onToggle: (s: SessionSchedule) => void
  onDelete: (id: string) => void
}

const DAY_LABELS_FULL = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// Créneaux horaires affichés (6h → 22h)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

export function WeeklyCalendar({ schedules, loading, onEdit, onToggle, onDelete }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center text-slate-400 text-sm">
        Chargement…
      </div>
    )
  }

  // Construire une map day → events triés par heure
  const eventsByDay: Record<number, SessionSchedule[]> = {}
  for (let d = 0; d < 7; d++) eventsByDay[d] = []
  for (const s of schedules) {
    for (const day of s.days_of_week) {
      eventsByDay[day] = [...(eventsByDay[day] ?? []), s]
    }
  }
  for (const day of Object.keys(eventsByDay)) {
    eventsByDay[Number(day)].sort((a, b) => a.time_of_day.localeCompare(b.time_of_day))
  }

  const hasAnyEvent = schedules.length > 0

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* En-tête jours */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_LABELS_FULL.map((label, i) => {
          const hasEvents = eventsByDay[i]?.length > 0
          return (
            <div
              key={i}
              className={cn(
                'py-2 text-center text-xs font-semibold',
                hasEvents ? 'text-primary bg-primary-50' : 'text-slate-400'
              )}
            >
              {label}
            </div>
          )
        })}
      </div>

      {!hasAnyEvent ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Aucun planning. Cliquez sur "Nouveau planning" pour commencer.
        </div>
      ) : (
        /* Grille */
        <div className="grid grid-cols-7 min-h-[300px] divide-x divide-slate-50">
          {DAY_LABELS_FULL.map((_, dayIdx) => (
            <div key={dayIdx} className="relative py-2 px-1 min-h-[300px]">
              {eventsByDay[dayIdx]?.map((s) => {
                const [h, m] = s.time_of_day.split(':').map(Number)
                const top = ((h - 6) / 16) * 100
                const height = Math.max((s.max_duration_minutes / (16 * 60)) * 100, 8)

                return (
                  <div
                    key={s.id}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    className={cn(
                      'absolute left-1 right-1 rounded-lg px-1 py-0.5 group transition-all cursor-pointer',
                      s.is_active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-200 text-slate-500'
                    )}
                    onClick={() => onEdit(s)}
                    title={`${s.time_of_day.slice(0, 5)} · ${s.max_duration_minutes} min`}
                  >
                    <p className="text-xs font-bold leading-none truncate">
                      {s.time_of_day.slice(0, 5)}
                    </p>
                    <p className="text-xs opacity-80 leading-none truncate">
                      {s.max_duration_minutes}m
                    </p>

                    {/* Actions au survol */}
                    <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggle(s) }}
                        className="w-4 h-4 rounded bg-white/20 hover:bg-white/40 flex items-center justify-center"
                        title={s.is_active ? 'Désactiver' : 'Activer'}
                      >
                        <span className="text-white text-xs">{s.is_active ? '⏸' : '▶'}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                        className="w-4 h-4 rounded bg-white/20 hover:bg-red-400 flex items-center justify-center"
                      >
                        <Trash2 size={8} className="text-white" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Légende */}
      <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary inline-block" /> Actif
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Inactif
        </span>
        <span className="ml-auto">Cliquer sur un créneau pour modifier</span>
      </div>
    </div>
  )
}
