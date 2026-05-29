/**
 * Edge Function: initiate-call
 *
 * Rôle : déclencher l'appel sortant Twilio vers le bénéficiaire.
 * Input : { call_id: string }
 *
 * Actions :
 *   1. Récupérer le call + bénéficiaire
 *   2. Si pas de numéro → marquer 'failed' et sortir
 *   3. POST vers `${VOICE_BRIDGE_URL}/scheduled-call` (auth interne)
 *   4. Marquer le call 'notified' + notified_at (origine du timer no-answer)
 *      uniquement si le voice-bridge a accepté la demande
 *
 * NB : depuis le passage au canal Twilio (Lot 1 du chantier appels planifiés),
 * cette fonction ne pousse plus de notification Expo — la couche mobile est
 * en pause. Le bénéficiaire reçoit directement son téléphone qui sonne.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { logEvent } from '../_shared/systemEvents.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  let parsedCallId: string | undefined

  try {
    const { call_id } = await req.json() as { call_id: string }
    parsedCallId = call_id
    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const voiceBridgeUrl = Deno.env.get('VOICE_BRIDGE_URL')
    const internalToken  = Deno.env.get('MODECT_INTERNAL_TOKEN')
    if (!voiceBridgeUrl) {
      return jsonResponse({ error: 'VOICE_BRIDGE_URL non configuré' }, 500)
    }
    if (!internalToken) {
      return jsonResponse({ error: 'MODECT_INTERNAL_TOKEN non configuré' }, 500)
    }

    const supabase = getSupabaseAdmin()

    // 1. Récupérer le call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, beneficiary_id, status')
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      return jsonResponse({ error: 'Call introuvable', detail: callError?.message }, 404)
    }

    // 2. Récupérer le bénéficiaire (numéro, persona pour logs, moteur préféré)
    const { data: beneficiary, error: benError } = await supabase
      .from('beneficiaries')
      .select('id, first_name, phone, ai_persona_name, preferred_engine')
      .eq('id', call.beneficiary_id)
      .single()

    if (benError || !beneficiary) {
      throw new Error(`Bénéficiaire introuvable: ${call.beneficiary_id}`)
    }

    // Pas de numéro → on ne peut rien faire, on marque failed
    if (!beneficiary.phone || !beneficiary.phone.trim()) {
      await supabase
        .from('calls')
        .update({ status: 'failed', ended_at: new Date().toISOString() })
        .eq('id', call_id)
      await logEvent(supabase, {
        level:   'warn',
        source:  'initiate-call',
        call_id,
        message: `Bénéficiaire ${beneficiary.first_name} sans numéro — call marqué failed`,
        payload: { beneficiary_id: beneficiary.id },
      })
      return jsonResponse(
        { error: `Bénéficiaire ${beneficiary.first_name} n'a pas de numéro de téléphone` },
        422,
      )
    }

    // 3. Déclencher l'appel Twilio via voice-bridge — propage le moteur préféré
    const engine = beneficiary.preferred_engine === 'gemini' ? 'gemini' : 'openai'
    const bridgeRes = await fetch(`${voiceBridgeUrl}/scheduled-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        call_id,
        phone: beneficiary.phone,
        engine,
      }),
    })

    if (!bridgeRes.ok) {
      const detail = await bridgeRes.text().catch(() => '')
      await supabase
        .from('calls')
        .update({ status: 'failed', ended_at: new Date().toISOString() })
        .eq('id', call_id)
      await logEvent(supabase, {
        level:   'error',
        source:  'initiate-call',
        call_id,
        message: `voice-bridge a refusé /scheduled-call (HTTP ${bridgeRes.status})`,
        payload: { status: bridgeRes.status, detail: detail.slice(0, 500) },
      })
      return jsonResponse(
        { error: 'voice-bridge a refusé la demande', status: bridgeRes.status, detail },
        502,
      )
    }

    const bridgeData = await bridgeRes.json().catch(() => ({})) as { callSid?: string }
    const twilioSid  = bridgeData.callSid ?? null

    // 4. Marquer le call notifié + tracer le moteur prévu pour cet appel.
    //    L'engine sera potentiellement écrasé par markCallInProgress côté
    //    voice-bridge si fallback (ex: gemini demandé mais clé absente).
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        status:          'notified',
        notified_at:     new Date().toISOString(),
        twilio_call_sid: twilioSid,
        engine,
      })
      .eq('id', call_id)

    if (updateError) throw new Error(`Update call failed: ${updateError.message}`)

    return jsonResponse({
      success:      true,
      call_id,
      twilio_sid:   twilioSid,
      persona_name: beneficiary.ai_persona_name,
    })

  } catch (err) {
    console.error('[initiate-call] Erreur:', err)
    if (parsedCallId) {
      try {
        const supabase = getSupabaseAdmin()
        await supabase
          .from('calls')
          .update({ status: 'failed', ended_at: new Date().toISOString() })
          .eq('id', parsedCallId)
        await logEvent(supabase, {
          level:   'error',
          source:  'initiate-call',
          call_id: parsedCallId,
          message: err instanceof Error ? err.message : 'Erreur interne',
        })
      } catch (_) { /* ignore */ }
    }
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
