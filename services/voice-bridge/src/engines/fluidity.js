// Tracker de FLUIDITÉ d'un appel — Étape 0 = OBSERVATION PURE.
//
// On capture pendant l'appel des signaux techniques bruts, puis on en fait un
// snapshot agrégé en fin d'appel (écrit dans calls.fluidity_metrics /
// demo_calls.fluidity_metrics). Aucun réglage automatique : on analysera les
// données à la main pour décider, plus tard, d'éventuels ajustements.
//
// Le tracker est ENGINE-AGNOSTIQUE : chaque bridge lui pousse les signaux qu'il
// a (les events diffèrent entre OpenAI et Gemini), et compute() ne renvoie que
// ce qui est calculable. Voir le câblage dans chaque engines/*-bridge.js.
//
// Trois symptômes ciblés (cf. encart « Fluidité de la conversation » de CLAUDE.md) :
//   - « le blanc » → latence entre la fin de parole de l'utilisateur et la
//     reprise de l'IA (blank.*).
//   - barge-in → l'utilisateur coupe l'IA (barge_in.total/per_min).
//   - bruit d'ambiance → barge-in non suivi de parole = bruit probable
//     (barge_in.suspected_false) ; « allô ? » répétés (presence_checks).
//
// ⚠️ Fiabilité variable selon le moteur :
//   - OpenAI émet `speech_stopped` → latence de tour PRÉCISE (approx=false).
//   - Gemini TÉLÉPHONE : pas d'event de fin de parole, MAIS le bridge fournit une
//     ancre acoustique via un détecteur d'énergie local (endpointing.js) qui
//     appelle onUserSpeechStop(at) → latence PRÉCISE (approx=false) elle aussi.
//   - Gemini sans ancre acoustique (ex. démo web, ou kill-switch endpointing) →
//     on retombe sur le dernier fragment de transcript user (proxy) → latence
//     APPROXIMATIVE (approx=true). Le proxy SOUS-ESTIME le « blanc » (la
//     transcription Gemini arrive en retard, collée à la réponse de l'IA).

/**
 * @param {object} [opts]
 * @param {boolean} [opts.hasUserTranscription] true si le bridge fournit le
 *   transcript user (onUserText). Conditionne presence_checks et
 *   barge_in.suspected_false (sinon null = « non mesurable »).
 */
export function createFluidityTracker({ hasUserTranscription = false } = {}) {
  const startedAt = Date.now()

  // --- prise de parole IA ---------------------------------------------------
  let firstAiAudioAt   = null
  let assistantSpeechMs = 0
  let aiSpeaking       = false
  let assistantTurns   = 0

  // --- ancres pour mesurer « le blanc » -------------------------------------
  let userStopAt     = null    // précis : OpenAI input_audio_buffer.speech_stopped
  let userTextAt     = null    // proxy : dernier fragment de transcript user (Gemini)
  let hasPreciseStop = false   // a-t-on reçu au moins un speech_stopped ?
  let userSpeechStops = 0
  const turnGapsMs   = []

  // --- barge-in -------------------------------------------------------------
  let bargeInTotal        = 0
  let bargeInAwaitingText = false  // armé à chaque barge-in, désarmé par onUserText
  let suspectedFalse      = 0

  // --- transcript user accumulé (pour presence_checks « allô ? ») -----------
  let userTextAll = ''

  /** Un chunk audio IA de `ms` millisecondes vient d'être émis vers l'auditeur. */
  function onAiAudio(ms) {
    const now = Date.now()
    if (firstAiAudioAt == null) firstAiAudioAt = now
    if (Number.isFinite(ms) && ms > 0) assistantSpeechMs += ms

    if (!aiSpeaking) {
      // Début d'un tour IA → on mesure le « blanc » depuis la dernière activité
      // user (stop précis prioritaire, sinon proxy texte).
      aiSpeaking = true
      const anchor = userStopAt ?? userTextAt
      if (anchor != null) {
        const gap = now - anchor
        if (gap >= 0 && gap < 30000) turnGapsMs.push(Math.round(gap))
      }
      userStopAt = null
      userTextAt = null
      // Un barge-in qui n'a PAS été suivi de parole avant que l'IA reprenne →
      // probablement déclenché par du bruit.
      if (bargeInAwaitingText) { suspectedFalse++; bargeInAwaitingText = false }
    }
  }

  /** L'IA a terminé un tour (turnComplete Gemini / response.done OpenAI). */
  function onAiTurnComplete() {
    if (aiSpeaking) assistantTurns++
    aiSpeaking = false
  }

  /** VAD : l'utilisateur a commencé à parler (non utilisé pour l'instant, réservé). */
  function onUserSpeechStart() { /* réservé */ }

  /**
   * Fin de parole user → ancre PRÉCISE du « blanc ».
   * @param {number} [at] timestamp (Date.now-style) de l'arrêt. Par défaut now.
   *   OpenAI appelle sans argument (sur `speech_stopped`). Gemini téléphone passe
   *   le timestamp du détecteur d'énergie (endpointing.js), légèrement dans le
   *   passé (= début du silence) → ancre au plus proche de l'arrêt réel.
   */
  function onUserSpeechStop(at) {
    userStopAt = at ?? Date.now()
    hasPreciseStop = true
    userSpeechStops++
  }

  /** Un fragment de transcription user est arrivé (tout moteur qui l'expose). */
  function onUserText(text) {
    if (!text || !text.trim()) return
    userTextAt = Date.now()
    userTextAll += ' ' + text
    bargeInAwaitingText = false
  }

  /** L'utilisateur a coupé l'IA (interrupted Gemini / speech_started en cours de parole IA). */
  function onBargeIn() {
    bargeInTotal++
    // L'IA a été coupée → son tour est terminé de fait : le prochain audio IA
    // comptera comme un nouveau tour (et mesurera le « blanc » de reprise).
    aiSpeaking = false
    if (hasUserTranscription) bargeInAwaitingText = true
  }

  /** Snapshot final. transcript optionnel (pour turns.user) ; engine = moteur effectif. */
  function compute(transcript, durationSeconds, engine) {
    const durSec  = Math.max(1, Math.round(durationSeconds || 0))
    const startMs = firstAiAudioAt != null ? (firstAiAudioAt - startedAt) : null

    const gaps = turnGapsMs.slice().sort((a, b) => a - b)
    const avg  = gaps.length ? Math.round(gaps.reduce((s, x) => s + x, 0) / gaps.length) : null
    const p90  = gaps.length ? gaps[Math.ceil(0.9 * gaps.length) - 1] : null
    const max  = gaps.length ? gaps[gaps.length - 1] : null

    // presence_checks : « allô ? », « vous êtes là ? » dans le transcript user.
    let presence = null
    if (hasUserTranscription && userTextAll.trim()) {
      const matches = matchPresence(userTextAll)
      presence = { count: matches.length, matches: matches.slice(0, 20) }
    }

    // turns.user : depuis le transcript si fourni (prod), sinon nb de fins de
    // parole détectées (OpenAI), sinon null.
    const userTurns = Array.isArray(transcript) && transcript.length
      ? transcript.filter((e) => e.role === 'user').length
      : (hasPreciseStop ? userSpeechStops : null)

    return {
      engine,
      duration_seconds: durSec,
      turns: { assistant: assistantTurns, user: userTurns },
      blank: {
        start_ms:    startMs,
        turn_avg_ms: avg,
        turn_p90_ms: p90,
        turn_max_ms: max,
        samples:     gaps.length,
        samples_ms:  turnGapsMs.slice(0, 100),  // brut pour analyse, borné
        approx:      !hasPreciseStop,            // Gemini = proxy transcript
      },
      barge_in: {
        total:           bargeInTotal,
        per_min:         +(bargeInTotal / (durSec / 60)).toFixed(2),
        suspected_false: hasUserTranscription ? suspectedFalse : null,
      },
      presence_checks:     presence,
      assistant_speech_ms: Math.round(assistantSpeechMs),
      speech_ratio:        +Math.min(1, assistantSpeechMs / (durSec * 1000)).toFixed(2),
    }
  }

  return {
    onAiAudio, onAiTurnComplete,
    onUserSpeechStart, onUserSpeechStop, onUserText,
    onBargeIn, compute,
  }
}

// --- Helpers durée audio (sans allouer de Buffer par chunk) -----------------

/** Longueur en octets d'une string base64 (sans padding, sans retours ligne). */
export function b64Bytes(b64) {
  if (!b64) return 0
  const len = b64.length
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor(len * 3 / 4) - pad
}

/** Durée (ms) d'un payload µ-law 8 kHz base64 (1 octet = 1 échantillon, 8000/s). */
export function mulaw8kMs(b64) {
  return b64Bytes(b64) / 8
}

/** Durée (ms) d'un payload PCM16 base64 (2 octets/échantillon). rateHz défaut 24000. */
export function pcm16Ms(b64, rateHz = 24000) {
  return (b64Bytes(b64) / 2) / rateHz * 1000
}

// --- Détection « allô ? » (signaux de vérification de présence) -------------
// On vise la PRÉCISION : on ne matche QUE des marqueurs téléphoniques sans
// ambiguïté avec une salutation (« allô / pronto ») + les phrases explicites
// « êtes-vous là / m'entendez-vous ». On évite « hello / hola / hallo » seuls,
// qui sont aussi des bonjours. Heuristique — à affiner après analyse des données.
const PRESENCE_PATTERNS = [
  /\ball[oô]+\b/gi,                                   // FR/EN « allô / allo »
  /\bpronto\b/gi,                                     // IT
  /\b(vous\s+)?[êe]tes[- ]vous\s+l[àa]\b/gi,          // FR « êtes-vous là »
  /\bvous\s+[êe]tes\s+l[àa]\b/gi,                     // FR « vous êtes là »
  /\b(il\s+)?y\s*a[- ]t[- ]il\s+quelqu['e]un\b/gi,    // FR « y a-t-il quelqu'un »
  /\by\s+a\s+quelqu['e]un\b/gi,                        // FR « y a quelqu'un »
  /\bvous\s+m['e]?\s*entendez\b/gi,                    // FR « vous m'entendez »
  /\bare\s+you\s+(still\s+)?there\b/gi,                // EN
  /\bcan\s+you\s+hear\s+me\b/gi,                       // EN
  /\best[áa]s?\s+ah[íi]\b/gi,                           // ES « estás/está ahí »
  /\bhay\s+alguien\b/gi,                               // ES
  /\bsind\s+sie\s+(noch\s+)?da\b/gi,                   // DE
  /\bc['i]?\s*sei\b/gi,                                 // IT « ci sei »
  /\bmi\s+senti\b/gi,                                  // IT
]

function matchPresence(text) {
  const found = []
  const t = text.toLowerCase()
  for (const re of PRESENCE_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(t)) !== null) {
      found.push(m[0].trim())
      if (m.index === re.lastIndex) re.lastIndex++  // garde-fou anti-boucle
    }
  }
  return found
}
