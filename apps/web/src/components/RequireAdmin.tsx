import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'

/**
 * Garde-fou pour les routes /admin/*. Doit être imbriqué SOUS <AuthGuard> (qui
 * garantit déjà qu'on a une session), donc on n'a qu'à vérifier le rôle.
 *
 * Pendant le chargement du profil on rend un placeholder discret plutôt que de
 * rediriger trop tôt (sinon un admin connecté serait kické vers /dashboard
 * pendant la fraction de seconde où profile est encore null).
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
        Vérification…
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
