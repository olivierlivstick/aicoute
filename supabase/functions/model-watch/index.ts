/**
 * Edge Function: model-watch
 *
 * « Veille modèles voix » self-service du back-office (/admin/sante). Réservé
 * aux admins. Interroge un LLM AVEC recherche web (OpenAI Responses API + outil
 * web_search) pour savoir s'il existe des modèles voix temps réel plus récents
 * que ceux qu'on utilise (OpenAI Realtime + Gemini Live), et renvoie un
 * compte-rendu structuré affiché dans la page.
 *
 * Pourquoi une Edge Function : la clé OPENAI_API_KEY ne doit jamais transiter
 * côté navigateur, et l'appel coûte des tokens → on le réserve aux admins.
 *
 * Le résultat est aussi journalisé dans system_events (source='model-watch') :
 * la page peut ainsi réafficher la dernière veille sans relancer une recherche.
 *
 * verify_jwt: false → auth gérée en interne via requireAdmin (JWT appelant).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'
import { logEvent } from '../_shared/systemEvents.ts'

// ⚠️ Baseline DUPLIQUÉE de CLAUDE.md / _shared/callContext.ts. À garder en phase :
// c'est ce qu'on déclare « actuellement en service » au LLM pour qu'il compare.
const CURRENT = {
  openai: { model: 'gpt-realtime-2 (snapshot 2026-05-07)', voices: 'cedar, marin' },
  gemini: { model: 'models/gemini-3.1-flash-live-preview', voices: 'Aoede, Sulafat, Callirrhoe, Kore, Charon, Orus' },
}

// Modèle de recherche (overridable sans redéploiement si besoin de bumper).
const RESEARCH_MODEL = Deno.env.get('MODEL_WATCH_MODEL') ?? 'gpt-4.1'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const admin = getSupabaseAdmin()

    const auth = await requireAdmin(req, admin)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) return jsonResponse({ error: 'OPENAI_API_KEY non configurée' }, 500)

    const today = new Date().toISOString().slice(0, 10)
    const prompt = buildPrompt(today)

    // --- Appel Responses API + outil de recherche web ---------------------
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RESEARCH_MODEL,
        tools: [{ type: 'web_search' }],
        input: prompt,
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      return jsonResponse(
        { error: `Recherche LLM échouée (HTTP ${aiRes.status}). Modèle « ${RESEARCH_MODEL} » — vérifier MODEL_WATCH_MODEL.`, detail: detail.slice(0, 500) },
        502,
      )
    }

    const data = await aiRes.json()
    const text: string = data.output_text
      ?? data.output?.find((o: { type?: string }) => o.type === 'message')?.content?.[0]?.text
      ?? ''

    // Citations (url_citation) renvoyées par l'outil web_search.
    const annotations: Array<{ type?: string; url?: string; title?: string }> =
      data.output?.find((o: { type?: string }) => o.type === 'message')?.content?.[0]?.annotations ?? []
    const sources = dedupeSources(
      annotations
        .filter((a) => a.type === 'url_citation' && a.url)
        .map((a) => ({ url: a.url!, title: a.title ?? a.url! })),
    )

    const parsed = parseJson(text)
    if (!parsed) {
      return jsonResponse({ error: 'Réponse LLM illisible (JSON non parsé).', raw: text.slice(0, 1000) }, 502)
    }

    // Cohérence garantie : on DÉRIVE le verdict global ET le texte du bandeau
    // en CODE à partir des is_latest par moteur. Le texte libre du LLM n'est
    // PAS fiable (il peut contredire ses propres champs) → on l'ignore pour le
    // bandeau et on ne garde du LLM que les notes par moteur + recommandations.
    const openaiOk = (parsed.openai as { is_latest?: boolean })?.is_latest !== false
    const geminiOk = (parsed.gemini as { is_latest?: boolean })?.is_latest !== false
    const upToDate = openaiOk && geminiOk

    const verdict = upToDate
      ? 'Les deux moteurs sont à jour (modèle et voix).'
      : (!openaiOk && !geminiOk)
        ? 'Une amélioration (modèle ou voix) est disponible pour OpenAI et pour Gemini.'
        : !openaiOk
          ? 'Une amélioration est disponible pour OpenAI ; Gemini est à jour.'
          : 'Une amélioration est disponible pour Gemini ; OpenAI est à jour.'

    // Si tout est à jour → pas de recommandation (évite « à jour » + une action).
    const recommendations = upToDate
      ? []
      : (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])

    const result = {
      checked_at: new Date().toISOString(),
      research_model: RESEARCH_MODEL,
      ...parsed,
      verdict,
      up_to_date: upToDate,
      recommendations,
      sources,
    }

    // Journalise pour réaffichage ultérieur (best-effort, non bloquant).
    await logEvent(admin, {
      level: upToDate ? 'info' : 'warn',
      source: 'model-watch',
      message: upToDate
        ? 'Veille : à jour'
        : 'Veille : une amélioration (modèle ou voix) est disponible',
      payload: result,
    })

    return jsonResponse(result)
  } catch (err) {
    console.error('[model-watch] Erreur:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})

function buildPrompt(today: string): string {
  return [
    `Nous sommes le ${today}.`,
    `Notre produit fait des appels vocaux temps réel à des personnes âgées, en français. La QUALITÉ et la FLUIDITÉ de la conversation sont le cœur du produit.`,
    `Moteurs actuellement EN SERVICE :`,
    `- OpenAI Realtime API : modèle « ${CURRENT.openai.model} », voix « ${CURRENT.openai.voices} ».`,
    `- Google Gemini Live API : modèle « ${CURRENT.gemini.model} », voix « ${CURRENT.gemini.voices} ».`,
    ``,
    `Avec la RECHERCHE WEB, vérifie sur les sources officielles (docs/changelog OpenAI Realtime et Google Gemini Live, annonces) s'il existe AUJOURD'HUI, pour CHAQUE moteur, soit un MODÈLE de voix temps réel plus récent/meilleur, soit de nouvelles VOIX sensiblement meilleures (notamment pour le français), que ce qu'on utilise.`,
    ``,
    `Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, aucune balise de code), avec EXACTEMENT cette forme :`,
    `{`,
    `  "openai": { "in_use": string, "latest": string, "is_latest": boolean, "note": string },`,
    `  "gemini": { "in_use": string, "latest": string, "is_latest": boolean, "note": string },`,
    `  "recommendations": string[]`,
    `}`,
    ``,
    `RÈGLES STRICTES :`,
    `- "is_latest" (par moteur) = false dès qu'un MODÈLE plus récent OU des VOIX nettement meilleures/plus récentes existent ; true seulement si on est au mieux sur les deux plans (modèle + voix).`,
    `- "note" (FR, concis) doit dire PRÉCISÉMENT ce qui est en jeu : soit "à jour", soit nommer le modèle plus récent et/ou les voix concernées (noms exacts). Ne reste jamais vague.`,
    `- "recommendations" : liste d'actions concrètes en français. OBLIGATOIREMENT NON VIDE si au moins un "is_latest" est false (ex. « Tester la voix Gemini Flare en français avant bascule »). Tableau vide UNIQUEMENT si les deux moteurs sont parfaitement à jour.`,
    `- "latest" = identifiant exact du modèle le plus récent trouvé (= "in_use" si déjà à jour).`,
  ].join('\n')
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text) return null
  let s = text.trim()
  // Retire d'éventuelles fences ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(s.slice(start, end + 1))
  } catch {
    return null
  }
}

function dedupeSources(list: Array<{ url: string; title: string }>): Array<{ url: string; title: string }> {
  const seen = new Set<string>()
  const out: Array<{ url: string; title: string }> = []
  for (const s of list) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    out.push(s)
  }
  return out.slice(0, 12)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
