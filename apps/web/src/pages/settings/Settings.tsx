import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

const schema = z.object({
  full_name: z.string().min(2, 'Prénom et nom requis'),
  phone: z.string().optional(),
  timezone: z.string().min(1),
})

type FormData = z.infer<typeof schema>

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Brussels',
  'America/Montreal',
  'America/New_York',
]

export function SettingsPage() {
  const { profile, user } = useAuth()
  const { updateProfile, loading } = useProfile()
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      timezone: profile?.timezone ?? 'Europe/Paris',
    },
  })

  const onSubmit = async (data: FormData) => {
    if (!user) return
    const ok = await updateProfile(user.id, {
      full_name: data.full_name,
      phone: data.phone || null,
      timezone: data.timezone,
    })
    if (ok) setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-1">Paramètres</h1>
      <p className="text-slate-500 mb-8">Gérez votre compte et vos préférences</p>

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
            <Input
              id="full_name"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
          </div>

          <div>
            <Label htmlFor="phone">Téléphone (optionnel)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+33 6 00 00 00 00"
              {...register('phone')}
            />
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
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              ✓ Modifications enregistrées
            </p>
          )}

          <Button type="submit" loading={loading}>
            Enregistrer
          </Button>
        </form>
      </div>
    </div>
  )
}
