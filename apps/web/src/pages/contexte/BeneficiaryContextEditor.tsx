import { useState } from 'react'
import { IdCard, Bot, Notebook, CalendarClock, Phone } from 'lucide-react'
import { useMemories } from '@/hooks/useMemories'
import { cn } from '@/lib/utils'
import type { Beneficiary } from '@modect/shared'
import { ProfilTab } from './tabs/ProfilTab'
import { CompagnonIATab } from './tabs/CompagnonIATab'
import { MemoireTab } from './tabs/MemoireTab'
import { PlanningTab } from './tabs/PlanningTab'
import { AppelsTab } from './tabs/AppelsTab'

type Tab = 'profil' | 'ai' | 'memory' | 'schedule' | 'calls'

interface TabDef {
  id: Tab
  label: string
  icon: React.ElementType
}

/**
 * Éditeur de la fiche bénéficiaire, partagé entre :
 *   - /contexte (aidant édite SON bénéficiaire — RLS caregiver_owns)
 *   - /admin/beneficiaires/:id (admin édite N'IMPORTE QUEL bénéficiaire — RLS admin)
 *
 * Lecture-d'abord : chaque carte bascule lecture ⇄ édition inline et persiste via
 * useBeneficiary(id).update. Onglets Planning (withSchedule) et Appels (withCalls)
 * réservés à l'admin.
 */
export function BeneficiaryContextEditor({
  beneficiary,
  onSaved,
  withSchedule = false,
  withCalls = false,
  onDeleted,
}: {
  beneficiary: Beneficiary
  onSaved: () => void
  /** Onglet « Planning » (édition gardée par confirmation). Réservé à l'admin. */
  withSchedule?: boolean
  /** Onglet « Appels » (graphe minutes + coûts). Réservé à l'admin. */
  withCalls?: boolean
  /** Si fourni, affiche une zone danger « Effacer » en bas de l'onglet Profil
   *  (vue aidant). L'admin a sa propre zone danger au niveau de la page. */
  onDeleted?: () => void
}) {
  const [tab, setTab] = useState<Tab>('profil')
  const { memories, loading: memoriesLoading } = useMemories(beneficiary.id)

  const tabs: TabDef[] = [
    { id: 'profil', label: 'Profil', icon: IdCard },
    { id: 'ai', label: 'Compagnon IA', icon: Bot },
    { id: 'memory', label: 'Mémoire', icon: Notebook },
    ...(withSchedule ? [{ id: 'schedule' as Tab, label: 'Planning', icon: CalendarClock }] : []),
    ...(withCalls ? [{ id: 'calls' as Tab, label: 'Appels', icon: Phone }] : []),
  ]

  return (
    <div>
      {/* Barre d'onglets */}
      <div className="flex gap-1 mb-6 border-b border-creme-sable overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-[14px] font-medium transition-colors relative whitespace-nowrap',
              tab === id ? 'text-primary' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={16} />
            {label}
            {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {tab === 'profil' && (
        <ProfilTab
          beneficiary={beneficiary}
          onSaved={onSaved}
          onGoToMemory={() => setTab('memory')}
          memoryCount={memoriesLoading ? null : memories.length}
          onDeleted={onDeleted}
        />
      )}
      {tab === 'ai' && <CompagnonIATab beneficiary={beneficiary} onSaved={onSaved} />}
      {tab === 'memory' && <MemoireTab beneficiary={beneficiary} />}
      {tab === 'schedule' && withSchedule && <PlanningTab beneficiary={beneficiary} onSaved={onSaved} />}
      {tab === 'calls' && withCalls && <AppelsTab beneficiary={beneficiary} />}
    </div>
  )
}
