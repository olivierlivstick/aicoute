/**
 * Edge Function: get-report
 *
 * Rôle : servir le compte-rendu d'un appel à une page PUBLIQUE (sans login),
 * à partir d'un jeton de partage porté dans l'URL (cf. _shared/reportToken.ts).
 *
 * Lecture en service-role (la table `calls` n'est pas exposée à anon) : on ne
 * renvoie qu'un sous-ensemble de champs « rapport » + l'identité du bénéficiaire,
 * jamais l'email/téléphone de l'aidant, ni les coûts, ni le sid Twilio.
 *
 * Entrée  : POST { token } ou GET ?token=...
 * Sorties :
 *   200 { report: {...} }
 *   400 { error: 'token_required' }
 *   404 { error: 'not_found' }      (jeton inconnu)
 *   410 { error: 'expired' }        (jeton expiré — > 48h)
 *
 * verify_jwt: false — page publique, pas d'auth (le jeton EST le secret).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Jeton accepté en query (GET) ou dans le body (POST via functions.invoke).
    const url = new URL(req.url)
    let token = url.searchParams.get('token') ?? ''
    if (!token && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      token = typeof body?.token === 'string' ? body.token : ''
    }

    if (!token || token.length < 16) {
      return jsonResponse({ error: 'token_required' }, 400)
    }

    const supabase = getSupabaseAdmin()

    // Client admin non typé (pas de generic Database) → l'inférence de
    // supabase-js bute sur la liste de colonnes + jointure ; on caste le retour.
    interface ReportRow {
      report_token_expires_at: string | null
      scheduled_at:            string
      ended_at:                string | null
      duration_seconds:        number | null
      summary:                 string | null
      mood_detected:           string | null
      key_topics:              unknown
      memorable_moments:       unknown
      alerts:                  unknown
      transcript:              unknown
      report_available:        boolean | null
      beneficiaries: { first_name: string; last_name: string; ai_persona_name: string } | null
    }

    const { data, error } = await supabase
      .from('calls')
      .select(
        'report_token_expires_at, scheduled_at, ended_at, duration_seconds, ' +
        'summary, mood_detected, key_topics, memorable_moments, alerts, transcript, ' +
        'report_available, beneficiaries(first_name, last_name, ai_persona_name)',
      )
      .eq('report_token', token)
      .maybeSingle()

    if (error) throw new Error(`get-report query failed: ${error.message}`)

    const call = data as unknown as ReportRow | null

    // Jeton inconnu → petite latence anti-bruteforce puis 404.
    if (!call) {
      await new Promise((r) => setTimeout(r, 250))
      return jsonResponse({ error: 'not_found' }, 404)
    }

    // Expiration (48h).
    const expiresAt = call.report_token_expires_at
      ? new Date(call.report_token_expires_at).getTime()
      : 0
    if (!expiresAt || expiresAt < Date.now()) {
      return jsonResponse({ error: 'expired' }, 410)
    }

    const beneficiary = call.beneficiaries as
      | { first_name: string; last_name: string; ai_persona_name: string }
      | null

    return jsonResponse({
      report: {
        beneficiary_first_name: beneficiary?.first_name ?? '',
        beneficiary_last_name:  beneficiary?.last_name ?? '',
        ai_persona_name:        beneficiary?.ai_persona_name ?? 'IA',
        scheduled_at:           call.scheduled_at,
        ended_at:               call.ended_at,
        duration_seconds:       call.duration_seconds,
        summary:                call.summary,
        mood_detected:          call.mood_detected,
        key_topics:             Array.isArray(call.key_topics) ? call.key_topics : [],
        memorable_moments:      Array.isArray(call.memorable_moments) ? call.memorable_moments : [],
        alerts:                 Array.isArray(call.alerts) ? call.alerts : [],
        transcript:             Array.isArray(call.transcript) ? call.transcript : [],
        report_available:       call.report_available ?? false,
        expires_at:             call.report_token_expires_at,
      },
    })

  } catch (err) {
    console.error('[get-report] Erreur:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
