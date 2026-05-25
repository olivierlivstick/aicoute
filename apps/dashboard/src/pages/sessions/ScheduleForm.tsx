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
  time_of_day:          z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  max_duration_minutes: z.coerce.number().int().min(5).max(60),
  timezone:             z.string().min(1),
  special_instructions: z.string().optional(),
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
      time_of_day:          schedule?.time_of_day?.slice(0, 5) ?? '10:00',
      max_duration_minutes: schedule?.max_duration_minutes ?? 15,
      timezone:             schedule?.timezone ?? 'Europe/Paris',
      special_instructions: schedule?.special_instructions ?? '',
    },
  })

  const duration = watch('max_duration_minutes')

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const addTopic = (topic: string) => {
    const t = topic.trim()
    if (t && !topics.includes(t)) setTopics((prev) => [...prev, t])
    setTopicInput('')
  }

  const removeTopic = (topic: string) => setTopics((prev) => prev.filter((t) => t !== topic))

  const onSubmit = async (values: FormData) => {
    if (selectedDays.length === 0) {
      setError('Sélectionnez au moins un jour.')
      return
    }
    if (!user) return

    setSaving(true)
    setError(null)

    const payload = {
      beneficiary_id:       beneficiary.id,
      caregiver_id:         user.id,
      days_of_week:         selectedDays,
      time_of_day:          values.time_of_day + ':00',
      timezone:             values.timezone,
      max_duration_minutes: values.max_duration_minutes,
      suggested_topics:     topics.length > 0 ? topics : null,
      special_instructions: values.special_instructions || null,
      is_active:            schedule?.is_active ?? true,
      next_scheduled_at:    null,
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

          {/* Jours */}
          <div>
            <Label>Jours de la semaine *</Label>
            <div className="flex gap-2 mt-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                    selectedDays.includes(i)
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {label}
                </button>
              ))}
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

          {/* Sujets suggérés */}
          <div>
            <Label>Sujets suggérés pour cet appel</Label>
            <p className="text-xs text-slate-400 mb-2">
              L'IA pourra aborder ces thèmes en priorité
            </p>

            {/* Tags ajoutés */}
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

            {/* Input libre */}
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

            {/* Suggestions rapides */}
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
