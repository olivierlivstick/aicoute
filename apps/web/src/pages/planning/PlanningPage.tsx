import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { UserPlus, PartyPopper, X } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { useSubscription } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/Button'
import { ScheduleEditor } from './ScheduleEditor'
import { PlanChooser } from './PlanChooser'

export function PlanningPage() {
  const { selected } = useSelectedBeneficiary()
  const { schedules, loading, refetch } = useSessionSchedules(selected?.id)
  const {
    subscription, loading: subLoading, refetch: refetchSub,
    startTrial, maxCallsPerWeek, error: subError,
  } = useSubscription()

  const [searchParams, setSearchParams] = useSearchParams()
  const [showBanner, setShowBanner] = useState(searchParams.get('created') === '1')
  const [starting, setStarting] = useState(false)

  const dismissBanner = () => {
    setShowBanner(false)
    if (searchParams.has('created')) {
      searchParams.delete('created')
      setSearchParams(searchParams, { replace: true })
    }
  }

  const handleStartTrial = async () => {
    setStarting(true)
    const ok = await startTrial()
    setStarting(false)
    if (ok) await refetchSub()
  }

  if (!selected) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
            Aucun bénéficiaire configuré
          </h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Ajoutez un bénéficiaire avant de configurer un planning d'appels.
          </p>
          <Link to="/beneficiary/new">
            <Button><UserPlus size={16} /> Créer un bénéficiaire</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading || subLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 1 planning par bénéficiaire : on prend le 1er s'il existe, sinon null = création
  const schedule = schedules[0] ?? null

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800">Planning</h1>
        <p className="text-slate-500 mt-1">
          Sessions récurrentes avec <strong>{selected.first_name}</strong>
        </p>
      </div>

      {/* Bannière pédagogique après création du bénéficiaire */}
      {showBanner && (
        <div className="relative bg-primary-50 border border-primary-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
          <span className="text-primary mt-0.5"><PartyPopper size={20} /></span>
          <div className="flex-1 pr-6">
            <p className="font-semibold text-slate-800">
              La fiche de {selected.first_name} est bien créée 🎉
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              Il vous faut maintenant définir le <strong>planning des appels</strong> :
              le nombre d'appels, les jours et l'heure.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {!subscription ? (
        <PlanChooser
          onStartTrial={handleStartTrial}
          starting={starting}
          error={subError}
        />
      ) : (
        <ScheduleEditor
          beneficiary={selected}
          schedule={schedule}
          onSaved={refetch}
          maxCallsPerWeek={maxCallsPerWeek}
        />
      )}
    </div>
  )
}
