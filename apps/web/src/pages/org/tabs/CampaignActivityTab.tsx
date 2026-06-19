import { useState } from 'react'
import { Play, Pause, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { useCampaign } from '@/hooks/useCampaign'
import { campaignWindowState } from '@/pages/org/campaignWindow'

type CampaignCtx = ReturnType<typeof useCampaign>

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-2xl font-serif font-semibold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}

export function CampaignActivityTab({ c }: { c: CampaignCtx }) {
  const camp = c.campaign!
  const running = camp.status === 'running'
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    if (running) await c.pause()
    else await c.start()
    setBusy(false)
  }

  const noMembers = c.members.length === 0
  const noPhone = c.members.filter((m) => !m.phone || !m.phone.trim()).length

  // Statut d'activité honnête quand la campagne tourne (miroir du worker).
  const runningSubtitle = () => {
    switch (campaignWindowState(camp)) {
      case 'calling':        return 'Appels en cours — dans la plage horaire configurée.'
      case 'waiting_window': return `En attente de la plage horaire (${camp.daily_start_time.slice(0, 5)}–${camp.daily_end_time.slice(0, 5)}).`
      case 'before_start':   return camp.starts_on ? `Démarre le ${formatDate(camp.starts_on, { day: 'numeric', month: 'long' })}.` : 'En attente de la date de début.'
      case 'after_end':      return 'Période de campagne terminée.'
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* KPI en-tête */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Appels passés" value={c.stats.calls_made} />
        <KpiCard label="Temps passé" value={`${c.stats.minutes_spent} min`} />
        <KpiCard label="Appels à passer" value={c.stats.calls_todo} />
      </div>

      {/* Interrupteur GO / PAUSE */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {running ? 'Campagne en cours' : 'Campagne à l’arrêt'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {running
              ? runningSubtitle()
              : noMembers
                ? 'Ajoutez des bénéficiaires avant de lancer la campagne.'
                : 'Lancez la campagne pour démarrer la file d’appels.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || (!running && noMembers)}
          className={
            running
              ? 'inline-flex items-center gap-2 rounded-xl bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50'
              : 'inline-flex items-center gap-2 rounded-xl bg-sauge px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'
          }
        >
          {running ? <><Pause size={16} /> Mettre en pause</> : <><Play size={16} /> Lancer (GO)</>}
        </button>
      </div>

      {noPhone > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{noPhone} bénéficiaire(s) sans téléphone ne seront pas appelés. Renseignez leur numéro dans l’onglet Bénéficiaires.</span>
        </div>
      )}

      {/* Périodes d'activité */}
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
              {c.periods.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucune période — la campagne n'a pas encore été lancée.</td></tr>
              ) : c.periods.map((p) => (
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
    </div>
  )
}
