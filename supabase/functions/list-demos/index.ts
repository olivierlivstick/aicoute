/**
 * Edge Function: list-demos
 *
 * Renvoie les démos vitrine pour le dashboard /track_calls.
 * Protégée par un secret en query : ?key=<DEMO_TRACK_KEY>.
 *
 * GET ?key=XXX[&limit=100]
 *   → { rows: [...], totals: { calls, twilio_eur, openai_eur, total_eur } }
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

const DEFAULT_LIMIT = 100
const MAX_LIMIT     = 500

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const expectedKey = Deno.env.get('DEMO_TRACK_KEY')
    if (!expectedKey) {
      return jsonResponse({ error: 'DEMO_TRACK_KEY non configuré côté serveur' }, 500)
    }

    const url = new URL(req.url)
    const key = url.searchParams.get('key') ?? ''

    if (!constantTimeEqual(key, expectedKey)) {
      // Petite latence pour ralentir les tentatives de bruteforce
      await new Promise((r) => setTimeout(r, 250))
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    let limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
    if (limit > MAX_LIMIT) limit = MAX_LIMIT

    const supabase = getSupabaseAdmin()
    const { data: rows, error } = await supabase
      .from('demo_calls')
      .select('id, mode, started_at, ended_at, duration_seconds, phone_prefix, twilio_cost_eur, openai_cost_eur')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[list-demos] SELECT failed:', error)
      return jsonResponse({ error: 'lecture impossible' }, 500)
    }

    type Row = {
      id: string
      mode: 'web' | 'phone'
      started_at: string
      ended_at: string | null
      duration_seconds: number | null
      phone_prefix: string | null
      twilio_cost_eur: number | null
      openai_cost_eur: number | null
    }
    const list = (rows ?? []) as Row[]

    const totals = {
      calls:      list.length,
      twilio_eur: round4(list.reduce((s, r) => s + (Number(r.twilio_cost_eur) || 0), 0)),
      openai_eur: round4(list.reduce((s, r) => s + (Number(r.openai_cost_eur) || 0), 0)),
      total_eur:  0,
    }
    totals.total_eur = round4(totals.twilio_eur + totals.openai_eur)

    return jsonResponse({ rows: list, totals })
  } catch (err) {
    console.error('[list-demos] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
