import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import type { WizardData } from '../BeneficiaryWizard'
import type { AIVoice, ConversationStyle } from '@modect/shared'

const schema = z.object({
  ai_persona_name:    z.string().min(1, 'Prénom requis'),
  ai_voice:           z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  conversation_style: z.enum(['warm', 'playful', 'calm', 'formal']),
  language_preference: z.string().min(2),
})

type FormData = z.infer<typeof schema>

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

const VOICES: { value: AIVoice; label: string; description: string }[] = [
  { value: 'nova',    label: 'Nova',    description: 'Chaleureuse et douce — recommandée' },
  { value: 'alloy',   label: 'Alloy',   description: 'Neutre et claire' },
  { value: 'shimmer', label: 'Shimmer', description: 'Légère et dynamique' },
  { value: 'echo',    label: 'Echo',    description: 'Grave et posée' },
  { value: 'fable',   label: 'Fable',   description: 'Expressive et narrative' },
  { value: 'onyx',    label: 'Onyx',    description: 'Profonde et assurée' },
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

export function Step5AIConfig({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ai_persona_name:    data.ai_persona_name ?? 'Marie',
      ai_voice:           data.ai_voice ?? 'nova',
      conversation_style: data.conversation_style ?? 'warm',
      language_preference: data.language_preference ?? 'fr',
    },
  })

  const selectedVoice = watch('ai_voice')
  const selectedStyle = watch('conversation_style')

  const onSubmit = (values: FormData) => onNext(values)

  return (
    <StepLayout
      title="Configuration du compagnon IA"
      subtitle="Personnalisez la façon dont l'IA s'exprime"
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
    >
      {/* Prénom du compagnon */}
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

      {/* Voix */}
      <div>
        <Label>Voix</Label>
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

      {/* Style de conversation */}
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

      {/* Langue */}
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
    </StepLayout>
  )
}
