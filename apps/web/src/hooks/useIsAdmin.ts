import { useAuth } from '@/hooks/useAuth'

/**
 * Renvoie l'état admin courant.
 * - `isAdmin` : true si le rôle du profil chargé est 'admin'
 * - `loading` : true tant que la session ou le profil sont en cours de chargement
 *               (utile pour ne pas flasher une redirection trop tôt)
 */
export function useIsAdmin() {
  const { profile, loading } = useAuth()
  return {
    isAdmin: profile?.role === 'admin',
    loading,
  }
}
