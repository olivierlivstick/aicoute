/**
 * Edge Function: realtime-token
 *
 * Mini-backend qui génère un ephemeral token OpenAI Realtime (API GA).
 * Équivalent serveur du /session du test de référence, mais avec le system
 * prompt MODECT construit côté serveur (jamais exposé au client).
 *
 * Input  : { call_id: string }
 * Output : { value: string, model: string, persona_name: string }
 *
 * Le client utilise ensuite `value` comme Bearer pour négocier la connexion
 * WebRTC directe vers OpenAI (POST /v1/realtime/calls?model=...).
 *
 * Doc : https://platform.openai.com/docs/guides/realtime (GA)
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { loadCallContext } from '../_shared/callContext.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { call_id } = await req.json() as { call_id: string }
    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const supabase  = getSupabaseAdmin()
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY manquant' }, 500)
    }

    // 1. Charger tout le contexte d'appel (prompt + modèle + voix) via le helper
    //    partagé avec get-call-context : même prompt sur les deux canaux, et
    //    inclut le rappel du dernier appel + agent_extra_prompt.
    const ctx          = await loadCallContext(supabase, call_id)
    const model        = ctx.model
    const instructions = ctx.instructions

    // 2. Générer l'ephemeral token (format GA)
    const tokenRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        session: {
          type:  'realtime',
          model,
          audio: {
            output: { voice: ctx.voice },
            // Tours de parole : la GA applique `server_vad` par défaut.
            // Pour tuner : audio.input.turn_detection (PAS au niveau racine = Beta).
          },
          instructions,
        },
      }),
    })

    const tokenData = await tokenRes.json()

    // Le token est dans `value` (format GA), PAS `client_secret.value` (Beta)
    if (!tokenRes.ok || !tokenData?.value) {
      console.error('[realtime-token] Réponse OpenAI inattendue:', JSON.stringify(tokenData))
      return jsonResponse(
        { error: 'Échec génération du token OpenAI', detail: tokenData },
        502,
      )
    }

    // 3. Marquer le call comme démarré
    await supabase
      .from('calls')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', call_id)
      .in('status', ['scheduled', 'notified'])

    // 4. Renvoyer le token + le modèle (le client doit réutiliser le MÊME modèle
    //    dans ?model= lors de la négociation SDP)
    return jsonResponse({
      value:        tokenData.value,
      model,
      persona_name: ctx.beneficiary.ai_persona_name,
    })

  } catch (err) {
    console.error('[realtime-token] Erreur:', err)
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
