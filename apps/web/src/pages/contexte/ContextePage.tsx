import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { Button } from '@/components/ui/Button'
import { BeneficiaryContextEditor } from './BeneficiaryContextEditor'

export function ContextePage() {
  const { selected, refetch } = useSelectedBeneficiary()

  if (!selected) {
    return <EmptyState />
  }

  return (
    <div className="p-8 max-w-[1180px] mx-auto">
      <div className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800">Contexte</h1>
        <p className="text-slate-500 mt-1">
          Profil et préférences de <strong>{selected.first_name} {selected.last_name}</strong>
        </p>
      </div>

      <BeneficiaryContextEditor beneficiary={selected} onSaved={refetch} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
          Aucun bénéficiaire configuré
        </h2>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Commencez par créer un profil pour votre bénéficiaire : ces informations alimentent la conversation et la planification.
        </p>
        <Link to="/beneficiary/new">
          <Button>
            <UserPlus size={16} /> Créer un bénéficiaire
          </Button>
        </Link>
      </div>
    </div>
  )
}
