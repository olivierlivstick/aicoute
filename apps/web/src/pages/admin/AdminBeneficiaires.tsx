import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Phone, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BeneficiaryRow {
  id:                    string
  first_name:            string
  last_name:             string
  phone:                 string | null
  language_preference:   string
  is_active:             boolean
  notify_call_report:    boolean
  created_at:            string
  profiles: { email: string; full_name: string } | null
  callsTotal:            number
  lastCallEnded:         string | null
}

type SortKey = 'name' | 'caregiver' | 'calls' | 'lastCall'
type SortDir = 'asc' | 'desc'

const collator = new Intl.Collator('fr', { sensitivity: 'base' })

const nameOf      = (b: BeneficiaryRow) => `${b.last_name} ${b.first_name}`.trim()
const caregiverOf = (b: BeneficiaryRow) => b.profiles?.full_name || b.profiles?.email || ''

export function AdminBeneficiairesPage() {
  const [rows, setRows] = useState<BeneficiaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    load()
  }, [activeOnly])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('beneficiaries')
      .select('id, first_name, last_name, phone, language_preference, is_active, notify_call_report, created_at, profiles:caregiver_id(email, full_name)')
      .order('created_at', { ascending: false })

    if (activeOnly) q = q.eq('is_active', true)

    const { data } = await q
    if (!data) { setLoading(false); return }

    const enriched = await Promise.all(data.map(async (b) => {
      const [{ count }, lastCall] = await Promise.all([
        supabase.from('calls').select('id', { count: 'exact', head: true }).eq('beneficiary_id', b.id),
        supabase.from('calls').select('ended_at').eq('beneficiary_id', b.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      return {
        ...b,
        profiles:      b.profiles as unknown as { email: string; full_name: string } | null,
        callsTotal:    count ?? 0,
        lastCallEnded: (lastCall.data as { ended_at: string } | null)?.ended_at ?? null,
      }
    }))
    setRows(enriched as BeneficiaryRow[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? rows
      : rows.filter((r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.profiles?.email?.toLowerCase().includes(q) ||
          (r.phone ?? '').toLowerCase().includes(q),
        )

    const dir = sortDir === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      if (sortKey === 'lastCall') {
        // jamais appelé (null) toujours en bas, quelle que soit la direction
        const ta = a.lastCallEnded ? Date.parse(a.lastCallEnded) : null
        const tb = b.lastCallEnded ? Date.parse(b.lastCallEnded) : null
        if (ta === null && tb === null) return collator.compare(nameOf(a), nameOf(b))
        if (ta === null) return 1
        if (tb === null) return -1
        return (ta - tb) * dir
      }
      let c = 0
      if (sortKey === 'name')      c = collator.compare(nameOf(a), nameOf(b))
      if (sortKey === 'caregiver') c = collator.compare(caregiverOf(a), caregiverOf(b))
      if (sortKey === 'calls')     c = a.callsTotal - b.callsTotal
      // départage stable par nom pour les ex æquo
      if (c === 0) return collator.compare(nameOf(a), nameOf(b))
      return c * dir
    })
  }, [rows, query, sortKey, sortDir])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Bénéficiaires (tous comptes)</h1>
        <p className="text-slate-500 mt-1">{rows.length} bénéficiaire{rows.length > 1 ? 's' : ''} {activeOnly ? 'actifs' : '(actifs + archivés)'}.</p>
      </header>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom, aidant ou numéro…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-creme-sable bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded"
          />
          Actifs uniquement
        </label>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <SortHeader label="Bénéficiaire" col="name"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Aidant"       col="caregiver" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3">Téléphone</th>
                <SortHeader label="Appels"       col="calls"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortHeader label="Dernier appel" col="lastCall" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3">État</th>
                <th className="px-5 py-3 text-right">Gérer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-creme/40 transition-colors group">
                  <td className="px-5 py-3">
                    <p className="font-medium text-brun-900">{b.first_name} {b.last_name}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    <p className="text-brun-700">{b.profiles?.full_name ?? '—'}</p>
                    <p>{b.profiles?.email ?? ''}</p>
                  </td>
                  <td className="px-5 py-3">
                    {b.phone ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-brun-700 font-mono">
                        <Phone size={12} className="text-slate-400" />
                        {b.phone}
                      </span>
                    ) : (
                      <span className="text-xs text-brique">⚠ aucun numéro</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center text-brun-700">{b.callsTotal}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {b.lastCallEnded
                      ? new Date(b.lastCallEnded).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className={b.is_active ? 'text-sauge' : 'text-slate-400'}>
                        {b.is_active ? '● Actif' : '○ Archivé'}
                      </span>
                      {!b.notify_call_report && (
                        <span className="text-slate-400">Notif. emails OFF</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/admin/beneficiaires/${b.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                    >
                      Gérer <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">
                    Aucun bénéficiaire ne correspond à ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, col, sortKey, sortDir, onSort, align = 'left' }: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'center' | 'right'
}) {
  const active = sortKey === col
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  return (
    <th className={`px-5 py-3 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 w-full ${justify} uppercase tracking-wider transition-colors hover:text-brun-900 ${active ? 'text-brun-900' : ''}`}
      >
        {label}
        {active
          ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
          : <ArrowUpDown size={12} className="text-slate-300" />}
      </button>
    </th>
  )
}
