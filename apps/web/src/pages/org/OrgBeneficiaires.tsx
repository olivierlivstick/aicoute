import { useMemo, useState } from 'react'
import { Plus, Upload, Search, History, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import type { Beneficiary } from '@modect/shared'
import { useOrgBeneficiaries } from '@/hooks/useOrgBeneficiaries'
import { BeneficiaryFormModal } from '@/pages/org/BeneficiaryFormModal'
import { ImportCsvModal } from '@/pages/org/ImportCsvModal'
import { BeneficiaryHistoryModal } from '@/pages/org/BeneficiaryHistoryModal'

type SortKey = 'last_name' | 'first_name' | 'phone' | 'comment'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'last_name',  label: 'Nom' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'phone',      label: 'Téléphone' },
  { key: 'comment',    label: 'Commentaire' },
]

export function OrgBeneficiairesPage() {
  const { beneficiaries, loading, create, update, remove, bulkCreate } = useOrgBeneficiaries()

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last_name')
  const [sortAsc, setSortAsc] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Beneficiary | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [history, setHistory] = useState<Beneficiary | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? beneficiaries.filter((b) =>
          [b.first_name, b.last_name, b.phone, b.comment]
            .some((v) => (v ?? '').toLowerCase().includes(q))
        )
      : beneficiaries
    const sorted = [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? '').toString().toLowerCase()
      const bv = (b[sortKey] ?? '').toString().toLowerCase()
      return av < bv ? -1 : av > bv ? 1 : 0
    })
    return sortAsc ? sorted : sorted.reverse()
  }, [beneficiaries, query, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  async function handleDelete(b: Beneficiary) {
    if (confirm(`Supprimer définitivement ${b.first_name} ${b.last_name} ?`)) {
      await remove(b.id)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-800">Bénéficiaires</h1>
          <p className="mt-1 text-sm text-slate-500">{beneficiaries.length} bénéficiaire(s)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload size={16} /> Importer (CSV)
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            <Plus size={16} /> Nouveau bénéficiaire
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative mt-6 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, prénom, téléphone, commentaire)…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
        />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">
                  <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-700">
                    {c.label}
                    <ArrowUpDown size={11} className={sortKey === c.key ? 'text-primary' : 'text-slate-300'} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Chargement…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                {query ? 'Aucun résultat.' : 'Aucun bénéficiaire — créez-en un ou importez un CSV.'}
              </td></tr>
            ) : rows.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{b.last_name}</td>
                <td className="px-4 py-3 text-slate-700">{b.first_name}</td>
                <td className="px-4 py-3 text-slate-500">{b.phone || <span className="text-amber-600">—</span>}</td>
                <td className="px-4 py-3 text-slate-500">{b.comment || ''}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 text-slate-400">
                    <button onClick={() => setHistory(b)} title="Historique des appels" className="hover:text-primary">
                      <History size={16} />
                    </button>
                    <button onClick={() => { setEditing(b); setShowForm(true) }} title="Modifier" className="hover:text-primary">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(b)} title="Supprimer" className="hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <BeneficiaryFormModal
          initial={editing}
          onClose={() => setShowForm(false)}
          onSubmit={(input) => (editing ? update(editing.id, input) : create(input))}
        />
      )}
      {showImport && (
        <ImportCsvModal onClose={() => setShowImport(false)} onImport={bulkCreate} />
      )}
      {history && (
        <BeneficiaryHistoryModal beneficiary={history} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}
