import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'

/**
 * Symétrique de <RequireAdmin> : redirige les comptes admin vers leur module
 * dédié /admin pour éviter de leur afficher la navigation aidant (qui n'a pas
 * de sens — un admin n'a pas de bénéficiaire propre).
 *
 * Doit être imbriqué SOUS <AuthGuard>.
 */
export function AidantOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
        Vérification…
      </div>
    )
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
