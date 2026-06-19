import { AlertTriangle } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/reportI18n'
import type { CallAlert, AlertSeverity, AlertCategory } from '@modect/shared'

// Sévérité — couleurs alignées sur CallDetail / AdminSignaux (low=amber, medium=orange, high=rouge).
export const SEVERITY_META: Record<AlertSeverity, { label: string; tone: string; rank: number }> = {
  high:   { label: 'Élevée',  tone: 'bg-red-50 text-red-700',       rank: 0 },
  medium: { label: 'Modérée', tone: 'bg-orange-50 text-orange-700', rank: 1 },
  low:    { label: 'Faible',  tone: 'bg-amber-50 text-amber-700',   rank: 2 },
}

export function catLabel(cat: AlertCategory): string {
  return CATEGORY_LABELS.fr[cat] ?? cat
}

export function severityRank(sev: AlertSeverity): number {
  return SEVERITY_META[sev]?.rank ?? 99
}

/** Liste de signaux triés (plus grave d'abord) avec badge catégorie·sévérité + citation. */
export function AlertList({ alerts }: { alerts: CallAlert[] | null | undefined }) {
  const sorted = [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  if (sorted.length === 0) return null
  return (
    <div className="space-y-1.5">
      {sorted.map((a, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_META[a.severity]?.tone ?? 'bg-slate-100 text-slate-600'}`}>
            <AlertTriangle size={11} /> {catLabel(a.category)} · {SEVERITY_META[a.severity]?.label ?? a.severity}
          </span>
          <span className="text-xs italic text-slate-600">« {a.evidence} »</span>
        </div>
      ))}
    </div>
  )
}
