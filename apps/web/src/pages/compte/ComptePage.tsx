import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, ShoppingBag, Ticket, Check, ScrollText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMinutesBalance } from '@/hooks/useMinutesBalance'
import { useMinuteLedger } from '@/hooks/useMinuteLedger'
import { useSubscription } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { startCheckout } from '@/lib/checkout'
import { supabase } from '@/lib/supabase'
import { MINUTE_PACKS, PLAN_TIERS, computeFullName, type MinutePurchase, type MinutePackId } from '@modect/shared'
import { AccountTypeToggle } from '@/components/AccountTypeToggle'
import { PhoneInput } from '@/components/PhoneInput'
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
  const { subscription } = useSubscription()
  // Un abonné « Le contrôle » ne gère pas de minutes → on masque la carte de solde.
  const isSubscriber = subscription?.plan_tier === 'controle'

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

      {!isSubscriber && <MinutesBalanceCard balance={balance} />}

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
  account_type: z.enum(['individual', 'organization']),
  company_name: z.string().optional(),
  first_name:   z.string().optional(),
  last_name:    z.string().optional(),
  phone:        z.string().optional(),
  timezone:     z.string().min(1),
  address_line: z.string().optional(),
  postal_code:  z.string().optional(),
  city:         z.string().optional(),
  country:      z.string().optional(),
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

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      account_type: profile?.account_type ?? 'individual',
      company_name: profile?.company_name ?? '',
      first_name:   profile?.first_name ?? '',
      last_name:    profile?.last_name ?? '',
      phone:        profile?.phone ?? '',
      timezone:     profile?.timezone ?? 'Europe/Paris',
      address_line: profile?.address_line ?? '',
      postal_code:  profile?.postal_code ?? '',
      city:         profile?.city ?? '',
      country:      profile?.country ?? 'France',
    },
  })

  const accountType = watch('account_type')
  const isOrg = accountType === 'organization'

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return
    const full_name = computeFullName({
      account_type: data.account_type,
      first_name:   data.first_name,
      last_name:    data.last_name,
      company_name: data.company_name,
    })
    const ok = await updateProfile(user.id, {
      account_type: data.account_type,
      full_name,
      first_name:   data.first_name || null,
      last_name:    data.last_name || null,
      company_name: data.account_type === 'organization' ? (data.company_name || null) : null,
      phone:        data.phone || null,
      timezone:     data.timezone,
      address_line: data.address_line || null,
      postal_code:  data.postal_code || null,
      city:         data.city || null,
      country:      data.country || null,
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
          <Label>Type de compte</Label>
          <AccountTypeToggle
            value={accountType}
            onChange={(v) => setValue('account_type', v, { shouldValidate: true })}
          />
        </div>

        <div>
          <Label>Adresse email</Label>
          <Input value={user?.email ?? ''} disabled className="opacity-60" />
          <p className="text-xs text-slate-400 mt-1">L'email ne peut pas être modifié ici.</p>
        </div>

        {isOrg && (
          <div>
            <Label htmlFor="company_name">Raison sociale</Label>
            <Input id="company_name" {...register('company_name')} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="first_name">{isOrg ? 'Prénom du contact' : 'Prénom'}</Label>
            <Input id="first_name" {...register('first_name')} />
          </div>
          <div>
            <Label htmlFor="last_name">{isOrg ? 'Nom du contact' : 'Nom'}</Label>
            <Input id="last_name" {...register('last_name')} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <PhoneInput id="phone" value={watch('phone')} onChange={(v) => setValue('phone', v)} />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Adresse</p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="address_line">Adresse</Label>
              <Input id="address_line" placeholder="12 rue des Lilas" {...register('address_line')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="postal_code">Code postal</Label>
                <Input id="postal_code" placeholder="75011" {...register('postal_code')} />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" placeholder="Paris" {...register('city')} />
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Input id="country" placeholder="France" {...register('country')} />
              </div>
            </div>
          </div>
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
  const { subscription, loading: subLoading } = useSubscription()

  if (subLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Abonné (« Le contrôle ») : les packs de minutes / codes n'ont pas de sens →
  // on ne montre que l'abonnement (+ l'historique de packs s'il en a exceptionnellement).
  const isSubscriber = subscription?.plan_tier === 'controle'

  return (
    <div className="space-y-6">
      {isSubscriber && subscription && <AbonnementCard subscription={subscription} />}
      {!isSubscriber && <BuyPacksCard />}
      {!isSubscriber && <RedeemCodeCard onRedeemed={onReload} />}
      {(!isSubscriber || purchases.length > 0) && <PurchasesTable purchases={purchases} loading={loading} />}
    </div>
  )
}

// ── Abonnement en cours (« Le contrôle ») — distinct des packs de minutes ──
// Un abonnement récurrent ne s'affiche pas dans l'historique des achats de packs
// (minute_purchases) : on le montre ici, avec un accès au portail Stripe pour les
// factures et la gestion (moyen de paiement, résiliation).
function AbonnementCard({ subscription }: { subscription: { plan_tier: string; created_at?: string } }) {
  const plan = PLAN_TIERS[subscription.plan_tier as keyof typeof PLAN_TIERS]
  const since = subscription.created_at
    ? new Date(subscription.created_at).toLocaleDateString('fr-FR')
    : null
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const openPortal = async () => {
    setPortalError(null)
    setPortalLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-billing-portal-session', {})
      if (invokeError) {
        const ctx = (invokeError as { context?: Response }).context
        let msg = 'Le portail de facturation est momentanément indisponible.'
        try { msg = (await ctx?.json())?.error ?? msg } catch { /* garde le défaut */ }
        throw new Error(msg)
      }
      const url = (data as { url?: string } | null)?.url
      if (!url) throw new Error('Réponse invalide du portail.')
      window.location.href = url
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Une erreur est survenue.')
      setPortalLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-3">Mon abonnement</h2>
      <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-creme/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-accent-700 font-semibold">{plan?.name}</p>
          <p className="mt-1 font-semibold text-slate-800">
            {plan?.priceEur} € <span className="text-sm font-normal text-slate-500">/ mois</span>
          </p>
          <p className="text-sm text-slate-500 mt-0.5">{plan?.tagline}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sauge/15 text-sauge text-xs font-semibold px-3 py-1">Actif</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={openPortal} loading={portalLoading}>
          Gérer mon abonnement · factures
        </Button>
        <p className="text-xs text-slate-400">
          {since && <>Souscrit le {since}. </>}Facturé chaque mois, ne consomme pas de minutes.
        </p>
      </div>
      {portalError && <p className="mt-2 text-sm text-brique">{portalError}</p>}
    </section>
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
