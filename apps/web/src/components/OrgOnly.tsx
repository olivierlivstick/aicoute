import { Navigate } from 'react-router-dom'
import { useAccountKind } from '@/hooks/useAccountKind'

/**
 * Garde-fou des pages /org/* : réservé aux comptes account_type='organization'.
 * Un admin est renvoyé vers son module /admin, un aidant « particulier » vers
 * son /dashboard. Doit être imbriqué SOUS <AuthGuard>.
 */
export function OrgOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, isOrganization, loading } = useAccountKind()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
        Vérification…
      </div>
    )
  }

  if (isAdmin) return <Navigate to="/admin" replace />
  if (!isOrganization) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
