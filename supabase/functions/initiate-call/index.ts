/**
 * Edge Function: initiate-call
 *
 * Rôle : Notifier le bénéficiaire qu'un appel l'attend.
 * Input : { call_id: string }
 *
 * Actions :
 *   1. Récupérer le call + bénéficiaire
 *   2. Marquer le call comme 'notified'
 *   3. Envoyer la notification push (le client récupérera son token Realtime
 *      éphémère à la prise d'appel via realtime-token)
 *
 * NB : depuis le pivot WebRTC direct → OpenAI, cette fonction ne crée plus de
 * room ni de token LiveKit et ne construit plus le system prompt — tout ça est
 * désormais géré par realtime-token au moment où le client se connecte.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendExpoPushNotification } from '../_shared/pushNotification.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { call_id } = await req.json() as { call_id: string }
    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const supabase = getSupabaseAdmin()

    // 1. Récupérer le call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      return jsonResponse({ error: 'Call introuvable', detail: callError?.message }, 404)
    }

    // 2. Récupérer le bénéficiaire
    const { data: beneficiary, error: benError } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('id', call.beneficiary_id)
      .single()

    if (benError || !beneficiary) {
      throw new Error(`Bénéficiaire introuvable: ${call.beneficiary_id}`)
    }

    // 3. Marquer le call comme notifié
    const { error: updateError } = await supabase
      .from('calls')
      .update({ status: 'notified' })
      .eq('id', call_id)

    if (updateError) throw new Error(`Update call failed: ${updateError.message}`)

    // 4. Notification push (le bénéficiaire ouvre l'app → /call?call_id=...)
    if (beneficiary.push_token) {
      await sendExpoPushNotification({
        to:    beneficiary.push_token,
        title: `📞 ${beneficiary.ai_persona_name} vous appelle !`,
        body:  `Votre compagnon ${beneficiary.ai_persona_name} souhaite vous parler. Décrochez !`,
        data:  {
          call_id,
          persona_name: beneficiary.ai_persona_name,
        },
        priority: 'high',
      })
    } else {
      console.warn(`Bénéficiaire ${beneficiary.id} n'a pas de push_token`)
    }

    return jsonResponse({
      success:      true,
      call_id,
      persona_name: beneficiary.ai_persona_name,
    })

  } catch (err) {
    console.error('initiate-call error:', err)

    // Marquer le call comme failed si possible
    try {
      const body = await req.clone().json().catch(() => ({}))
      if (body.call_id) {
        const supabase = getSupabaseAdmin()
        await supabase.from('calls').update({ status: 'failed' }).eq('id', body.call_id)
      }
    } catch (_) { /* ignore */ }

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
