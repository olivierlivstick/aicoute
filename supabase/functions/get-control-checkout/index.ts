/**
 * Edge Function: get-control-checkout
 *
 * Renvoie l'email acheteur d'une session Stripe d'abonnement « Le contrôle »,
 * pour pré-remplir le formulaire d'inscription (parcours paiement-d'abord).
 *
 *  POST { session_id: cs_... }
 *    → { status: 'ready', email }         quand le webhook a retenu la session
 *    → { status: 'pending' }              tant que le webhook n'est pas passé
 *
 * Public (verify_jwt = false) : le `session_id` Stripe (cs_…) est long et non
 * devinable → il fait office de secret. On ne renvoie QUE l'email (pré-remplissage),
 * jamais les ids Stripe ni l'état de rattachement.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    let sessionId = url.searchParams.get('session_id')?.trim() ?? ''
    if (!sessionId && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      sessionId = String(body?.session_id ?? '').trim()
    }
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return jsonResponse({ error: 'session_id invalide' }, 400)
    }

    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('pending_control_subscriptions')
      .select('buyer_email')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()

    if (!data) {
      // Webhook pas encore arrivé → l'inscription réessaie (ou l'utilisateur
      // saisit son email à la main). 200 pour ne pas faire lever invoke().
      return jsonResponse({ status: 'pending' })
    }

    return jsonResponse({ status: 'ready', email: data.buyer_email ?? null })
  } catch (err) {
    console.error('[get-control-checkout] Erreur:', err)
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
