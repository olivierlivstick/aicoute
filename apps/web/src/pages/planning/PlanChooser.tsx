import { Check, Sparkles, Phone } from 'lucide-react'
import { PLAN_TIERS, MINUTE_PACKS } from '@modect/shared'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Sélecteur de forfait affiché « inline » sur la page Planning tant qu'aucun
 * abonnement n'existe. En phase de test, seul l'essai gratuit est actionnable ;
 * les packs de minutes (nouveau modèle, cf. #tarifs vitrine) sont présentés à
 * titre indicatif (paiement = phase 2).
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

      {/* Packs de minutes — référence (paiement = phase 2) */}
      <div>
        <p className="text-sm text-slate-500 mb-3">
          À l'issue de l'essai, vous choisirez le pack de minutes qui vous convient — sans
          abonnement, sans engagement :
        </p>
        <div className="grid sm:grid-cols-3 gap-3 items-stretch">
          {MINUTE_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                'relative rounded-xl border p-4 flex flex-col',
                pack.featured ? 'border-primary bg-primary-50/40' : 'border-slate-200 bg-slate-50/60',
              )}
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                Bientôt
              </span>

              <p className="text-[11px] uppercase tracking-wider font-semibold text-accent-700">{pack.name}</p>
              {pack.featured && (
                <p className="text-[11px] font-semibold text-primary mt-0.5">★ Le plus choisi</p>
              )}

              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-title text-3xl font-bold text-slate-800">{pack.minutes}</span>
                <span className="text-sm text-slate-500">minutes</span>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xl font-bold text-slate-800">{pack.price} €</span>
                {pack.saving && (
                  <span className="bg-accent text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                    {pack.saving}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{pack.perMinute}</p>

              <div className="mt-3 pt-3 border-t border-slate-200/70 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                  <Phone size={13} className="text-primary shrink-0" /> {pack.cadence}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pack.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Une conversation dure en moyenne 7 à 10 minutes. Les minutes restent valables 6 mois.
        </p>
      </div>
    </div>
  )
}
