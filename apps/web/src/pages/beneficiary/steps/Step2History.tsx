import { useForm } from 'react-hook-form'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { WizardData } from '../BeneficiaryWizard'

type FormData = {
  family_history: string
  life_story: string
}

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

export function Step2History({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      family_history: data.family_history ?? '',
      life_story:     data.life_story ?? '',
    },
  })

  const onSubmit = (values: FormData) => onNext(values)

  return (
    <StepLayout
      title="Son histoire"
      subtitle="Ces informations permettent à l'IA d'évoquer naturellement la vie de votre proche"
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
    >
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
          Métier exercé, lieux de vie, moments marquants, centres d'intérêt historiques…
        </p>
        <Textarea
          id="life_story"
          placeholder="Ex : Institutrice à Lyon pendant 30 ans, à la retraite depuis 1997. A vécu à Nice les 20 dernières années. Aime beaucoup la Provence et la cuisine du sud."
          rows={5}
          {...register('life_story')}
        />
      </div>

      <div className="bg-accent-50 rounded-xl px-4 py-3">
        <p className="text-sm text-accent-700">
          💛 Ces champs sont optionnels mais très précieux pour des conversations plus riches et personnalisées.
        </p>
      </div>
    </StepLayout>
  )
}
