import { useEffect, useState, useMemo } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
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

export function AdminComptesPage() {
  const [rows, setRows] = useState<CaregiverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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
    if (!q) return rows
    return rows.filter((r) =>
      r.email.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    )
  }, [rows, query])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
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
                <th className="px-5 py-3">Compte</th>
                <th className="px-5 py-3">Rôle</th>
                <th className="px-5 py-3 text-center">Bénéf.</th>
                <th className="px-5 py-3 text-center">Appels 30 j</th>
                <th className="px-5 py-3">Dernier appel</th>
                <th className="px-5 py-3">Inscrit le</th>
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">
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
