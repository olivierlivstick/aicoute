import { supabase } from '@/lib/supabase'

/**
 * Abonnement « Le contrôle » — parcours paiement-d'abord.
 *
 * Après le paiement Stripe, l'utilisateur atterrit sur /auth/register?sub=cs_…
 * L'inscription mémorise ce `session_id` en localStorage (il doit survivre à la
 * confirmation d'email, qui déconnecte puis reconnecte). Une fois le compte
 * authentifié (retour sur l'app), on rattache l'abonnement au compte via
 * l'Edge claim-control-subscription, puis on efface le jeton.
 */

const PENDING_CONTROL_KEY = 'aicoute.pending_control_sub'

export function storePendingControl(sessionId: string): void {
  try {
    if (sessionId.startsWith('cs_')) localStorage.setItem(PENDING_CONTROL_KEY, sessionId)
  } catch { /* localStorage indisponible */ }
}

export function getPendingControl(): string | null {
  try {
    return localStorage.getItem(PENDING_CONTROL_KEY)
  } catch {
    return null
  }
}

export function clearPendingControl(): void {
  try {
    localStorage.removeItem(PENDING_CONTROL_KEY)
  } catch { /* localStorage indisponible */ }
}

/**
 * Récupère l'email acheteur d'une session Stripe pour pré-remplir l'inscription.
 * Renvoie null tant que le webhook n'a pas retenu la session (ou en cas d'échec).
 */
export async function fetchControlCheckoutEmail(sessionId: string): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke('get-control-checkout', {
      body: { session_id: sessionId },
    })
    const res = data as { status?: string; email?: string | null } | null
    return res?.status === 'ready' ? (res.email ?? null) : null
  } catch {
    return null
  }
}

/**
 * Rattache l'abonnement en attente (jeton localStorage) au compte connecté.
 * Idempotent et best-effort : efface le jeton dès qu'il n'y a plus rien à
 * rattacher (rattaché, ou aucun abonnement pour ce compte). Renvoie true si un
 * abonnement a effectivement été rattaché lors de cet appel.
 */
export async function claimPendingControl(): Promise<boolean> {
  const sessionId = getPendingControl()
  if (!sessionId) return false
  try {
    const { data, error } = await supabase.functions.invoke('claim-control-subscription', {
      body: { session_id: sessionId },
    })
    if (error) return false  // on retentera au prochain chargement
    // ok:true → plus rien en attente (rattaché ou déjà fait) : on efface le jeton.
    clearPendingControl()
    return (data as { claimed?: boolean } | null)?.claimed === true
  } catch {
    return false
  }
}
