/**
 * Edge Function: get-call-context
 *
 * Renvoie le contexte complet (system prompt + voix + modèle) pour un appel
 * planifié, à destination du voice-bridge qui établit la WS vers OpenAI Realtime.
 *
 * Authentification : header `Authorization: Bearer ${MODECT_INTERNAL_TOKEN}`.
 * Sans ce token, l'appel est refusé en 401 — le prompt n'est JAMAIS exposé
 * publiquement (contrairement à `realtime-token` qui est protégé par le JWT
 * utilisateur côté back-office et `public-realtime-token` qui est rate-limité
 * IP pour la démo).
 *
 * Input  : { call_id: string }
 * Output : CallContext (cf. _shared/callContext.ts) sans le numéro de téléphone
 *          (que le voice-bridge a déjà reçu via initiate-call).
 *
 * verify_jwt: false → on gère l'auth nous-mêmes via MODECT_INTERNAL_TOKEN.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { loadCallContext }         from '../_shared/callContext.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // --- Auth interne ---------------------------------------------------------
  const expected = Deno.env.get('MODECT_INTERNAL_TOKEN')
  if (!expected) {
    return jsonResponse({ error: 'MODECT_INTERNAL_TOKEN non configuré côté serveur' }, 500)
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${expected}`) {
    return jsonResponse({ error: 'Forbidden' }, 401)
  }

  try {
    const { call_id } = await req.json() as { call_id: string }
    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const supabase = getSupabaseAdmin()
    const ctx      = await loadCallContext(supabase, call_id)

    // Ne pas renvoyer le numéro de téléphone : il a déjà été transmis au
    // voice-bridge dans le payload /scheduled-call. Cette fonction sert
    // uniquement à fournir les instructions IA.
    return jsonResponse({
      call_id:              ctx.call.id,
      beneficiary_id:       ctx.beneficiary.id,
      beneficiary_name:     ctx.beneficiary.first_name,
      persona_name:         ctx.beneficiary.ai_persona_name,
      language:             ctx.beneficiary.language_preference,
      model:                ctx.model,
      voice:                ctx.voice,
      instructions:         ctx.instructions,
      max_duration_minutes: ctx.max_duration_minutes,
    })

  } catch (err) {
    console.error('[get-call-context] Erreur:', err)
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
