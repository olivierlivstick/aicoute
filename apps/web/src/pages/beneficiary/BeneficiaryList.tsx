import { Link } from 'react-router-dom'
import { Plus, Phone, CheckCircle, Clock } from 'lucide-react'
import { useBeneficiaries } from '@/hooks/useBeneficiary'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function BeneficiaryListPage() {
  const { beneficiaries, loading } = useBeneficiaries()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Bénéficiaires</h1>
          <p className="text-slate-500 mt-1">Gérez les proches dont vous vous occupez</p>
        </div>
        <Link to="/beneficiary/new">
          <Button>
            <Plus size={18} />
            Ajouter un proche
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-5xl mb-4">👴👵</div>
          <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
            Aucun proche configuré
          </h2>
          <p className="text-slate-500 mb-6">
            Ajoutez votre premier proche pour commencer.
          </p>
          <Link to="/beneficiary/new">
            <Button><Plus size={18} /> Ajouter mon premier proche</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {beneficiaries.map((b) => (
            <Link key={b.id} to={`/beneficiary/${b.id}`}>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-primary/20 transition-all flex items-center gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary font-title font-bold text-2xl flex-shrink-0">
                  {b.first_name[0]}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {b.first_name} {b.last_name}
                    </h3>
                    {b.onboarding_completed ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Configuré
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        <Clock size={11} /> En cours
                      </span>
                    )}
                    {!b.is_active && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                    {b.birth_year && <span>Né(e) en {b.birth_year}</span>}
                    {b.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} /> {b.phone}
                      </span>
                    )}
                    <span className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                      {b.ai_persona_name}
                    </span>
                  </div>
                </div>

                {/* Indicateur voix */}
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                  b.is_active ? 'bg-green-400' : 'bg-slate-300'
                )} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
