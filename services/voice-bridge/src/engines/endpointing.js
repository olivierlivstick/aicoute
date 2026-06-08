// Détecteur de FIN DE PAROLE acoustique (endpointing) par énergie — INSTRUMENT
// DE MESURE, pas un réglage.
//
// Pourquoi : côté Gemini, on n'a aucun event de fin de parole. Le tracker de
// fluidité se rabattait sur un proxy (l'horodatage du dernier fragment de
// transcript user), mais la transcription Gemini ARRIVE EN RETARD → l'ancre se
// retrouve collée juste avant la réponse de l'IA, ce qui ÉCRASE le « blanc »
// mesuré vers 0 (cf. /admin/qualite : Gemini ~64 ms alors que l'oreille perçoit
// un silence bien plus long). Inutilisable pour juger la latence de fin de tour.
//
// Ce module écoute l'audio ENTRANT de l'interlocuteur (µ-law téléphone décodé en
// PCM8) et détecte, par seuil d'énergie, le moment où il ARRÊTE acoustiquement
// de parler. Ce timestamp devient l'ancre PRÉCISE du « blanc » (fluidity
// onUserSpeechStop) → blank.approx passe à false côté Gemini téléphone.
//
// ⚠️ LECTURE SEULE : on ne fait qu'observer une copie de l'audio. On ne touche
// NI à ce que Gemini reçoit, NI à sa VAD (qui décide quand répondre). On mesure,
// on ne règle pas.
//
// Algorithme (volontairement simple, suffisant pour de l'observation) :
//   - RMS par frame (~20 ms de Twilio).
//   - Plancher de bruit adaptatif (EMA sur les frames de silence) → robuste aux
//     lignes plus ou moins bruitées. Seuil de parole = max(MIN_RMS, floor×FACTOR).
//   - Parole confirmée après ONSET_MS au-dessus du seuil (rejette les clics).
//   - Fin déclarée après HANG_MS de silence continu → on émet onSpeechStop avec
//     pour timestamp la DERNIÈRE frame de parole (= début du silence, pas la fin
//     du hangover) → ancre proche de l'arrêt acoustique réel.
//
// Sur-segmentation inoffensive : si une pause intra-phrase dépasse HANG_MS, on
// émet un stop « trop tôt », mais le tracker ne retient que le DERNIER stop avant
// que l'IA reprenne la parole (userStopAt est écrasé à chaque appel) → l'ancre
// finale reste correcte.
//
// KILL-SWITCH : GEMINI_ENDPOINT_DISABLED=true → feed() devient un no-op, on
// retombe sur le proxy transcript (approx=true). Réglable par env sans redéploy.

const DISABLED   = /^(1|true|yes|on)$/i.test(process.env.GEMINI_ENDPOINT_DISABLED || '')
const HANG_MS    = intEnv('GEMINI_ENDPOINT_HANG_MS', 350)   // silence continu → fin de tour
const ONSET_MS   = intEnv('GEMINI_ENDPOINT_ONSET_MS', 80)   // parole continue → début confirmé
const MIN_RMS    = intEnv('GEMINI_ENDPOINT_MIN_RMS', 500)   // plancher absolu (PCM16)
const FLOOR_FACTOR = 4        // seuil = max(MIN_RMS, plancherBruit × FLOOR_FACTOR)
const FLOOR_ALPHA  = 0.05     // vitesse d'adaptation du plancher de bruit

/**
 * @param {object} opts
 * @param {(atMs: number) => void} opts.onSpeechStop  appelé à la fin de parole
 *   acoustique, avec le timestamp (Date.now-style) de l'arrêt.
 * @param {number} [opts.sampleRate=8000]  fréquence des échantillons fournis.
 * @returns {{ feed(samples: Int16Array): void, enabled: boolean }}
 */
export function createEndpointDetector({ onSpeechStop, sampleRate = 8000 } = {}) {
  if (DISABLED) {
    return { feed() { /* no-op */ }, enabled: false }
  }

  const samplesPerMs = sampleRate / 1000

  let noiseFloor   = 150   // plancher de bruit courant (RMS PCM16)
  let inSpeech     = false
  let speechMs     = 0     // durée de parole continue accumulée
  let silenceMs    = 0     // durée de silence continu accumulée
  let lastSpeechAt = null  // Date.now() de la dernière frame de parole

  function feed(samples) {
    if (!samples || samples.length === 0) return
    const now     = Date.now()
    const frameMs = samples.length / samplesPerMs
    const rms     = rmsOf(samples)
    const threshold = Math.max(MIN_RMS, noiseFloor * FLOOR_FACTOR)

    if (rms > threshold) {
      silenceMs = 0
      speechMs += frameMs
      if (speechMs >= ONSET_MS) {
        inSpeech     = true
        lastSpeechAt = now
      }
    } else {
      // Frame de silence → on adapte lentement le plancher de bruit.
      noiseFloor += (rms - noiseFloor) * FLOOR_ALPHA
      speechMs = 0
      if (inSpeech) {
        silenceMs += frameMs
        if (silenceMs >= HANG_MS) {
          inSpeech = false
          if (lastSpeechAt != null) onSpeechStop(lastSpeechAt)
          lastSpeechAt = null
        }
      }
    }
  }

  return { feed, enabled: true }
}

/** Résumé lisible pour les logs de setup. */
export function endpointSummary() {
  if (DISABLED) return 'désactivé (GEMINI_ENDPOINT_DISABLED)'
  return `hang=${HANG_MS}ms onset=${ONSET_MS}ms minRms=${MIN_RMS}`
}

function rmsOf(samples) {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    sum += s * s
  }
  return Math.sqrt(sum / samples.length)
}

function intEnv(name, dflt) {
  const v = process.env[name]
  if (v == null || v === '') return dflt
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : dflt
}
