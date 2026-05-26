import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'

const schema = z
  .object({
    full_name: z.string().min(2, 'Prénom et nom requis'),
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm_password'],
  })

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ full_name, email, password }: FormData) => {
    setServerError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, role: 'caregiver' },
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
      subtitle="Rejoignez MODECT pour veiller sur vos proches"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="full_name">Votre prénom et nom</Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="Marie Dupont"
            error={errors.full_name?.message}
            {...register('full_name')}
          />
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
