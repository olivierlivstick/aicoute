import { useState } from 'react'
import { PartyPopper, X } from 'lucide-react'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { useSubscription } from '@/hooks/useSubscription'
import { ScheduleEditor } from '@/pages/planning/ScheduleEditor'
import { PlanChooser } from '@/pages/planning/PlanChooser'
import type { Beneficiary } from '@modect/shared'

/**
 * Onglet Planning côté AIDANT (sa propre fiche). Reprend l'ancienne page
 * /planning : choix de formule / essai (abonnement = niveau compte) puis
 * configuration du planning d'appels. L'édition est directe (pas de garde-fou
 * de confirmation, contrairement à l'onglet admin qui édite la fiche d'autrui).
 */
export function CaregiverPlanningTab({
  beneficiary,
  onSaved,
  showCreatedBanner = false,
}: {
  beneficiary: Beneficiary
  onSaved: () => void
  showCreatedBanner?: boolean
}) {
  const { schedules, loading, refetch } = useSessionSchedules(beneficiary.id)
  const {
    subscription, loading: subLoading, refetch: refetchSub,
    startTrial, maxCallsPerWeek, error: subError,
  } = useSubscription()

  const [banner, setBanner] = useState(showCreatedBanner)
  const [starting, setStarting] = useState(false)

  const handleStartTrial = async () => {
    setStarting(true)
    const ok = await startTrial()
    setStarting(false)
    if (ok) await refetchSub()
  }

  if (loading || subLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const schedule = schedules[0] ?? null

  return (
    <div>
      {banner && (
        <div className="relative bg-primary-50 border border-primary-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
          <span className="text-primary mt-0.5"><PartyPopper size={20} /></span>
          <div className="flex-1 pr-6">
            <p className="font-semibold text-slate-800">
              La fiche de {beneficiary.first_name} est bien créée 🎉
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              Il vous faut maintenant définir le <strong>planning des appels</strong> :
              le nombre d'appels, les jours et l'heure.
            </p>
          </div>
          <button
            onClick={() => setBanner(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {!subscription ? (
        <PlanChooser onStartTrial={handleStartTrial} starting={starting} error={subError} />
      ) : (
        <ScheduleEditor
          beneficiary={beneficiary}
          schedule={schedule}
          onSaved={() => { refetch(); onSaved() }}
          maxCallsPerWeek={maxCallsPerWeek}
        />
      )}
    </div>
  )
}
