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

    // Garde-fou déterministe : le LLM confond parfois l'ordre des versions et
    // propose un modèle PLUS ANCIEN comme « dernier » (vécu : 2.5 présenté comme
    // plus récent que 3.1). On annule donc toute « amélioration » dont le modèle
    // proposé n'est PAS strictement postérieur (par date) à l'en-service, ou est
    // identique. La comparaison de dates est fiable, contrairement au raisonnement
    // temporel du LLM.
    reconcileEngine(parsed.openai)
    reconcileEngine(parsed.gemini)

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
    `PÉRIMÈTRE STRICT — ne considère QUE les modèles réellement utilisables pour de la conversation vocale TEMPS RÉEL bidirectionnelle (speech-to-speech, "parole entrante → parole sortante") via l'API temps réel du fournisseur :`,
    `- OpenAI : modèles servis par la « Realtime API ».`,
    `- Google : modèles servis par la « Live API » en NATIVE AUDIO (identifiants de type "*-live-*" / "*-native-audio-*").`,
    `NE COMPTENT PAS (à exclure explicitement) : les modèles texte/multimodaux standard sans variante temps réel (ex. un "Gemini X.Y Flash" classique), les modèles TTS / synthèse vocale seuls, et les variantes spécialisées de tâche (ex. traduction "Live Translate"). Un identifiant proposé doit être DOCUMENTÉ comme disponible sur cette API temps réel — vérifie-le sur la doc officielle, ne suppose pas l'existence d'une variante Live à partir d'un nom de génération.`,
    ``,
    `Avec la RECHERCHE WEB, vérifie sur les sources officielles (docs/changelog OpenAI Realtime et Google Gemini Live, annonces) s'il existe AUJOURD'HUI, pour CHAQUE moteur et DANS CE PÉRIMÈTRE, soit un MODÈLE temps réel plus récent/meilleur, soit de nouvelles VOIX sensiblement meilleures (notamment pour le français), que ce qu'on utilise.`,
    ``,
    `REPÈRE CHRONOLOGIQUE (à respecter absolument) : un numéro de génération plus élevé est PLUS RÉCENT (3.x > 2.x > 1.x), et une date de sortie postérieure est plus récente. Exemples : Gemini "3.1 flash live" (mars 2026) est PLUS RÉCENT que Gemini "2.5 native audio" (déc. 2025) ; un snapshot OpenAI de 2026 est plus récent qu'un snapshot de 2025. NE PROPOSE JAMAIS comme "latest"/amélioration un modèle d'une génération ANTÉRIEURE ou ÉGALE, ni un snapshot plus ANCIEN, que celui en service.`,
    ``,
    `Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, aucune balise de code), avec EXACTEMENT cette forme :`,
    `{`,
    `  "openai": { "in_use": string, "in_use_date": string, "latest": string, "latest_date": string, "is_latest": boolean, "note": string },`,
    `  "gemini": { "in_use": string, "in_use_date": string, "latest": string, "latest_date": string, "is_latest": boolean, "note": string },`,
    `  "recommendations": string[]`,
    `}`,
    ``,
    `RÈGLES STRICTES :`,
    `- "in_use_date" / "latest_date" = date de sortie (format ISO "AAAA-MM-JJ" ou "AAAA-MM") issue des sources officielles. Obligatoires.`,
    `- "is_latest" (par moteur) = false UNIQUEMENT si un MODÈLE STRICTEMENT PLUS RÉCENT (date de sortie postérieure) DANS LE PÉRIMÈTRE (temps réel / Live native audio) OU des VOIX nettement meilleures/plus récentes existent ; true sinon. Si "latest" n'est pas strictement postérieur à "in_use", alors is_latest=true et latest=in_use.`,
    `- Si une génération plus récente existe pour la marque mais SANS variante temps réel/Live à ce jour (ex. un Flash plus récent non disponible en Live API), alors "is_latest" reste true : on ne compte PAS ça comme une amélioration disponible. Mentionne-le simplement dans "note" comme information de veille (ex. « Gemini 3.5 Flash existe mais pas en Live API »).`,
    `- "note" (FR, concis) doit dire PRÉCISÉMENT ce qui est en jeu : soit "à jour", soit nommer le modèle temps réel plus récent et/ou les voix concernées (identifiants exacts). Ne reste jamais vague.`,
    `- "recommendations" : liste d'actions concrètes en français. OBLIGATOIREMENT NON VIDE si au moins un "is_latest" est false (ex. « Tester la voix Gemini Flare en français avant bascule »). Tableau vide UNIQUEMENT si les deux moteurs sont parfaitement à jour.`,
    `- "latest" = identifiant exact du modèle TEMPS RÉEL le plus récent trouvé dans le périmètre (= "in_use" si déjà à jour). N'y mets jamais un modèle non disponible sur l'API temps réel, ni un modèle plus ancien que l'en-service.`,
  ].join('\n')
}

// Normalise une date « AAAA-MM » ou « AAAA-MM-JJ » en « AAAA-MM-JJ » (comparable
// lexicographiquement). Retourne null si illisible.
function normDate(s: unknown): string | null {
  const m = String(s ?? '').match(/(\d{4})-(\d{2})(?:-(\d{2}))?/)
  return m ? `${m[1]}-${m[2]}-${m[3] ?? '01'}` : null
}

// Force is_latest=true (et corrige la note) quand le « latest » proposé n'est pas
// strictement postérieur à l'en-service — protège contre l'inversion de versions
// par le LLM. En l'absence de dates exploitables, on ne touche pas au verdict LLM.
function reconcileEngine(engRaw: unknown): void {
  const eng = engRaw as {
    in_use?: string; latest?: string; is_latest?: boolean
    in_use_date?: string; latest_date?: string; note?: string
  } | undefined
  if (!eng || typeof eng !== 'object') return

  const inUse = String(eng.in_use ?? '').trim()
  const latest = String(eng.latest ?? '').trim()

  const sameId = latest && inUse && latest === inUse
  const du = normDate(eng.in_use_date)
  const dl = normDate(eng.latest_date)
  const notNewer = du && dl ? dl <= du : false

  if (sameId || notNewer) {
    if (eng.is_latest === false) {
      eng.note = latest && !sameId
        ? `À jour — le modèle « ${latest} » n'est pas plus récent que celui en service.`
        : 'À jour.'
    }
    eng.is_latest = true
    eng.latest = inUse
  }
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
