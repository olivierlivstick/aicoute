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
import { logEvent } from '../_shared/systemEvents.ts'

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

    // 2. Déclencher generate-summary EN ATTENDANT sa réponse.
    //
    // Pourquoi pas en fire-and-forget (la version précédente) : le runtime
    // Deno Supabase ne garantissait pas l'exécution du promise via
    // EdgeRuntime.waitUntil → generate-summary n'était souvent jamais
    // invoquée → ni résumé, ni alertes, ni email. La fetch ajoute ~5s à la
    // latence de save-transcript mais le voice-bridge ne fait que loguer la
    // réponse (la WS Twilio est déjà fermée à ce stade).
    let summaryTriggered = false
    if (status === 'completed' && transcript.length > 0) {
      const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-summary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ call_id }),
        })
        summaryTriggered = res.ok
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          console.error(`[save-transcript] generate-summary HTTP ${res.status}: ${detail.slice(0, 500)}`)
          // Trace visible dans /admin/sante : sans ça, un échec transitoire de
          // generate-summary (ex: GPT-4o down) perd le compte-rendu + l'email en
          // silence. La passe de rattrapage de schedule-calls le relancera.
          await logEvent(supabase, {
            level:   'error',
            source:  'save-transcript',
            call_id,
            message: `generate-summary a échoué (HTTP ${res.status}) — compte-rendu non généré`,
            payload: { status: res.status, detail: detail.slice(0, 500) },
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[save-transcript] generate-summary fetch error:', msg)
        await logEvent(supabase, {
          level:   'error',
          source:  'save-transcript',
          call_id,
          message: `Exception à l'appel de generate-summary — compte-rendu non généré`,
          payload: { error: msg },
        })
      }
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
