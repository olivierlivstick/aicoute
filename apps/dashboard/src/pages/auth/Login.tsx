import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, password }: FormData) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setServerError('Email ou mot de passe incorrect.')
      return
    }
    navigate(from, { replace: true })
  }

  const handleMagicLink = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value
    if (!email) {
      setServerError('Entrez votre email pour recevoir un lien de connexion.')
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      setServerError(error.message)
    } else {
      setServerError(null)
      alert(`Lien de connexion envoyé à ${email} !`)
    }
  }

  return (
    <AuthLayout title="Connexion" subtitle="Bienvenue sur votre espace aidant">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              to="/auth/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Se connecter
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-3">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleMagicLink}
        >
          Recevoir un lien de connexion par email
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link to="/auth/register" className="text-primary font-semibold hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  )
}
