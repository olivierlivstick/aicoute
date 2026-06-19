import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Megaphone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useCampaigns } from '@/hooks/useCampaigns'
import { CampaignStatusBadge } from '@/pages/org/campaignStatus'
import { Modal } from '@/pages/org/Modal'

export function OrgCampagnesPage() {
  const { campaigns, loading, create } = useCampaigns()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || creating) return
    setCreating(true)
    const id = await create(title.trim())
    setCreating(false)
    if (id) navigate(`/org/campagnes/${id}`)
  }

  const dateRange = (s: string | null, e: string | null) => {
    if (!s && !e) return '—'
    const fmt = (d: string) => formatDate(d, { day: '2-digit', month: 'short', year: '2-digit' })
    return `${s ? fmt(s) : '?'} → ${e ? fmt(e) : '?'}`
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-800">Campagnes</h1>
          <p className="mt-1 text-sm text-slate-500">{campaigns.length} campagne(s)</p>
        </div>
        <button
          onClick={() => { setTitle(''); setShowCreate(true) }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-semibold">Créée le</th>
              <th className="px-4 py-3 font-semibold">Campagne</th>
              <th className="px-4 py-3 font-semibold">Période</th>
              <th className="px-4 py-3 text-center font-semibold" title="Bénéficiaires">Bénéf.</th>
              <th className="px-4 py-3 text-center font-semibold" title="Appels à date">À date</th>
              <th className="px-4 py-3 text-center font-semibold" title="Appels à faire">À faire</th>
              <th className="px-4 py-3 text-center font-semibold" title="Communications établies">Établies</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Chargement…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                <Megaphone size={28} className="mx-auto mb-2 text-slate-300" />
                Aucune campagne — créez-en une pour lancer des appels en masse.
              </td></tr>
            ) : campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at, { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{c.title}</span>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{dateRange(c.starts_on, c.ends_on)}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.nb_beneficiaries}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.calls_made}</td>
                <td className="px-4 py-3 text-center text-slate-700">{c.calls_todo}</td>
                <td className="px-4 py-3 text-center font-medium text-sauge">{c.connections}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/org/campagnes/${c.id}`)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle campagne" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Titre de la campagne</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Appels de convivialité — janvier"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
              <p className="mt-1 text-xs text-slate-400">Vous configurerez les détails (dates, prompt, horaires…) ensuite.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={!title.trim() || creating} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
