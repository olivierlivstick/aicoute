import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShieldCheck, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CaregiverRow {
  id:             string
  email:          string
  full_name:      string
  role:           string
  created_at:     string
  beneficiaries:  number
  calls30d:       number
  lastCallEnded:  string | null
}

const MS_30D = 30 * 24 * 60 * 60 * 1000

type SortKey = 'name' | 'role' | 'beneficiaries' | 'calls' | 'lastCall' | 'created'
type SortDir = 'asc' | 'desc'

const collator = new Intl.Collator('fr', { sensitivity: 'base' })

// Les profils n'ont qu'un full_name (« Prénom Nom ») : on trie sur le dernier mot
// (≈ nom de famille), fallback email si le nom est vide.
const lastNameOf = (r: CaregiverRow) => {
  const name = (r.full_name ?? '').trim()
  if (!name) return (r.email ?? '').toLowerCase()
  const parts = name.split(/\s+/)
  return parts[parts.length - 1]
}

export function AdminComptesPage() {
  const [rows, setRows] = useState<CaregiverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
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
  }, [])

  async function load() {
    setLoading(true)
    const since30d = new Date(Date.now() - MS_30D).toISOString()

    // 1. Tous les profils (admin RLS → SELECT all). On affiche aussi les admins
    //    car ça fait peu de rows et c'est utile de voir qui a quoi.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })

    if (!profiles) { setLoading(false); return }

    // 2. Pour chaque caregiver, on agrège côté client (séquentiel mais court)
    const enriched = await Promise.all(profiles.map(async (p) => {
      const [benCount, callCount, lastCall] = await Promise.all([
        supabase
          .from('beneficiaries')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_id', p.id),
        supabase
          .from('calls')
          .select('id, beneficiary_id, beneficiaries!inner(caregiver_id)', { count: 'exact', head: true })
          .eq('beneficiaries.caregiver_id', p.id)
          .gte('created_at', since30d),
        supabase
          .from('calls')
          .select('ended_at, beneficiaries!inner(caregiver_id)')
          .eq('beneficiaries.caregiver_id', p.id)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      return {
        id:            p.id,
        email:         p.email,
        full_name:     p.full_name,
        role:          p.role,
        created_at:    p.created_at,
        beneficiaries: benCount.count ?? 0,
        calls30d:      callCount.count ?? 0,
        lastCallEnded: (lastCall.data as { ended_at: string } | null)?.ended_at ?? null,
      }
    }))

    setRows(enriched)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? rows
      : rows.filter((r) =>
          r.email.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q),
        )

    const dir = sortDir === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      if (sortKey === 'lastCall') {
        // jamais appelé (null) toujours en bas, quelle que soit la direction
        const ta = a.lastCallEnded ? Date.parse(a.lastCallEnded) : null
        const tb = b.lastCallEnded ? Date.parse(b.lastCallEnded) : null
        if (ta === null && tb === null) return collator.compare(lastNameOf(a), lastNameOf(b))
        if (ta === null) return 1
        if (tb === null) return -1
        return (ta - tb) * dir
      }
      let c = 0
      if (sortKey === 'name')          c = collator.compare(lastNameOf(a), lastNameOf(b))
      if (sortKey === 'role')          c = collator.compare(a.role, b.role)
      if (sortKey === 'beneficiaries') c = a.beneficiaries - b.beneficiaries
      if (sortKey === 'calls')         c = a.calls30d - b.calls30d
      if (sortKey === 'created')       c = Date.parse(a.created_at) - Date.parse(b.created_at)
      // départage stable par nom pour les ex æquo
      if (c === 0) return collator.compare(lastNameOf(a), lastNameOf(b))
      return c * dir
    })
  }, [rows, query, sortKey, sortDir])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">Comptes utilisateurs</h1>
        <p className="text-slate-500 mt-1">{rows.length} compte{rows.length > 1 ? 's' : ''} au total.</p>
      </header>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par email ou nom…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-creme-sable bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <SortHeader label="Compte"      col="name"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Rôle"        col="role"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Bénéf."      col="beneficiaries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortHeader label="Appels 30 j" col="calls"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortHeader label="Dernier appel" col="lastCall"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Inscrit le"  col="created"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3 text-right">Gérer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-creme/40 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-brun-900">{r.full_name || '—'}</p>
                    <p className="text-xs text-slate-500">{r.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {r.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 bg-accent-50 text-accent-700 px-2 py-1 rounded-full text-xs font-semibold">
                        <ShieldCheck size={12} /> admin
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">{r.role}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center text-brun-700">{r.beneficiaries}</td>
                  <td className="px-5 py-3 text-center text-brun-700">{r.calls30d}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {r.lastCallEnded
                      ? new Date(r.lastCallEnded).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/admin/comptes/${r.id}`}
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
                    Aucun compte ne correspond à ce filtre.
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
