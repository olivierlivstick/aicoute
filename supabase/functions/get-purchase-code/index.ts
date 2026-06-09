/**
 * Edge Function: get-purchase-code
 *
 * Renvoie le code généré pour une session Stripe Checkout, pour l'afficher sur
 * la page publique /achat/merci après le paiement.
 *
 *  GET ?session_id=cs_...   → { status: 'ready', code, pack_name, minutes }
 *                           → 404 { status: 'pending' } tant que le webhook
 *                             n'a pas encore traité le paiement (la page poll)
 *
 * Public (verify_jwt = false) : le `session_id` Stripe (cs_…) est long et non
 * devinable → il fait office de secret. On ne renvoie QUE les infos d'affichage
 * du code (jamais l'email acheteur, ni l'état redeemed).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // session_id accepté en query (?session_id=) ou en body JSON (invoke POST).
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
      .from('minute_codes')
      .select('code, pack_name, minutes')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()

    if (!data) {
      // Webhook pas encore arrivé (ou achat connecté sans code) → la page réessaie.
      // 200 (pas 404) pour que supabase.functions.invoke ne lève pas d'erreur.
      return jsonResponse({ status: 'pending' })
    }

    return jsonResponse({
      status: 'ready',
      code: data.code,
      pack_name: data.pack_name,
      minutes: data.minutes,
    })
  } catch (err) {
    console.error('[get-purchase-code] Erreur:', err)
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
