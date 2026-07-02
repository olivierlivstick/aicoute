/**
 * Edge Function: create-billing-portal-session
 *
 * Ouvre le PORTAIL CLIENT Stripe pour l'aidant abonné (« Le contrôle ») :
 * factures/reçus, moyen de paiement, résiliation. C'est la façon standard de
 * gérer un abonnement récurrent (on ne stocke pas les factures nous-mêmes).
 *
 *  POST  → { url }   (redirection navigateur vers le portail)
 *
 * Public (verify_jwt = false) mais auth interne : on lit le JWT de l'appelant
 * pour l'identifier, puis on résout SON customer Stripe côté service-role
 * (jamais fourni par le client).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { getStripe, appUrl } from '../_shared/stripe.ts'

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

    // Abonnement vivant de ce compte.
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, stripe_customer_id, stripe_subscription_id')
      .eq('caregiver_id', caregiverId)
      .in('status', ['trial', 'active'])
      .not('stripe_subscription_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub) {
      return jsonResponse({ error: 'Aucun abonnement à gérer.' }, 404)
    }

    const stripe = getStripe()

    // Customer Stripe : stocké, sinon résolu depuis la subscription (et backfillé).
    let customerId: string | null = sub.stripe_customer_id
    if (!customerId && sub.stripe_subscription_id) {
      const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      customerId = typeof s.customer === 'string' ? s.customer : (s.customer?.id ?? null)
      if (customerId) {
        await admin.from('subscriptions').update({ stripe_customer_id: customerId }).eq('id', sub.id)
      }
    }
    if (!customerId) {
      return jsonResponse({ error: 'Client Stripe introuvable.' }, 404)
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/compte`,
    })

    return jsonResponse({ url: portal.url })
  } catch (err) {
    console.error('[create-billing-portal-session] Erreur:', err)
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
