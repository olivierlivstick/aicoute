/**
 * Edge Function: claim-control-subscription
 *
 * Rattache un abonnement « Le contrôle » (payé en invité, retenu dans
 * pending_control_subscriptions) au compte aidant fraîchement créé, puis pose la
 * ligne subscriptions (plan_tier='controle', active) qui marque le compte comme
 * abonné.
 *
 *  POST { session_id?: cs_... }  → { ok: true, claimed: boolean }
 *
 * Public (verify_jwt = false) mais auth interne : on lit le JWT de l'appelant
 * (joint par supabase.functions.invoke) pour l'identifier. Rattachement en
 * service-role (le client n'a aucun droit d'écriture).
 *
 * Rattachement par `session_id` en priorité ; à défaut (session_id perdu, ex.
 * inscription depuis un autre navigateur) repli sur l'email du compte. Claim
 * ATOMIQUE : UPDATE … WHERE status='pending' RETURNING → pas de double-crédit.
 * Idempotent : rappelé sans abonnement en attente → { ok: true, claimed: false }.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { PLAN_CONTROLE_MAX_CALLS } from './constants.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'méthode non autorisée' }, 405)
  }

  try {
    const admin = getSupabaseAdmin()

    // Identification de l'appelant.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return jsonResponse({ error: 'Connexion requise.' }, 401)
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Session invalide.' }, 401)
    }
    const caregiverId = userData.user.id
    const userEmail = (userData.user.email ?? '').trim().toLowerCase()

    const body = await req.json().catch(() => ({}))
    const sessionId = String(body?.session_id ?? '').trim()

    // Retrouver l'abonnement en attente : par session_id sinon par email.
    let pendingId: string | null = null
    let stripeCustomerId: string | null = null
    let stripeSubscriptionId: string | null = null

    if (sessionId.startsWith('cs_')) {
      const { data } = await admin
        .from('pending_control_subscriptions')
        .select('id, stripe_customer_id, stripe_subscription_id, status')
        .eq('stripe_session_id', sessionId)
        .maybeSingle()
      if (data && data.status === 'pending') {
        pendingId = data.id
        stripeCustomerId = data.stripe_customer_id
        stripeSubscriptionId = data.stripe_subscription_id
      } else if (data && data.status === 'claimed') {
        // Déjà rattaché (rejeu) → succès idempotent.
        return jsonResponse({ ok: true, claimed: false })
      }
    }

    if (!pendingId && userEmail) {
      const { data } = await admin
        .from('pending_control_subscriptions')
        .select('id, stripe_customer_id, stripe_subscription_id')
        .eq('status', 'pending')
        .ilike('buyer_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        pendingId = data.id
        stripeCustomerId = data.stripe_customer_id
        stripeSubscriptionId = data.stripe_subscription_id
      }
    }

    if (!pendingId) {
      // Rien à rattacher : soit déjà fait, soit pas d'abonnement pour ce compte.
      return jsonResponse({ ok: true, claimed: false })
    }

    // Claim atomique : on ne « consomme » que si encore pending.
    const { data: claimed, error: claimErr } = await admin
      .from('pending_control_subscriptions')
      .update({
        status:       'claimed',
        caregiver_id: caregiverId,
        claimed_at:   new Date().toISOString(),
      })
      .eq('id', pendingId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (claimErr) throw new Error(`claim pending: ${claimErr.message}`)
    if (!claimed) {
      // Course : un autre appel a gagné → succès idempotent.
      return jsonResponse({ ok: true, claimed: false })
    }

    // Pose du marqueur d'abonnement sur le compte. Un seul abonnement « vivant »
    // par compte (index unique partiel) : si une ligne trial/active existe déjà,
    // on la bascule sur 'controle' au lieu d'insérer.
    // Si CETTE étape échoue, on ROUVRE l'attente (retour à 'pending') pour qu'un
    // prochain chargement puisse réessayer — sinon le compte resterait abonné
    // sans ligne subscriptions (l'attente déjà 'claimed' bloquerait toute reprise).
    try {
      const subRow = {
        plan_tier:              'controle',
        status:                 'active',
        max_calls_per_week:     PLAN_CONTROLE_MAX_CALLS,
        stripe_customer_id:     stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      }
      const { error: insErr } = await admin.from('subscriptions').insert({
        caregiver_id: caregiverId,
        ...subRow,
      })
      if (insErr) {
        if (insErr.code === '23505') {
          // Abonnement vivant déjà présent → on le bascule sur « Le contrôle ».
          const { error: updErr } = await admin
            .from('subscriptions')
            .update(subRow)
            .eq('caregiver_id', caregiverId)
            .in('status', ['trial', 'active'])
          if (updErr) throw new Error(`update subscription: ${updErr.message}`)
        } else {
          throw new Error(`insert subscription: ${insErr.message}`)
        }
      }
    } catch (subErr) {
      await admin
        .from('pending_control_subscriptions')
        .update({ status: 'pending', caregiver_id: null, claimed_at: null })
        .eq('id', pendingId)
      throw subErr
    }

    console.log(`[claim-control-subscription] abonnement rattaché → ${caregiverId}`)
    return jsonResponse({ ok: true, claimed: true })
  } catch (err) {
    console.error('[claim-control-subscription] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
