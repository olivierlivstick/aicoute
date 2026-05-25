import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBeneficiaries } from '@/hooks/useBeneficiary'
import { useSessionSchedules, toggleSchedule, deleteSchedule } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { WeeklyCalendar } from './WeeklyCalendar'
import { ScheduleForm } from './ScheduleForm'
import type { Beneficiary, SessionSchedule } from '@modect/shared'

export function SessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { beneficiaries, loading: loadingBens } = useBeneficiaries()

  // Bénéficiaire sélectionné (via URL ou premier de la liste)
  const selectedBenId = searchParams.get('beneficiary') ?? beneficiaries[0]?.id
  const selectedBen = beneficiaries.find((b) => b.id === selectedBenId)

  const { schedules, loading: loadingSchedules, refetch } = useSessionSchedules(selectedBenId)

  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<SessionSchedule | null>(null)

  const handleToggle = async (schedule: SessionSchedule) => {
    await toggleSchedule(schedule.id, !schedule.is_active)
    refetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce planning ?')) return
    await deleteSchedule(id)
    refetch()
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingSchedule(null)
    refetch()
  }

  const handleEdit = (schedule: SessionSchedule) => {
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  if (loadingBens) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (beneficiaries.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-4">📅</div>
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
          Aucun proche configuré
        </h2>
        <p className="text-slate-500 mb-6">
          Commencez par ajouter un proche avant de planifier des sessions.
        </p>
        <Link to="/beneficiary/new">
          <Button><Plus size={18} /> Ajouter un proche</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Planification</h1>
          <p className="text-slate-500 mt-1">Configurez les sessions d'appel récurrentes</p>
        </div>
        {selectedBen && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} /> Nouveau planning
          </Button>
        )}
      </div>

      {/* Sélecteur de bénéficiaire */}
      {beneficiaries.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {beneficiaries.map((b) => (
            <button
              key={b.id}
              onClick={() => setSearchParams({ beneficiary: b.id })}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all',
                b.id === selectedBenId
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              ].join(' ')}
            >
              <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary font-bold text-xs">
                {b.first_name[0]}
              </span>
              {b.first_name} {b.last_name}
            </button>
          ))}
        </div>
      )}

      {selectedBen && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Colonne gauche : calendrier visuel */}
          <div>
            <h2 className="font-semibold text-slate-700 mb-3">Vue hebdomadaire</h2>
            <WeeklyCalendar
              schedules={schedules}
              loading={loadingSchedules}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          </div>

          {/* Colonne droite : liste des plannings */}
          <div>
            <h2 className="font-semibold text-slate-700 mb-3">Plannings configurés</h2>
            <ScheduleList
              schedules={schedules}
              loading={loadingSchedules}
              beneficiary={selectedBen}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onAdd={() => setShowForm(true)}
            />
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && selectedBen && (
        <ScheduleForm
          beneficiary={selectedBen}
          schedule={editingSchedule}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}

// --- Liste des plannings ---

interface ScheduleListProps {
  schedules: SessionSchedule[]
  loading: boolean
  beneficiary: Beneficiary
  onEdit: (s: SessionSchedule) => void
  onToggle: (s: SessionSchedule) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

function ScheduleList({ schedules, loading, onEdit, onToggle, onDelete, onAdd }: ScheduleListProps) {
  const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  if (loading) {
    return <div className="text-slate-400 text-sm py-4">Chargement…</div>
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm mb-3">Aucun planning configuré</p>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus size={15} /> Créer un planning
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <div
          key={s.id}
          className={[
            'bg-white rounded-2xl border p-4 transition-all',
            s.is_active ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Jours */}
              <div className="flex gap-1 mb-2">
                {DAY_LABELS.map((label, i) => (
                  <span
                    key={i}
                    className={[
                      'w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center',
                      s.days_of_week.includes(i)
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-400',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Heure + durée */}
              <p className="text-slate-800 font-semibold">
                {s.time_of_day.slice(0, 5)} · {s.max_duration_minutes} min
              </p>

              {/* Sujets suggérés */}
              {s.suggested_topics && s.suggested_topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.suggested_topics.slice(0, 3).map((t, i) => (
                    <span key={i} className="text-xs bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Prochain appel */}
              {s.next_scheduled_at && (
                <p className="text-xs text-slate-400 mt-2">
                  Prochain : {new Date(s.next_scheduled_at).toLocaleString('fr-FR', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1">
              {/* Toggle on/off */}
              <button
                onClick={() => onToggle(s)}
                title={s.is_active ? 'Désactiver' : 'Activer'}
                className={[
                  'w-10 h-6 rounded-full transition-colors relative',
                  s.is_active ? 'bg-primary' : 'bg-slate-200',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  s.is_active ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')} />
              </button>

              <button
                onClick={() => onEdit(s)}
                className="text-xs text-slate-400 hover:text-primary transition-colors text-center"
              >
                Éditer
              </button>
              <button
                onClick={() => onDelete(s.id)}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors text-center"
              >
                Suppr.
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
