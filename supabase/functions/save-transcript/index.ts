/**
 * Edge Function: save-transcript
 *
 * Persiste le transcript collecté côté client (WebRTC direct → OpenAI) à la fin
 * d'un appel, puis déclenche generate-summary.
 *
 * Écriture de confiance via le service role : le client n'a donc pas besoin
 * d'un accès direct en écriture sur calls.transcript (RLS inchangée).
 *
 * Input : {
 *   call_id:          string
 *   transcript:       Array<{ role: 'user'|'assistant', text: string, timestamp: string }>
 *   duration_seconds?: number
 *   status?:          'completed' | 'failed'
 * }
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

interface TranscriptEntry {
  role:      'user' | 'assistant'
  text:      string
  timestamp: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const {
      call_id,
      transcript = [],
      duration_seconds,
      status = 'completed',
    } = await req.json() as {
      call_id:           string
      transcript?:       TranscriptEntry[]
      duration_seconds?: number
      status?:           'completed' | 'failed'
    }

    if (!call_id) {
      return jsonResponse({ error: 'call_id requis' }, 400)
    }

    const supabase = getSupabaseAdmin()
    const endedAt  = new Date().toISOString()

    // 1. Sauvegarder le transcript + clôturer l'appel
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        transcript,
        status,
        ended_at:         endedAt,
        duration_seconds: duration_seconds ?? null,
      })
      .eq('id', call_id)

    if (updateError) throw new Error(`Update call failed: ${updateError.message}`)

    // 2. Déclencher generate-summary (en arrière-plan, sans bloquer le client)
    let summaryTriggered = false
    if (status === 'completed' && transcript.length > 0) {
      const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const summaryPromise = fetch(`${supabaseUrl}/functions/v1/generate-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ call_id }),
      }).catch((err) => console.error('[save-transcript] generate-summary error:', err))

      // Garder la tâche vivante après l'envoi de la réponse (runtime Supabase)
      const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
        .EdgeRuntime?.waitUntil
      if (waitUntil) waitUntil(summaryPromise)
      summaryTriggered = true
    }

    return jsonResponse({ success: true, call_id, summary_triggered: summaryTriggered })

  } catch (err) {
    console.error('[save-transcript] Erreur:', err)
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
