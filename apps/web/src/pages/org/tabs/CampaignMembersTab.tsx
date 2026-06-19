import { useMemo, useState } from 'react'
import { Plus, X, Search, PhoneCall } from 'lucide-react'
import type { useCampaign } from '@/hooks/useCampaign'
import { useOrgBeneficiaries } from '@/hooks/useOrgBeneficiaries'
import { Modal } from '@/pages/org/Modal'

type CampaignCtx = ReturnType<typeof useCampaign>

export function CampaignMembersTab({ c }: { c: CampaignCtx }) {
  const [showAdd, setShowAdd] = useState(false)
  const [callingId, setCallingId] = useState<string | null>(null)

  async function handleCall(b: { id: string; first_name: string; last_name: string; phone: string | null }) {
    if (!b.phone) return
    if (!confirm(`Appeler maintenant ${b.first_name} ${b.last_name} (${b.phone}) ?`)) return
    setCallingId(b.id)
    const ok = await c.callNow(b.id)
    setCallingId(null)
    if (!ok) alert("Échec du déclenchement de l'appel.")
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{c.members.length} bénéficiaire(s) dans la campagne</p>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus size={16} /> Ajouter des bénéficiaires
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {c.members.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Aucun bénéficiaire — ajoutez-en pour que la campagne ait des appels à passer.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {c.members.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{b.last_name} {b.first_name}</td>
                  <td className="px-4 py-3 text-slate-500">{b.phone || <span className="text-amber-600">pas de téléphone</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{b.comment}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleCall(b)}
                        disabled={!b.phone || callingId === b.id}
                        title={b.phone ? 'Appeler maintenant' : 'Pas de téléphone'}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                      >
                        <PhoneCall size={14} className={callingId === b.id ? 'animate-pulse' : ''} />
                        {callingId === b.id ? 'Appel…' : 'Appeler'}
                      </button>
                      <button onClick={() => c.removeMember(b.id)} title="Retirer" className="text-slate-400 hover:text-red-600">
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddMembersModal c={c} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}

function AddMembersModal({ c, onClose }: { c: CampaignCtx; onClose: () => void }) {
  const { beneficiaries, loading } = useOrgBeneficiaries()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const memberIds = useMemo(() => new Set(c.members.map((m) => m.id)), [c.members])

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return beneficiaries
      .filter((b) => !memberIds.has(b.id))
      .filter((b) => !q || [b.first_name, b.last_name, b.phone, b.comment].some((v) => (v ?? '').toLowerCase().includes(q)))
  }, [beneficiaries, memberIds, query])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (selected.size === 0 || saving) return
    setSaving(true)
    const ok = await c.addMembers([...selected])
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Ajouter des bénéficiaires" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
          />
        </div>

        <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : available.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              {query ? 'Aucun résultat.' : 'Tous les bénéficiaires sont déjà dans la campagne.'}
            </p>
          ) : available.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0 hover:bg-slate-50/60">
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-primary" />
              <span className="text-sm font-medium text-slate-800">{b.last_name} {b.first_name}</span>
              <span className="ml-auto text-xs text-slate-400">{b.phone || 'pas de téléphone'}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(new Set(available.map((b) => b.id)))} className="text-xs text-slate-500 hover:underline">
            Tout sélectionner ({available.length})
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleAdd} disabled={selected.size === 0 || saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
              {saving ? 'Ajout…' : `Ajouter ${selected.size || ''}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
