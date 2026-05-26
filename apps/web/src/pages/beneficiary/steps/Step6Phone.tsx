import { useForm } from 'react-hook-form'
import { StepLayout } from './StepLayout'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import type { WizardData } from '../BeneficiaryWizard'

type FormData = { phone: string }

interface Props {
  data: WizardData
  onPrev: () => void
  onSubmit: (patch: WizardData) => void
  saving?: boolean
}

export function Step6Phone({ data, onPrev, onSubmit, saving }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { phone: data.phone ?? '' },
  })

  const handleFinish = (values: FormData) =>
    onSubmit({ phone: values.phone || undefined })

  return (
    <StepLayout
      title="Application mobile"
      subtitle="Pour recevoir les appels sur son smartphone"
      onPrev={onPrev}
      onSubmit={handleSubmit(handleFinish)}
      saving={saving}
      isLast
    >
      <div>
        <Label htmlFor="phone">Numéro de téléphone du proche</Label>
        <p className="text-xs text-slate-400 mb-1">
          Utilisé pour envoyer la notification d'appel entrant
        </p>
        <Input
          id="phone"
          type="tel"
          placeholder="+33 6 00 00 00 00"
          {...register('phone')}
        />
      </div>

      {/* Instructions installation app */}
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl p-5 border border-primary-100">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          📱 Installation de l'application
        </h3>
        <ol className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Téléchargez l'application <strong>MODECT</strong> sur l'App Store ou Google Play
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Ouvrez l'app et entrez le code d'accès qui sera affiché sur cette page après la création du profil
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Autorisez les notifications push — indispensable pour recevoir les appels
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            C'est tout ! Votre proche recevra ses premiers appels selon la planification configurée
          </li>
        </ol>
      </div>

      <div className="bg-slate-50 rounded-xl px-4 py-3">
        <p className="text-xs text-slate-500">
          💡 Le numéro de téléphone et la configuration du profil peuvent être modifiés à tout moment.
        </p>
      </div>
    </StepLayout>
  )
}
