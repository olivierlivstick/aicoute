/**
 * Edge Function: list-openai-models
 *
 * Proxie GET /v1/models vers OpenAI et retourne uniquement
 * les modèles compatibles Realtime API (contenant "realtime").
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY manquant' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${openaiKey}` },
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: `OpenAI error: ${err}` }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data } = await res.json() as { data: Array<{ id: string }> }

    // Filtrer les modèles realtime et trier par id décroissant (plus récent en premier)
    const realtimeModels = data
      .filter((m) => m.id.includes('realtime'))
      .map((m) => m.id)
      .sort((a, b) => b.localeCompare(a))

    return new Response(JSON.stringify({ models: realtimeModels }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
