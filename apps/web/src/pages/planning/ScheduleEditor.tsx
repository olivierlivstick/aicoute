import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createSchedule, updateSchedule, pauseSchedule, activateSchedule } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import type { Beneficiary, SessionSchedule } from '@modect/shared'

const schema = z.object({
  time_of_day:               z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  max_duration_minutes:      z.coerce.number().int().min(5).max(60),
  timezone:                  z.string().min(1),
  calls_per_week:            z.coerce.number().int().min(1).max(7),
  retry_count:               z.coerce.number().int().min(0).max(3),
  retry_interval_minutes:    z.coerce.number().int().min(1).max(60),
  notify_on_no_answer:       z.boolean(),
  no_answer_timeout_seconds: z.coerce.number().int().min(30).max(600),
})

type FormData = z.infer<typeof schema>

interface Props {
  beneficiary: Beneficiary
  schedule:    SessionSchedule | null
  onSaved:     () => void
  /**
   * Aidant propriétaire du planning. Par défaut l'utilisateur courant (cas aidant
   * qui édite SON bénéficiaire). En admin, on passe `beneficiary.caregiver_id`
   * pour ne pas réattribuer le planning à l'admin lors d'un update/create.
   */
  caregiverId?: string
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Brussels',
  'America/Montreal', 'America/New_York',
]

const DURATIONS = [5, 10, 15, 20, 30, 45, 60]
const RETRY_INTERVALS = [2, 5, 10, 15]

export function ScheduleEditor({ beneficiary, schedule, onSaved, caregiverId }: Props) {
  const { user } = useAuth()
  const ownerId = caregiverId ?? beneficiary.caregiver_id ?? user?.id
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule?.days_of_week ?? [1, 3, 5])
  const [isActive, setIsActive] = useState<boolean>(schedule?.is_active ?? true)
  const [togglingActive, setTogglingActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Toggle Actif / En pause : persistance immédiate en DB si le planning existe
  // déjà (sinon l'état est local et sera appliqué à la création).
  const handleToggleActive = async () => {
    const next = !isActive
    setIsActive(next)
    setError(null)

    if (!schedule) return  // mode création : juste local

    setTogglingActive(true)
    const ok = next
      ? await activateSchedule(schedule.id)
      : await pauseSchedule(schedule.id)
    setTogglingActive(false)

    if (!ok) {
      setIsActive(!next)
      setError("Impossible de mettre à jour l'état du planning.")
      return
    }
    onSaved()
  }

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      time_of_day:               schedule?.time_of_day?.slice(0, 5) ?? '10:00',
      max_duration_minutes:      schedule?.max_duration_minutes ?? 15,
      timezone:                  schedule?.timezone ?? 'Europe/Paris',
      calls_per_week:            schedule?.calls_per_week ?? (schedule?.days_of_week?.length ?? 3),
      retry_count:               schedule?.retry_count ?? 1,
      retry_interval_minutes:    schedule?.retry_interval_minutes ?? 5,
      notify_on_no_answer:       schedule?.notify_on_no_answer ?? true,
      no_answer_timeout_seconds: schedule?.no_answer_timeout_seconds ?? 120,
    },
  })

  const duration             = watch('max_duration_minutes')
  const callsPerWeek         = Number(watch('calls_per_week'))
  const retryCount           = Number(watch('retry_count'))
  const retryIntervalMinutes = Number(watch('retry_interval_minutes'))
  const notifyOnNoAnswer     = watch('notify_on_no_answer')

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day)
      if (prev.length >= callsPerWeek) return prev
      return [...prev, day].sort()
    })
  }

  const setCallsPerWeek = (n: number) => {
    setValue('calls_per_week', n)
    setSelectedDays((prev) => prev.slice(0, n))
  }

  const onSubmit = async (values: FormData) => {
    if (selectedDays.length !== values.calls_per_week) {
      setError(`Sélectionnez exactement ${values.calls_per_week} jour${values.calls_per_week > 1 ? 's' : ''} (${selectedDays.length} sélectionné${selectedDays.length > 1 ? 's' : ''}).`)
      return
    }
    if (!ownerId) return

    setSaving(true)
    setError(null)
    setSaved(false)

    const payload = {
      beneficiary_id:            beneficiary.id,
      caregiver_id:              ownerId,
      days_of_week:              selectedDays,
      time_of_day:               values.time_of_day + ':00',
      timezone:                  values.timezone,
      calls_per_week:            values.calls_per_week,
      max_duration_minutes:      values.max_duration_minutes,
      retry_count:               values.retry_count,
      retry_interval_minutes:    values.retry_interval_minutes,
      notify_on_no_answer:       values.notify_on_no_answer,
      no_answer_timeout_seconds: values.no_answer_timeout_seconds,
      suggested_topics:          null,
      special_instructions:      null,
      is_active:                 isActive,
      next_scheduled_at:         null,
    }

    let ok: boolean
    if (schedule) {
      ok = await updateSchedule(schedule.id, payload)
    } else {
      ok = !!(await createSchedule(payload))
    }

    setSaving(false)
    if (!ok) { setError('Une erreur est survenue.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
      {/* Header avec toggle Actif / En pause */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <h2 className="font-title text-xl font-semibold text-slate-800">
            Planning d'appels
          </h2>
          <p className="text-sm text-slate-500">
            {isActive
              ? 'Actif — les prochains appels sont planifiés automatiquement.'
              : 'En pause — aucun appel ne sera passé tant que vous ne réactivez pas le planning.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={cn(
            'text-sm font-semibold transition-colors',
            isActive ? 'text-primary' : 'text-slate-400'
          )}>
            {isActive ? 'Actif' : 'En pause'}
          </span>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={togglingActive}
            title={isActive ? 'Mettre en pause' : 'Activer le planning'}
            className={cn(
              'w-12 h-7 rounded-full transition-colors relative',
              isActive ? 'bg-primary' : 'bg-slate-300',
              togglingActive && 'opacity-50 cursor-wait'
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
              isActive ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Étape 1 : nombre d'appels par semaine */}
        <div>
          <Label>Nombre d'appels par semaine *</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCallsPerWeek(n)}
                className={cn(
                  'w-10 h-10 rounded-xl text-sm font-semibold transition-all',
                  callsPerWeek === n
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Choisissez ensuite les {callsPerWeek} jour{callsPerWeek > 1 ? 's' : ''} de la semaine ci-dessous.
          </p>
        </div>

        {/* Étape 2 : jours */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Jours de la semaine *</Label>
            <span className={cn(
              'text-xs font-medium',
              selectedDays.length === callsPerWeek ? 'text-green-600' : 'text-slate-400'
            )}>
              {selectedDays.length} / {callsPerWeek}
            </span>
          </div>
          <div className="flex gap-2 mt-1">
            {DAY_LABELS.map((label, i) => {
              const isSelected = selectedDays.includes(i)
              const quotaReached = selectedDays.length >= callsPerWeek
              const disabled = !isSelected && quotaReached
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  disabled={disabled}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                    isSelected
                      ? 'bg-primary text-white shadow-sm'
                      : disabled
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Heure */}
        <div>
          <Label htmlFor="time_of_day">Heure de l'appel *</Label>
          <Input id="time_of_day" type="time" error={errors.time_of_day?.message} {...register('time_of_day')} />
        </div>

        {/* Durée */}
        <div>
          <Label>Durée maximale</Label>
          <div className="flex gap-2 flex-wrap mt-1">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValue('max_duration_minutes', d)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                  Number(duration) === d
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Fuseau horaire */}
        <div>
          <Label htmlFor="timezone">Fuseau horaire</Label>
          <select
            id="timezone"
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            {...register('timezone')}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* En cas de non-réponse */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
          <div>
            <Label>Si {beneficiary.first_name} ne répond pas</Label>
            <p className="text-xs text-slate-400 mt-1">
              Nous attendons {Math.round(Number(watch('no_answer_timeout_seconds')) / 60)} min après la notification puis enclenchons la politique de relance.
            </p>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Nombre de relances</Label>
            <div className="flex gap-2 mt-1">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue('retry_count', n)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                    retryCount === n
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                  )}
                >
                  {n === 0 ? 'Aucune' : `${n} fois`}
                </button>
              ))}
            </div>
          </div>

          {retryCount > 0 && (
            <div>
              <Label className="text-xs text-slate-500">Intervalle entre les tentatives</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {RETRY_INTERVALS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValue('retry_interval_minutes', m)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                      retryIntervalMinutes === m
                        ? 'bg-primary text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    )}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              {...register('notify_on_no_answer')}
            />
            <span className="text-sm text-slate-600 leading-snug">
              M'envoyer un email si <strong>{beneficiary.first_name}</strong> ne répond {retryCount > 0 ? 'à aucune tentative' : 'pas'}.
            </span>
          </label>
          {!notifyOnNoAnswer && (
            <p className="text-xs text-slate-400 -mt-2">
              Aucun email ne sera envoyé en cas de non-réponse.
            </p>
          )}
        </div>

        {/* Footer save */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex-1">
            {saved && (
              <p className="text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <Check size={14} />
                Planning enregistré
              </p>
            )}
          </div>
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  )
}
