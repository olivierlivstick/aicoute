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
  getStripe, getPack, priceIdForPack, siteUrl, appUrl, APP_TAG,
} from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'méthode non autorisée' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))
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
