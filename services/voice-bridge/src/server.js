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
import { recordDemoStart, recordDemoEnd, recordDemoRealCost, computeAiCostEur } from './tracking.js'
import { createOpenaiBridge } from './engines/openai-bridge.js'
import { createGeminiBridge } from './engines/gemini-bridge.js'
import { createGeminiBridgeWeb } from './engines/gemini-bridge-web.js'
import { createModectCallBridge } from './engines/modect-call-bridge.js'
import { createModectGeminiBridge } from './engines/modect-gemini-bridge.js'
import {
  markCallInProgress,
  recordCallTokens,
  recordCallFluidity,
  markCallByTwilioStatus,
  findCallIdByTwilioSid,
  saveTwilioCostBySid,
  listCallsMissingTwilioCost,
} from './persistence/modect-call.js'
import { logEvent as logSystemEvent } from './persistence/system-events.js'
import { readAppSettings, setKeepRecording, storeRecordingWav } from './persistence/fluidity-diagnostic.js'
import { acquireCallSlot, releaseCallSlot } from './concurrency.js'
import {
  findBeneficiaryForInbound,
  evaluateInboundQuota,
  createInboundCall,
  normalizePhone,
} from './persistence/inbound-call.js'

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

// Taux de change USD→EUR (aligné sur tracking.js / modect-call.js). Twilio peut
// facturer en USD ou EUR selon le compte ; on convertit seulement si USD.
const USD_TO_EUR = 0.92

/**
 * Récupère le prix d'un appel Twilio et le convertit en EUR.
 * Renvoie le coût en EUR (number, 4 décimales) ou null si pas encore dispo.
 * price est une chaîne négative (ex "-0.0130") dans la devise priceUnit.
 */
async function fetchTwilioPriceEur(sid) {
  const call = await twilioClient.calls(sid).fetch()
  if (call.price == null) return null  // pas encore renseigné par Twilio
  const raw = Math.abs(parseFloat(call.price))
  if (!Number.isFinite(raw)) return null
  const unit = (call.priceUnit || 'USD').toUpperCase()
  return +(unit === 'EUR' ? raw : raw * USD_TO_EUR).toFixed(4)
}

/**
 * Récupère le coût RÉEL d'un appel Twilio et l'écrit dans calls.twilio_cost_eur.
 *
 * Le champ `price` est renseigné de façon ASYNCHRONE par Twilio : null au moment
 * du callback `completed`, il n'apparaît que quelques secondes/minutes plus tard.
 * On poll donc l'API plusieurs fois avec délai croissant. Fire-and-forget :
 * lancé sans await depuis /scheduled-status. Best-effort — en cas d'échec on
 * garde l'estimation par la durée côté UI.
 */
async function captureTwilioCost(sid) {
  if (!sid) return
  const delaysMs = [15_000, 30_000, 45_000, 60_000, 90_000]
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    await new Promise((r) => setTimeout(r, delaysMs[attempt]))
    try {
      const eur = await fetchTwilioPriceEur(sid)
      if (eur == null) continue  // pas encore prêt → réessaie plus tard
      await saveTwilioCostBySid(sid, eur)
      console.log(`💶 [twilio-cost] sid=${sid.slice(0, 12)}… → €${eur}`)
      return
    } catch (err) {
      console.error(`❌ [twilio-cost] fetch ${sid.slice(0, 12)}… :`, err?.message)
      // On continue à réessayer : une erreur transitoire ne doit pas tout annuler.
    }
  }
  console.warn(`⚠️  [twilio-cost] prix toujours indisponible pour sid=${sid.slice(0, 12)}… après ${delaysMs.length} tentatives`)
}

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

// Langues proposées pour la démo vitrine (alignées avec le front Demo.tsx et
// prompt.js). Toute valeur hors liste retombe sur 'fr' (prompt français défaut).
const DEMO_LANGS = ['fr', 'en', 'es', 'de', 'it']
function sanitizeLang(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  return DEMO_LANGS.includes(v) ? v : 'fr'
}

app.post('/call', async (req, res) => {
  try {
    const { phoneNumber, opener, engine: engineRaw, lang: langRaw } = req.body ?? {}
    const lang = sanitizeLang(langRaw)

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
    queryParts.push(`lang=${encodeURIComponent(lang)}`)
    const outgoingUrl = `${publicBase}/outgoing?${queryParts.join('&')}`

    // Diagnostic fluidité : si l'admin a demandé de garder des enregistrements de
    // calibration (compteur > 0 dans app_settings), on enregistre CET appel démo
    // en dual-channel (canal 1 = appelé, canal 2 = IA) et on décrémente. Le WAV
    // est récupéré + déposé dans Storage par /recording-status. Best-effort : si la
    // lecture des réglages échoue, on n'enregistre pas (comportement par défaut).
    const callParams = { to: cleaned, from: TWILIO_NUMBER, url: outgoingUrl }
    try {
      const { diagnosticEnabled, keepRecordingRemaining } = await readAppSettings()
      console.log(`• [diag] app_settings au moment de l'appel: enabled=${diagnosticEnabled} keepRec=${keepRecordingRemaining}`)
      // Trace visible dans /admin/sante (« Événements système ») — indépendant des
      // logs Render. Prouve que ce build lit bien app_settings et avec quelle valeur.
      void logSystemEvent({
        level:   'info',
        source:  'voice-bridge/fluidity-diag',
        message: `/call : app_settings lus — enabled=${diagnosticEnabled}, keepRec=${keepRecordingRemaining}`,
        payload: { enabled: diagnosticEnabled, keepRec: keepRecordingRemaining },
      })
      if (keepRecordingRemaining > 0) {
        callParams.record                       = true
        callParams.recordingChannels            = 'dual'
        callParams.recordingStatusCallback      = `${publicBase}/recording-status`
        callParams.recordingStatusCallbackEvent = ['completed']
        await setKeepRecording(keepRecordingRemaining - 1)
        console.log(`🎙️  [diag] enregistrement de calibration activé (restants après: ${keepRecordingRemaining - 1})`)
      }
    } catch (err) {
      console.error('⚠️  [diag] lecture app_settings échouée, pas d\'enregistrement:', err?.message || err)
      void logSystemEvent({
        level:   'error',
        source:  'voice-bridge/fluidity-diag',
        message: `/call : lecture app_settings échouée — ${err?.message || err}`,
      })
    }

    const call = await twilioClient.calls.create(callParams)

    console.log(`📞 Appel sortant initié vers ${maskNumber(cleaned)} engine=${engine} lang=${lang} (sid: ${call.sid}${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''})`)
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
  const lang       = sanitizeLang(req.query.lang ?? req.body?.lang)
  console.log(`📩 /outgoing reçu (engine=${engine}, lang=${lang}, demoCallId=${demoCallId ? 'yes' : 'no'}, opener=${opener ? `"${opener.substring(0, 50)}…"` : 'no'})`)
  // <Parameter> est retransmis à la WS dans event start (data.start.customParameters)
  const params = []
  if (demoCallId) params.push(`      <Parameter name="demoCallId" value="${escapeXml(demoCallId)}" />`)
  if (opener)     params.push(`      <Parameter name="opener" value="${escapeXml(opener)}" />`)
  params.push(`      <Parameter name="engine" value="${escapeXml(engine)}" />`)
  params.push(`      <Parameter name="lang" value="${escapeXml(lang)}" />`)
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

// --- Callback d'enregistrement (Diagnostic fluidité, calibration) ----------
//
// Twilio notifie ici quand un enregistrement dual-channel est prêt. On télécharge
// le WAV (auth Twilio), on le dépose dans Storage (bucket privé) et on publie un
// lien signé via system_events → visible/cliquable dans /admin/sante. RGPD : ne
// concerne QUE les appels démo/test (cf. /call), jamais les bénéficiaires.
app.post('/recording-status', async (req, res) => {
  // Toujours acquitter vite : Twilio n'attend pas notre traitement.
  res.sendStatus(204)
  try {
    const recordingSid = (req.body?.RecordingSid || '').toString()
    const recordingUrl = (req.body?.RecordingUrl || '').toString()
    const callSid      = (req.body?.CallSid || '').toString()
    const duration     = (req.body?.RecordingDuration || '').toString()
    const channels     = (req.body?.RecordingChannels || '').toString()
    if (!recordingUrl || !recordingSid) {
      console.error('⚠️  [diag] /recording-status sans RecordingUrl/Sid')
      return
    }

    // Télécharge le WAV depuis Twilio (basic auth AccountSid:AuthToken).
    const wavUrl = `${recordingUrl}.wav`
    const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const resp = await fetch(wavUrl, { headers: { Authorization: authHeader } })
    if (!resp.ok) {
      console.error(`⚠️  [diag] download WAV ${resp.status} pour ${recordingSid}`)
      return
    }
    const bytes = Buffer.from(await resp.arrayBuffer())

    const path      = `demo/${callSid || recordingSid}.wav`
    const signedUrl = await storeRecordingWav(bytes, path)

    // Supprime l'enregistrement côté Twilio (on l'a copié dans notre Storage) —
    // best-effort, évite d'accumuler des médias chez Twilio.
    twilioClient.recordings(recordingSid).remove().catch(() => { /* */ })

    console.log(`🎙️  [diag] WAV calibration ${recordingSid} (${duration}s, ${channels}ch) → ${signedUrl ? 'Storage OK' : 'upload KO'}`)
    await logSystemEvent({
      level:   'info',
      source:  'voice-bridge/fluidity-diag',
      message: signedUrl
        ? `Enregistrement de calibration prêt (${duration}s) — lien valable 7 jours`
        : `Enregistrement de calibration capté (${duration}s) mais upload Storage échoué`,
      payload: { recording_url: signedUrl, twilio_sid: recordingSid, call_sid: callSid, duration_s: Number(duration) || null, channels: Number(channels) || null },
    })
  } catch (err) {
    console.error('❌ /recording-status :', err?.message || err)
  }
})

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
    const { call_id: callId, phone, engine: engineRaw } = req.body ?? {}
    if (!callId || typeof callId !== 'string') {
      return res.status(400).json({ error: 'call_id requis' })
    }
    const cleaned = String(phone || '').replace(/\s/g, '')
    if (!cleaned.match(/^\+\d{8,15}$/)) {
      return res.status(400).json({ error: 'Numéro invalide. Format attendu : +33XXXXXXXXX.' })
    }
    // Engine : 'openai' (défaut) ou 'gemini' (refusé si pas configuré côté Render)
    const engine = engineRaw === 'gemini' ? 'gemini' : 'openai'
    if (engine === 'gemini' && !GOOGLE_API_KEY) {
      return res.status(503).json({ error: 'Le moteur Gemini n\'est pas configuré sur ce serveur.' })
    }

    const host  = req.headers['x-forwarded-host'] || req.headers.host
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const publicBase = `${proto}://${host}`

    // call_id + engine passés via query → /scheduled-outgoing les retransmet via <Parameter>
    const queryParts = [`call_id=${encodeURIComponent(callId)}`, `engine=${encodeURIComponent(engine)}`]
    const outgoingUrl = `${publicBase}/scheduled-outgoing?${queryParts.join('&')}`

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

    console.log(`📞 [scheduled] Appel sortant vers ${maskNumber(cleaned)} engine=${engine} (callId: ${callId.slice(0, 8)}…, sid: ${call.sid})`)
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

  // Sur tout statut terminal, on lance en arrière-plan la récupération du coût
  // Twilio réel (le prix n'est pas encore dispo à cet instant → poller différé).
  // Pour 'completed', c'est le seul endroit où on l'apprend (markCallByTwilioStatus
  // ignore 'completed', géré par save-transcript côté flush WS).
  if (['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(status)) {
    void captureTwilioCost(sid)
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

// Backfill du coût Twilio réel sur les appels passés (completed) qui n'ont pas
// encore de twilio_cost_eur — typiquement les appels antérieurs à l'ajout de la
// capture automatique. Protégé par le token interne (mêmes credentials que les
// appels planifiés). À déclencher manuellement :
//   curl -X POST https://voice.modect.com/backfill-twilio-costs \
//        -H "Authorization: Bearer $MODECT_INTERNAL_TOKEN" \
//        -H "Content-Type: application/json" -d '{"limit":200}'
// Pour les appels anciens, le prix Twilio est déjà finalisé → pas de polling,
// un seul fetch suffit. On espace légèrement les appels pour ménager l'API.
app.post('/backfill-twilio-costs', async (req, res) => {
  if (!SCHEDULED_CALLS_ENABLED) {
    return res.status(503).json({ error: 'Persistance Supabase non configurée.' })
  }
  const auth = req.headers['authorization'] || req.headers['Authorization']
  if (auth !== `Bearer ${MODECT_INTERNAL_TOKEN}`) {
    return res.status(401).json({ error: 'Forbidden' })
  }

  const limit = Math.min(Math.max(Number(req.body?.limit) || 200, 1), 500)
  const calls = await listCallsMissingTwilioCost(limit)

  let updated = 0, notReady = 0, errors = 0
  for (const c of calls) {
    try {
      const eur = await fetchTwilioPriceEur(c.twilio_call_sid)
      if (eur == null) { notReady++; continue }
      await saveTwilioCostBySid(c.twilio_call_sid, eur)
      updated++
    } catch (err) {
      console.error(`❌ [backfill] ${c.twilio_call_sid?.slice(0, 12)}… :`, err?.message)
      errors++
    }
    await new Promise((r) => setTimeout(r, 120))  // ~8 req/s max
  }

  const summary = { scanned: calls.length, updated, notReady, errors }
  console.log('💶 [backfill-twilio-costs]', JSON.stringify(summary))
  res.json({ ok: true, ...summary })
})

app.all('/scheduled-outgoing', (req, res) => {
  const host    = req.headers['x-forwarded-host'] || req.headers.host
  const callId  = (req.query.call_id ?? req.body?.call_id ?? '').toString()
  const engine  = (req.query.engine  ?? req.body?.engine  ?? 'openai').toString()
  console.log(`📩 /scheduled-outgoing reçu (callId: ${callId ? callId.slice(0, 8) + '…' : 'no'}, engine=${engine})`)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/scheduled-media-stream">
      <Parameter name="call_id" value="${escapeXml(callId)}" />
      <Parameter name="engine" value="${escapeXml(engine)}" />
    </Stream>
  </Connect>
</Response>`
  res.type('text/xml').send(twiml)
})

// --- Webhook Twilio APPEL ENTRANT (le bénéficiaire appelle AICOUTE) ---------
// Configuré comme « A CALL COMES IN » sur le numéro Twilio. Twilio POSTe
// From/To/CallSid. On identifie le bénéficiaire à son numéro, on applique les
// garde-fous (activé + cooldown + budget minutes/jour), et on répond en TwiML :
//   - autorisé → <Connect><Stream .../inbound-media-stream> (la conversation démarre,
//                même bridge que les appels planifiés via le call_id)
//   - refusé   → <Reject> (inconnu/désactivé : ne décroche pas → coût ~0) ou
//                <Say>+<Hangup> court (connu mais quota/cooldown atteint)
//
// Sécurité : la signature X-Twilio-Signature n'est PAS encore vérifiée.
// L'exposition est bornée par les garde-fous (seul un numéro opt-in connu
// déclenche une session ; quota + cooldown + durée max + concurrence). Un
// spoofeur devrait connaître le numéro exact d'un bénéficiaire activé.
// Durcissement possible : twilio.validateRequest (cf. CLAUDE.md).
app.post('/inbound-voice', async (req, res) => {
  const xml = (body) =>
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`)

  if (!SCHEDULED_CALLS_ENABLED) {
    // Persistance indispo → on ne peut ni identifier ni tracer : on raccroche.
    return xml('<Reject reason="rejected" />')
  }

  const from      = String(req.body?.From ?? '')
  const twilioSid = req.body?.CallSid ?? null

  // Filet anti-martèlement AVANT toute requête DB (in-memory, par numéro source).
  const rl = rateLimit({ key: `inbound:${normalizePhone(from) || 'unknown'}`, ...LIMITS.perInbound })
  if (!rl.ok) {
    console.warn(`⛔ [inbound] rate-limit ${maskNumber(from)}`)
    return xml('<Reject reason="rejected" />')
  }

  try {
    const beneficiary = await findBeneficiaryForInbound(from)
    if (!beneficiary) {
      console.log(`📵 [inbound] numéro non reconnu / canal désactivé : ${maskNumber(from)}`)
      return xml('<Reject reason="rejected" />')
    }

    const quota = await evaluateInboundQuota(beneficiary)
    if (!quota.ok) {
      console.log(`🚧 [inbound] ${maskNumber(from)} refusé (${quota.reason})`, quota.detail ?? '')
      void logSystemEvent({
        level:   'info',
        source:  'voice-bridge/inbound',
        message: `Appel entrant refusé (${quota.reason})`,
        payload: { beneficiary_id: beneficiary.id, reason: quota.reason, ...(quota.detail ?? {}) },
      })
      return xml('<Say language="fr-FR">Je ne suis pas disponible pour le moment. Je vous rappellerai très bientôt. À très vite.</Say><Hangup />')
    }

    // Moteur effectif : préférence bénéficiaire, repli OpenAI si Gemini non
    // configuré sur ce serveur (pour que la ligne calls.engine soit exacte dès
    // la création — le WS ne pourra plus la corriger, déjà in_progress).
    let engine = beneficiary.preferred_engine === 'gemini' ? 'gemini' : 'openai'
    if (engine === 'gemini' && !GOOGLE_API_KEY) engine = 'openai'

    const callId = await createInboundCall(beneficiary.id, engine, twilioSid)
    if (!callId) {
      console.error('❌ [inbound] création du call échouée — raccrochage')
      return xml('<Reject reason="rejected" />')
    }

    void logSystemEvent({
      level:   'info',
      source:  'voice-bridge/inbound',
      call_id: callId,
      message: `Appel entrant accepté (engine=${engine})`,
      payload: { beneficiary_id: beneficiary.id, twilio_sid: twilioSid, engine },
    })
    console.log(`📞 [inbound] ${maskNumber(from)} → ${beneficiary.first_name ?? '?'} accepté (callId: ${callId.slice(0, 8)}…, engine=${engine})`)

    const host       = req.headers['x-forwarded-host'] || req.headers.host
    const maxSeconds = Number(beneficiary.inbound_max_duration_seconds) || 600
    return xml(
      '<Connect>' +
        `<Stream url="wss://${host}/inbound-media-stream">` +
          `<Parameter name="call_id" value="${escapeXml(callId)}" />` +
          `<Parameter name="engine" value="${escapeXml(engine)}" />` +
          `<Parameter name="max_seconds" value="${escapeXml(String(maxSeconds))}" />` +
          // CallSid de l'appel entrant → captureTwilioCost à la fermeture (les
          // entrants n'ont pas de statusCallback comme les sortants).
          (twilioSid ? `<Parameter name="twilio_sid" value="${escapeXml(twilioSid)}" />` : '') +
        '</Stream>' +
      '</Connect>',
    )
  } catch (err) {
    console.error('❌ /inbound-voice :', err)
    return xml('<Reject reason="rejected" />')
  }
})

// --- Démarrage HTTP + WebSocket --------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`✅ voice-bridge écoute sur :${PORT}`)
  console.log(`   engines : openai=on gemini=${GOOGLE_API_KEY ? 'on' : 'off'}`)
  console.log(`   maxCall=${MAX_CALL_SECONDS}s`)
  // Self-test diagnostic fluidité : prouve que ce build a le code diag ET que le
  // service role peut lire app_settings (sinon on verra l'erreur juste au-dessus).
  readAppSettings()
    .then((s) => console.log(`   diagnostic fluidité : lecture app_settings OK (enabled=${s.diagnosticEnabled}, keepRec=${s.keepRecordingRemaining})`))
    .catch((e) => console.log(`   diagnostic fluidité : lecture app_settings KO (${e?.message || e})`))
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
const wssScheduled = new WebSocketServer({ noServer: true })  // Twilio /scheduled-media-stream (appels AICOUTE sortants)
const wssInbound   = new WebSocketServer({ noServer: true })  // Twilio /inbound-media-stream (le bénéficiaire appelle)

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

  if (pathname === '/inbound-media-stream') {
    if (!SCHEDULED_CALLS_ENABLED) {
      abortHandshake(socket, 503, 'Inbound calls not configured')
      return
    }
    wssInbound.handleUpgrade(req, socket, head, (ws) => wssInbound.emit('connection', ws, req))
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

  // Contrôle d'admission : si la capacité est atteinte, on raccroche plutôt que
  // de dégrader tous les appels en cours. No-op tant que MAX_CONCURRENT_CALLS=0.
  if (!acquireCallSlot({ label: 'demo-phone' })) {
    try { twilioWs.close() } catch { /* */ }
    return
  }

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
      const lang      = sanitizeLang(params.lang)
      demoCallId      = params.demoCallId ?? null
      engine          = params.engine === 'gemini' ? 'gemini' : 'openai'
      streamStartedAt = Date.now()

      console.log(`✅ Stream démarré engine=${engine} lang=${lang} (${streamSid.substring(0, 12)}…${demoCallId ? `, demoId: ${demoCallId.substring(0, 8)}…` : ''})`)
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
          twilioWs, streamSid, opener, lang,
          geminiApiKey: GOOGLE_API_KEY,
        })
      } else {
        session = createOpenaiBridge({
          twilioWs, streamSid, opener, lang,
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
    releaseCallSlot()
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
        const fluidity = session.getFluidityMetrics?.(durationSeconds) ?? null
        void recordDemoEnd(demoCallId, durationSeconds, tokensToSave, engine, fluidity)
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

wssWeb.on('connection', (clientWs, req) => {
  // Contrôle d'admission (cf. demo-phone). No-op tant que MAX_CONCURRENT_CALLS=0.
  if (!acquireCallSlot({ label: 'demo-web' })) {
    try { clientWs.close() } catch { /* */ }
    return
  }

  // demoId transmis par le client en query (?demoId=…) pour pouvoir écrire le
  // coût IA RÉEL : les tokens Gemini ne sont visibles que côté serveur (ici),
  // alors que ended_at/duration/estimation sont écrits par le client via log-demo.
  let demoCallId = null
  try {
    demoCallId = new URL(req.url, 'http://localhost').searchParams.get('demoId') || null
  } catch { /* url malformée → pas de tracking coût réel */ }
  console.log(`🔌 [web] Connexion gemini-web${demoCallId ? ` (demoId: ${demoCallId.substring(0, 8)}…)` : ''}`)

  // Tracking demo_calls : ended_at/duration/estimation gérés côté CLIENT via
  // log-demo. Le coût RÉEL (tokens) est complété ici, côté serveur, dans onEnd.
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
      // Persiste le coût réel + tokens + fluidité (colonnes disjointes de log-demo).
      const fluidity = bridge.getFluidityMetrics?.(dur) ?? null
      void recordDemoRealCost(demoCallId, tokens, 'gemini', fluidity)
    },
  })

  clientWs.on('close', () => {
    console.log('🔌 [web] gemini-web fermé')
    releaseCallSlot()
    clearTimeout(safetyTimer)
    bridge.close()
  })
})

// --- WSS appels AICOUTE (planifiés sortants + entrants) --------------------
// Twilio ouvre la WS quand le bénéficiaire est EN LIGNE (décroche pour un appel
// sortant ; appelle lui-même pour un entrant). On marque le call 'in_progress'
// dans Supabase, on instancie le bridge moteur (qui fetche le contexte via
// get-call-context + le call_id), et on accumule transcript + tokens pour le
// flush final via save-transcript (qui chaîne generate-summary + email aidant).
//
// Le MÊME handler sert les deux canaux — seule la coupure de durée diffère :
//   - planifié : MAX_SCHEDULED_CALL_SECONDS (900s)
//   - entrant  : max_seconds par bénéficiaire (inbound_max_duration_seconds),
//                transmis via <Parameter name="max_seconds"> par /inbound-voice.
// Pas de tracking demo_calls ici (c'est wss/wssWeb) ; c'est la table `calls`.

function handleAicouteCallConnection(twilioWs, { label }) {
  console.log(`🔌 [${label}] Stream Twilio connecté`)

  // Contrôle d'admission (cf. demo-phone). No-op tant que MAX_CONCURRENT_CALLS=0.
  if (!acquireCallSlot({ label })) {
    try { twilioWs.close() } catch { /* */ }
    return
  }

  let session         = null
  let callId          = null
  let engine          = 'openai'
  let streamStartedAt = null
  let twilioSid       = null   // entrants : sid passé en <Parameter> → captureTwilioCost à la fin

  // Filet de sécurité initial : borne dure tant qu'on n'a pas reçu 'start'
  // (un Stream qui s'ouvre sans jamais démarrer). Resserré sur 'start' à la
  // limite propre au canal entrant si elle est plus courte.
  let safetyTimer = setTimeout(() => {
    console.log(`⏱  [${label}] Limite ${MAX_SCHEDULED_CALL_SECONDS}s atteinte — raccrochage`)
    try { twilioWs.close() } catch { /* */ }
  }, MAX_SCHEDULED_CALL_SECONDS * 1000)

  twilioWs.on('message', (msg) => {
    let data
    try { data = JSON.parse(msg.toString()) } catch { return }

    if (data.event === 'start' && !session) {
      const streamSid = data.start.streamSid
      const params    = data.start.customParameters ?? {}
      callId          = params.call_id ?? null
      engine          = params.engine === 'gemini' ? 'gemini' : 'openai'
      twilioSid       = params.twilio_sid ?? null
      streamStartedAt = Date.now()

      if (!callId) {
        console.error(`❌ [${label}] Stream démarré sans call_id — raccrochage`)
        try { twilioWs.close() } catch { /* */ }
        return
      }

      // Coupe-circuit propre au canal entrant : si max_seconds est fourni et
      // plus court que la limite par défaut, on resserre le timer.
      const maxSeconds = Number(params.max_seconds) || 0
      if (maxSeconds > 0 && maxSeconds < MAX_SCHEDULED_CALL_SECONDS) {
        clearTimeout(safetyTimer)
        safetyTimer = setTimeout(() => {
          console.log(`⏱  [${label}:${callId.slice(0, 8)}…] Limite ${maxSeconds}s atteinte — raccrochage`)
          try { twilioWs.close() } catch { /* */ }
        }, maxSeconds * 1000)
      }

      // Garde-fou : Gemini demandé mais pas configuré → on tombe sur OpenAI
      // (au lieu de raccrocher) pour ne pas pénaliser le bénéficiaire.
      if (engine === 'gemini' && !GOOGLE_API_KEY) {
        console.error(`❌ [${label}:${callId.slice(0, 8)}…] engine=gemini demandé mais GOOGLE_API_KEY absent — fallback openai`)
        engine = 'openai'
      }

      console.log(`✅ [${label}] Stream démarré callId=${callId.slice(0, 8)}… engine=${engine} (sid: ${streamSid.slice(0, 12)}…)`)

      // Marquer le call en cours côté Supabase avec le moteur effectif.
      // (Entrant : la ligne est déjà 'in_progress' → markCallInProgress no-op,
      //  cf. son filtre .in('status', ['scheduled','notified']). Inoffensif.)
      void markCallInProgress(callId, engine)

      if (engine === 'gemini') {
        session = createModectGeminiBridge({
          twilioWs,
          streamSid,
          callId,
          geminiApiKey:   GOOGLE_API_KEY,
          supabaseUrl:    SUPABASE_URL,
          internalToken:  MODECT_INTERNAL_TOKEN,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        })
      } else {
        session = createModectCallBridge({
          twilioWs,
          streamSid,
          callId,
          openaiApiKey:   OPENAI_API_KEY,
          supabaseUrl:    SUPABASE_URL,
          internalToken:  MODECT_INTERNAL_TOKEN,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        })
      }
      return
    }

    if (session) session.handleTwilioEvent(data)
  })

  twilioWs.on('close', async () => {
    console.log(`🔌 [${label}] Stream Twilio fermé${callId ? ` (callId=${callId.slice(0, 8)}…)` : ''}`)
    releaseCallSlot()
    clearTimeout(safetyTimer)

    if (!session || !callId || !streamStartedAt) {
      session?.close()
      return
    }

    const durationSeconds = (Date.now() - streamStartedAt) / 1000
    const tokens          = session.getTokens()
    const totalAudioIn    = (tokens.input_audio ?? 0) + (tokens.input_audio_cached ?? 0)

    // Flush transcript → save-transcript (chaîne generate-summary + email aidant)
    await session.flushFinal(durationSeconds, 'completed')

    // Écrire tokens + coût IA réel (tarifs différents selon engine)
    if (totalAudioIn > 0 || (tokens.output_audio ?? 0) > 0) {
      await recordCallTokens(callId, tokens, engine)
    }

    // Snapshot de fluidité (Étape 0 — observation, best-effort)
    const fluidity = session.getFluidityMetrics?.(durationSeconds) ?? null
    if (fluidity) await recordCallFluidity(callId, fluidity)

    // Coût Twilio RÉEL des ENTRANTS : ils n'ont pas de statusCallback comme les
    // sortants (cf. /scheduled-status) → on déclenche ici la capture différée à
    // partir du sid reçu en <Parameter>. Fire-and-forget (best-effort, poll API).
    if (twilioSid) void captureTwilioCost(twilioSid)

    session.close()

    console.log(
      `💰 [${label}:${callId.slice(0, 8)}…] engine=${engine} tokens audio_in=${totalAudioIn} audio_out=${tokens.output_audio ?? 0}` +
      ` text_in=${tokens.input_text ?? 0} text_out=${tokens.output_text ?? 0}` +
      ` durée=${durationSeconds.toFixed(1)}s`,
    )
  })
}

wssScheduled.on('connection', (twilioWs) => handleAicouteCallConnection(twilioWs, { label: 'scheduled' }))
wssInbound.on('connection',   (twilioWs) => handleAicouteCallConnection(twilioWs, { label: 'inbound' }))

// --- Helpers ---------------------------------------------------------------

function maskNumber(n) {
  // +33612345678 → +33 6•• ••• •78  (logs sans PII complète)
  if (n.length < 6) return n
  return n.slice(0, 4) + '•'.repeat(n.length - 6) + n.slice(-2)
}
