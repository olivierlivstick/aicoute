import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createSchedule, updateSchedule } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
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
  special_instructions:      z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  beneficiary: Beneficiary
  schedule: SessionSchedule | null
  onClose: () => void
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Brussels',
  'America/Montreal', 'America/New_York',
]

const DURATIONS = [5, 10, 15, 20, 30, 45, 60]
const RETRY_INTERVALS = [2, 5, 10, 15]

const TOPIC_SUGGESTIONS = [
  'Météo du jour', 'Nouvelles de la famille', 'Jardinage', 'Cuisine',
  'Souvenirs d\'enfance', 'Musique', 'Lecture', 'Actualité locale',
  'Petits-enfants', 'Santé et bien-être',
]

export function ScheduleForm({ beneficiary, schedule, onClose }: Props) {
  const { user } = useAuth()
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule?.days_of_week ?? [1, 3, 5])
  const [topics, setTopics] = useState<string[]>(schedule?.suggested_topics ?? [])
  const [topicInput, setTopicInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      special_instructions:      schedule?.special_instructions ?? '',
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
      if (prev.length >= callsPerWeek) return prev // quota atteint
      return [...prev, day].sort()
    })
  }

  const setCallsPerWeek = (n: number) => {
    setValue('calls_per_week', n)
    setSelectedDays((prev) => prev.slice(0, n)) // tronquer si on baisse
  }

  const addTopic = (topic: string) => {
    const t = topic.trim()
    if (t && !topics.includes(t)) setTopics((prev) => [...prev, t])
    setTopicInput('')
  }

  const removeTopic = (topic: string) => setTopics((prev) => prev.filter((t) => t !== topic))

  const onSubmit = async (values: FormData) => {
    if (selectedDays.length !== values.calls_per_week) {
      setError(`Sélectionnez exactement ${values.calls_per_week} jour${values.calls_per_week > 1 ? 's' : ''} (${selectedDays.length} sélectionné${selectedDays.length > 1 ? 's' : ''}).`)
      return
    }
    if (!user) return

    setSaving(true)
    setError(null)

    const payload = {
      beneficiary_id:            beneficiary.id,
      caregiver_id:              user.id,
      days_of_week:              selectedDays,
      time_of_day:               values.time_of_day + ':00',
      timezone:                  values.timezone,
      calls_per_week:            values.calls_per_week,
      max_duration_minutes:      values.max_duration_minutes,
      retry_count:               values.retry_count,
      retry_interval_minutes:    values.retry_interval_minutes,
      notify_on_no_answer:       values.notify_on_no_answer,
      no_answer_timeout_seconds: values.no_answer_timeout_seconds,
      suggested_topics:          topics.length > 0 ? topics : null,
      special_instructions:      values.special_instructions || null,
      is_active:                 schedule?.is_active ?? true,
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
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="font-title text-xl font-semibold text-slate-800">
              {schedule ? 'Modifier le planning' : 'Nouveau planning'}
            </h2>
            <p className="text-sm text-slate-500">
              {beneficiary.first_name} {beneficiary.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
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
            <Input
              id="time_of_day"
              type="time"
              error={errors.time_of_day?.message}
              {...register('time_of_day')}
            />
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

          {/* Section : en cas de non-réponse */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
            <div>
              <Label>Si {beneficiary.first_name} ne répond pas</Label>
              <p className="text-xs text-slate-400 mt-1">
                Nous attendons {Math.round(Number(watch('no_answer_timeout_seconds')) / 60)} min après la notification puis enclenchons la politique de relance.
              </p>
            </div>

            {/* Nombre de relances */}
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

            {/* Intervalle entre relances */}
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

            {/* Email si pas de réponse */}
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
            {/* Hint sur l'envoi d'email — purement visuel, registre l'état actuel */}
            {!notifyOnNoAnswer && (
              <p className="text-xs text-slate-400 -mt-2">
                Aucun email ne sera envoyé en cas de non-réponse.
              </p>
            )}
          </div>

          {/* Sujets suggérés */}
          <div>
            <Label>Sujets suggérés pour cet appel</Label>
            <p className="text-xs text-slate-400 mb-2">
              L'IA pourra aborder ces thèmes en priorité
            </p>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 bg-accent-50 text-accent-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {t}
                    <button type="button" onClick={() => removeTopic(t)} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Ajouter un sujet…"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTopic(topicInput) }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addTopic(topicInput)}
                disabled={!topicInput.trim()}
              >
                <Plus size={16} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {TOPIC_SUGGESTIONS.filter((s) => !topics.includes(s)).slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTopic(s)}
                  className="text-xs border border-dashed border-slate-300 text-slate-500 px-2.5 py-1 rounded-full hover:border-primary hover:text-primary transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions spéciales */}
          <div>
            <Label htmlFor="special_instructions">Instructions spéciales (optionnel)</Label>
            <Textarea
              id="special_instructions"
              placeholder="Ex : C'est l'anniversaire de son petit-fils cette semaine, évoquer ce sujet chaleureusement."
              rows={3}
              {...register('special_instructions')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" loading={saving}>
              {schedule ? 'Enregistrer' : 'Créer le planning'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
