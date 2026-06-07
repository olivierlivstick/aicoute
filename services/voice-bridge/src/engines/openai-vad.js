// Réglage de la VAD / tour de parole OpenAI Realtime — jumeau de vad.js (Gemini).
//
// Deux symptômes de fluidité ciblés :
//
//   1. « Le blanc » = silence trop long avant que l'IA prenne la parole. Levier :
//      la détection de FIN de tour. Par défaut on passe en `semantic_vad` : un
//      modèle décide quand l'utilisateur a VRAIMENT fini (selon ses MOTS, pas
//      juste la durée de silence). Résultat : l'IA répond vite quand la phrase
//      est finie, sans couper une pause de réflexion — idéal pour des personnes
//      âgées qui parlent lentement. `eagerness` règle la nervosité (low|medium|
//      high|auto ; timeouts max ~8s/4s/2s). Défaut `medium` = compromis.
//
//   2. « Bruit d'ambiance » pris pour un coupage de parole (faux barge-in).
//      Leviers :
//        - noise_reduction : OpenAI FILTRE le bruit AVANT la VAD → moins de faux
//          déclenchements. `far_field` (haut-parleur / pièce — cas fréquent chez
//          les personnes âgées) ou `near_field` (combiné collé à l'oreille).
//        - en server_vad uniquement : `threshold` plus haut = exige une voix
//          plus franche (semantic_vad n'utilise pas de threshold).
//
// Tout surchargeable par variable d'env (même convention que GEMINI_VAD_*) → on
// itère les réglages à l'oreille en prod SANS redéploiement de code.
//
// KILL-SWITCH : OPENAI_VAD_DISABLED=true → on ne renvoie ni turn_detection ni
// noise_reduction (OpenAI reprend ses défauts) — rollback instantané.

const DISABLED = /^(1|true|yes|on)$/i.test(process.env.OPENAI_VAD_DISABLED || '')

// Type de détection de tour : 'semantic_vad' (défaut, cf. ci-dessus) ou 'server_vad'.
const TYPE = (process.env.OPENAI_VAD_TYPE || 'semantic_vad').toLowerCase()

// semantic_vad : low | medium | high | auto. Défaut 'medium' = bon compromis
// entre « répond vite » et « ne coupe pas une pause ».
const EAGERNESS = process.env.OPENAI_VAD_EAGERNESS || 'medium'

// server_vad : réglages classiques (utilisés UNIQUEMENT si OPENAI_VAD_TYPE=server_vad).
const THRESHOLD           = floatEnv('OPENAI_VAD_THRESHOLD', 0.5)
const PREFIX_PADDING_MS   = intEnv('OPENAI_VAD_PREFIX_PADDING_MS', 300)
const SILENCE_DURATION_MS = intEnv('OPENAI_VAD_SILENCE_DURATION_MS', 500)

// Réduction de bruit en entrée : 'far_field' (défaut) | 'near_field' | 'off'.
const NOISE_REDUCTION = (process.env.OPENAI_NOISE_REDUCTION || 'far_field').toLowerCase()

/**
 * Construit le bloc `turn_detection` à placer dans session.audio.input.
 * @returns {object | null} null si kill-switch (l'appelant n'ajoute alors rien).
 */
export function buildTurnDetection() {
  if (DISABLED) return null
  if (TYPE === 'server_vad') {
    return {
      type:                'server_vad',
      threshold:           THRESHOLD,
      prefix_padding_ms:   PREFIX_PADDING_MS,
      silence_duration_ms: SILENCE_DURATION_MS,
    }
  }
  // Défaut : semantic_vad
  return { type: 'semantic_vad', eagerness: EAGERNESS }
}

/**
 * Construit le bloc `noise_reduction` à placer dans session.audio.input.
 * @returns {{ type: 'near_field' | 'far_field' } | null} null si désactivé.
 */
export function buildNoiseReduction() {
  if (DISABLED) return null
  if (NOISE_REDUCTION !== 'near_field' && NOISE_REDUCTION !== 'far_field') return null
  return { type: NOISE_REDUCTION }
}

/** Résumé lisible pour les logs de setup. */
export function openaiVadSummary() {
  if (DISABLED) return 'désactivée (OPENAI_VAD_DISABLED)'
  const td = TYPE === 'server_vad'
    ? `server_vad thr=${THRESHOLD} prefix=${PREFIX_PADDING_MS}ms silence=${SILENCE_DURATION_MS}ms`
    : `semantic_vad eagerness=${EAGERNESS}`
  const nr = buildNoiseReduction() ? NOISE_REDUCTION : 'off'
  return `${td} · noise=${nr}`
}

function intEnv(name, dflt) {
  const v = process.env[name]
  if (v == null || v === '') return dflt
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : dflt
}

function floatEnv(name, dflt) {
  const v = process.env[name]
  if (v == null || v === '') return dflt
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : dflt
}
