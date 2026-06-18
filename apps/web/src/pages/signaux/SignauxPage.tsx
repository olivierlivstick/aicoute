import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { useCalls, type CallWithBeneficiary } from '@/hooks/useCalls'
import { CATEGORY_LABELS } from '@/lib/reportI18n'

/**
 * /signaux — vue aidant des « signaux faibles » détectés en conversation pour le
 * bénéficiaire sélectionné dans l'en-tête. Remplace l'ancienne page « Veille ».
 *
 * LECTURE SEULE (décision produit 2026-06-18) : pas de journal d'actions
 * (`signal_actions` reste un outil interne AICOUTE, RLS admin-only) ni de bouton
 * .wav (bucket d'enregistrements admin-only). Les appels sont chargés via
 * `useCalls(selected.id)` → RLS aidant + filtre bénéficiaire.
 */

type Severity = 'low' | 'medium' | 'high'
type Category = 'health' | 'mood' | 'cognition' | 'social' | 'autonomy' | 'other'

interface Alert { category: Category; severity: Severity; evidence: string }

// Couleurs alignées sur CallDetail + la page admin Signaux (low=amber, medium=orange, high=rouge).
const SEVERITY_META: Record<Severity, { label: string; tone: string; rank: number }> = {
  high:   { label: 'Élevée',  tone: 'bg-red-50 text-red-700',       rank: 0 },
  medium: { label: 'Modérée', tone: 'bg-orange-50 text-orange-700', rank: 1 },
  low:    { label: 'Faible',  tone: 'bg-amber-50 text-amber-700',   rank: 2 },
}

function catLabel(cat: Category): string {
  return CATEGORY_LABELS.fr[cat] ?? cat
}

function alertsOf(c: CallWithBeneficiary): Alert[] {
  const a = (c as unknown as { alerts?: Alert[] | null }).alerts
  return Array.isArray(a) ? a : []
}

function isInbound(c: CallWithBeneficiary): boolean {
  return (c as unknown as { origin?: string }).origin === 'inbound'
}

function effectiveDate(c: CallWithBeneficiary): string {
  const x = c as unknown as { started_at?: string | null; notified_at?: string | null; scheduled_at: string }
  return x.started_at ?? x.notified_at ?? x.scheduled_at
}

function maxRank(c: CallWithBeneficiary): number {
  return Math.min(99, ...alertsOf(c).map((a) => SEVERITY_META[a.severity]?.rank ?? 99))
}

export function SignauxPage() {
  const { selected } = useSelectedBeneficiary()
  const { calls, loading } = useCalls(selected?.id)
  const [sevSel, setSevSel] = useState<Set<Severity>>(new Set())

  function toggleSev(s: Severity) {
    setSevSel((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const visible = useMemo(() => {
    let list = calls.filter((c) => alertsOf(c).length > 0)
    if (sevSel.size > 0) {
      list = list.filter((c) => alertsOf(c).some((a) => sevSel.has(a.severity)))
    }
    // Tri par date d'appel décroissante (plus récents en premier) ;
    // à date égale, le plus grave d'abord.
    return [...list].sort((a, b) => {
      const da = new Date(effectiveDate(a)).getTime()
      const db = new Date(effectiveDate(b)).getTime()
      if (da !== db) return db - da
      return maxRank(a) - maxRank(b)
    })
  }, [calls, sevSel])

  if (!selected) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <ShieldAlert size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">Sélectionnez un bénéficiaire pour voir ses signaux.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="font-title text-3xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert size={26} className="text-brique" /> Signaux
        </h1>
        <p className="text-slate-500 mt-1">
          Points d'attention détectés lors des conversations avec <strong>{selected.first_name}</strong>,
          les plus importants en tête.
        </p>
      </header>

      {/* Filtre de sévérité (multi-sélection) */}
      <div className="flex flex-wrap items-center gap-1 mb-5">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Sévérité</span>
        <SevPill active={sevSel.size === 0} onClick={() => setSevSel(new Set())}>Toutes</SevPill>
        {(['high', 'medium', 'low'] as Severity[]).map((s) => (
          <SevPill key={s} active={sevSel.has(s)} onClick={() => toggleSev(s)}>{SEVERITY_META[s].label}</SevPill>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {visible.map((c) => {
                const sortedAlerts = [...alertsOf(c)].sort(
                  (a, b) => (SEVERITY_META[a.severity]?.rank ?? 99) - (SEVERITY_META[b.severity]?.rank ?? 99),
                )
                return (
                  <tr key={c.id} className="hover:bg-creme/40 transition-colors align-top">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(effectiveDate(c)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        isInbound(c) ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isInbound(c) ? '📞 Émis' : 'Reçu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xl">
                      <div className="space-y-1.5">
                        {sortedAlerts.map((a, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${SEVERITY_META[a.severity]?.tone ?? 'bg-slate-100 text-slate-600'}`}>
                              <AlertTriangle size={11} /> {catLabel(a.category)} · {SEVERITY_META[a.severity]?.label ?? a.severity}
                            </span>
                            <span className="text-slate-600 text-xs italic">« {a.evidence} »</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/historique/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink size={12} /> Détail
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <ShieldAlert size={24} className="mx-auto mb-2 text-slate-300" />
                    {sevSel.size === 0
                      ? 'Aucun signal détecté pour l\'instant. 🎉'
                      : 'Aucun signal ne correspond à ce filtre.'}
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

function SevPill({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-accent-600 text-white' : 'bg-white border border-creme-sable text-slate-600 hover:bg-creme'
      }`}
    >
      {children}
    </button>
  )
}
