import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, ShoppingBag, Ticket, Check, ScrollText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMinutesBalance } from '@/hooks/useMinutesBalance'
import { useMinuteLedger } from '@/hooks/useMinuteLedger'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { startCheckout } from '@/lib/checkout'
import { supabase } from '@/lib/supabase'
import { MINUTE_PACKS, type MinutePurchase, type MinutePackId } from '@modect/shared'
import { MinutesBalanceCard, LedgerTable, PurchasesTable } from '@/pages/compte/MinutesViews'

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
  // Le crédit se fait via webhook (asynchrone) → on ouvre l'onglet solde et on
  // rafraîchit quelques secondes plus tard, puis on nettoie l'URL.
  useEffect(() => {
    const achat = new URLSearchParams(window.location.search).get('achat')
    if (achat !== 'ok' && achat !== 'annule') return
    setPurchaseBanner(achat)
    if (achat === 'ok') {
      setTab('solde')
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
// Onglet Mon solde — relevé (vue partagée)
// ────────────────────────────────────────────────────────────────────────────

function SoldeTab() {
  const { entries, loading } = useMinuteLedger()
  return <LedgerTable entries={entries} loading={loading} />
}

// ────────────────────────────────────────────────────────────────────────────
// Onglet Mes achats — acheter + créditer un code + historique
// ────────────────────────────────────────────────────────────────────────────

function AchatsTab({ purchases, loading, onReload }: { purchases: MinutePurchase[]; loading: boolean; onReload: () => void }) {
  return (
    <div className="space-y-6">
      <BuyPacksCard />
      <RedeemCodeCard onRedeemed={onReload} />
      <PurchasesTable purchases={purchases} loading={loading} />
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
