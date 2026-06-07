import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  IdCard, BookOpen, Heart, Sparkles, Bot, Check, Brain,
  Plus, Pencil, Trash2, Lightbulb, Star, CalendarHeart, SmilePlus, MessageCircle, Link2, RotateCcw,
  CalendarClock, AlertTriangle, Clock, Phone, Mail, X,
} from 'lucide-react'
import { useBeneficiary } from '@/hooks/useBeneficiary'
import { useMemories } from '@/hooks/useMemories'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { cn, formatDate } from '@/lib/utils'
import { ScheduleEditor } from '@/pages/planning/ScheduleEditor'
import { resolvePromptPlaceholders, resolveOpenAIVoice, resolveGeminiVoice } from '@modect/shared'
import type { Beneficiary, ConversationStyle, ConversationMemory, MemoryType, SessionSchedule } from '@modect/shared'
import { VoicePicker } from '@/components/VoicePicker'

type Tab = 'basics' | 'history' | 'tastes' | 'personality' | 'ai' | 'memory' | 'schedule'

const BASE_TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'basics',      label: 'Infos de base',       icon: IdCard },
  { id: 'history',     label: 'Son histoire',         icon: BookOpen },
  { id: 'tastes',      label: 'Goûts et intérêts',    icon: Heart },
  { id: 'personality', label: 'Personnalité',         icon: Sparkles },
  { id: 'ai',          label: 'Configuration IA',     icon: Bot },
  { id: 'memory',      label: 'Mémoire',              icon: Brain },
]

const SCHEDULE_TAB: { id: Tab; label: string; icon: React.ElementType } = {
  id: 'schedule', label: 'Planning', icon: CalendarClock,
}

/**
 * Éditeur 5-onglets du profil d'un bénéficiaire, partagé entre :
 *   - /contexte (aidant édite SON bénéficiaire — RLS caregiver_owns)
 *   - /admin/beneficiaires/:id (admin édite N'IMPORTE QUEL bénéficiaire — RLS admin)
 *
 * Auto-suffisant : prend un bénéficiaire + un callback onSaved. La persistance
 * passe par useBeneficiary(id).update qui s'appuie sur les policies RLS.
 */
export function BeneficiaryContextEditor({
  beneficiary,
  onSaved,
  withSchedule = false,
}: {
  beneficiary: Beneficiary
  onSaved: () => void
  /** Ajoute un onglet « Planning » (édition gardée par confirmation). Réservé à l'admin. */
  withSchedule?: boolean
}) {
  const [tab, setTab] = useState<Tab>('basics')
  const tabs = withSchedule ? [...BASE_TABS, SCHEDULE_TAB] : BASE_TABS

  return (
    <div>
      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
              tab === id ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon size={16} />
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'schedule' ? (
        <ScheduleSection beneficiary={beneficiary} onSaved={onSaved} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {tab === 'basics'      && <BasicsSection beneficiary={beneficiary} onSaved={onSaved} />}
          {tab === 'history'     && <HistorySection beneficiary={beneficiary} onSaved={onSaved} />}
          {tab === 'tastes'      && <TastesSection beneficiary={beneficiary} onSaved={onSaved} />}
          {tab === 'personality' && <PersonalitySection beneficiary={beneficiary} onSaved={onSaved} />}
          {tab === 'ai'          && <AIConfigSection beneficiary={beneficiary} onSaved={onSaved} />}
          {tab === 'memory'      && <MemorySection beneficiary={beneficiary} />}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Onglet Planning (admin) — lecture seule + édition gardée par confirmation
// ============================================================================

const SCHEDULE_DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function ScheduleSection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
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

  // Mode édition déverrouillé (après confirmation) : on réutilise l'éditeur aidant,
  // en lui passant le caregiver_id du bénéficiaire pour ne pas réattribuer le planning à l'admin.
  if (editing) {
    return (
      <div>
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

  // Mode lecture seule (par défaut)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-title text-lg font-semibold text-slate-800">Planning d'appels</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Les appels récurrents passés à {beneficiary.first_name}. Cœur de l'application — édition protégée.
          </p>
        </div>
        {schedule && (
          <span className={cn(
            'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
            schedule.is_active ? 'bg-sauge/10 text-sauge' : 'bg-slate-100 text-slate-400',
          )}>
            {schedule.is_active ? '● Actif' : '○ En pause'}
          </span>
        )}
      </div>

      {schedule ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <ScheduleField icon={Phone} label="Fréquence" value={`${schedule.calls_per_week} appel${schedule.calls_per_week > 1 ? 's' : ''} / semaine`} />
          <ScheduleField icon={Clock} label="Heure" value={`${schedule.time_of_day?.slice(0, 5)} (${schedule.timezone})`} />
          <ScheduleField
            icon={CalendarClock}
            label="Jours"
            value={[...(schedule.days_of_week ?? [])].sort().map((d) => SCHEDULE_DAY_LABELS[d]).join(' · ') || '—'}
          />
          <ScheduleField icon={Clock} label="Durée max" value={`${schedule.max_duration_minutes} min`} />
          <ScheduleField
            icon={Phone}
            label="Relances si pas de réponse"
            value={schedule.retry_count > 0 ? `${schedule.retry_count}× toutes les ${schedule.retry_interval_minutes} min` : 'Aucune'}
          />
          <ScheduleField
            icon={AlertTriangle}
            label="Email à l'aidant si non-réponse"
            value={schedule.notify_on_no_answer ? 'Oui' : 'Non'}
          />
        </dl>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 text-center">
          <p className="text-sm text-slate-500">Aucun planning configuré pour ce bénéficiaire.</p>
        </div>
      )}

      {/* Garde-fou : confirmation avant de déverrouiller l'édition */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        {confirming ? (
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-700 mb-1">
              <AlertTriangle size={16} /> Modifier le planning de {beneficiary.first_name} ?
            </p>
            <p className="text-xs text-brun-700 mb-4">
              Toute modification reconfigure ses <strong>appels réels</strong> (création/suppression des
              prochains appels planifiés). Ne le faites que si vous savez ce que vous changez.
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => { setConfirming(false); setEditing(true) }}>
                Oui, modifier le planning
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            <Pencil size={15} /> {schedule ? 'Modifier le planning' : 'Configurer un planning'}
          </Button>
        )}
      </div>
    </div>
  )
}

function ScheduleField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
        <Icon size={13} /> {label}
      </dt>
      <dd className="text-slate-800 font-medium">{value}</dd>
    </div>
  )
}

// ============================================================================
// Helpers communs
// ============================================================================

function useSection(beneficiary: Beneficiary) {
  const { update } = useBeneficiary(beneficiary.id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: Partial<Beneficiary>) => {
    setSaving(true)
    setError(null)
    const ok = await update(patch)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return true
    }
    setError('Impossible d\'enregistrer les modifications.')
    return false
  }

  return { save, saving, saved, error }
}

function SaveBar({ saving, saved, error }: { saving: boolean; saved: boolean; error: string | null }) {
  return (
    <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-100">
      <div className="flex-1">
        {saved && (
          <p className="text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
            <Check size={14} />
            Modifications enregistrées
          </p>
        )}
        {error && (
          <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-1.5">{error}</p>
        )}
      </div>
      <Button type="submit" loading={saving}>Enregistrer</Button>
    </div>
  )
}

// ============================================================================
// Onglet 1 — Infos de base
// ============================================================================

const basicsSchema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name:  z.string().min(1, 'Nom requis'),
  birth_year: z.coerce.number().int().min(1900).max(new Date().getFullYear() - 50).optional().or(z.literal('')),
  gender:     z.enum(['male', 'female', 'other']).optional(),
  phone:      z.string().optional(),
})

type BasicsForm = z.infer<typeof basicsSchema>

const GENDERS: Array<{ value: 'male' | 'female' | 'other'; label: string }> = [
  { value: 'female', label: 'Femme' },
  { value: 'male',   label: 'Homme' },
  { value: 'other',  label: 'Autre' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function BasicsSection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BasicsForm>({
    resolver: zodResolver(basicsSchema),
    values: {
      first_name: beneficiary.first_name,
      last_name:  beneficiary.last_name,
      birth_year: beneficiary.birth_year ?? ('' as unknown as number),
      gender:     beneficiary.gender ?? undefined,
      phone:      beneficiary.phone ?? '',
    },
  })

  const selectedGender = watch('gender')

  // Destinataires supplémentaires des emails de compte-rendu (proches).
  const [recipients, setRecipients] = useState<string[]>(beneficiary.report_recipients ?? [])
  const [draft, setDraft] = useState('')
  const [recipientError, setRecipientError] = useState<string | null>(null)

  // Re-synchronise si on change de bénéficiaire sans remonter le composant.
  useEffect(() => {
    setRecipients(beneficiary.report_recipients ?? [])
    setDraft('')
    setRecipientError(null)
  }, [beneficiary.id])

  const addRecipient = () => {
    const email = draft.trim()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setRecipientError('Adresse email invalide.'); return }
    if (recipients.some((r) => r.toLowerCase() === email.toLowerCase())) {
      setRecipientError('Cette adresse est déjà dans la liste.'); return
    }
    setRecipients([...recipients, email])
    setDraft('')
    setRecipientError(null)
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email))
  }

  const onSubmit = async (values: BasicsForm) => {
    const ok = await save({
      first_name: values.first_name,
      last_name:  values.last_name,
      birth_year: values.birth_year ? Number(values.birth_year) : null,
      gender:     values.gender ?? null,
      phone:      values.phone || null,
      report_recipients: recipients,
    })
    if (ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Informations de base</h2>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">Prénom *</Label>
            <Input id="first_name" error={errors.first_name?.message} {...register('first_name')} />
          </div>
          <div>
            <Label htmlFor="last_name">Nom *</Label>
            <Input id="last_name" error={errors.last_name?.message} {...register('last_name')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="birth_year">Année de naissance</Label>
            <Input
              id="birth_year"
              type="number"
              min={1900}
              max={new Date().getFullYear() - 50}
              error={errors.birth_year?.message}
              {...register('birth_year')}
            />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" type="tel" placeholder="+33 6 00 00 00 00" {...register('phone')} />
          </div>
        </div>

        <div>
          <Label>Genre</Label>
          <div className="flex gap-3 mt-1">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('gender', value)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  selectedGender === value
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Destinataires des emails de compte-rendu */}
        <div className="pt-2 border-t border-slate-100">
          <Label>Destinataires des comptes-rendus</Label>
          <p className="text-xs text-slate-500 mt-0.5 mb-2 leading-relaxed">
            Vous recevez déjà les comptes-rendus. Ajoutez ici les adresses des proches
            (frères, sœurs…) qui doivent aussi les recevoir après chaque appel.
          </p>

          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 bg-primary-50 text-primary border border-primary-100 rounded-full pl-3 pr-1.5 py-1 text-sm font-medium"
                >
                  <Mail size={13} />
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-primary-100 transition-colors"
                    aria-label={`Retirer ${email}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="frere@exemple.fr"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setRecipientError(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addRecipient() }
              }}
            />
            <Button type="button" variant="secondary" onClick={addRecipient} className="shrink-0">
              <Plus size={16} className="mr-1" /> Ajouter
            </Button>
          </div>
          {recipientError && <p className="text-xs text-red-600 mt-1">{recipientError}</p>}
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ============================================================================
// Onglet 2 — Son histoire
// ============================================================================

function HistorySection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm<{ family_history: string; life_story: string }>({
    values: {
      family_history: beneficiary.family_history ?? '',
      life_story:     beneficiary.life_story ?? '',
    },
  })

  const onSubmit = async (values: { family_history: string; life_story: string }) => {
    const ok = await save({
      family_history: values.family_history || null,
      life_story:     values.life_story || null,
    })
    if (ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Son histoire</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="family_history">Histoire familiale</Label>
          <p className="text-xs text-slate-400 mb-1">
            Enfants, petits-enfants, conjoint(e), personnes importantes…
          </p>
          <Textarea
            id="family_history"
            placeholder="Ex : A deux fils, Pierre (55 ans) et Marc (52 ans). Quatre petits-enfants dont Emma qui vient souvent la voir le week-end."
            rows={4}
            {...register('family_history')}
          />
        </div>

        <div>
          <Label htmlFor="life_story">Résumé de vie</Label>
          <p className="text-xs text-slate-400 mb-1">
            Métier exercé, lieux de vie, moments marquants…
          </p>
          <Textarea
            id="life_story"
            placeholder="Ex : Institutrice à Lyon pendant 30 ans, à la retraite depuis 1997. A vécu à Nice les 20 dernières années. Aime beaucoup la Provence et la cuisine du sud."
            rows={5}
            {...register('life_story')}
          />
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ============================================================================
// Onglet 3 — Goûts et intérêts
// ============================================================================

function TastesSection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm<{
    hobbies: string; favorite_topics: string; topics_to_avoid: string
  }>({
    values: {
      hobbies:         beneficiary.hobbies ?? '',
      favorite_topics: beneficiary.favorite_topics ?? '',
      topics_to_avoid: beneficiary.topics_to_avoid ?? '',
    },
  })

  const onSubmit = async (values: { hobbies: string; favorite_topics: string; topics_to_avoid: string }) => {
    const ok = await save({
      hobbies:         values.hobbies || null,
      favorite_topics: values.favorite_topics || null,
      topics_to_avoid: values.topics_to_avoid || null,
    })
    if (ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Goûts et centres d'intérêt</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="hobbies">Activités et loisirs</Label>
          <p className="text-xs text-slate-400 mb-1">Ce qu'il/elle aime faire au quotidien</p>
          <Textarea
            id="hobbies"
            placeholder="Ex : Jardinage, tricot, regarder les émissions de cuisine, mots croisés, promenades en forêt…"
            rows={3}
            {...register('hobbies')}
          />
        </div>

        <div>
          <Label htmlFor="favorite_topics">Sujets de conversation préférés</Label>
          <p className="text-xs text-slate-400 mb-1">Thèmes qui l'animent, dont il/elle aime parler</p>
          <Textarea
            id="favorite_topics"
            placeholder="Ex : Ses petits-enfants, l'actualité locale, la cuisine provençale, ses souvenirs d'enseignante…"
            rows={3}
            {...register('favorite_topics')}
          />
        </div>

        <div>
          <Label htmlFor="topics_to_avoid">Sujets à éviter absolument</Label>
          <p className="text-xs text-slate-400 mb-1">
            Sujets sensibles, douloureux ou qui causent de l'anxiété
          </p>
          <Textarea
            id="topics_to_avoid"
            placeholder="Ex : La politique, les nouvelles anxiogènes, le décès de son mari, les détails médicaux…"
            rows={3}
            {...register('topics_to_avoid')}
          />
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ============================================================================
// Onglet 4 — Personnalité
// ============================================================================

function PersonalitySection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm<{ personality_notes: string; health_notes: string }>({
    values: {
      personality_notes: beneficiary.personality_notes ?? '',
      health_notes:      beneficiary.health_notes ?? '',
    },
  })

  const onSubmit = async (values: { personality_notes: string; health_notes: string }) => {
    const ok = await save({
      personality_notes: values.personality_notes || null,
      health_notes:      values.health_notes || null,
    })
    if (ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Personnalité et bien-être</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="personality_notes">Traits de caractère</Label>
          <p className="text-xs text-slate-400 mb-1">
            Humeur générale, façon d'être, ce qui le/la fait rire ou réfléchir…
          </p>
          <Textarea
            id="personality_notes"
            placeholder="Ex : Très chaleureuse, aime rire et raconter des anecdotes. Un peu nostalgique mais généralement de bonne humeur."
            rows={4}
            {...register('personality_notes')}
          />
        </div>

        <div>
          <Label htmlFor="health_notes">Notes générales de bien-être</Label>
          <p className="text-xs text-slate-400 mb-1">
            Informations utiles (sans détails médicaux) pour adapter les échanges
          </p>
          <Textarea
            id="health_notes"
            placeholder="Ex : Entend moins bien de l'oreille gauche, préférer parler lentement. Fatigue en fin d'après-midi."
            rows={3}
            {...register('health_notes')}
          />
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <p className="text-xs text-slate-500">
            🔒 Ces informations sont strictement confidentielles et ne sont jamais partagées avec des tiers.
          </p>
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ============================================================================
// Onglet 5 — Configuration IA
// ============================================================================

const aiSchema = z.object({
  ai_persona_name:     z.string().min(1, 'Prénom requis'),
  ai_voice:            z.string(),
  gemini_voice:        z.string(),
  conversation_style:  z.enum(['warm', 'playful', 'calm', 'formal']),
  language_preference: z.string().min(2),
  report_language:     z.string().min(2),
  preferred_engine:    z.enum(['openai', 'gemini']),
  custom_prompt:       z.string().optional(),
})

type AIForm = z.infer<typeof aiSchema>

const ENGINES: { value: 'openai' | 'gemini'; label: string; description: string }[] = [
  { value: 'openai', label: 'OpenAI',        description: 'gpt-realtime-2' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini Live' },
]

const STYLES: { value: ConversationStyle; label: string; description: string; emoji: string }[] = [
  { value: 'warm',    label: 'Chaleureux',  description: 'Bienveillant et affectueux', emoji: '🤗' },
  { value: 'calm',    label: 'Calme',       description: 'Posé, serein et rassurant',  emoji: '😌' },
  { value: 'playful', label: 'Enjoué',      description: 'Léger, drôle et vivant',     emoji: '😄' },
  { value: 'formal',  label: 'Respectueux', description: 'Poli et traditionnel',       emoji: '🎩' },
]

const LANGUAGES = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]

function AIConfigSection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AIForm>({
    resolver: zodResolver(aiSchema),
    values: {
      ai_persona_name:     beneficiary.ai_persona_name ?? 'Marie',
      ai_voice:            resolveOpenAIVoice(beneficiary.ai_voice),
      gemini_voice:        resolveGeminiVoice((beneficiary as unknown as { gemini_voice?: string }).gemini_voice),
      conversation_style:  beneficiary.conversation_style ?? 'warm',
      language_preference: beneficiary.language_preference ?? 'fr',
      report_language:     (beneficiary as unknown as { report_language?: string }).report_language ?? 'fr',
      // preferred_engine vient de la DB (cast pour contourner les types Database
      // incomplets cf. CLAUDE.md "Build Netlify : utiliser vite build sans tsc")
      preferred_engine:    ((beneficiary as unknown as { preferred_engine?: string }).preferred_engine === 'gemini' ? 'gemini' : 'openai'),
      custom_prompt:       beneficiary.custom_prompt ?? '',
    },
  })

  const selectedVoice  = watch('ai_voice')
  const selectedGemini = watch('gemini_voice')
  const selectedStyle  = watch('conversation_style')
  const selectedEngine = watch('preferred_engine')

  const [resetting, setResetting] = useState(false)

  const onSubmit = async (values: AIForm) => {
    const trimmed = values.custom_prompt?.trim()
    const ok = await save({
      ai_persona_name:     values.ai_persona_name,
      ai_voice:            values.ai_voice,
      gemini_voice:        values.gemini_voice,
      conversation_style:  values.conversation_style,
      language_preference: values.language_preference,
      report_language:     values.report_language,
      preferred_engine:    values.preferred_engine,
      // vide → NULL : on retombe alors sur le prompt par défaut au moment de l'appel
      custom_prompt:       trimmed ? trimmed : null,
    } as unknown as Partial<Beneficiary>)
    if (ok) onSaved()
  }

  // Réinitialise le prompt depuis le défaut admin, résolu (concret) pour ce bénéficiaire.
  const resetFromDefault = async () => {
    setResetting(true)
    const { data: tpl } = await supabase
      .from('prompt_templates')
      .select('template')
      .eq('id', 1)
      .maybeSingle()
    const tplText = (tpl as { template: string } | null)?.template
    if (tplText) {
      const resolved = resolvePromptPlaceholders(tplText, {
        first_name:          beneficiary.first_name,
        ai_persona_name:     watch('ai_persona_name'),
        conversation_style:  watch('conversation_style'),
        language_preference: watch('language_preference'),
        gender:              beneficiary.gender ?? null,
      })
      setValue('custom_prompt', resolved, { shouldDirty: true })
    }
    setResetting(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Configuration du compagnon IA</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="ai_persona_name">Prénom du compagnon IA</Label>
          <p className="text-xs text-slate-400 mb-1">
            Quel prénom votre bénéficiaire entendra-t-il pour ce compagnon ?
          </p>
          <Input
            id="ai_persona_name"
            placeholder="Marie"
            error={errors.ai_persona_name?.message}
            {...register('ai_persona_name')}
          />
        </div>

        {/* Moteur AVANT la voix : les voix disponibles dépendent du moteur. */}
        <div>
          <Label>Moteur conversationnel</Label>
          <p className="text-xs text-slate-400 mb-1">
            Le modèle IA qui anime les appels. Vous pouvez en changer à tout moment.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {ENGINES.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('preferred_engine', value)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                  selectedEngine === value
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                <span className="font-semibold block">{label}</span>
                <span className="text-xs opacity-70">{description}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Voix du compagnon</Label>
          <p className="text-xs text-slate-400 mb-1">
            Écoutez chaque voix puis choisissez celle qui appellera {beneficiary.first_name}.
          </p>
          <VoicePicker
            engine={selectedEngine}
            value={selectedEngine === 'gemini' ? selectedGemini : selectedVoice}
            onChange={(id) =>
              setValue(selectedEngine === 'gemini' ? 'gemini_voice' : 'ai_voice', id, { shouldDirty: true })
            }
          />
        </div>

        <div>
          <Label>Style de conversation</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {STYLES.map(({ value, label, description, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('conversation_style', value)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                  selectedStyle === value
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                <span className="font-semibold block">{emoji} {label}</span>
                <span className="text-xs opacity-70">{description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="language_preference">Langue des conversations</Label>
            <p className="text-xs text-slate-400 mb-1">La langue parlée pendant l'appel.</p>
            <select
              id="language_preference"
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register('language_preference')}
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="report_language">Langue des retours</Label>
            <p className="text-xs text-slate-400 mb-1">Résumé, alertes et email envoyés à l'aidant.</p>
            <select
              id="report_language"
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register('report_language')}
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <Label htmlFor="custom_prompt">Prompt de personnalité</Label>
            <button
              type="button"
              onClick={resetFromDefault}
              disabled={resetting}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} />
              Réinitialiser depuis le défaut
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-1">
            Personnalité et règles propres à {beneficiary.first_name}. Le contexte (infos, mémoire,
            dernière conversation, sujets) est ajouté automatiquement — inutile de l'écrire ici.
            Laisser vide pour utiliser le prompt par défaut de la plateforme.
          </p>
          <Textarea
            id="custom_prompt"
            rows={14}
            className="font-mono text-sm leading-relaxed"
            {...register('custom_prompt')}
          />
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}

// ============================================================================
// Onglet 6 — Mémoire (souvenirs long-terme du compagnon IA)
// ============================================================================

const MEMORY_TYPE_META: Record<MemoryType, { label: string; icon: React.ReactNode; cls: string; barCls: string }> = {
  fact:       { label: 'Fait',       icon: <Lightbulb size={13} />,     cls: 'bg-primary-50 text-primary border-primary/20', barCls: 'bg-primary' },
  preference: { label: 'Préférence', icon: <Star size={13} />,          cls: 'bg-accent/10 text-accent border-accent/20',    barCls: 'bg-accent' },
  event:      { label: 'Événement',  icon: <CalendarHeart size={13} />, cls: 'bg-sauge/10 text-sauge border-sauge/20',       barCls: 'bg-sauge' },
  mood:       { label: 'Humeur',     icon: <SmilePlus size={13} />,     cls: 'bg-amber-50 text-amber-700 border-amber-100',  barCls: 'bg-amber-400' },
  topic:      { label: 'Sujet',      icon: <MessageCircle size={13} />, cls: 'bg-slate-100 text-slate-600 border-slate-200', barCls: 'bg-slate-300' },
}
// Dérivé du lookup → garantit l'alignement avec l'union MemoryType
const MEMORY_TYPES = Object.keys(MEMORY_TYPE_META) as MemoryType[]
const IMPORTANCE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const memSelectCls =
  'h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

interface MemoryDraft { memory_type: MemoryType; content: string; importance: number }

function MemorySection({ beneficiary }: { beneficiary: Beneficiary }) {
  const { memories, loading, error, addMemory, updateMemory, deleteMemory, refetch } = useMemories(beneficiary.id)

  const [adding, setAdding]       = useState(false)
  const [addDraft, setAddDraft]   = useState<MemoryDraft>({ memory_type: 'fact', content: '', importance: 5 })
  const [addBusy, setAddBusy]     = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MemoryDraft>({ memory_type: 'fact', content: '', importance: 5 })
  const [editBusy, setEditBusy]   = useState(false)

  function startEdit(m: ConversationMemory) {
    setEditingId(m.id)
    setEditDraft({ memory_type: m.memory_type, content: m.content, importance: m.importance })
  }

  async function saveEdit() {
    if (!editingId || !editDraft.content.trim()) return
    setEditBusy(true)
    const ok = await updateMemory(editingId, editDraft)
    setEditBusy(false)
    if (ok) {
      setEditingId(null)
      // updateMemory ne fait qu'un patch local optimiste → on refetch pour re-trier
      // la liste si l'importance a changé (le hook ordonne par importance desc).
      refetch()
    }
  }

  async function handleAdd() {
    if (!addDraft.content.trim()) return
    setAddBusy(true)
    const ok = await addMemory(addDraft)
    setAddBusy(false)
    if (ok) {
      setAddDraft({ memory_type: 'fact', content: '', importance: 5 })
      setAdding(false)
    }
  }

  async function handleDelete(m: ConversationMemory) {
    if (!window.confirm('Supprimer ce souvenir ? Cette action est irréversible.')) return
    await deleteMemory(m.id)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="font-title text-lg font-semibold text-slate-800">Mémoire du compagnon</h2>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} className="mr-1" />
            Ajouter un souvenir
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Ce dont Aicoute se souvient d'un appel à l'autre pour personnaliser ses conversations avec {beneficiary.first_name}.
        Les souvenirs sont extraits automatiquement après chaque appel ; vous pouvez les corriger, en supprimer ou en ajouter.
      </p>

      {error && (
        <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Formulaire d'ajout (repliable) */}
      {adding && (
        <div className="bg-primary-50/50 rounded-xl border border-primary/15 p-4 mb-5">
          <Textarea
            rows={2}
            autoFocus
            placeholder="Ex : a un nouveau chat nommé Felix dont elle parle souvent"
            value={addDraft.content}
            onChange={(e) => setAddDraft({ ...addDraft, content: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              className={memSelectCls}
              value={addDraft.memory_type}
              onChange={(e) => setAddDraft({ ...addDraft, memory_type: e.target.value as MemoryType })}
            >
              {MEMORY_TYPES.map((t) => <option key={t} value={t}>{MEMORY_TYPE_META[t].label}</option>)}
            </select>
            <select
              className={memSelectCls}
              value={addDraft.importance}
              onChange={(e) => setAddDraft({ ...addDraft, importance: Number(e.target.value) })}
            >
              {IMPORTANCE_OPTIONS.map((n) => <option key={n} value={n}>Importance {n}/10</option>)}
            </select>
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setAddDraft({ memory_type: 'fact', content: '', importance: 5 }) }}>
              Annuler
            </Button>
            <Button type="button" size="sm" loading={addBusy} disabled={!addDraft.content.trim()} onClick={handleAdd}>
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-sm text-slate-500">
            Aucun souvenir pour le moment. Les souvenirs apparaîtront après les premiers appels,
            et aident le compagnon à se rappeler ce qui compte pour {beneficiary.first_name}.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {memories.map((m) => {
            const meta = MEMORY_TYPE_META[m.memory_type] ?? MEMORY_TYPE_META.fact
            const isEditing = editingId === m.id
            return (
              <div key={m.id} className="flex gap-3 p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                <div className={cn('w-1 rounded-full shrink-0', meta.barCls)} />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <>
                      <Textarea
                        rows={2}
                        autoFocus
                        value={editDraft.content}
                        onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                      />
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <select
                          className={memSelectCls}
                          value={editDraft.memory_type}
                          onChange={(e) => setEditDraft({ ...editDraft, memory_type: e.target.value as MemoryType })}
                        >
                          {MEMORY_TYPES.map((t) => <option key={t} value={t}>{MEMORY_TYPE_META[t].label}</option>)}
                        </select>
                        <select
                          className={memSelectCls}
                          value={editDraft.importance}
                          onChange={(e) => setEditDraft({ ...editDraft, importance: Number(e.target.value) })}
                        >
                          {IMPORTANCE_OPTIONS.map((n) => <option key={n} value={n}>Importance {n}/10</option>)}
                        </select>
                        <div className="flex-1" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Annuler</Button>
                        <Button type="button" size="sm" loading={editBusy} disabled={!editDraft.content.trim()} onClick={saveEdit}>
                          Enregistrer
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', meta.cls)}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Star size={12} className={m.importance >= 7 ? 'text-accent fill-accent' : 'text-slate-300'} />
                          {m.importance}/10
                        </span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="p-1 text-slate-400 hover:text-primary transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          className="p-1 text-slate-400 hover:text-brique transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{m.content}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                        {m.source_call_id ? (
                          <Link to={`/historique/${m.source_call_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Link2 size={12} />
                            Issu d'un appel
                          </Link>
                        ) : (
                          <span>Ajouté manuellement</span>
                        )}
                        <span>·</span>
                        <span>{formatDate(m.created_at)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
