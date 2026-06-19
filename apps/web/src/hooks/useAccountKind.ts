import { useAuth } from '@/hooks/useAuth'

/**
 * Décide quel back-office afficher selon le profil chargé.
 *
 * Trois familles de comptes :
 *  - `isAdmin`        : role === 'admin' (module /admin) — prioritaire sur tout.
 *  - `isOrganization` : account_type === 'organization' ET pas admin → dashboard
 *                       organisation (/org/*), centré campagnes d'appels en masse.
 *  - sinon            : aidant « particulier » (/dashboard, parcours actuel).
 *
 * `loading` reprend la sémantique de useIsAdmin : true tant qu'on n'a pas de
 * décision fiable (session présente mais profile pas encore arrivé), pour éviter
 * de flasher une mauvaise destination puis de rebondir.
 */
export function useAccountKind() {
  const { session, profile, loading } = useAuth()
  const profileNotYetLoaded = !!session && !profile
  const isAdmin = profile?.role === 'admin'
  return {
    isAdmin,
    isOrganization: !isAdmin && profile?.account_type === 'organization',
    loading: loading || profileNotYetLoaded,
  }
}
