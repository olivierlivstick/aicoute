import {
  Play, Pause, PhoneOutgoing, PhoneCall, PhoneMissed, PhoneOff, CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { CampaignStats, JournalEntry, JournalKind, PeriodWithStats } from '@/hooks/useCampaign'

/** Vues présentationnelles partagées entre l'onglet Activité (org, éditable) et
 *  la fiche campagne admin (lecture seule). Aucune action ici. */

const JOURNAL_META: Record<JournalKind, { Icon: typeof Play; cls: string }> = {
  go:          { Icon: Play,          cls: 'text-sauge' },
  pause:       { Icon: Pause,         cls: 'text-amber-600' },
  launched:    { Icon: PhoneOutgoing, cls: 'text-slate-400' },
  in_progress: { Icon: PhoneCall,     cls: 'text-primary' },
  completed:   { Icon: CheckCircle2,  cls: 'text-sauge' },
  missed:      { Icon: PhoneMissed,   cls: 'text-orange-600' },
  failed:      { Icon: PhoneOff,      cls: 'text-red-600' },
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-2xl font-serif font-semibold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}

export function CampaignKpis({ stats }: { stats: CampaignStats }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard label="Appels passés" value={stats.calls_made} />
      <KpiCard label="Temps passé" value={`${stats.minutes_spent} min`} />
      <KpiCard label="Appels à passer" value={stats.calls_todo} />
    </div>
  )
}

export function CampaignJournal({ entries, live }: { entries: JournalEntry[]; live?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Journal d'activité</h3>
        {live && <span className="inline-flex items-center gap-1 text-xs text-sauge"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sauge" /> en direct</span>}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white">
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun événement pour l'instant.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-50 overflow-auto">
            {entries.map((e) => {
              const { Icon, cls } = JOURNAL_META[e.kind]
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon size={15} className={`shrink-0 ${cls}`} />
                  <span className="text-slate-700">{e.label}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                    {formatDate(e.at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function CampaignPeriods({ periods }: { periods: PeriodWithStats[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Périodes d'activité</h3>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-semibold">Début</th>
              <th className="px-4 py-3 font-semibold">Fin</th>
              <th className="px-4 py-3 text-center font-semibold">Appels passés</th>
              <th className="px-4 py-3 text-center font-semibold">Appels aboutis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {periods.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucune période — la campagne n'a pas encore été lancée.</td></tr>
            ) : periods.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-slate-600">{formatDate(p.started_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.ended_at
                    ? formatDate(p.ended_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : <span className="text-sauge">en cours</span>}
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{p.calls_made}</td>
                <td className="px-4 py-3 text-center text-slate-700">{p.connections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
