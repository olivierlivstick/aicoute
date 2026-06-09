import { Radar } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'

export function VeillePage() {
  const { selected } = useSelectedBeneficiary()

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800">Veille</h1>
        <p className="text-slate-500 mt-1">
          Suivi des signaux faibles détectés au fil des conversations
          {selected && <> avec <strong>{selected.first_name}</strong></>}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-4">
          <Radar size={28} />
        </div>
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
          Bientôt disponible
        </h2>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          Cette page agrégera les signaux faibles détectés dans les conversations (santé, humeur, cognition, lien social, autonomie),
          leur évolution dans le temps, et les mémoires marquantes accumulées.
        </p>
      </div>
    </div>
  )
}
