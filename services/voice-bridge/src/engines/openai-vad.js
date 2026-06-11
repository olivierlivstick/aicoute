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
//      high|auto ; timeouts max ~8s/4s/2s). Défaut `high` = prise de parole la
//      plus rapide possible après une phrase finie (objectif fluidité : minimiser
//      « le blanc »). Si on observe que l'IA coupe des pauses de réflexion chez
//      certains bénéficiaires, repli immédiat via OPENAI_VAD_EAGERNESS=medium.
//
//   2. « Bruit d'ambiance » pris pour un coupage de parole (faux barge-in).
//      Leviers :
//        - noise_reduction : OpenAI FILTRE le bruit AVANT la VAD → moins de faux
//          déclenchements. `far_field` (haut-parleur / pièce — cas fréquent chez
//          les personnes âgées) ou `near_field` (combiné collé à l'oreille).
//        - en server_vad uniquement : `threshold` plus haut = exige une voix
//          plus franche (semantic_vad n'utilise pas de threshold).
//
// Tout réglable depuis /admin/sante (onglet Fine-tuning) — lu À CHAUD via le cache
// tuning.js (cascade DB → env → défaut), sans redémarrer Render. Env (OPENAI_VAD_*)
// = filet/escape hatch.
//
// KILL-SWITCH : openai_vad_disabled (DB) ou OPENAI_VAD_DISABLED=true → on ne renvoie
// ni turn_detection ni noise_reduction (OpenAI reprend ses défauts) — rollback instantané.

import { getTuning } from '../persistence/tuning.js'

/**
 * Construit le bloc `turn_detection` à placer dans session.audio.input.
 * @returns {object | null} null si kill-switch (l'appelant n'ajoute alors rien).
 */
export function buildTurnDetection() {
  const t = getTuning()
  if (t.openai_vad_disabled) return null
  if (t.openai_vad_type === 'server_vad') {
    return {
      type:                'server_vad',
      threshold:           t.openai_vad_threshold,
      prefix_padding_ms:   t.openai_vad_prefix_padding_ms,
      silence_duration_ms: t.openai_vad_silence_duration_ms,
    }
  }
  // Défaut : semantic_vad
  return { type: 'semantic_vad', eagerness: t.openai_vad_eagerness }
}

/**
 * Construit le bloc `noise_reduction` à placer dans session.audio.input.
 * @returns {{ type: 'near_field' | 'far_field' } | null} null si désactivé.
 */
export function buildNoiseReduction() {
  const t = getTuning()
  if (t.openai_vad_disabled) return null
  const nr = t.openai_noise_reduction
  if (nr !== 'near_field' && nr !== 'far_field') return null
  return { type: nr }
}

/** Résumé lisible pour les logs de setup. */
export function openaiVadSummary() {
  const t = getTuning()
  if (t.openai_vad_disabled) return 'désactivée'
  const td = t.openai_vad_type === 'server_vad'
    ? `server_vad thr=${t.openai_vad_threshold} prefix=${t.openai_vad_prefix_padding_ms}ms silence=${t.openai_vad_silence_duration_ms}ms`
    : `semantic_vad eagerness=${t.openai_vad_eagerness}`
  const nr = buildNoiseReduction() ? t.openai_noise_reduction : 'off'
  return `${td} · noise=${nr}`
}
