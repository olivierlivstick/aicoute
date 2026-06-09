import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { StepLayout } from './StepLayout'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { PhoneInput } from '@/components/PhoneInput'
import { cn } from '@/lib/utils'
import type { WizardData } from '../BeneficiaryWizard'

const TODAY = new Date().toISOString().slice(0, 10)

const schema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name: z.string().min(1, 'Nom requis'),
  birth_date: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
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
] as const

export function Step1BasicInfo({ data, onNext, onPrev }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: data.first_name ?? '',
      last_name:  data.last_name ?? '',
      birth_date: data.birth_date ?? '',
      gender:     (data.gender === 'male' || data.gender === 'female') ? data.gender : undefined,
    },
  })

  const [phone, setPhone] = useState(data.phone ?? '')
  const selectedGender = watch('gender')

  const onSubmit = (values: FormData) => {
    const birthDate = values.birth_date || undefined
    onNext({
      first_name: values.first_name,
      last_name:  values.last_name,
      birth_date: birthDate ?? null,
      // birth_year tenu à jour à partir de la date (prompt edge + repli âge).
      birth_year: birthDate ? Number(birthDate.slice(0, 4)) : null,
      gender:     values.gender,
      phone:      phone || null,
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="birth_date">Date de naissance</Label>
          <p className="text-xs text-slate-400 mb-1">Pour son âge et pour penser à son anniversaire.</p>
          <Input
            id="birth_date"
            type="date"
            max={TODAY}
            min="1900-01-01"
            error={errors.birth_date?.message}
            {...register('birth_date')}
          />
        </div>
        <div>
          <Label>Genre</Label>
          <p className="text-xs text-slate-400 mb-1">Pour accorder le ton et les formulations.</p>
          <div className="flex gap-3">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('gender', value)}
                className={cn(
                  'flex-1 h-10 rounded-xl border text-sm font-medium transition-all',
                  selectedGender === value
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="phone">Numéro de téléphone</Label>
        <p className="text-xs text-slate-400 mb-1">
          Le numéro sur lequel votre proche recevra les appels (modifiable à tout moment).
        </p>
        <PhoneInput id="phone" value={phone} onChange={setPhone} />
      </div>

      <div className="bg-primary-50 rounded-xl px-4 py-3">
        <p className="text-sm text-primary-700">
          💡 Ces informations aident l'IA à s'adresser naturellement à votre proche.
        </p>
      </div>
    </StepLayout>
  )
}
