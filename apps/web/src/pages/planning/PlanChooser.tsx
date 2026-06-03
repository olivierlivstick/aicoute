import { Check, Sparkles } from 'lucide-react'
import { PLAN_TIERS, type PlanTier } from '@modect/shared'
import { Button } from '@/components/ui/Button'

const PAID_TIERS: PlanTier[] = ['discovery', 'comfort', 'serenity']

/**
 * Sélecteur de forfait affiché « inline » sur la page Planning tant qu'aucun
 * abonnement n'existe. En phase de test, seul l'essai gratuit est actionnable ;
 * les 3 forfaits payants sont présentés à titre indicatif (paiement = phase 2).
 */
export function PlanChooser({
  onStartTrial,
  starting,
  error,
}: {
  onStartTrial: () => void
  starting?: boolean
  error?: string | null
}) {
  const trial = PLAN_TIERS.trial

  return (
    <div className="space-y-6">
      {/* Carte essai gratuit — actionnable */}
      <div className="bg-white rounded-2xl border-2 border-primary shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-1.5 text-primary text-xs font-semibold uppercase tracking-wide mb-3">
          <Sparkles size={14} /> Offre de lancement
        </div>
        <h2 className="font-title text-2xl font-bold text-slate-800">
          Essai gratuit — 1 mois offert
        </h2>
        <p className="text-slate-500 mt-1.5 max-w-xl">
          Profitez de <strong>{trial.callsPerWeek} appels par semaine</strong> pendant
          un mois, sans carte bancaire. Votre mois d'essai démarre au tout premier appel.
        </p>

        <ul className="mt-5 space-y-2">
          {[
            `Jusqu'à ${trial.callsPerWeek} appels par semaine`,
            'Compte-rendu après chaque appel',
            'Aucune carte bancaire — sans engagement',
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-5 h-5 rounded-full bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
                <Check size={12} />
              </span>
              {f}
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-5">{error}</p>
        )}

        <Button onClick={onStartTrial} loading={starting} className="mt-6">
          Démarrer mon essai gratuit
        </Button>
      </div>

      {/* Forfaits payants — référence (phase 2) */}
      <div>
        <p className="text-sm text-slate-500 mb-3">
          À l'issue de l'essai, vous choisirez la formule qui vous convient :
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {PAID_TIERS.map((t) => {
            const p = PLAN_TIERS[t]
            return (
              <div
                key={t}
                className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                  Bientôt
                </span>
                <p className="font-semibold text-slate-700">{p.name}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {p.priceEur} €
                  <span className="text-sm font-normal text-slate-400"> / mois</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {p.callsPerWeek} appel{p.callsPerWeek > 1 ? 's' : ''} par semaine
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
