import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, ShoppingBag, Wallet, Gift, Ticket, Check, ScrollText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMinutesBalance } from '@/hooks/useMinutesBalance'
import { useMinuteLedger, type LedgerEntry } from '@/hooks/useMinuteLedger'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn, formatDate } from '@/lib/utils'
import { startCheckout } from '@/lib/checkout'
import { supabase } from '@/lib/supabase'
import { MINUTE_PACKS, type MinutePurchase, type MinutePackId } from '@modect/shared'

type Tab = 'profil' | 'solde' | 'achats'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'profil', label: 'Mon profil', icon: User },
  { id: 'solde',  label: 'Mon solde', icon: ScrollText },
  { id: 'achats', label: 'Mes achats', icon: ShoppingBag },
]

export function ComptePage() {
  const [tab, setTab] = useState<Tab>('profil')
  const [purchaseBanner, setPurchaseBanner] = useState<'ok' | 'annule' | null>(null)
  const balance = useMinutesBalance()

  // Retour depuis Stripe (achat direct connecté) : ?achat=ok|annule.
  // Le crédit se fait via webhook (asynchrone) → on ouvre l'onglet achats et on
  // rafraîchit le solde quelques secondes plus tard, puis on nettoie l'URL.
  useEffect(() => {
    const achat = new URLSearchParams(window.location.search).get('achat')
    if (achat !== 'ok' && achat !== 'annule') return
    setPurchaseBanner(achat)
    if (achat === 'ok') {
      setTab('achats')
      const t1 = setTimeout(() => balance.reload(), 3000)
      const t2 = setTimeout(() => balance.reload(), 8000)
      window.history.replaceState({}, '', '/compte')
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    window.history.replaceState({}, '', '/compte')
  }, [])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-1">Mon compte</h1>
      <p className="text-slate-500 mb-6">Profil et achats de minutes</p>

      {purchaseBanner === 'ok' && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-sauge/10 border border-sauge/30 px-4 py-3 text-sm text-sauge">
          <Check size={18} className="mt-0.5 shrink-0" />
          <span>Paiement confirmé ! Vos minutes sont créditées (le solde se met à jour dans un instant).</span>
        </div>
      )}
      {purchaseBanner === 'annule' && (
        <div className="mb-6 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Paiement annulé — aucune somme n'a été débitée.
        </div>
      )}

      <MinutesBalanceCard balance={balance} />

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
              tab === id ? 'text-primary' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={16} />
            {label}
            {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {tab === 'profil' && <ProfilTab />}
      {tab === 'solde' && <SoldeTab />}
      {tab === 'achats' && (
        <AchatsTab purchases={balance.purchases} loading={balance.loading} onReload={balance.reload} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Carte « Minutes disponibles » (stock acheté + offert − consommé)
// ────────────────────────────────────────────────────────────────────────────

function MinutesBalanceCard({ balance }: { balance: ReturnType<typeof useMinutesBalance> }) {
  const { availableMinutes, stockMinutes, consumedMinutes, purchasedMinutes, trialMinutes, loading } = balance
  const shown = Math.max(0, availableMinutes)
  const valueColor =
    availableMinutes <= 0 ? 'text-brique' : availableMinutes < 10 ? 'text-accent-700' : 'text-brun-900'

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
          <BalanceStat
            label="Stock"
            value={`${stockMinutes} min`}
            sub={trialMinutes > 0 ? `dont ${trialMinutes} offertes` : purchasedMinutes > 0 ? `${purchasedMinutes} achetées` : undefined}
          />
          <div className="w-px bg-slate-100" />
          <BalanceStat label="Consommé" value={`${consumedMinutes} min`} sub="reçus + émis" />
        </div>
      </div>

      {!loading && trialMinutes > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
          <Gift size={13} className="text-primary" /> {trialMinutes} minutes offertes pendant l'essai gratuit.
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

// ────────────────────────────────────────────────────────────────────────────
// Onglet Profil
// ────────────────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z.string().min(2, 'Prénom et nom requis'),
  phone:     z.string().optional(),
  timezone:  z.string().min(1),
})

type ProfileForm = z.infer<typeof profileSchema>

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Brussels',
  'America/Montreal', 'America/New_York',
]

function ProfilTab() {
  const { profile, user } = useAuth()
  const { updateProfile, loading, error } = useProfile()
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? '',
      phone:     profile?.phone ?? '',
      timezone:  profile?.timezone ?? 'Europe/Paris',
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return
    const ok = await updateProfile(user.id, {
      full_name: data.full_name,
      phone:     data.phone || null,
      timezone:  data.timezone,
    })
    if (ok) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-5">Informations personnelles</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label>Adresse email</Label>
          <Input value={user?.email ?? ''} disabled className="opacity-60" />
          <p className="text-xs text-slate-400 mt-1">L'email ne peut pas être modifié ici.</p>
        </div>

        <div>
          <Label htmlFor="full_name">Prénom et nom</Label>
          <Input id="full_name" error={errors.full_name?.message} {...register('full_name')} />
        </div>

        <div>
          <Label htmlFor="phone">Téléphone (optionnel)</Label>
          <Input id="phone" type="tel" placeholder="+33 6 00 00 00 00" {...register('phone')} />
        </div>

        <div>
          <Label htmlFor="timezone">Fuseau horaire</Label>
          <select
            id="timezone"
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-body text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            {...register('timezone')}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {success && (
          <p className="text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-2">
            ✓ Modifications enregistrées
          </p>
        )}
        {error && (
          <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" loading={loading}>Enregistrer</Button>
      </form>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Onglet Mon solde — relevé de compte de minutes (crédit / débit / solde)
// ────────────────────────────────────────────────────────────────────────────

function SoldeTab() {
  const { entries, loading } = useMinuteLedger()

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
          Vos achats de minutes et vos appels apparaîtront ici, avec le solde mis à jour à chaque opération.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-1">Relevé de mon compte de minutes</h2>
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
            {entries.map((e: LedgerEntry) => (
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

// ────────────────────────────────────────────────────────────────────────────
// Onglet Mes achats
// ────────────────────────────────────────────────────────────────────────────

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function AchatsTab({ purchases, loading, onReload }: { purchases: MinutePurchase[]; loading: boolean; onReload: () => void }) {
  return (
    <div className="space-y-6">
      <BuyPacksCard />
      <RedeemCodeCard onRedeemed={onReload} />
      <PurchasesHistory purchases={purchases} loading={loading} />
    </div>
  )
}

// ── Acheter des minutes (packs → Stripe Checkout, crédit direct au retour) ──
function BuyPacksCard() {
  const [loadingId, setLoadingId] = useState<MinutePackId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buy = async (id: MinutePackId) => {
    setError(null)
    setLoadingId(id)
    try {
      await startCheckout(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le paiement n’a pas pu démarrer.')
      setLoadingId(null)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-1">Acheter des minutes</h2>
      <p className="text-sm text-slate-500 mb-5">Paiement sécurisé par Stripe. Vos minutes sont créditées aussitôt.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {MINUTE_PACKS.map((p) => (
          <div
            key={p.id}
            className={cn(
              'rounded-xl border p-4 flex flex-col',
              p.featured ? 'border-primary/60 bg-creme/40' : 'border-slate-200',
            )}
          >
            <p className="text-xs uppercase tracking-wider text-accent-700 font-semibold">{p.name}</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-title text-3xl font-bold text-brun-900">{p.minutes}</span>
              <span className="text-sm text-slate-500">min</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-semibold text-slate-800">{p.price} €</span>
              {p.saving && (
                <span className="text-[11px] font-semibold text-accent-700 bg-accent-50 rounded-full px-2 py-0.5">{p.saving}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{p.perMinute}</p>
            <Button
              type="button"
              className="mt-4 w-full"
              variant={p.featured ? 'primary' : 'ghost'}
              loading={loadingId === p.id}
              disabled={loadingId !== null}
              onClick={() => buy(p.id)}
            >
              Acheter
            </Button>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-brique">{error}</p>}
    </section>
  )
}

// ── Créditer un code d'achat (acheté en invité depuis la vitrine) ──
function RedeemCodeCard({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('redeem-code', {
        body: { code: trimmed },
      })
      if (invokeError) {
        // Le message métier (code déjà utilisé / invalide) est dans la réponse.
        const ctx = (invokeError as { context?: Response }).context
        let msg = 'Ce code n’a pas pu être crédité.'
        try { msg = (await ctx?.json())?.error ?? msg } catch { /* garde le message par défaut */ }
        throw new Error(msg)
      }
      const res = data as { ok?: boolean; minutes?: number; error?: string }
      if (!res?.ok) throw new Error(res?.error ?? 'Ce code n’a pas pu être crédité.')
      setSuccess(`${res.minutes} minutes créditées 🎉`)
      setCode('')
      onRedeemed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="flex items-center gap-2 font-semibold text-slate-700 mb-1">
        <Ticket size={18} className="text-primary" /> J'ai un code
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Vous avez reçu un code d'activation par email après un achat ? Saisissez-le ici pour créditer vos minutes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-xl">
        <div className="flex-1">
          <Label htmlFor="code">Code d'activation</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="AICOUTE-XXXX-XXXX"
            className="font-mono uppercase tracking-wider"
            autoComplete="off"
          />
        </div>
        <Button type="button" onClick={submit} loading={loading} disabled={!code.trim()}>
          Créditer
        </Button>
      </div>
      {success && <p className="mt-3 text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-2">{success}</p>}
      {error && <p className="mt-3 text-sm text-brique bg-brique/10 rounded-lg px-3 py-2">{error}</p>}
    </section>
  )
}

// ── Historique des achats ──
function PurchasesHistory({ purchases, loading }: { purchases: MinutePurchase[]; loading: boolean }) {
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
          Vos achats de packs de minutes apparaîtront ici.
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
