import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, ShoppingBag, Wallet, Gift } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMinutesBalance } from '@/hooks/useMinutesBalance'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn, formatDate } from '@/lib/utils'
import type { MinutePurchase } from '@modect/shared'

type Tab = 'profil' | 'achats'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'profil', label: 'Mon profil', icon: User },
  { id: 'achats', label: 'Mes achats', icon: ShoppingBag },
]

export function ComptePage() {
  const [tab, setTab] = useState<Tab>('profil')
  const balance = useMinutesBalance()

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-1">Mon compte</h1>
      <p className="text-slate-500 mb-6">Profil et achats de minutes</p>

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
      {tab === 'achats' && <AchatsTab purchases={balance.purchases} loading={balance.loading} />}
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
// Onglet Mes achats
// ────────────────────────────────────────────────────────────────────────────

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function AchatsTab({ purchases, loading }: { purchases: MinutePurchase[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (purchases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <ShoppingBag size={40} className="mx-auto text-slate-200 mb-3" />
        <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">Aucun achat pour le moment</h2>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          Vos achats de packs de minutes apparaîtront ici. L'achat de packs sera disponible prochainement.
        </p>
      </div>
    )
  }

  const totalMinutes = purchases.reduce((s, p) => s + p.minutes, 0)
  const totalAmount = purchases.reduce((s, p) => s + p.amount_eur, 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
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
