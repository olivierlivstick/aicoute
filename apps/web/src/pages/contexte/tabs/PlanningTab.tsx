import { useState } from 'react'
import { CalendarClock, Calendar, Clock, Phone, AlertTriangle, Pencil } from 'lucide-react'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { ScheduleEditor } from '@/pages/planning/ScheduleEditor'
import type { Beneficiary, SessionSchedule } from '@modect/shared'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * Onglet Planning (admin) — lecture seule par défaut ; l'édition est déverrouillée
 * APRÈS une confirmation explicite, car toute modification reconfigure les appels
 * réels. Garde-fou conservé tel quel.
 */
export function PlanningTab({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { schedules, loading, refetch } = useSessionSchedules(beneficiary.id)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)

  const schedule: SessionSchedule | null = schedules[0] ?? null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="max-w-3xl">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brun-700 mb-3"
        >
          ← Quitter l'édition
        </button>
        <ScheduleEditor
          beneficiary={beneficiary}
          schedule={schedule}
          caregiverId={beneficiary.caregiver_id}
          onSaved={() => { refetch(); onSaved() }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <section className="bg-surface rounded-2xl border border-creme-sable shadow-[0_1px_2px_rgba(61,40,23,0.04)]">
        <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-creme text-primary">
            <CalendarClock size={15} />
          </span>
          <h3 className="font-title text-[15px] font-semibold text-slate-800 flex-1">Planning d'appels</h3>
          {schedule && (
            <span className={cn(
              'text-[11.5px] font-semibold px-2.5 py-1 rounded-full',
              schedule.is_active ? 'bg-sauge/10 text-sauge' : 'bg-slate-100 text-slate-400',
            )}>
              {schedule.is_active ? '● Actif' : '○ En pause'}
            </span>
          )}
        </header>

        <div className="px-5 pb-5">
          <p className="text-[13px] text-slate-500 mb-4">
            Les appels récurrents passés à {beneficiary.first_name}. Cœur du service — édition protégée.
          </p>

          {schedule ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SchedField icon={Phone} label="Fréquence" value={`${schedule.calls_per_week} appel${schedule.calls_per_week > 1 ? 's' : ''} / semaine`} />
              <SchedField icon={Clock} label="Heure" value={`${schedule.time_of_day?.slice(0, 5)} (${schedule.timezone})`} />
              <SchedField icon={Calendar} label="Jours" value={[...(schedule.days_of_week ?? [])].sort().map((d) => DAY_LABELS[d]).join(' · ') || '—'} />
              <SchedField icon={Clock} label="Durée max" value={`${schedule.max_duration_minutes} min`} />
              <SchedField icon={Phone} label="Relances si sans réponse" value={schedule.retry_count > 0 ? `${schedule.retry_count}× toutes les ${schedule.retry_interval_minutes} min` : 'Aucune'} />
              <SchedField icon={AlertTriangle} label="Email à l'aidant si non-réponse" value={schedule.notify_on_no_answer ? 'Oui' : 'Non'} />
            </dl>
          ) : (
            <div className="bg-creme/60 rounded-xl border border-creme-sable p-6 text-center">
              <p className="text-sm text-slate-500">Aucun planning configuré pour ce bénéficiaire.</p>
            </div>
          )}

          {/* Garde-fou : confirmation avant de déverrouiller l'édition */}
          <div className="mt-6 pt-5 border-t border-creme-sable">
            {confirming ? (
              <div className="rounded-xl border border-accent/30 bg-accent-50 p-4">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-accent-700 mb-1">
                  <AlertTriangle size={16} /> Modifier le planning de {beneficiary.first_name} ?
                </p>
                <p className="text-[12.5px] text-brun-700 mb-4 leading-relaxed">
                  Toute modification reconfigure ses <strong>appels réels</strong> (création/suppression des
                  prochains appels planifiés). Ne le faites que si vous savez ce que vous changez.
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => { setConfirming(false); setEditing(true) }}>
                    Oui, modifier le planning
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                <Pencil size={14} /> {schedule ? 'Modifier le planning' : 'Configurer un planning'}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function SchedField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
        <Icon size={12} /> {label}
      </dt>
      <dd className="text-[14.5px] text-slate-800 font-medium">{value}</dd>
    </div>
  )
}
