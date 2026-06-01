/**
 * Edge Function: public-realtime-token
 *
 * Démo publique vitrine (www.aicoute.fr) — mode WebRTC navigateur.
 * Génère un ephemeral token OpenAI Realtime GA pour un visiteur anonyme.
 * Pas d'authentification : la fonction est appelable depuis la home publique.
 *
 * Différences avec `realtime-token` :
 *  - aucun call_id, aucun accès base : prompt démo hardcodé
 *  - rate-limit basique en mémoire par IP (anti-abus)
 *  - durée de session limitée côté client (le composant React coupe à 3 min)
 *
 * Output : { value, model, voice }
 * Le client réutilise `value` comme Bearer pour POST /v1/realtime/calls?model=...
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'

const MODEL = 'gpt-realtime-2'
const VOICE = 'cedar'

const DEMO_PROMPT = `Tu es un compagnon de conversation chaleureux et curieux qui parle en français.

Contexte : tu es la démo vocale du service Aicoute, un service qui appelle régulièrement les personnes âgées isolées pour discuter avec elles et envoyer un résumé à leur famille. La personne en face de toi vient de cliquer sur "essayer la démo" depuis le site aicoute.fr pour découvrir à quoi ressemble une conversation avec toi.

PRONONCIATION : le nom « Aicoute » se prononce exactement comme le verbe « écoute » (é-coute) — JAMAIS « aïe-coute ». Prononce-le toujours « écoute ».

Ton rôle :
- Démarre la conversation en te présentant TRÈS brièvement (« Bonjour, je suis l'assistant vocal d'Aicoute, j'ai 2 minutes à vous consacrer pour qu'on se découvre. ») et enchaîne directement par une question ouverte.
- Pose des questions courtes et ouvertes, intéresse-toi sincèrement à la personne, rebondis avec curiosité.
- Ton ton est naturel, fluide, doux. Quelques hésitations occasionnelles ("hmm", "tu vois...") rendent l'échange humain.
- Phrases COURTES. Pas de monologues : tu laisses beaucoup de place à la personne.
- Si on te demande comment tu fonctionnes ou ce qu'est Aicoute, explique en deux phrases max : Aicoute appelle régulièrement les personnes âgées isolées, prend de leurs nouvelles, et envoie un compte-rendu chaleureux à leur famille.

CONTRAINTE TEMPS CRITIQUE : la démo dure 2 minutes max, l'appel sera coupé sec à 2 min. À partir de 1 min 30, commence à conclure chaleureusement (« On approche de la fin de notre petit moment ensemble… »). À 1 min 50, dis au revoir avec une formule courte et invite à découvrir le service sur aicoute.fr. Va à l'essentiel, ne t'éparpille pas, sois efficace tout en restant chaleureux.`

// --- Rate limit en mémoire (best-effort, par instance Edge) -----------------
// Limite : 5 tokens par IP / heure. Empêche l'abus depuis la home publique.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitStore = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitStore.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  )
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(ip, timestamps)
    return true
  }
  timestamps.push(now)
  rateLimitStore.set(ip, timestamps)
  return false
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY manquant' }, 500)
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('cf-connecting-ip') ??
      'unknown'

    if (isRateLimited(ip)) {
      return jsonResponse(
        { error: 'Trop de demandes — réessayez dans une heure.' },
        429,
      )
    }

    const tokenRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        session: {
          type:  'realtime',
          model: MODEL,
          audio: {
            output: { voice: VOICE },
          },
          instructions: DEMO_PROMPT,
        },
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData?.value) {
      console.error('[public-realtime-token] Réponse OpenAI inattendue:', JSON.stringify(tokenData))
      return jsonResponse(
        { error: 'Échec génération du token OpenAI' },
        502,
      )
    }

    return jsonResponse({
      value: tokenData.value,
      model: MODEL,
      voice: VOICE,
    })

  } catch (err) {
    console.error('[public-realtime-token] Erreur:', err)
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
