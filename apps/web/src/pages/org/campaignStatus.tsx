import type { CampaignStatus } from '@modect/shared'

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; cls: string }> = {
  draft:     { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
  running:   { label: 'En cours',  cls: 'bg-sauge/15 text-sauge' },
  paused:    { label: 'En pause',  cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Terminée',  cls: 'bg-slate-200 text-slate-500' },
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const m = CAMPAIGN_STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  )
}
