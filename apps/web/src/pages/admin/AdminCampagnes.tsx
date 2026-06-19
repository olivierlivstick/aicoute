import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useCampaigns } from '@/hooks/useCampaigns'
import { CampaignStatusBadge } from '@/pages/org/campaignStatus'

/**
 * /admin/campagnes — vue transverse de TOUTES les campagnes (toutes orgs).
 * useCampaigns() renvoie tout pour un admin (RLS admin_select_campaigns).
 * Lecture seule : « Voir » ouvre la fiche admin read-only.
 */
export function AdminCampagnesPage() {
  const { campaigns, loading } = useCampaigns()
  const navigate = useNavigate()
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (campaigns.length === 0) return
    const ids = [...new Set(campaigns.map((c) => c.org_id))]
    supabase.from('profiles').select('id, full_name').in('id', ids).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const p of (data ?? []) as { id: string; full_name: string }[]) map[p.id] = p.full_name
      setOrgNames(map)
    })
  }, [campaigns])

  const dateRange = (s: string | null, e: string | null) => {
    if (!s && !e) return '—'
    const fmt = (d: string) => formatDate(d, { day: '2-digit', month: 'short', year: '2-digit' })
    return `${s ? fmt(s) : '?'} → ${e ? fmt(e) : '?'}`
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <header className="mb-6">
        <p className="mb-1 text-xs uppercase tracking-widest text-accent-700 font-semibold">Administration</p>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-semibold text-brun-900">
          <Megaphone size={26} className="text-accent-700" /> Campagnes
        </h1>
        <p className="mt-1 text-slate-500">Toutes les campagnes des organisations (lecture seule).</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-creme-sable bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-creme-sable bg-creme text-left text-xs uppercase tracking-wider text-brun-700">
              <th className="px-4 py-3">Créée le</th>
              <th className="px-4 py-3">Campagne</th>
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3 text-center">Bénéf.</th>
              <th className="px-4 py-3 text-center">À date</th>
              <th className="px-4 py-3 text-center">À faire</th>
              <th className="px-4 py-3 text-center">Établies</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-creme-sable">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Chargement…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                <Megaphone size={28} className="mx-auto mb-2 text-slate-300" />
                Aucune campagne pour l'instant.
              </td></tr>
            ) : campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-creme/40">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(c.created_at, { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brun-900">{c.title}</span>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{orgNames[c.org_id] ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{dateRange(c.starts_on, c.ends_on)}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.nb_beneficiaries}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.calls_made}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.calls_todo}</td>
                <td className="px-4 py-3 text-center font-medium text-sauge">{c.connections}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/admin/campagnes/${c.id}`)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
