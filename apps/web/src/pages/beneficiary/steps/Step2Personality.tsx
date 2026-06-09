import { useForm } from 'react-hook-form'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { WizardData } from '../BeneficiaryWizard'

type FormData = {
  family_history: string
  life_story: string
  hobbies: string
  favorite_topics: string
  topics_to_avoid: string
  personality_notes: string
  health_notes: string
}

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

/**
 * Étape fusionnée : Son histoire + Ses goûts + Personnalité & bien-être.
 * Mise en page sur 2 colonnes (la page est large) pour rester scannable.
 */
export function Step2Personality({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      family_history:    data.family_history ?? '',
      life_story:        data.life_story ?? '',
      hobbies:           data.hobbies ?? '',
      favorite_topics:   data.favorite_topics ?? '',
      topics_to_avoid:   data.topics_to_avoid ?? '',
      personality_notes: data.personality_notes ?? '',
      health_notes:      data.health_notes ?? '',
    },
  })

  const onSubmit = (values: FormData) => onNext(values)

  return (
    <StepLayout
      title="Sa personnalité"
      subtitle="Son histoire, ses goûts et son caractère — tout ce qui rend les conversations naturelles et personnalisées (champs optionnels mais précieux)."
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
    >
      <div className="grid lg:grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <Label htmlFor="family_history">Histoire familiale</Label>
          <p className="text-xs text-slate-400 mb-1">Enfants, petits-enfants, conjoint·e, personnes importantes…</p>
          <Textarea
            id="family_history"
            rows={4}
            placeholder="Ex : A deux fils, Pierre (55 ans) et Marc (52 ans). Quatre petits-enfants dont Emma qui vient souvent le week-end."
            {...register('family_history')}
          />
        </div>

        <div>
          <Label htmlFor="life_story">Résumé de vie</Label>
          <p className="text-xs text-slate-400 mb-1">Métier exercé, lieux de vie, moments marquants…</p>
          <Textarea
            id="life_story"
            rows={4}
            placeholder="Ex : Institutrice à Lyon pendant 30 ans, à la retraite depuis 1997. A vécu à Nice. Aime la Provence et la cuisine du sud."
            {...register('life_story')}
          />
        </div>

        <div>
          <Label htmlFor="hobbies">Activités et loisirs</Label>
          <p className="text-xs text-slate-400 mb-1">Ce qu'il/elle aime faire au quotidien.</p>
          <Textarea
            id="hobbies"
            rows={3}
            placeholder="Ex : Jardinage, tricot, émissions de cuisine, mots croisés, promenades…"
            {...register('hobbies')}
          />
        </div>

        <div>
          <Label htmlFor="favorite_topics">Sujets de conversation préférés</Label>
          <p className="text-xs text-slate-400 mb-1">Thèmes qui l'animent, dont il/elle aime parler.</p>
          <Textarea
            id="favorite_topics"
            rows={3}
            placeholder="Ex : Ses petits-enfants, l'actualité locale, la cuisine provençale, ses souvenirs d'enseignante…"
            {...register('favorite_topics')}
          />
        </div>

        <div className="lg:col-span-2">
          <Label htmlFor="topics_to_avoid">Sujets à éviter absolument</Label>
          <p className="text-xs text-slate-400 mb-1">Sujets sensibles, douloureux ou anxiogènes.</p>
          <Textarea
            id="topics_to_avoid"
            rows={2}
            placeholder="Ex : La politique, les nouvelles anxiogènes, le décès de son mari, les détails médicaux…"
            {...register('topics_to_avoid')}
          />
        </div>

        <div>
          <Label htmlFor="personality_notes">Traits de caractère</Label>
          <p className="text-xs text-slate-400 mb-1">Humeur générale, façon d'être, ce qui le/la fait rire…</p>
          <Textarea
            id="personality_notes"
            rows={3}
            placeholder="Ex : Très chaleureuse, aime rire et raconter des anecdotes. Un peu nostalgique mais de bonne humeur."
            {...register('personality_notes')}
          />
        </div>

        <div>
          <Label htmlFor="health_notes">Notes générales de bien-être</Label>
          <p className="text-xs text-slate-400 mb-1">Infos utiles (sans détails médicaux) pour adapter les échanges.</p>
          <Textarea
            id="health_notes"
            rows={3}
            placeholder="Ex : Entend moins bien de l'oreille gauche, parler lentement. Fatigue en fin d'après-midi."
            {...register('health_notes')}
          />
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
        <p className="text-xs text-slate-500">
          🔒 Ces informations sont strictement confidentielles et ne sont jamais partagées avec des tiers.
        </p>
      </div>
    </StepLayout>
  )
}
