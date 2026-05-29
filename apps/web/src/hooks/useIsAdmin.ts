import { useAuth } from '@/hooks/useAuth'

/**
 * Renvoie l'état admin courant.
 * - `isAdmin` : true si le rôle du profil chargé est 'admin'
 * - `loading` : true tant qu'on n'a pas de décision fiable. C'est-à-dire :
 *     - useAuth en chargement initial, OU
 *     - on a une session mais le profile n'est pas encore arrivé (fetch async
 *       séparé dans useAuth). Sans ce second cas, on flasherait isAdmin=false
 *       pendant ~100-300ms, ce qui provoque une redirection prématurée vers
 *       /dashboard suivie d'un rebond vers /admin une fois le profile chargé.
 */
export function useIsAdmin() {
  const { session, profile, loading } = useAuth()
  const profileNotYetLoaded = !!session && !profile
  return {
    isAdmin: profile?.role === 'admin',
    loading: loading || profileNotYetLoaded,
  }
}
