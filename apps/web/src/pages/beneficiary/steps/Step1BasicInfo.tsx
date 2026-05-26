import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { StepLayout } from './StepLayout'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { WizardData } from '../BeneficiaryWizard'

const schema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name: z.string().min(1, 'Nom requis'),
  birth_year: z.coerce
    .number()
    .int()
    .min(1900, 'Année invalide')
    .max(new Date().getFullYear() - 50, 'Année invalide')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  data: WizardData
  onNext: (patch: WizardData) => void
  onPrev: () => void
}

const GENDERS = [
  { value: 'female', label: 'Femme' },
  { value: 'male',   label: 'Homme' },
  { value: 'other',  label: 'Autre' },
]

export function Step1BasicInfo({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: data.first_name ?? '',
      last_name:  data.last_name ?? '',
      birth_year: data.birth_year ?? ('' as unknown as number),
      gender:     data.gender ?? undefined,
    },
  })

  const selectedGender = watch('gender')

  const onSubmit = (values: FormData) => {
    onNext({
      first_name: values.first_name,
      last_name:  values.last_name,
      birth_year: values.birth_year ? Number(values.birth_year) : undefined,
      gender:     values.gender,
    })
  }

  return (
    <StepLayout
      title="Informations de base"
      subtitle="Les informations essentielles sur votre proche"
      onPrev={onPrev}
      onNext={handleSubmit(onSubmit)}
      isFirst
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">Prénom *</Label>
          <Input id="first_name" placeholder="Jeanne" error={errors.first_name?.message} {...register('first_name')} />
        </div>
        <div>
          <Label htmlFor="last_name">Nom *</Label>
          <Input id="last_name" placeholder="Dupont" error={errors.last_name?.message} {...register('last_name')} />
        </div>
      </div>

      <div>
        <Label htmlFor="birth_year">Année de naissance</Label>
        <Input
          id="birth_year"
          type="number"
          placeholder="1942"
          min={1900}
          max={new Date().getFullYear() - 50}
          error={errors.birth_year?.message}
          {...register('birth_year')}
        />
      </div>

      <div>
        <Label>Genre</Label>
        <div className="flex gap-3 mt-1">
          {GENDERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('gender', value as 'male' | 'female' | 'other')}
              className={[
                'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                selectedGender === value
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-primary-50 rounded-xl px-4 py-3">
        <p className="text-sm text-primary-700">
          💡 Ces informations aident l'IA à s'adresser naturellement à votre proche.
        </p>
      </div>
    </StepLayout>
  )
}
