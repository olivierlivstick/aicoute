import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { VoicePicker } from '@/components/VoicePicker'
import { PromptSelect } from '@/components/PromptSelect'
import type { WizardData } from '../BeneficiaryWizard'
import type { ConversationStyle } from '@modect/shared'

const schema = z.object({
  ai_persona_name:    z.string().min(1, 'Prénom requis'),
  preferred_engine:   z.enum(['openai', 'gemini']),
  ai_voice:           z.string(),
  gemini_voice:       z.string(),
  conversation_style: z.enum(['warm', 'playful', 'calm', 'formal']),
  language_preference: z.string().min(2),
  report_language:     z.string().min(2),
  prompt_id:           z.string().nullable().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  data: WizardData
  onPrev: () => void
  onSubmit: (patch: WizardData) => void
  saving?: boolean
}

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

export function Step5AIConfig({ data, onPrev, onSubmit, saving }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ai_persona_name:    data.ai_persona_name ?? 'Marie',
      // Produit Gemini-only pour l'instant : moteur forcé, plus de sélecteur.
      preferred_engine:   'gemini',
      ai_voice:           data.ai_voice ?? 'cedar',
      gemini_voice:       data.gemini_voice ?? 'Aoede',
      conversation_style: data.conversation_style ?? 'warm',
      language_preference: data.language_preference ?? 'fr',
      report_language:     data.report_language ?? 'fr',
      prompt_id:           data.prompt_id ?? null,
    },
  })

  const selectedGemini = watch('gemini_voice')
  const selectedStyle  = watch('conversation_style')
  const selectedLang   = watch('language_preference')
  const promptId       = watch('prompt_id') ?? null

  // ai_voice/gemini_voice sont des string côté form (le VoicePicker ne produit
  // que des ids valides du catalogue) → cast vers WizardData.
  const handleFinish = (values: FormData) => onSubmit(values as unknown as WizardData)

  return (
    <StepLayout
      title="Configuration du compagnon IA"
      subtitle="Personnalisez la façon dont l'IA s'exprime"
      onPrev={onPrev}
      onSubmit={handleSubmit(handleFinish)}
      saving={saving}
      isLast
    >
      {/* Prénom du compagnon */}
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

      {/* Voix : écoute d'un échantillon par voix (Gemini) */}
      <div>
        <Label>Voix du compagnon</Label>
        <p className="text-xs text-slate-400 mb-1">
          Écoutez chaque voix puis choisissez celle qui appellera votre bénéficiaire.
        </p>
        <VoicePicker
          engine="gemini"
          value={selectedGemini}
          onChange={(id) => setValue('gemini_voice', id, { shouldDirty: true })}
        />
      </div>

      {/* Style de conversation */}
      <div>
        <Label>Style de conversation</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
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

      {/* Langues : conversation + retours */}
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
          <p className="text-xs text-slate-400 mb-1">Résumé et email envoyés à l'aidant.</p>
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

      {/* Prompt (paire émis + entrant, selon la langue des conversations).
          Les deux textes sont personnalisables ensuite dans la fiche. */}
      <div>
        <Label>Prompt du compagnon</Label>
        <p className="text-xs text-slate-400 mb-1">
          Modèle de conversation (appels émis + entrants). Personnalisable après la création.
        </p>
        <PromptSelect
          language={selectedLang}
          value={promptId}
          autoSelectDefault
          onChange={(p) => setValue('prompt_id', p?.id ?? null, { shouldDirty: true })}
        />
      </div>
    </StepLayout>
  )
}
