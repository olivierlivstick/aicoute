import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useSessionSchedules } from '@/hooks/useSessionSchedule'
import { Button } from '@/components/ui/Button'
import { ScheduleEditor } from './ScheduleEditor'

export function PlanningPage() {
  const { selected } = useSelectedBeneficiary()
  const { schedules, loading, refetch } = useSessionSchedules(selected?.id)

  if (!selected) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 1 planning par bénéficiaire : on prend le 1er s'il existe, sinon null = création
  const schedule = schedules[0] ?? null

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800">Planning</h1>
        <p className="text-slate-500 mt-1">
          Sessions récurrentes avec <strong>{selected.first_name}</strong>
        </p>
      </div>

      <ScheduleEditor
        beneficiary={selected}
        schedule={schedule}
        onSaved={refetch}
      />
    </div>
  )
}
