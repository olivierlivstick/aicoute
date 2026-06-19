import { Navigate } from 'react-router-dom'
import { useAccountKind } from '@/hooks/useAccountKind'

/**
 * Symétrique de <RequireAdmin> : redirige les comptes qui n'ont rien à faire sur
 * le parcours aidant « particulier » vers leur module dédié — admin → /admin,
 * organisation → /org. Un admin n'a pas de bénéficiaire propre, une organisation
 * a son propre dashboard (campagnes).
 *
 * Doit être imbriqué SOUS <AuthGuard>.
 */
export function AidantOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, isOrganization, loading } = useAccountKind()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
        Vérification…
      </div>
    )
  }

  if (isAdmin) return <Navigate to="/admin" replace />
  if (isOrganization) return <Navigate to="/org/campagnes" replace />

  return <>{children}</>
}
