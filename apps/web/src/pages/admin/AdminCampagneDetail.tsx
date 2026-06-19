import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useCampaign } from '@/hooks/useCampaign'
import { usePrompts } from '@/hooks/usePrompts'
import { CampaignStatusBadge } from '@/pages/org/campaignStatus'
import { CampaignKpis, CampaignJournal, CampaignPeriods } from '@/pages/org/campaignViews'

const LANG_LABEL: Record<string, string> = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien' }

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || '—'}</p>
    </div>
  )
}

/** /admin/campagnes/:id — fiche campagne admin, LECTURE SEULE (aucune action). */
export function AdminCampagneDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const c = useCampaign(id)
  const camp = c.campaign
  const { prompts } = usePrompts({ language: camp?.language ?? 'fr' })
  const [orgName, setOrgName] = useState<string>('')

  useEffect(() => {
    if (!camp?.org_id) return
    supabase.from('profiles').select('full_name').eq('id', camp.org_id).single()
      .then(({ data }) => setOrgName((data as { full_name: string } | null)?.full_name ?? ''))
  }, [camp?.org_id])

  if (c.loading) return <div className="max-w-[1400px] mx-auto px-4 py-8 text-sm text-slate-400">Chargement…</div>
  if (!camp) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <p className="text-sm text-slate-500">Campagne introuvable.</p>
        <Link to="/admin/campagnes" className="mt-2 inline-block text-sm text-primary hover:underline">← Retour aux campagnes</Link>
      </div>
    )
  }

  const selectedPrompt = prompts.find((p) => p.id === camp.prompt_id) ?? null
  const promptSource = camp.custom_prompt?.trim()
    ? 'Personnalisé (édité)'
    : selectedPrompt ? `Modèle : ${selectedPrompt.title}` : 'Défaut de la langue'
  const promptText = camp.custom_prompt?.trim() || selectedPrompt?.outbound_body || '(défaut de la langue)'

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <button onClick={() => navigate('/admin/campagnes')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Campagnes
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-semibold text-brun-900">{camp.title}</h1>
        <CampaignStatusBadge status={camp.status} />
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{orgName || '—'}</span>
        <span className="text-xs uppercase tracking-wider text-accent-700">Lecture seule</span>
      </div>

      <div className="mt-6 space-y-6">
        {/* Configuration */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Configuration</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <InfoRow label="Prénom de l'appelant" value={camp.ai_persona_name} />
            <InfoRow label="Langue" value={LANG_LABEL[camp.language] ?? camp.language} />
            <InfoRow label="Période" value={`${camp.starts_on ? formatDate(camp.starts_on, { day: '2-digit', month: 'short', year: '2-digit' }) : '?'} → ${camp.ends_on ? formatDate(camp.ends_on, { day: '2-digit', month: 'short', year: '2-digit' }) : '?'}`} />
            <InfoRow label="Plage horaire" value={`${camp.daily_start_time.slice(0, 5)}–${camp.daily_end_time.slice(0, 5)} (${camp.timezone})`} />
            <InfoRow label="Appels simultanés" value={camp.max_concurrent_calls} />
            <InfoRow label="Durée max / appel" value={`${camp.max_call_minutes} min`} />
            <InfoRow label="Relances" value={`${camp.retry_count} × (toutes les ${camp.retry_interval_minutes} min)`} />
          </div>
          {camp.comment && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Commentaire</p>
              <p className="mt-0.5 text-sm text-slate-700">{camp.comment}</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Prompt — {promptSource}</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-700">{promptText}</pre>
          </div>
        </section>

        {/* Bénéficiaires */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Bénéficiaires ({c.members.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Bénéficiaire</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Commentaire</th>
                  <th className="px-4 py-3 font-semibold">Appel abouti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {c.members.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucun bénéficiaire.</td></tr>
                ) : c.members.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{b.last_name} {b.first_name}</td>
                    <td className="px-4 py-3 text-slate-500">{b.phone || <span className="text-amber-600">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400">{b.comment}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {c.connectedAt[b.id]
                        ? formatDate(c.connectedAt[b.id], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Activité */}
        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-slate-700">Activité</h2>
          <CampaignKpis stats={c.stats} />
          <CampaignJournal entries={c.journal} live={camp.status === 'running'} />
          <CampaignPeriods periods={c.periods} />
        </section>
      </div>
    </div>
  )
}
