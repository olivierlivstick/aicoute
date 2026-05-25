import { useForm } from 'react-hook-form'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { WizardData } from '../BeneficiaryWizard'

type FormData = {
  hobbies: string
  favorite_topics: string
  topics_to_avoid: string
}

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

export function Step3Tastes({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      hobbies:         data.hobbies ?? '',
      favorite_topics: data.favorite_topics ?? '',
      topics_to_avoid: data.topics_to_avoid ?? '',
    },
  })

  const onSubmit = (values: FormData) => onNext(values)

  return (
    <StepLayout
      title="Ses goûts et centres d'intérêt"
      subtitle="Guidez l'IA pour des échanges qui plaisent vraiment à votre proche"
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
    >
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
          placeholder="Ex : Ses petits-enfants, l'actualité locale, la cuisine provençale, ses souvenirs d'enseignante, le jardinage…"
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
    </StepLayout>
  )
}
