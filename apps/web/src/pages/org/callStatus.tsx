import type { CallStatus } from '@modect/shared'

/** Libellé + couleur d'un statut d'appel, partagés par les pages organisation. */
export const CALL_STATUS_META: Record<CallStatus, { label: string; cls: string }> = {
  scheduled:   { label: 'Prévu',      cls: 'bg-slate-100 text-slate-600' },
  notified:    { label: 'En cours…',  cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'En cours',   cls: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Abouti',     cls: 'bg-sauge/15 text-sauge' },
  missed:      { label: 'Sans réponse', cls: 'bg-orange-100 text-orange-700' },
  failed:      { label: 'Échec',      cls: 'bg-red-100 text-red-700' },
}

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const m = CALL_STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  )
}
