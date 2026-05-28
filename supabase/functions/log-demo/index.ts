/**
 * Edge Function: log-demo
 *
 * Tracking des démos vitrine (mode web). Deux actions :
 *
 *  POST { action: 'start', mode: 'web', phone_prefix?: string }
 *    → INSERT row, renvoie { id }
 *
 *  POST { action: 'end', id, duration_seconds }
 *    → UPDATE row avec ended_at + duration + coûts estimés
 *
 * Le mode 'phone' n'utilise PAS cette Edge Function : le service voice-bridge
 * écrit directement dans Supabase via service role (latence plus faible et
 * évite un aller-retour HTTPS supplémentaire sur le canal serveur).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

// Tarifs estimés en EUR/seconde (approximation MVP)
//  - OpenAI Realtime GA gpt-realtime-2 : ~0,50 USD/min audio (mix input/output)
//                                       → ~0,46 EUR/min → ~0,0077 EUR/s
//  - Twilio FR mobile sortant : ~0,045 USD/min → ~0,041 EUR/min → ~0,0007 EUR/s
const OPENAI_EUR_PER_SECOND = 0.0077
const TWILIO_EUR_PER_SECOND = 0.0007

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json()
    const action = body?.action

    if (action === 'start') {
      return await handleStart(body)
    }
    if (action === 'end') {
      return await handleEnd(body)
    }
    return jsonResponse({ error: 'action invalide (start|end attendu)' }, 400)
  } catch (err) {
    console.error('[log-demo] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

async function handleStart(body: Record<string, unknown>): Promise<Response> {
  const mode = body.mode as string | undefined
  if (mode !== 'web' && mode !== 'phone') {
    return jsonResponse({ error: 'mode doit être "web" ou "phone"' }, 400)
  }
  const engine = (body.engine as string | undefined) ?? 'openai'
  if (engine !== 'openai' && engine !== 'gemini') {
    return jsonResponse({ error: 'engine doit être "openai" ou "gemini"' }, 400)
  }
  const phonePrefix = body.phone_prefix as string | null | undefined

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('demo_calls')
    .insert({
      mode,
      engine,
      started_at:   new Date().toISOString(),
      phone_prefix: phonePrefix ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[log-demo:start] INSERT failed:', error)
    return jsonResponse({ error: 'enregistrement impossible' }, 500)
  }

  return jsonResponse({ id: data.id })
}

async function handleEnd(body: Record<string, unknown>): Promise<Response> {
  const id              = body.id as string | undefined
  const durationSeconds = Number(body.duration_seconds)

  if (!id || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return jsonResponse({ error: 'id + duration_seconds (number) requis' }, 400)
  }

  const supabase = getSupabaseAdmin()

  // Récupère le mode pour savoir s'il faut compter Twilio aussi
  const { data: row, error: readErr } = await supabase
    .from('demo_calls')
    .select('mode, started_at')
    .eq('id', id)
    .single()

  if (readErr || !row) {
    return jsonResponse({ error: 'démo introuvable' }, 404)
  }

  const openaiCost = +(durationSeconds * OPENAI_EUR_PER_SECOND).toFixed(4)
  const twilioCost = row.mode === 'phone'
    ? +(durationSeconds * TWILIO_EUR_PER_SECOND).toFixed(4)
    : null

  const { error: updErr } = await supabase
    .from('demo_calls')
    .update({
      ended_at:         new Date().toISOString(),
      duration_seconds: Math.round(durationSeconds),
      openai_cost_eur:  openaiCost,
      twilio_cost_eur:  twilioCost,
    })
    .eq('id', id)

  if (updErr) {
    console.error('[log-demo:end] UPDATE failed:', updErr)
    return jsonResponse({ error: 'mise à jour impossible' }, 500)
  }

  return jsonResponse({ ok: true })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
