// Contrôle d'admission — borne le nombre d'appels VOCAUX simultanés.
//
// Pourquoi : le voice-bridge est un process Node unique par instance Render.
// Chaque appel = 1 WS Twilio + 1 connexion moteur IA + (Gemini) transcodage
// µ-law↔PCM par frame (CPU réel). Au-delà d'un certain nombre d'appels en
// parallèle, la qualité de TOUS les appels en cours se dégrade. Mieux vaut
// REFUSER proprement un nouvel appel (l'entrant : <Reject> busy ; le sortant :
// on ne sature pas) que hacher la conversation de tout le monde.
//
// Deux usages :
//   - Contrôle d'admission : acquireCallSlot() avant d'accepter un appel ;
//     false → on refuse. Armé seulement si MAX_CONCURRENT_CALLS > 0.
//   - Observabilité PURE (toujours active) : on suit le nombre d'appels actifs
//     et on journalise le pic dans system_events → Olivier voit la charge réelle
//     et peut choisir une valeur de MAX_CONCURRENT_CALLS en connaissance de cause.
//
// MAX_CONCURRENT_CALLS : défaut 0 = ILLIMITÉ (mécanisme désarmé, comportement
// inchangé). Le mécanisme est livré prêt à armer ; on l'active via l'env quand
// on connaît le plafond réel de l'instance Render. La mesure, elle, tourne dès
// maintenant.

import { logEvent as logSystemEvent } from './persistence/system-events.js'

const MAX_CONCURRENT_CALLS = Number(process.env.MAX_CONCURRENT_CALLS || 0)

let active   = 0   // appels vocaux actuellement en cours
let peak     = 0   // pic observé depuis le démarrage (pour le log d'observabilité)
let rejected = 0   // appels refusés faute de slot (depuis le démarrage)

export function getActiveCalls() { return active }
export function getPeakCalls()   { return peak }

/**
 * Tente de réserver un slot d'appel. À appeler AVANT d'accepter un nouvel appel.
 *
 * @param {{ label?: string, callId?: string|null }} [opts]
 * @returns {boolean} true = slot accordé (appelant DOIT releaseCallSlot() à la
 *   fin) ; false = capacité atteinte, l'appelant doit refuser l'appel.
 */
export function acquireCallSlot(opts = {}) {
  const { label = 'call', callId = null } = opts

  if (MAX_CONCURRENT_CALLS > 0 && active >= MAX_CONCURRENT_CALLS) {
    rejected++
    console.warn(`⛔ [admission] capacité atteinte (${active}/${MAX_CONCURRENT_CALLS}) — refus ${label}`)
    void logSystemEvent({
      level:   'warn',
      source:  'voice-bridge/admission',
      message: `Appel refusé : capacité maximale atteinte (${active}/${MAX_CONCURRENT_CALLS})`,
      call_id: callId,
      payload: { label, active, max: MAX_CONCURRENT_CALLS, rejected_total: rejected },
    })
    return false
  }

  active++
  if (active > peak) {
    peak = active
    // On journalise chaque NOUVEAU pic (un seul event par palier franchi) →
    // historique de charge dans /admin/sante sans spammer system_events.
    void logSystemEvent({
      level:   'info',
      source:  'voice-bridge/admission',
      message: `Nouveau pic d'appels simultanés : ${peak}`,
      call_id: callId,
      payload: { label, active, peak, max: MAX_CONCURRENT_CALLS || null },
    })
  }
  return true
}

/** Libère un slot précédemment réservé. À appeler une seule fois, à la fin de l'appel. */
export function releaseCallSlot() {
  if (active > 0) active--
}
