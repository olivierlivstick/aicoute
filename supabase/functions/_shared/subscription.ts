/**
 * Helpers abonnement côté Edge (service-role).
 *
 * - markServiceStarted : pose service_started_at (= date du 1er appel) + la fin
 *   d'essai (trial_ends_at = +1 mois) une seule fois, au premier appel réel.
 * - evaluateSubscriptionForCall : verdict avant de déclencher un appel planifié.
 *   Grandfathering : un compte SANS abonnement (créé avant la feature) reste
 *   autorisé. Un essai expiré bascule en 'expired' (paywall).
 */

// deno-lint-ignore no-explicit-any
type Supabase = any

/** Écrit service_started_at + trial_ends_at (+1 mois) si pas encore fait. Best-effort. */
export async function markServiceStarted(supabase: Supabase, caregiverId: string): Promise<void> {
  if (!caregiverId) return
  const now = new Date()
  const trialEnds = new Date(now)
  trialEnds.setMonth(trialEnds.getMonth() + 1)   // 1 mois calendaire
  try {
    await supabase
      .from('subscriptions')
      .update({
        service_started_at: now.toISOString(),
        trial_ends_at:      trialEnds.toISOString(),
        updated_at:         now.toISOString(),
      })
      .eq('caregiver_id', caregiverId)
      .is('service_started_at', null)
      .in('status', ['trial', 'active'])
  } catch (err) {
    console.error('[subscription] markServiceStarted failed:', err)
  }
}

export type SubVerdict = 'ok' | 'blocked' | 'just_expired'

/**
 * Décide si un appel peut être déclenché pour ce compte aidant.
 *  - 'ok'           : aucun abonnement (grandfather) OU essai/actif valide.
 *  - 'blocked'      : abonnement déjà expiré/annulé.
 *  - 'just_expired' : essai qui vient d'expirer → bascule en 'expired' ici
 *                     (l'appelant pause le planning + prévient l'aidant).
 */
export async function evaluateSubscriptionForCall(
  supabase: Supabase,
  caregiverId: string,
): Promise<SubVerdict> {
  if (!caregiverId) return 'ok'
  const { data } = await supabase
    .from('subscriptions')
    .select('id, status, trial_ends_at')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return 'ok'                                   // grandfather
  if (data.status === 'expired' || data.status === 'canceled') return 'blocked'

  if (
    data.status === 'trial' &&
    data.trial_ends_at &&
    new Date(data.trial_ends_at).getTime() < Date.now()
  ) {
    await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return 'just_expired'
  }
  return 'ok'
}
