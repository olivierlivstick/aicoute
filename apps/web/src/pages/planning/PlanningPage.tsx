import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, UserPlus, ArrowLeft } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useSessionSchedules, toggleSchedule, deleteSchedule } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { ScheduleEditor } from './ScheduleEditor'
import { WeeklyCalendar } from './WeeklyCalendar'
import { cn } from '@/lib/utils'
import type { SessionSchedule } from '@modect/shared'

type EditState = SessionSchedule | 'new' | null

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function PlanningPage() {
  const { selected } = useSelectedBeneficiary()
  const { schedules, loading, refetch } = useSessionSchedules(selected?.id)
  const [editing, setEditing] = useState<EditState>(null)

  if (!selected) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
            Aucun proche configuré
          </h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Ajoutez un proche avant de configurer un planning d'appels.
          </p>
          <Link to="/beneficiary/new">
            <Button><UserPlus size={16} /> Créer un proche</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Mode édition : on n'affiche que le form
  if (editing !== null) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Retour aux plannings
        </button>
        <ScheduleEditor
          beneficiary={selected}
          schedule={editing === 'new' ? null : editing}
          onSaved={() => { refetch(); setEditing(null) }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Planning</h1>
          <p className="text-slate-500 mt-1">
            Sessions récurrentes pour <strong>{selected.first_name}</strong>
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={18} /> Nouveau planning
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendrier visuel */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Vue hebdomadaire</h2>
          <WeeklyCalendar
            schedules={schedules}
            loading={loading}
            onEdit={setEditing}
            onToggle={async (s) => { await toggleSchedule(s.id, !s.is_active); refetch() }}
            onDelete={async (id) => {
              if (!confirm('Supprimer ce planning ?')) return
              await deleteSchedule(id); refetch()
            }}
          />
        </div>

        {/* Liste des plannings */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Plannings configurés</h2>
          {loading && <div className="text-slate-400 text-sm py-4">Chargement…</div>}

          {!loading && schedules.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-slate-400 text-sm mb-3">Aucun planning configuré</p>
              <Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
                <Plus size={15} /> Créer un planning
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'bg-white rounded-2xl border p-4 transition-all',
                  s.is_active ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex gap-1 mb-2">
                      {DAY_LABELS.map((label, i) => (
                        <span
                          key={i}
                          className={cn(
                            'w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center',
                            s.days_of_week.includes(i)
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    <p className="text-slate-800 font-semibold">
                      {s.time_of_day.slice(0, 5)} · {s.max_duration_minutes} min
                    </p>

                    {s.suggested_topics && s.suggested_topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.suggested_topics.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-xs bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 space-y-0.5">
                      {s.last_call_at && (
                        <p className="text-xs text-slate-400">
                          Dernier : {new Date(s.last_call_at).toLocaleString('fr-FR', {
                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      {s.next_scheduled_at && (
                        <p className="text-xs text-slate-400">
                          Prochain : {new Date(s.next_scheduled_at).toLocaleString('fr-FR', {
                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>

                    {s.retry_count > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        En cas de non-réponse : {s.retry_count} relance{s.retry_count > 1 ? 's' : ''} toutes les {s.retry_interval_minutes} min
                        {s.notify_on_no_answer ? ' · email aidant si échec' : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={async () => { await toggleSchedule(s.id, !s.is_active); refetch() }}
                      title={s.is_active ? 'Désactiver' : 'Activer'}
                      className={cn(
                        'w-10 h-6 rounded-full transition-colors relative',
                        s.is_active ? 'bg-primary' : 'bg-slate-200',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        s.is_active ? 'translate-x-4' : 'translate-x-0.5',
                      )} />
                    </button>

                    <button
                      onClick={() => setEditing(s)}
                      className="text-xs text-slate-400 hover:text-primary transition-colors flex items-center gap-1 justify-center"
                    >
                      <Pencil size={11} /> Éditer
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Supprimer ce planning ?')) return
                        await deleteSchedule(s.id); refetch()
                      }}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 justify-center"
                    >
                      <Trash2 size={11} /> Suppr.
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
