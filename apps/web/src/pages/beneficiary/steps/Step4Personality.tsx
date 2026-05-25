import { useForm } from 'react-hook-form'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { WizardData } from '../BeneficiaryWizard'

type FormData = {
  personality_notes: string
  health_notes: string
}

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

export function Step4Personality({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      personality_notes: data.personality_notes ?? '',
      health_notes:      data.health_notes ?? '',
    },
  })

  const onSubmit = (values: FormData) => onNext(values)

  return (
    <StepLayout
      title="Personnalité et bien-être"
      subtitle="Aidez l'IA à adapter son comportement à votre proche"
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
    >
      <div>
        <Label htmlFor="personality_notes">Traits de caractère</Label>
        <p className="text-xs text-slate-400 mb-1">
          Humeur générale, façon d'être, ce qui le/la fait rire ou réfléchir…
        </p>
        <Textarea
          id="personality_notes"
          placeholder="Ex : Très chaleureuse, aime rire et raconter des anecdotes. Un peu nostalgique mais généralement de bonne humeur. Parle beaucoup de ses petits-enfants. Peut être hésitante au téléphone au début."
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
          placeholder="Ex : Entend moins bien de l'oreille gauche, préférer parler lentement et clairement. Fatigue en fin d'après-midi."
          rows={3}
          {...register('health_notes')}
        />
      </div>

      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
        <p className="text-xs text-slate-500">
          🔒 Ces informations sont strictement confidentielles et ne sont jamais partagées avec des tiers.
        </p>
      </div>
    </StepLayout>
  )
}
