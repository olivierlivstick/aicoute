/**
 * Edge Function: redeem-code
 *
 * Crédite les minutes d'un code d'achat (acheté en invité) sur le compte de
 * l'aidant connecté.
 *
 *  POST { code }  → { ok: true, minutes, pack_name }
 *
 * Public (verify_jwt = false) mais auth gérée en interne : on lit le JWT de
 * l'appelant (joint automatiquement par supabase.functions.invoke) pour
 * l'identifier. Le crédit se fait en service-role (le client n'a aucun droit
 * d'écriture sur minute_purchases ni de lecture sur minute_codes).
 *
 * Crédit ATOMIQUE : UPDATE … WHERE status='active' RETURNING → un seul appel
 * peut « gagner » un code donné (pas de double-crédit, pas de course).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

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

    const body = await req.json().catch(() => ({}))
    const code = String(body?.code ?? '').toUpperCase().replace(/\s+/g, '')
    if (!code) return jsonResponse({ error: 'Code requis.' }, 400)

    // Crédit atomique : ne « consomme » le code que s'il est encore actif.
    const { data: claimed, error: claimErr } = await admin
      .from('minute_codes')
      .update({
        status: 'redeemed',
        redeemed_by: caregiverId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('code', code)
      .eq('status', 'active')
      .select('id, pack_id, pack_name, minutes, amount_eur')
      .maybeSingle()

    if (claimErr) throw new Error(`claim code: ${claimErr.message}`)

    if (!claimed) {
      // Distinguer « inexistant » de « déjà utilisé » pour un message clair.
      const { data: exists } = await admin
        .from('minute_codes')
        .select('status')
        .eq('code', code)
        .maybeSingle()
      if (exists) {
        return jsonResponse({ error: 'Ce code a déjà été utilisé.' }, 409)
      }
      return jsonResponse({ error: 'Code invalide.' }, 404)
    }

    // Crédit du compte.
    const { error: insErr } = await admin.from('minute_purchases').insert({
      caregiver_id: caregiverId,
      pack_id: claimed.pack_id,
      pack_name: claimed.pack_name,
      minutes: claimed.minutes,
      amount_eur: claimed.amount_eur,
      source_code: code,
    })

    if (insErr) {
      // Rollback best-effort : on rouvre le code pour ne pas « perdre » l'achat.
      await admin
        .from('minute_codes')
        .update({ status: 'active', redeemed_by: null, redeemed_at: null })
        .eq('id', claimed.id)
      throw new Error(`crédit minute_purchases: ${insErr.message}`)
    }

    return jsonResponse({ ok: true, minutes: claimed.minutes, pack_name: claimed.pack_name })
  } catch (err) {
    console.error('[redeem-code] Erreur:', err)
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
