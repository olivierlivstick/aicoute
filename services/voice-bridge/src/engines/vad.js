// Réglage de la détection d'activité vocale (VAD) de Gemini Live.
//
// Problème : par défaut, Gemini coupe la voix de l'IA « au couteau » dès qu'il
// détecte le moindre son entrant (barge-in instantané) — un souffle, un
// raclement de gorge suffisent. Résultat : des interruptions très mécaniques,
// rien à voir avec une conversation humaine.
//
// Levier : Gemini expose la config de sa VAD dans le message `setup`
// (realtimeInputConfig.automaticActivityDetection). On rend la détection de
// DÉBUT de parole moins nerveuse :
//   - startOfSpeechSensitivity = LOW  → il faut un signal de parole plus franc
//     pour déclencher l'interruption (ignore souffles / bruits brefs).
//   - prefixPaddingMs = 200           → ~200 ms de vraie parole requis avant de
//     valider le début de parole (= la reco de Google : « attendre un vrai
//     mot »).
//
// On NE touche PAS par défaut à la détection de FIN de parole
// (endOfSpeechSensitivity / silenceDurationMs) : la durcir rendrait les
// réponses de l'IA plus lentes à démarrer. Réglable par env si besoin.
//
// Tout est surchargeable par variable d'env (même convention que GEMINI_MODEL /
// GEMINI_VOICE) → on itère les réglages sans redéploiement de code.
//
// KILL-SWITCH : GEMINI_VAD_DISABLED=true → on n'injecte plus du tout le bloc,
// Gemini reprend son comportement par défaut au prochain appel (rollback
// instantané sans redéploiement).

const DISABLED = /^(1|true|yes|on)$/i.test(process.env.GEMINI_VAD_DISABLED || '')

const START_SENSITIVITY = process.env.GEMINI_VAD_START_SENSITIVITY || 'START_SENSITIVITY_LOW'
const PREFIX_PADDING_MS  = intEnv('GEMINI_VAD_PREFIX_PADDING_MS', 200)

// Optionnels : seulement envoyés si explicitement définis en env (sinon on
// laisse le défaut Gemini pour ne pas ralentir la prise de parole de l'IA).
const END_SENSITIVITY     = process.env.GEMINI_VAD_END_SENSITIVITY || null
const SILENCE_DURATION_MS = intEnv('GEMINI_VAD_SILENCE_DURATION_MS', null)

/**
 * Construit le bloc realtimeInputConfig à insérer dans le `setup` Gemini.
 * @returns {{ automaticActivityDetection: object } | null} null si désactivé
 *          (kill-switch) → l'appelant n'ajoute alors rien au setup.
 */
export function buildRealtimeInputConfig() {
  if (DISABLED) return null

  const automaticActivityDetection = {
    disabled:                 false,
    startOfSpeechSensitivity: START_SENSITIVITY,
    prefixPaddingMs:          PREFIX_PADDING_MS,
  }
  if (END_SENSITIVITY)             automaticActivityDetection.endOfSpeechSensitivity = END_SENSITIVITY
  if (SILENCE_DURATION_MS != null) automaticActivityDetection.silenceDurationMs      = SILENCE_DURATION_MS

  return { automaticActivityDetection }
}

/** Résumé lisible pour les logs de setup. */
export function vadSummary() {
  if (DISABLED) return 'désactivée (GEMINI_VAD_DISABLED)'
  const parts = [`start=${START_SENSITIVITY}`, `prefix=${PREFIX_PADDING_MS}ms`]
  if (END_SENSITIVITY)             parts.push(`end=${END_SENSITIVITY}`)
  if (SILENCE_DURATION_MS != null) parts.push(`silence=${SILENCE_DURATION_MS}ms`)
  return parts.join(' ')
}

function intEnv(name, dflt) {
  const v = process.env[name]
  if (v == null || v === '') return dflt
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : dflt
}
