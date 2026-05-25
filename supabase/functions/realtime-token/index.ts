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
import { buildSystemPrompt } from '../_shared/systemPrompt.ts'

// --- Paramètres Realtime (point unique de configuration) ---------------------
const DEFAULT_GA_MODEL = 'gpt-realtime-2'   // modèle GA par défaut
const DEFAULT_VOICE    = 'cedar'            // voix par défaut (configurable)

/**
 * Le endpoint GA n'accepte que les modèles GA. Les anciens modèles Beta
 * (`gpt-4o-realtime-preview`, encore stockés en base) sont ramenés au défaut.
 */
function normalizeModel(model: string | null | undefined): string {
  if (!model) return DEFAULT_GA_MODEL
  if (!model.includes('realtime') || model.includes('preview')) return DEFAULT_GA_MODEL
  return model
}

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

    // 1. Récupérer le call (+ planification jointe)
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*, session_schedules(*)')
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      return jsonResponse({ error: 'Call introuvable', detail: callError?.message }, 404)
    }

    // 2. Bénéficiaire
    const { data: beneficiary, error: benError } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('id', call.beneficiary_id)
      .single()

    if (benError || !beneficiary) {
      throw new Error(`Bénéficiaire introuvable: ${call.beneficiary_id}`)
    }

    // 3. Mémoires long-terme (20 plus importantes)
    const { data: memories } = await supabase
      .from('conversation_memory')
      .select('memory_type, content, importance')
      .eq('beneficiary_id', beneficiary.id)
      .order('importance', { ascending: false })
      .limit(20)

    // 4. Paramètres agent du caregiver
    const { data: caregiverProfile } = await supabase
      .from('profiles')
      .select('agent_model, agent_extra_prompt')
      .eq('id', beneficiary.caregiver_id)
      .single()

    const model           = normalizeModel(caregiverProfile?.agent_model)
    const agentExtraPrompt = caregiverProfile?.agent_extra_prompt ?? null

    // 5. Construire le system prompt (instructions Realtime)
    const schedule = call.session_schedules ?? {
      max_duration_minutes: 15,
      suggested_topics:     null,
      special_instructions: null,
    }

    const basePrompt   = buildSystemPrompt(beneficiary, memories ?? [], schedule)
    const instructions = agentExtraPrompt ? `${agentExtraPrompt}\n\n${basePrompt}` : basePrompt

    // 6. Générer l'ephemeral token (format GA)
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
            output: { voice: DEFAULT_VOICE },
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

    // 7. Marquer le call comme démarré
    await supabase
      .from('calls')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', call_id)
      .in('status', ['scheduled', 'notified'])

    // 8. Renvoyer le token + le modèle (le client doit réutiliser le MÊME modèle
    //    dans ?model= lors de la négociation SDP)
    return jsonResponse({
      value:        tokenData.value,
      model,
      persona_name: beneficiary.ai_persona_name,
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
