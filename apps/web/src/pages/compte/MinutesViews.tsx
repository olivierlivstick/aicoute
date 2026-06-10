// Vues PARTAGÉES du compte de minutes — utilisées par le back-office aidant
// (/compte) ET la fiche aidant côté admin (/admin/comptes/:id), pour garder
// les deux affichages toujours synchronisés (source unique de rendu).
import { Wallet, Gift, ShoppingBag, ScrollText } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { MinutePurchase } from '@modect/shared'
import type { LedgerEntry } from '@/hooks/useMinuteLedger'

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

interface BalanceLike {
  availableMinutes: number
  stockMinutes: number
  consumedMinutes: number
  purchasedMinutes: number
  trialMinutes: number
  adjustmentMinutes?: number
  loading: boolean
}

// ── Carte « Minutes disponibles » (offertes + achetées + crédits − consommé) ──
export function MinutesBalanceCard({ balance }: { balance: BalanceLike }) {
  const { availableMinutes, stockMinutes, consumedMinutes, purchasedMinutes, trialMinutes, adjustmentMinutes = 0, loading } = balance
  const shown = Math.max(0, availableMinutes)
  const valueColor =
    availableMinutes <= 0 ? 'text-brique' : availableMinutes < 10 ? 'text-accent-700' : 'text-brun-900'

  const parts: string[] = []
  if (trialMinutes > 0) parts.push(`${trialMinutes} essai`)
  if (purchasedMinutes > 0) parts.push(`${purchasedMinutes} achetées`)
  if (adjustmentMinutes > 0) parts.push(`${adjustmentMinutes} offertes`)

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-creme text-primary shrink-0">
            <Wallet size={22} />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Minutes disponibles</p>
            <p className={cn('font-title text-3xl font-bold leading-tight', valueColor)}>
              {loading ? '…' : `${shown} min`}
            </p>
          </div>
        </div>

        <div className="flex items-stretch gap-4 text-sm">
          <BalanceStat label="Stock" value={`${stockMinutes} min`} sub={parts.length ? parts.join(' · ') : undefined} />
          <div className="w-px bg-slate-100" />
          <BalanceStat label="Consommé" value={`${consumedMinutes} min`} sub="reçus + émis" />
        </div>
      </div>

      {!loading && adjustmentMinutes > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
          <Gift size={13} className="text-primary" /> {adjustmentMinutes} minutes offertes par l'équipe Aicoute.
        </p>
      )}
    </section>
  )
}

function BalanceStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-right">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
      <p className="text-lg font-semibold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Relevé de compte de minutes (crédit / débit / solde) ──
export function LedgerTable({ entries, loading }: { entries: LedgerEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <ScrollText size={40} className="mx-auto text-slate-200 mb-3" />
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">Aucune opération pour le moment</h2>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          Les achats de minutes et les appels apparaîtront ici, avec le solde mis à jour à chaque opération.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-1">Relevé du compte de minutes</h2>
      <p className="text-sm text-slate-500 mb-4">
        Crédits (achats, minutes offertes) et débits (appels reçus et émis), du plus récent au plus ancien.
        Chaque appel est compté à la minute supérieure.
      </p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="font-semibold px-2 py-2.5">Date</th>
              <th className="font-semibold px-2 py-2.5">Opération</th>
              <th className="font-semibold px-2 py-2.5 text-right">Crédit</th>
              <th className="font-semibold px-2 py-2.5 text-right">Débit</th>
              <th className="font-semibold px-2 py-2.5 text-right">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-creme/40 transition-colors">
                <td className="px-2 py-3 whitespace-nowrap text-slate-600">
                  {formatDate(e.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-2 py-3 text-slate-800">{e.label}</td>
                <td className="px-2 py-3 text-right tabular-nums font-medium text-sauge">
                  {e.credit > 0 ? `+${e.credit}` : ''}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-500">
                  {e.debit > 0 ? `−${e.debit}` : ''}
                </td>
                <td className={cn(
                  'px-2 py-3 text-right tabular-nums font-semibold',
                  e.balance < 0 ? 'text-brique' : 'text-brun-900',
                )}>
                  {e.balance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Historique des achats de minutes ──
export function PurchasesTable({ purchases, loading }: { purchases: MinutePurchase[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (purchases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <ShoppingBag size={36} className="mx-auto text-slate-200 mb-3" />
        <h2 className="font-title text-lg font-semibold text-slate-700 mb-1">Aucun achat pour le moment</h2>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          Les achats de packs de minutes apparaîtront ici.
        </p>
      </div>
    )
  }

  const totalMinutes = purchases.reduce((s, p) => s + p.minutes, 0)
  const totalAmount = purchases.reduce((s, p) => s + p.amount_eur, 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-4">Historique</h2>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="font-semibold px-2 py-2.5">Date</th>
              <th className="font-semibold px-2 py-2.5">Pack</th>
              <th className="font-semibold px-2 py-2.5 text-right">Minutes</th>
              <th className="font-semibold px-2 py-2.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-creme/40 transition-colors">
                <td className="px-2 py-3 whitespace-nowrap text-slate-600">
                  {formatDate(p.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-2 py-3 font-medium text-slate-800">{p.pack_name}</td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700">{p.minutes} min</td>
                <td className="px-2 py-3 text-right tabular-nums font-mono text-[13px] text-slate-700">{eur(p.amount_eur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-100 font-semibold text-brun-900">
              <td className="px-2 py-3" colSpan={2}>Total ({purchases.length} achat{purchases.length > 1 ? 's' : ''})</td>
              <td className="px-2 py-3 text-right tabular-nums">{totalMinutes} min</td>
              <td className="px-2 py-3 text-right tabular-nums font-mono text-[13px] text-primary">{eur(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
