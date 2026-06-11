// Réglage de la détection d'activité vocale (VAD) de Gemini Live.
//
// Problème : par défaut, Gemini coupe la voix de l'IA « au couteau » dès qu'il
// détecte le moindre son entrant (barge-in instantané) — un souffle, un
// raclement de gorge suffisent. Résultat : des interruptions très mécaniques,
// rien à voir avec une conversation humaine.
//
// Levier : Gemini expose la config de sa VAD dans le message `setup`
// (realtimeInputConfig.automaticActivityDetection).
//
// (A) DÉBUT de parole moins nerveux → moins de faux barge-in sur le BRUIT
//     D'AMBIANCE (un bruit bref ne doit pas couper la parole de l'IA) :
//   - startOfSpeechSensitivity = LOW  → il faut un signal de parole plus franc
//     pour déclencher l'interruption (ignore souffles / bruits brefs).
//   - prefixPaddingMs = 300           → ~300 ms de parole SOUTENUE requis avant
//     de valider le début de parole. ↑ = rejette mieux le bruit d'ambiance,
//     ↓ = interruptions plus réactives. (NB : Gemini n'a pas de filtre de bruit
//     dédié type noise_reduction — c'est le seul levier anti-bruit ici.)
//
// (B) FIN de parole = levier anti-« BLANC » (silence trop long avant que l'IA
//     réponde). Contrairement à OpenAI (semantic_vad), Gemini n'a PAS de
//     détection sémantique de fin de tour : seuls endOfSpeechSensitivity et
//     silenceDurationMs jouent. Laissés au défaut Gemini par défaut ici
//     (les durcir accélère la prise de parole mais risque de couper une
//     personne âgée qui marque une pause) → à régler À L'OREILLE par env :
//       GEMINI_VAD_SILENCE_DURATION_MS (ex. 600-800) = attente après le silence
//       GEMINI_VAD_END_SENSITIVITY (END_SENSITIVITY_HIGH = fin détectée plus tôt).
//
// Tout est réglable depuis /admin/sante (onglet Fine-tuning) — lu À CHAUD via le
// cache tuning.js (cascade DB → env → défaut), sans redémarrer Render. Les env
// (GEMINI_VAD_*) restent un filet/escape hatch.
//
// KILL-SWITCH : gemini_vad_disabled (DB) ou GEMINI_VAD_DISABLED=true → on n'injecte
// plus du tout le bloc, Gemini reprend son comportement par défaut au prochain appel.

import { getTuning } from '../persistence/tuning.js'

/**
 * Construit le bloc realtimeInputConfig à insérer dans le `setup` Gemini.
 * Lit les réglages courants (cache tuning) au moment de l'appel.
 * @returns {{ automaticActivityDetection: object } | null} null si désactivé.
 */
export function buildRealtimeInputConfig() {
  const t = getTuning()
  if (t.gemini_vad_disabled) return null

  const automaticActivityDetection = {
    disabled:                 false,
    startOfSpeechSensitivity: t.gemini_vad_start_sensitivity,
    prefixPaddingMs:          t.gemini_vad_prefix_padding_ms,
  }
  // Optionnels : seulement envoyés si réglés (sinon défaut Gemini, pour ne pas
  // ralentir la prise de parole de l'IA).
  if (t.gemini_vad_end_sensitivity)             automaticActivityDetection.endOfSpeechSensitivity = t.gemini_vad_end_sensitivity
  if (t.gemini_vad_silence_duration_ms != null) automaticActivityDetection.silenceDurationMs      = t.gemini_vad_silence_duration_ms

  return { automaticActivityDetection }
}

/** Résumé lisible pour les logs de setup. */
export function vadSummary() {
  const t = getTuning()
  if (t.gemini_vad_disabled) return 'désactivée'
  const parts = [`start=${t.gemini_vad_start_sensitivity}`, `prefix=${t.gemini_vad_prefix_padding_ms}ms`]
  if (t.gemini_vad_end_sensitivity)             parts.push(`end=${t.gemini_vad_end_sensitivity}`)
  if (t.gemini_vad_silence_duration_ms != null) parts.push(`silence=${t.gemini_vad_silence_duration_ms}ms`)
  return parts.join(' ')
}
