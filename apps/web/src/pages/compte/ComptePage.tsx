import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, CreditCard, Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'

type Tab = 'profil' | 'abonnement' | 'factures'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'profil',     label: 'Mon profil',     icon: User },
  { id: 'abonnement', label: 'Mon abonnement', icon: CreditCard },
  { id: 'factures',   label: 'Mes factures',   icon: Receipt },
]

export function ComptePage() {
  const [tab, setTab] = useState<Tab>('profil')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-1">Mon compte</h1>
      <p className="text-slate-500 mb-6">Profil, abonnement et facturation</p>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
              tab === id
                ? 'text-primary'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon size={16} />
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'profil'     && <ProfilTab />}
      {tab === 'abonnement' && <ComingSoon title="Mon abonnement" description="Gestion de votre formule MODECT, paiement et résiliation. Disponible prochainement." />}
      {tab === 'factures'   && <ComingSoon title="Mes factures" description="Historique des paiements et téléchargement des factures. Disponible prochainement." />}
    </div>
  )
}

// --- Onglet Profil ---

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

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
      <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">{description}</p>
    </div>
  )
}
