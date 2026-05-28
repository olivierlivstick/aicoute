import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IdCard, BookOpen, Heart, Sparkles, Bot, Check, UserPlus } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useBeneficiary } from '@/hooks/useBeneficiary'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type { Beneficiary, AIVoice, ConversationStyle } from '@modect/shared'

type Tab = 'basics' | 'history' | 'tastes' | 'personality' | 'ai'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'basics',      label: 'Infos de base',       icon: IdCard },
  { id: 'history',     label: 'Son histoire',         icon: BookOpen },
  { id: 'tastes',      label: 'Goûts et intérêts',    icon: Heart },
  { id: 'personality', label: 'Personnalité',         icon: Sparkles },
  { id: 'ai',          label: 'Configuration IA',     icon: Bot },
]

export function ContextePage() {
  const { selected, refetch } = useSelectedBeneficiary()
  const [tab, setTab] = useState<Tab>('basics')

  if (!selected) {
    return <EmptyState />
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800">Contexte</h1>
        <p className="text-slate-500 mt-1">
          Profil et préférences de <strong>{selected.first_name} {selected.last_name}</strong>
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {tab === 'basics'      && <BasicsSection beneficiary={selected} onSaved={refetch} />}
        {tab === 'history'     && <HistorySection beneficiary={selected} onSaved={refetch} />}
        {tab === 'tastes'      && <TastesSection beneficiary={selected} onSaved={refetch} />}
        {tab === 'personality' && <PersonalitySection beneficiary={selected} onSaved={refetch} />}
        {tab === 'ai'          && <AIConfigSection beneficiary={selected} onSaved={refetch} />}
      </div>
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

function EmptyState() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
          Aucun proche configuré
        </h2>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Commencez par créer un profil pour votre proche : ces informations alimentent la conversation et la planification.
        </p>
        <Link to="/beneficiary/new">
          <Button>
            <UserPlus size={16} /> Créer un proche
          </Button>
        </Link>
      </div>
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

  const onSubmit = async (values: BasicsForm) => {
    const ok = await save({
      first_name: values.first_name,
      last_name:  values.last_name,
      birth_year: values.birth_year ? Number(values.birth_year) : null,
      gender:     values.gender ?? null,
      phone:      values.phone || null,
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
  ai_voice:            z.enum(['cedar', 'marin']),
  conversation_style:  z.enum(['warm', 'playful', 'calm', 'formal']),
  language_preference: z.string().min(2),
})

type AIForm = z.infer<typeof aiSchema>

const VOICES: { value: AIVoice; label: string; description: string }[] = [
  { value: 'marin', label: 'Féminin',  description: 'Voix féminine, douce et chaleureuse' },
  { value: 'cedar', label: 'Masculin', description: 'Voix masculine, posée et rassurante' },
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

// Tolère les anciennes voix DB (nova, shimmer…) en les ramenant au bon genre.
const FEMININE_VOICES = ['marin', 'nova', 'shimmer', 'coral', 'sage']
const voiceToGenderValue = (v?: string | null): AIVoice =>
  v === 'cedar' ? 'cedar'
    : v === 'marin' ? 'marin'
    : FEMININE_VOICES.includes(v ?? '') ? 'marin' : 'cedar'

function AIConfigSection({ beneficiary, onSaved }: { beneficiary: Beneficiary; onSaved: () => void }) {
  const { save, saving, saved, error } = useSection(beneficiary)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AIForm>({
    resolver: zodResolver(aiSchema),
    values: {
      ai_persona_name:     beneficiary.ai_persona_name ?? 'Marie',
      ai_voice:            voiceToGenderValue(beneficiary.ai_voice),
      conversation_style:  beneficiary.conversation_style ?? 'warm',
      language_preference: beneficiary.language_preference ?? 'fr',
    },
  })

  const selectedVoice = watch('ai_voice')
  const selectedStyle = watch('conversation_style')

  const onSubmit = async (values: AIForm) => {
    const ok = await save({
      ai_persona_name:     values.ai_persona_name,
      ai_voice:            values.ai_voice,
      conversation_style:  values.conversation_style,
      language_preference: values.language_preference,
    })
    if (ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-title text-lg font-semibold text-slate-800 mb-4">Configuration du compagnon IA</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="ai_persona_name">Prénom du compagnon IA</Label>
          <p className="text-xs text-slate-400 mb-1">
            Quel prénom votre proche entendra-t-il pour ce compagnon ?
          </p>
          <Input
            id="ai_persona_name"
            placeholder="Marie"
            error={errors.ai_persona_name?.message}
            {...register('ai_persona_name')}
          />
        </div>

        <div>
          <Label>Genre de la voix</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {VOICES.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('ai_voice', value)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                  selectedVoice === value
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

        <div>
          <Label htmlFor="language_preference">Langue des conversations</Label>
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
      </div>

      <SaveBar saving={saving} saved={saved} error={error} />
    </form>
  )
}
