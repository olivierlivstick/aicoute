// MODECT — voice-bridge
// Service Node hébergé sur Render. Fait :
//   - POST /call         déclenche un appel sortant Twilio vers le numéro fourni
//   - POST /outgoing     TwiML servi à Twilio quand le destinataire décroche
//   - WSS  /media-stream pont audio µ-law Twilio ↔ OpenAI Realtime GA
//   - GET  /health       healthcheck Render
//
// Aucun frontend ici : c'est uniquement une API + un WebSocket. Le front
// (apps/web/src/marketing/components/DemoPhoneModal.tsx) appelle /call.
//
// Architecture inspirée de realtime-phone-v3 mais adaptée à la prod :
//   - pas de ngrok (Render expose le service publiquement)
//   - CORS verrouillé sur les origines vitrine
//   - rate-limit par IP + par numéro destinataire
//   - coupure serveur de sécurité à MAX_CALL_SECONDS pour éviter les facturations qui dérapent

import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import twilio from 'twilio'
import 'dotenv/config'

import { DEMO_PROMPT, buildFirstMessage } from './prompt.js'
import { rateLimit, LIMITS } from './rateLimit.js'
import { recordDemoStart, recordDemoEnd } from './tracking.js'

// --- Config ----------------------------------------------------------------

const PORT             = Number(process.env.PORT || 5050)
const MAX_CALL_SECONDS = Number(process.env.MAX_CALL_SECONDS || 240)
const VOICE            = 'cedar'
const MODEL            = 'gpt-realtime-2'

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
  res.json({ ok: true, service: 'voice-bridge', model: MODEL, voice: VOICE })
})

// --- Déclenchement d'appel sortant -----------------------------------------

// Limite serveur de la phrase d'ouverture (cohérent avec le front, double check
// au cas où quelqu'un POST direct sans passer par le formulaire).
const OPENER_MAX_LENGTH = 500

app.post('/call', async (req, res) => {
  try {
    const { phoneNumber, opener } = req.body ?? {}

    const cleaned = String(phoneNumber || '').replace(/\s/g, '')
    if (!cleaned.match(/^\+\d{8,15}$/)) {
      return res.status(400).json({ error: 'Numéro invalide. Format attendu : +33XXXXXXXXX.' })
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

    // Tracking : INSERT row demo_calls avant l'appel Twilio (best-effort)
    const demoCallId = await recordDemoStart(cleaned)

    // demoCallId + opener passés en query, /outgoing les retransmet via TwiML
    // <Parameter> → la WS les récupère dans l'event 'start' (customParameters)
    const queryParts = []
    if (demoCallId)   queryParts.push(`demoCallId=${encodeURIComponent(demoCallId)}`)
    if (openerClean)  queryParts.push(`opener=${encodeURIComponent(openerClean)}`)
    const outgoingUrl = queryParts.length
      ? `${publicBase}/outgoing?${queryParts.join('&')}`
      : `${publicBase}/outgoing`

    const call = await twilioClient.calls.create({
      to:   cleaned,
      from: TWILIO_NUMBER,
      url:  outgoingUrl,
    })

    console.log(`📞 Appel sortant initié vers ${maskNumber(cleaned)} (sid: ${call.sid}${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''})`)
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
  // <Parameter> est retransmis à la WS dans event start (data.start.customParameters)
  const params = []
  if (demoCallId) params.push(`      <Parameter name="demoCallId" value="${escapeXml(demoCallId)}" />`)
  if (opener)     params.push(`      <Parameter name="opener" value="${escapeXml(opener)}" />`)
  const paramTags = params.length ? params.join('\n') + '\n' : ''
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

// --- Démarrage HTTP + WebSocket --------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`✅ voice-bridge écoute sur :${PORT}`)
  console.log(`   modèle=${MODEL} voix=${VOICE} maxCall=${MAX_CALL_SECONDS}s`)
  if (ALLOWED_ORIGINS.length) {
    console.log(`   CORS autorisé pour : ${ALLOWED_ORIGINS.join(', ')}`)
  } else {
    console.warn('   ⚠️ ALLOWED_ORIGINS vide → CORS ouvert à toutes origines')
  }
})

const wss = new WebSocketServer({ server, path: '/media-stream' })

wss.on('connection', (twilioWs) => {
  console.log('🔌 Stream Twilio connecté')

  let streamSid              = null
  let openaiWs               = null
  let latestMediaTimestamp   = 0
  let lastAssistantItem      = null
  let markQueue              = []
  let responseStartTimestamp = null
  let safetyTimer            = null
  let demoCallId             = null
  let streamStartedAt        = null
  let opener                 = null

  // Coupure serveur de sécurité (raccroche dur après MAX_CALL_SECONDS)
  safetyTimer = setTimeout(() => {
    console.log(`⏱  Limite ${MAX_CALL_SECONDS}s atteinte — raccrochage`)
    try { twilioWs.close() } catch { /* */ }
  }, MAX_CALL_SECONDS * 1000)

  // Connexion OpenAI Realtime
  openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${MODEL}`,
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } },
  )

  openaiWs.on('open', () => {
    console.log('✅ Connecté à OpenAI Realtime')
    // Petit délai pour laisser la session s'établir avant le session.update
    setTimeout(() => {
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          type:              'realtime',
          model:             MODEL,
          output_modalities: ['audio'],
          audio: {
            input: {
              format:         { type: 'audio/pcmu' },
              turn_detection: {
                type:                'server_vad',
                threshold:           0.5,
                prefix_padding_ms:   300,
                silence_duration_ms: 500,
              },
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice:  VOICE,
            },
          },
          instructions: DEMO_PROMPT,
        },
      }))

      // L'IA prend la parole en premier après le décroché. Si un opener custom
      // a été fourni (testeur a saisi une phrase dans DemoPhoneModal), l'IA est
      // instruite de la prononcer verbatim ; sinon, accueil MODECT standard.
      setTimeout(() => {
        openaiWs.send(JSON.stringify({
          type:     'response.create',
          response: { instructions: buildFirstMessage(opener) },
        }))
      }, 250)
    }, 250)
  })

  openaiWs.on('message', (data) => {
    let event
    try { event = JSON.parse(data.toString()) } catch { return }

    if (event.type === 'error') {
      console.error('❌ OpenAI :', event.error?.message || event)
      return
    }

    // Audio sortant : OpenAI → Twilio
    if (event.type === 'response.output_audio.delta' && event.delta && streamSid) {
      twilioWs.send(JSON.stringify({
        event:     'media',
        streamSid,
        media:     { payload: event.delta },
      }))

      if (!responseStartTimestamp) responseStartTimestamp = latestMediaTimestamp
      if (event.item_id) lastAssistantItem = event.item_id

      // Mark pour mesurer la latence + détecter la fin de buffer côté Twilio
      twilioWs.send(JSON.stringify({
        event:     'mark',
        streamSid,
        mark:      { name: 'ai-chunk' },
      }))
      markQueue.push('ai-chunk')
    }

    // Interruption : l'utilisateur prend la parole pendant que l'IA parle
    if (event.type === 'input_audio_buffer.speech_started') {
      if (markQueue.length > 0 && responseStartTimestamp != null && lastAssistantItem) {
        const elapsed = latestMediaTimestamp - responseStartTimestamp
        openaiWs.send(JSON.stringify({
          type:          'conversation.item.truncate',
          item_id:       lastAssistantItem,
          content_index: 0,
          audio_end_ms:  elapsed,
        }))
        twilioWs.send(JSON.stringify({ event: 'clear', streamSid }))
        markQueue              = []
        lastAssistantItem      = null
        responseStartTimestamp = null
      }
    }
  })

  openaiWs.on('error', (err) => console.error('❌ OpenAI WS :', err?.message || err))
  openaiWs.on('close', ()    => console.log('• OpenAI déconnecté'))

  // Audio entrant : Twilio → OpenAI
  twilioWs.on('message', (msg) => {
    let data
    try { data = JSON.parse(msg.toString()) } catch { return }

    switch (data.event) {
      case 'start':
        streamSid              = data.start.streamSid
        responseStartTimestamp = null
        latestMediaTimestamp   = 0
        streamStartedAt        = Date.now()
        demoCallId             = data.start.customParameters?.demoCallId ?? null
        opener                 = data.start.customParameters?.opener ?? null
        console.log(`✅ Stream démarré (${streamSid.substring(0, 12)}…${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''}${opener ? ', opener custom' : ''})`)
        break

      case 'media':
        latestMediaTimestamp = data.media.timestamp
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type:  'input_audio_buffer.append',
            audio: data.media.payload,
          }))
        }
        break

      case 'mark':
        if (markQueue.length > 0) markQueue.shift()
        break

      case 'stop':
        console.log('• Stream stoppé par Twilio')
        if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close()
        break
    }
  })

  twilioWs.on('close', () => {
    console.log('🔌 Stream Twilio fermé')
    if (safetyTimer) clearTimeout(safetyTimer)
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close()
    // Tracking : UPDATE row demo_calls avec durée + coûts (best-effort)
    if (demoCallId && streamStartedAt) {
      const durationSeconds = (Date.now() - streamStartedAt) / 1000
      void recordDemoEnd(demoCallId, durationSeconds)
    }
  })
})

// --- Helpers ---------------------------------------------------------------

function maskNumber(n) {
  // +33612345678 → +33 6•• ••• •78  (logs sans PII complète)
  if (n.length < 6) return n
  return n.slice(0, 4) + '•'.repeat(n.length - 6) + n.slice(-2)
}
