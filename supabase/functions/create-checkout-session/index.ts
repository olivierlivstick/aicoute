/**
 * Edge Function: create-checkout-session
 *
 * Crée une session Stripe Checkout (paiement UNIQUE) pour l'achat d'un pack de
 * minutes, et renvoie l'URL de redirection.
 *
 *  POST { pack_id }  → { url }
 *
 * Public (verify_jwt = false) : appelée depuis la vitrine sans authentification
 * (paiement invité). MAIS si l'appelant est connecté, le client supabase joint
 * son JWT → on l'identifie et on met `caregiver_id` dans les metadata : le
 * webhook créditera alors directement le compte (sans passer par un code).
 *
 * Le pack (minutes / montant / Price ID) vient TOUJOURS du catalogue serveur
 * (_shared/stripe.ts), jamais du client.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import {
  getStripe, getPack, priceIdForPack, controlPriceId, siteUrl, appUrl, APP_TAG,
} from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'méthode non autorisée' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))

    // ── Abonnement « Le contrôle » (RÉCURRENT) — parcours paiement-d'abord ──
    // Le compte n'existe pas encore : après paiement, retour vers l'inscription
    // pré-remplie (le session_id sert de clé de rattachement, cf.
    // claim-control-subscription). On ne rattache donc PAS de caregiver ici.
    if (body?.plan === 'controle') {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: controlPriceId(), quantity: 1 }],
        locale: 'fr',
        success_url: `${appUrl()}/auth/register?sub={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}/#tarifs`,
        metadata: { app: APP_TAG, plan: 'controle' },
        // Le tag est aussi porté sur la subscription (utile pour un futur webhook
        // d'événements d'abonnement dans le compte Stripe partagé).
        subscription_data: { metadata: { app: APP_TAG, plan: 'controle' } },
      })
      return jsonResponse({ url: session.url })
    }

    const pack = getPack(body?.pack_id)
    if (!pack) {
      return jsonResponse({ error: 'Pack inconnu.' }, 400)
    }

    // Identification facultative de l'appelant (achat depuis le back-office).
    const admin = getSupabaseAdmin()
    let caregiverId: string | null = null
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (token) {
      const { data } = await admin.auth.getUser(token)
      caregiverId = data?.user?.id ?? null
    }

    const stripe = getStripe()
    const price = priceIdForPack(pack)

    // Connecté → retour back-office (crédit direct) ; invité → page publique qui
    // affichera le code (le webhook le génère à la confirmation du paiement).
    const successUrl = caregiverId
      ? `${appUrl()}/compte?achat=ok`
      : `${siteUrl()}/achat/merci?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = caregiverId
      ? `${appUrl()}/compte?achat=annule`
      : `${siteUrl()}/#tarifs`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      locale: 'fr',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        app: APP_TAG,
        pack_id: pack.id,
        ...(caregiverId ? { caregiver_id: caregiverId } : {}),
      },
    })

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Erreur:', err)
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
