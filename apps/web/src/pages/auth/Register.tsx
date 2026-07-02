import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { computeFullName } from '@modect/shared'
import { AuthLayout } from '@/components/AuthLayout'
import { AccountTypeToggle } from '@/components/AccountTypeToggle'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { storePendingControl, fetchControlCheckoutEmail } from '@/lib/controlSubscription'

const schema = z
  .object({
    account_type: z.enum(['individual', 'organization']),
    company_name: z.string().optional(),
    first_name: z.string().min(2, 'Prénom requis'),
    last_name: z.string().min(2, 'Nom requis'),
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm_password'],
  })
  .refine(
    (d) => d.account_type !== 'organization' || (d.company_name?.trim().length ?? 0) >= 2,
    { message: 'Raison sociale requise', path: ['company_name'] },
  )

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Abonnement « Le contrôle » en attente (parcours paiement-d'abord) : présent
  // quand on arrive depuis Stripe (/auth/register?sub=cs_…).
  const [fromControl, setFromControl] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { account_type: 'individual' },
  })

  const accountType = watch('account_type')
  const isOrg = accountType === 'organization'

  // Retour du paiement Stripe : mémoriser le session_id (pour le rattachement
  // après confirmation d'email) et pré-remplir l'email de l'acheteur.
  useEffect(() => {
    const sub = new URLSearchParams(window.location.search).get('sub')
    if (!sub || !sub.startsWith('cs_')) return
    setFromControl(true)
    storePendingControl(sub)
    void fetchControlCheckoutEmail(sub).then((email) => {
      if (email) setValue('email', email)
    })
  }, [setValue])

  const onSubmit = async ({ account_type, company_name, first_name, last_name, email, password }: FormData) => {
    setServerError(null)
    const full_name = computeFullName({ account_type, first_name, last_name, company_name })
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role: 'caregiver',
          account_type,
          first_name,
          last_name,
          company_name: account_type === 'organization' ? company_name : null,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <AuthLayout title="Vérifiez votre email">
        <div className="text-center space-y-4">
          <div className="text-5xl">📬</div>
          <p className="text-slate-600">
            Un email de confirmation a été envoyé. Cliquez sur le lien pour activer votre compte.
          </p>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/auth/login')}>
            Retour à la connexion
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez Aicoute pour veiller sur vos proches"
    >
      {fromControl && (
        <div className="mb-5 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">Paiement confirmé 🎉</p>
          <p className="mt-0.5">
            Votre abonnement <strong>Le contrôle</strong> est réglé. Créez votre
            compte pour l'activer — les appels quotidiens se configureront à
            l'ajout de votre proche.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label>Vous êtes…</Label>
          <AccountTypeToggle
            value={accountType}
            onChange={(v) => setValue('account_type', v, { shouldValidate: true })}
          />
        </div>

        {isOrg && (
          <div>
            <Label htmlFor="company_name">Raison sociale</Label>
            <Input
              id="company_name"
              type="text"
              autoComplete="organization"
              placeholder="Résidence Les Tilleuls"
              error={errors.company_name?.message}
              {...register('company_name')}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="first_name">{isOrg ? 'Prénom du contact' : 'Prénom'}</Label>
            <Input
              id="first_name"
              type="text"
              autoComplete="given-name"
              placeholder="Marie"
              error={errors.first_name?.message}
              {...register('first_name')}
            />
          </div>
          <div>
            <Label htmlFor="last_name">{isOrg ? 'Nom du contact' : 'Nom'}</Label>
            <Input
              id="last_name"
              type="text"
              autoComplete="family-name"
              placeholder="Dupont"
              error={errors.last_name?.message}
              {...register('last_name')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 8 caractères"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div>
          <Label htmlFor="confirm_password">Confirmer le mot de passe</Label>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <p className="text-xs text-slate-400 leading-relaxed">
          En créant un compte, vous acceptez nos{' '}
          <a href="#" className="underline">conditions d'utilisation</a> et notre{' '}
          <a href="#" className="underline">politique de confidentialité</a> (RGPD).
        </p>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <Link to="/auth/login" className="text-primary font-semibold hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  )
}
