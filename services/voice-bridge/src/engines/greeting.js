// Démarrage de conversation — délai (ms) avant que l'IA ne salue (cf. CLAUDE.md
// « ④ blanc au démarrage »).
//
// DÉFAUT 0 = bonjour PROACTIF quasi immédiat : l'IA salue dès que le setup est
// prêt, sans attendre que l'interlocuteur parle. C'est le comportement validé à
// l'oreille le 2026-06-07 (le plus fluide pour ces appels).
//
// Valeur > 0 = mode « hybride » : on laisse cette fenêtre à l'interlocuteur pour
// dire « allô » d'abord ; s'il parle avant l'échéance, on annule le bonjour
// proactif et le VAD déclenche la réponse de l'IA à son « allô ». ⚠️ Testé et
// ABANDONNÉ par défaut : sur un mot court comme « allô ? », la détection de fin
// de tour (semantic_vad) hésite → blanc interminable avant la réponse. À ne
// réactiver que pour expérimenter (ex. GREETING_FALLBACK_MS=1200).
//
// Constante PARTAGÉE par les 5 bridges : appels planifiés OpenAI/Gemini + démos
// téléphone OpenAI/Gemini + démo web Gemini. Surchargée sans redéploiement par
// l'env GREETING_FALLBACK_MS (Render).
export const GREETING_FALLBACK_MS = (() => {
  const v = parseInt(process.env.GREETING_FALLBACK_MS ?? '', 10)
  return Number.isFinite(v) && v >= 0 ? v : 0
})()

// PROTECTION DU BONJOUR D'OUVERTURE (cf. CLAUDE.md « ④ »). Pendant que l'IA
// délivre son bonjour, on NE transmet PAS le micro de l'interlocuteur au moteur
// → un « allô » réflexe ne coupe pas le bonjour (sinon : troncature + long blanc
// avant la reprise). La porte micro se rouvre dès la fin du 1er tour (le
// bonjour), puis le barge-in normal reprend. Ce filet borne la durée MAX de
// protection au cas où l'event de fin de tour manquerait (sinon micro muté trop
// longtemps). Surchargé par l'env GREETING_PROTECT_MAX_MS.
export const GREETING_PROTECT_MAX_MS = (() => {
  const v = parseInt(process.env.GREETING_PROTECT_MAX_MS ?? '', 10)
  return Number.isFinite(v) && v > 0 ? v : 8000
})()
