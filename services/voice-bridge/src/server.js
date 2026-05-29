// MODECT — voice-bridge
// Service Node hébergé sur Render. Fait :
//   - POST /call         déclenche un appel sortant Twilio vers le numéro fourni
//   - POST /outgoing     TwiML servi à Twilio quand le destinataire décroche
//   - WSS  /media-stream pont audio Twilio ↔ moteur conversationnel
//                        (OpenAI Realtime ou Google Gemini Live au choix)
//   - GET  /health       healthcheck Render + état des moteurs configurés
//
// Aucun frontend ici : c'est uniquement une API + un WebSocket. Le front
// (apps/web/src/marketing/components/DemoPhoneModal.tsx) appelle /call.
//
// Architecture :
//   - server.js (ici) : lifecycle Twilio + dispatch vers le bon engine module
//   - engines/openai-bridge.js : pont OpenAI (audio µ-law direct, pas de conversion)
//   - engines/gemini-bridge.js : pont Gemini (conversion µ-law ↔ PCM16 16/24kHz)
//   - engines/audio.js : helpers conversion audio (utilisé par gemini-bridge)
//
// Sécurité / robustesse :
//   - pas de ngrok (Render expose le service publiquement)
//   - CORS verrouillé sur les origines vitrine
//   - rate-limit par IP + par numéro destinataire
//   - coupure serveur de sécurité à MAX_CALL_SECONDS pour éviter les facturations qui dérapent

import express from 'express'
import { WebSocketServer } from 'ws'
import twilio from 'twilio'
import 'dotenv/config'

import { rateLimit, LIMITS } from './rateLimit.js'
import { recordDemoStart, recordDemoEnd, computeAiCostEur } from './tracking.js'
import { createOpenaiBridge } from './engines/openai-bridge.js'
import { createGeminiBridge } from './engines/gemini-bridge.js'
import { createGeminiBridgeWeb } from './engines/gemini-bridge-web.js'
import { createModectCallBridge } from './engines/modect-call-bridge.js'
import {
  markCallInProgress,
  recordCallTokens,
  markCallByTwilioStatus,
  findCallIdByTwilioSid,
} from './persistence/modect-call.js'
import { logEvent as logSystemEvent } from './persistence/system-events.js'

// --- Config ----------------------------------------------------------------

const PORT             = Number(process.env.PORT || 5050)
const MAX_CALL_SECONDS = Number(process.env.MAX_CALL_SECONDS || 240)
// Appels planifiés : durée beaucoup plus longue qu'une démo (cible 5-15 min)
const MAX_SCHEDULED_CALL_SECONDS = Number(process.env.MAX_SCHEDULED_CALL_SECONDS || 900)
// Sonnerie max côté Twilio avant de basculer en no-answer (passe B prend ensuite le relais)
const SCHEDULED_RING_TIMEOUT = Number(process.env.SCHEDULED_RING_TIMEOUT || 30)

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Variable d'environnement manquante : ${name}`)
    process.exit(1)
  }
  return v
}

const OPENAI_API_KEY     = requireEnv('OPENAI_API_KEY')
const TWILIO_ACCOUNT_SID = requireEnv('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN  = requireEnv('TWILIO_AUTH_TOKEN')
const TWILIO_NUMBER      = requireEnv('TWILIO_NUMBER')
// Gemini est optionnel : si absent, l'engine 'gemini' est refusé à /call (503).
// Permet de déployer le service avec OpenAI seul et d'activer Gemini plus tard
// sans modifier le code (juste ajouter GOOGLE_API_KEY dans les vars Render).
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? null

// Pour les appels planifiés Modect : appels Supabase Edge Functions internes.
// Le token est partagé avec Supabase (get-call-context le vérifie).
// Si absent → /scheduled-call sera refusé en 503 (le service reste utilisable
// pour la démo vitrine).
const MODECT_INTERNAL_TOKEN     = process.env.MODECT_INTERNAL_TOKEN     ?? null
const SUPABASE_URL              = process.env.SUPABASE_URL              ?? null
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null
const SCHEDULED_CALLS_ENABLED   =
  MODECT_INTERNAL_TOKEN !== null &&
  SUPABASE_URL          !== null &&
  SUPABASE_SERVICE_ROLE_KEY !== null

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

// --- App Express -----------------------------------------------------------

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS — uniquement pour le front (Twilio ne fait pas de requêtes CORS).
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

// --- Health ----------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    ok:      true,
    service: 'voice-bridge',
    engines: {
      openai: true,                  // toujours présent (env required)
      gemini: GOOGLE_API_KEY !== null,
    },
    scheduledCalls: SCHEDULED_CALLS_ENABLED,
  })
})

// --- Déclenchement d'appel sortant -----------------------------------------

// Limite serveur de la phrase d'ouverture (cohérent avec le front, double check
// au cas où quelqu'un POST direct sans passer par le formulaire).
const OPENER_MAX_LENGTH = 500

app.post('/call', async (req, res) => {
  try {
    const { phoneNumber, opener, engine: engineRaw } = req.body ?? {}

    const cleaned = String(phoneNumber || '').replace(/\s/g, '')
    if (!cleaned.match(/^\+\d{8,15}$/)) {
      return res.status(400).json({ error: 'Numéro invalide. Format attendu : +33XXXXXXXXX.' })
    }

    // Engine : 'openai' (défaut) ou 'gemini' (refusé si pas configuré)
    const engine = engineRaw === 'gemini' ? 'gemini' : 'openai'
    if (engine === 'gemini' && !GOOGLE_API_KEY) {
      return res.status(503).json({ error: 'Le moteur Gemini n\'est pas configuré sur ce serveur.' })
    }

    const openerClean = String(opener ?? '').trim().slice(0, OPENER_MAX_LENGTH)

    const ip =
      (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()) ||
      req.socket.remoteAddress ||
      'unknown'

    const ipCheck = rateLimit({ key: `ip:${ip}`, ...LIMITS.perIp })
    if (!ipCheck.ok) {
      return res.status(429).json({
        error: 'Trop d\'appels depuis votre adresse. Réessayez dans une heure.',
      })
    }

    const numCheck = rateLimit({ key: `num:${cleaned}`, ...LIMITS.perNumber })
    if (!numCheck.ok) {
      return res.status(429).json({
        error: 'Ce numéro a déjà été utilisé plusieurs fois aujourd\'hui pour la démo.',
      })
    }

    // L'URL publique d'origine du service (Render fournit X-Forwarded-Host).
    const host  = req.headers['x-forwarded-host'] || req.headers.host
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const publicBase = `${proto}://${host}`

    // Tracking : INSERT row demo_calls AVANT l'appel Twilio (best-effort).
    // L'engine est persisté dès le start pour avoir le bon discriminant même
    // si l'appel échoue avant que la WS ne s'établisse.
    const demoCallId = await recordDemoStart(cleaned, engine)

    // demoCallId + opener + engine passés en query, /outgoing les retransmet via
    // TwiML <Parameter> → la WS les récupère dans l'event 'start' (customParameters)
    const queryParts = []
    if (demoCallId)  queryParts.push(`demoCallId=${encodeURIComponent(demoCallId)}`)
    if (openerClean) queryParts.push(`opener=${encodeURIComponent(openerClean)}`)
    queryParts.push(`engine=${encodeURIComponent(engine)}`)
    const outgoingUrl = `${publicBase}/outgoing?${queryParts.join('&')}`

    const call = await twilioClient.calls.create({
      to:   cleaned,
      from: TWILIO_NUMBER,
      url:  outgoingUrl,
    })

    console.log(`📞 Appel sortant initié vers ${maskNumber(cleaned)} engine=${engine} (sid: ${call.sid}${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''})`)
    res.json({ ok: true, callSid: call.sid })
  } catch (err) {
    console.error('❌ /call :', err)
    res.status(500).json({ error: err?.message || 'Erreur interne' })
  }
})

// --- TwiML servi à Twilio quand le destinataire décroche -------------------

app.all('/outgoing', (req, res) => {
  const host       = req.headers['x-forwarded-host'] || req.headers.host
  const demoCallId = (req.query.demoCallId ?? req.body?.demoCallId ?? '').toString()
  const opener     = (req.query.opener     ?? req.body?.opener     ?? '').toString()
  const engine     = (req.query.engine     ?? req.body?.engine     ?? 'openai').toString()
  console.log(`📩 /outgoing reçu (engine=${engine}, demoCallId=${demoCallId ? 'yes' : 'no'}, opener=${opener ? `"${opener.substring(0, 50)}…"` : 'no'})`)
  // <Parameter> est retransmis à la WS dans event start (data.start.customParameters)
  const params = []
  if (demoCallId) params.push(`      <Parameter name="demoCallId" value="${escapeXml(demoCallId)}" />`)
  if (opener)     params.push(`      <Parameter name="opener" value="${escapeXml(opener)}" />`)
  params.push(`      <Parameter name="engine" value="${escapeXml(engine)}" />`)
  const paramTags = params.join('\n') + '\n'
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream">
${paramTags}    </Stream>
  </Connect>
</Response>`
  res.type('text/xml').send(twiml)
})

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// --- Appels planifiés Modect (Twilio sortant → bénéficiaire réel) ----------
//
// Auth : header Authorization: Bearer ${MODECT_INTERNAL_TOKEN}.
// Pas de rate-limit IP / numéro : c'est l'Edge Function `initiate-call` qui
// appelle, et le worker Modect est seul responsable du rythme via les passes
// A/B/C de schedule-calls.

app.post('/scheduled-call', async (req, res) => {
  if (!SCHEDULED_CALLS_ENABLED) {
    return res.status(503).json({ error: 'Appels planifiés non configurés (MODECT_INTERNAL_TOKEN / SUPABASE_* manquants)' })
  }
  const auth = req.headers.authorization ?? ''
  if (auth !== `Bearer ${MODECT_INTERNAL_TOKEN}`) {
    return res.status(401).json({ error: 'Forbidden' })
  }

  try {
    const { call_id: callId, phone } = req.body ?? {}
    if (!callId || typeof callId !== 'string') {
      return res.status(400).json({ error: 'call_id requis' })
    }
    const cleaned = String(phone || '').replace(/\s/g, '')
    if (!cleaned.match(/^\+\d{8,15}$/)) {
      return res.status(400).json({ error: 'Numéro invalide. Format attendu : +33XXXXXXXXX.' })
    }

    const host  = req.headers['x-forwarded-host'] || req.headers.host
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const publicBase = `${proto}://${host}`

    // call_id passé via query → /scheduled-outgoing le retransmet en <Parameter>
    const outgoingUrl = `${publicBase}/scheduled-outgoing?call_id=${encodeURIComponent(callId)}`

    // statusCallback : Twilio nous notifie des changements de statut de l'appel
    // (no-answer, busy, failed, completed). On l'utilise pour court-circuiter
    // la passe B no-answer qui attendrait 120s par défaut.
    const statusCallbackUrl = `${publicBase}/scheduled-status`

    const call = await twilioClient.calls.create({
      to:                   cleaned,
      from:                 TWILIO_NUMBER,
      url:                  outgoingUrl,
      timeout:              SCHEDULED_RING_TIMEOUT,
      statusCallback:       statusCallbackUrl,
      statusCallbackEvent:  ['completed', 'no-answer', 'busy', 'failed', 'canceled'],
      statusCallbackMethod: 'POST',
    })

    console.log(`📞 [scheduled] Appel sortant vers ${maskNumber(cleaned)} (callId: ${callId.slice(0, 8)}…, sid: ${call.sid})`)
    res.json({ ok: true, callSid: call.sid })
  } catch (err) {
    console.error('❌ /scheduled-call :', err)
    res.status(500).json({ error: err?.message || 'Erreur interne' })
  }
})

// Webhook Twilio appelé à chaque transition de statut (no-answer, busy, failed,
// canceled, completed). On marque le call Modect en conséquence — le bénéfice
// principal est de détecter le no-answer en quelques secondes au lieu d'attendre
// la passe B qui tourne toutes les minutes avec un délai par défaut de 120s.
//
// Sécurité : on ne vérifie pas la signature X-Twilio-Signature pour l'instant
// (low-risk : impact = marquer un call missed/failed sans appel sortant) ;
// à ajouter si l'observabilité montre des écrits parasites.
app.post('/scheduled-status', async (req, res) => {
  const sid    = req.body?.CallSid
  const status = req.body?.CallStatus
  if (!sid || !status) {
    return res.status(400).end()
  }

  try {
    const callId = await findCallIdByTwilioSid(sid)
    const applied = await markCallByTwilioStatus(sid, status)
    if (applied) {
      console.log(`📞 [scheduled-status] sid=${sid.slice(0, 12)}… status=${status} → call marqué ${applied}`)
      void logSystemEvent({
        level:   applied === 'failed' ? 'warn' : 'info',
        source:  'voice-bridge/twilio-status',
        call_id: callId,
        message: `Twilio status=${status} → call marqué ${applied}`,
        payload: { twilio_sid: sid, twilio_status: status },
      })
    }
    // Toujours 200 pour que Twilio n'insiste pas avec des retries
    res.status(200).end()
  } catch (err) {
    console.error('❌ /scheduled-status :', err)
    res.status(200).end()  // idem, on absorbe pour éviter les retries Twilio
  }
})

app.all('/scheduled-outgoing', (req, res) => {
  const host    = req.headers['x-forwarded-host'] || req.headers.host
  const callId  = (req.query.call_id ?? req.body?.call_id ?? '').toString()
  console.log(`📩 /scheduled-outgoing reçu (callId: ${callId ? callId.slice(0, 8) + '…' : 'no'})`)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/scheduled-media-stream">
      <Parameter name="call_id" value="${escapeXml(callId)}" />
    </Stream>
  </Connect>
</Response>`
  res.type('text/xml').send(twiml)
})

// --- Démarrage HTTP + WebSocket --------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`✅ voice-bridge écoute sur :${PORT}`)
  console.log(`   engines : openai=on gemini=${GOOGLE_API_KEY ? 'on' : 'off'}`)
  console.log(`   maxCall=${MAX_CALL_SECONDS}s`)
  if (ALLOWED_ORIGINS.length) {
    console.log(`   CORS autorisé pour : ${ALLOWED_ORIGINS.join(', ')}`)
  } else {
    console.warn('   ⚠️ ALLOWED_ORIGINS vide → CORS ouvert à toutes origines')
  }
})

// Deux endpoints WebSocket sur le même HTTP server :
//   /media-stream    → audio Twilio (appels téléphone)
//   /ws/gemini-web   → audio navigateur (démo web Gemini)
//
// IMPORTANT : on ne peut PAS créer deux WebSocketServer avec { server, path }
// car le module `ws` v8 fait abortHandshake(400) quand le path ne matche pas,
// ce qui empêche le 2e WSS de voir la requête. On crée donc les WSS en mode
// noServer et on dispatche nous-mêmes l'event 'upgrade' selon le pathname.

const wss          = new WebSocketServer({ noServer: true })  // Twilio /media-stream (démo vitrine)
const wssWeb       = new WebSocketServer({ noServer: true })  // browser /ws/gemini-web (démo vitrine)
const wssScheduled = new WebSocketServer({ noServer: true })  // Twilio /scheduled-media-stream (appels Modect)

function abortHandshake(socket, code, message = '') {
  socket.write(
    `HTTP/1.1 ${code} ${message}\r\n` +
    `Connection: close\r\n` +
    `Content-Length: 0\r\n` +
    `\r\n`,
  )
  socket.destroy()
}

server.on('upgrade', (req, socket, head) => {
  // URL relative → on extrait juste le pathname (sans query, sans host)
  const pathname = (req.url || '').split('?')[0]

  if (pathname === '/media-stream') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    return
  }

  if (pathname === '/scheduled-media-stream') {
    if (!SCHEDULED_CALLS_ENABLED) {
      abortHandshake(socket, 503, 'Scheduled calls not configured')
      return
    }
    wssScheduled.handleUpgrade(req, socket, head, (ws) => wssScheduled.emit('connection', ws, req))
    return
  }

  if (pathname === '/ws/gemini-web') {
    // verifyClient inline (équivalent à l'option verifyClient des WSS classiques)
    if (!GOOGLE_API_KEY) {
      abortHandshake(socket, 503, 'Gemini engine not configured')
      return
    }
    const origin = req.headers.origin
    if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`⛔ /ws/gemini-web origine refusée : ${origin}`)
      abortHandshake(socket, 403, 'Forbidden origin')
      return
    }
    const ip =
      (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()) ||
      req.socket.remoteAddress ||
      'unknown'
    const check = rateLimit({ key: `web-ws:${ip}`, ...LIMITS.perIpWeb })
    if (!check.ok) {
      console.warn(`⛔ /ws/gemini-web rate-limit IP=${ip}`)
      abortHandshake(socket, 429, 'Too many requests')
      return
    }
    wssWeb.handleUpgrade(req, socket, head, (ws) => wssWeb.emit('connection', ws, req))
    return
  }

  // Aucun WSS pour ce path → ferme le socket proprement
  abortHandshake(socket, 404, 'Not Found')
})

wss.on('connection', (twilioWs) => {
  console.log('🔌 Stream Twilio connecté')

  let session         = null   // engine bridge ({ handleTwilioEvent, close, getTokens })
  let engine          = 'openai'
  let streamStartedAt = null
  let demoCallId      = null

  // Coupure serveur de sécurité (raccroche dur après MAX_CALL_SECONDS)
  const safetyTimer = setTimeout(() => {
    console.log(`⏱  Limite ${MAX_CALL_SECONDS}s atteinte — raccrochage`)
    try { twilioWs.close() } catch { /* */ }
  }, MAX_CALL_SECONDS * 1000)

  twilioWs.on('message', (msg) => {
    let data
    try { data = JSON.parse(msg.toString()) } catch { return }

    // L'event 'start' est toujours le 1er reçu. Il porte streamSid +
    // customParameters (opener, demoCallId, engine). On instancie le bon
    // bridge engine APRÈS l'avoir reçu, pour ne pas avoir à propager l'opener
    // / engine de manière asynchrone.
    if (data.event === 'start' && !session) {
      const streamSid = data.start.streamSid
      const params    = data.start.customParameters ?? {}
      const opener    = params.opener ?? null
      demoCallId      = params.demoCallId ?? null
      engine          = params.engine === 'gemini' ? 'gemini' : 'openai'
      streamStartedAt = Date.now()

      console.log(`✅ Stream démarré engine=${engine} (${streamSid.substring(0, 12)}…${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''})`)
      console.log(`   customParameters reçus :`, JSON.stringify(params))

      if (engine === 'gemini') {
        if (!GOOGLE_API_KEY) {
          // Cas pathologique : /call a accepté gemini mais la clé a disparu
          // entre-temps (rolling deploy). On raccroche proprement.
          console.error('❌ engine=gemini demandé mais GOOGLE_API_KEY absent — raccrochage')
          try { twilioWs.close() } catch { /* */ }
          return
        }
        session = createGeminiBridge({
          twilioWs, streamSid, opener,
          geminiApiKey: GOOGLE_API_KEY,
        })
      } else {
        session = createOpenaiBridge({
          twilioWs, streamSid, opener,
          openaiApiKey: OPENAI_API_KEY,
        })
      }
      return
    }

    // Tous les events suivants sont délégués au bridge engine
    if (session) session.handleTwilioEvent(data)
  })

  twilioWs.on('close', () => {
    console.log('🔌 Stream Twilio fermé')
    clearTimeout(safetyTimer)
    session?.close()

    // Log récapitulatif tokens + coût réel (audit / debug)
    if (session) {
      const tokens = session.getTokens()
      const totalAudioIn = (tokens.input_audio ?? 0) + (tokens.input_audio_cached ?? 0)
      const cacheRatio = totalAudioIn > 0
        ? Math.round(((tokens.input_audio_cached ?? 0) / totalAudioIn) * 100)
        : 0
      const realCostEur = computeAiCostEur(engine, tokens)
      console.log(
        `💰 [${engine}] Tokens : audio_in=${totalAudioIn} (cached=${tokens.input_audio_cached ?? 0}, ${cacheRatio}%)` +
        ` audio_out=${tokens.output_audio ?? 0} text_in=${tokens.input_text ?? 0} text_out=${tokens.output_text ?? 0}` +
        ` → coût réel ≈ €${realCostEur.toFixed(4)}`,
      )

      // Tracking : UPDATE row demo_calls avec durée + coûts (best-effort).
      // Si aucun event usage n'a été reçu (appel coupé trop tôt), tokens sont
      // tous à 0 → on passe undefined pour ne PAS écrire un coût réel à 0€ qui
      // serait trompeur (NULL est meilleur que 0 pour "inconnu").
      if (demoCallId && streamStartedAt) {
        const durationSeconds = (Date.now() - streamStartedAt) / 1000
        const tokensToSave = totalAudioIn > 0 || (tokens.output_audio ?? 0) > 0 ? tokens : undefined
        void recordDemoEnd(demoCallId, durationSeconds, tokensToSave, engine)
      }
    }
  })
})

// --- WSS /ws/gemini-web : démo navigateur Gemini ----------------------------
// Le navigateur parle un protocole JSON simple (cf. gemini-bridge-web.js) et
// envoie son audio en PCM16 16kHz LE base64. Aucune conversion audio dans la
// boucle — Twilio n'intervient pas pour ce mode.
//
// Auth : pas de token, juste vérification d'origine (anti-curl) + rate-limit
// IP (anti-spam) effectués dans le dispatch upgrade plus haut. Cohérent avec
// le mode web OpenAI qui passe par une Edge Function publique sans token non
// plus.

wssWeb.on('connection', (clientWs) => {
  console.log('🔌 [web] Connexion gemini-web')

  // Tracking demo_calls : géré côté CLIENT via log-demo (Edge Function),
  // comme pour le mode web OpenAI. Ici on ne fait que loguer pour le debug
  // Render — l'UPDATE final avec la durée vient du navigateur au stop.
  const streamStartedAt = Date.now()

  // Coupure serveur de sécurité (identique téléphone : ferme dur si on
  // dépasse MAX_CALL_SECONDS, pour borner le coût même si le client oublie
  // de raccrocher).
  const safetyTimer = setTimeout(() => {
    console.log(`⏱  [web] Limite ${MAX_CALL_SECONDS}s atteinte — fermeture`)
    try { clientWs.close() } catch { /* */ }
  }, MAX_CALL_SECONDS * 1000)

  const bridge = createGeminiBridgeWeb({
    clientWs,
    geminiApiKey: GOOGLE_API_KEY,
    onEnd: ({ tokens }) => {
      const totalAudioIn = (tokens.input_audio ?? 0) + (tokens.input_audio_cached ?? 0)
      const realCostEur  = computeAiCostEur('gemini', tokens)
      const dur          = (Date.now() - streamStartedAt) / 1000
      console.log(
        `💰 [web/gemini] Tokens : audio_in=${totalAudioIn} audio_out=${tokens.output_audio ?? 0}` +
        ` text_in=${tokens.input_text ?? 0} text_out=${tokens.output_text ?? 0}` +
        ` durée=${dur.toFixed(1)}s → coût réel ≈ €${realCostEur.toFixed(4)}`,
      )
    },
  })

  clientWs.on('close', () => {
    console.log('🔌 [web] gemini-web fermé')
    clearTimeout(safetyTimer)
    bridge.close()
  })
})

// --- WSS /scheduled-media-stream : appels planifiés Modect -----------------
// Twilio ouvre la WS quand le bénéficiaire DÉCROCHE (Stream démarre côté
// destinataire, pas à la sonnerie). On marque alors le call 'in_progress'
// dans Supabase, on instancie modect-call-bridge qui fetche le contexte +
// négocie OpenAI Realtime, et on accumule transcript + tokens pour le flush
// final via save-transcript.

wssScheduled.on('connection', (twilioWs) => {
  console.log('🔌 [scheduled] Stream Twilio connecté')

  let session         = null
  let callId          = null
  let streamStartedAt = null

  const safetyTimer = setTimeout(() => {
    console.log(`⏱  [scheduled] Limite ${MAX_SCHEDULED_CALL_SECONDS}s atteinte — raccrochage`)
    try { twilioWs.close() } catch { /* */ }
  }, MAX_SCHEDULED_CALL_SECONDS * 1000)

  twilioWs.on('message', (msg) => {
    let data
    try { data = JSON.parse(msg.toString()) } catch { return }

    if (data.event === 'start' && !session) {
      const streamSid = data.start.streamSid
      const params    = data.start.customParameters ?? {}
      callId          = params.call_id ?? null
      streamStartedAt = Date.now()

      if (!callId) {
        console.error('❌ [scheduled] Stream démarré sans call_id — raccrochage')
        try { twilioWs.close() } catch { /* */ }
        return
      }

      console.log(`✅ [scheduled] Stream démarré callId=${callId.slice(0, 8)}… (sid: ${streamSid.slice(0, 12)}…)`)

      // Marquer le call en cours côté Supabase (best-effort, async)
      void markCallInProgress(callId)

      session = createModectCallBridge({
        twilioWs,
        streamSid,
        callId,
        openaiApiKey:   OPENAI_API_KEY,
        supabaseUrl:    SUPABASE_URL,
        internalToken:  MODECT_INTERNAL_TOKEN,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      })
      return
    }

    if (session) session.handleTwilioEvent(data)
  })

  twilioWs.on('close', async () => {
    console.log(`🔌 [scheduled] Stream Twilio fermé${callId ? ` (callId=${callId.slice(0, 8)}…)` : ''}`)
    clearTimeout(safetyTimer)

    if (!session || !callId || !streamStartedAt) {
      session?.close()
      return
    }

    const durationSeconds = (Date.now() - streamStartedAt) / 1000
    const tokens          = session.getTokens()
    const totalAudioIn    = (tokens.input_audio ?? 0) + (tokens.input_audio_cached ?? 0)

    // Flush transcript → save-transcript (chaîne generate-summary)
    await session.flushFinal(durationSeconds, 'completed')

    // Écrire tokens + coût IA réel en parallèle (UPDATE séparé, save-transcript
    // ne gère pas ces champs)
    if (totalAudioIn > 0 || (tokens.output_audio ?? 0) > 0) {
      await recordCallTokens(callId, tokens)
    }

    session.close()

    console.log(
      `💰 [scheduled:${callId.slice(0, 8)}…] tokens audio_in=${totalAudioIn} audio_out=${tokens.output_audio ?? 0}` +
      ` text_in=${tokens.input_text ?? 0} text_out=${tokens.output_text ?? 0}` +
      ` durée=${durationSeconds.toFixed(1)}s`,
    )
  })
})

// --- Helpers ---------------------------------------------------------------

function maskNumber(n) {
  // +33612345678 → +33 6•• ••• •78  (logs sans PII complète)
  if (n.length < 6) return n
  return n.slice(0, 4) + '•'.repeat(n.length - 6) + n.slice(-2)
}
