// Engine bridge OpenAI Realtime ↔ Twilio Media Stream.
//
// Audio µ-law 8kHz dans les deux sens (OpenAI accepte audio/pcmu en natif, donc
// AUCUNE conversion n'est nécessaire — on forward les payloads base64 tels quels).
//
// Interface (commune à tous les engines, cf. gemini-bridge.js) :
//   createOpenaiBridge({ twilioWs, streamSid, opener, openaiApiKey }) → {
//     handleTwilioEvent(data)  // dispatch sur events Twilio (media, mark, stop)
//     close()                  // ferme la WS OpenAI proprement
//     getTokens()              // snapshot accumulateur tokens (pour tracking final)
//   }

import { WebSocket } from 'ws'
import { buildSystemPrompt, buildFirstMessage } from '../prompt.js'
import { buildTurnDetection, buildNoiseReduction, openaiVadSummary } from './openai-vad.js'
import { createFluidityTracker, mulaw8kMs } from './fluidity.js'
import { GREETING_FALLBACK_MS, GREETING_PROTECT_MAX_MS } from './greeting.js'

const MODEL = 'gpt-realtime-2'
const VOICE = 'cedar'

export function createOpenaiBridge({ twilioWs, streamSid, opener, openaiApiKey, lang = 'fr' }) {
  // État de l'interaction OpenAI ↔ Twilio
  let latestMediaTimestamp   = 0
  let lastAssistantItem      = null
  let markQueue              = []
  let responseStartTimestamp = null
  let setupDone              = false
  let greetingHandled        = false  // bonjour proactif envoyé
  let greetingTimer          = null
  let micGateOpen            = false  // porte micro : fermée tant que le bonjour d'ouverture n'est pas fini
  let micGateTimer           = null

  // Accumulateur tokens (incrémenté à chaque response.done OpenAI).
  // En fin d'appel, server.js lit ça via getTokens() pour calculer le coût réel.
  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

  // Métriques de fluidité (Étape 0 — observation). Démo OpenAI = pas de
  // transcription user activée → presence_checks + suspected_false non
  // mesurables (null), mais le « blanc » reste précis (event speech_stopped).
  const fluidity = createFluidityTracker({ hasUserTranscription: false })

  const openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${MODEL}`,
    { headers: { Authorization: `Bearer ${openaiApiKey}` } },
  )

  openaiWs.on('open', () => {
    console.log('✅ Connecté à OpenAI Realtime')
    setupSession()
  })

  openaiWs.on('error', (err) => console.error('❌ OpenAI WS :', err?.message || err))
  openaiWs.on('close', ()    => console.log('• OpenAI déconnecté'))

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

      twilioWs.send(JSON.stringify({
        event:     'mark',
        streamSid,
        mark:      { name: 'ai-chunk' },
      }))
      markQueue.push('ai-chunk')
      fluidity.onAiAudio(mulaw8kMs(event.delta))
    }

    // VAD : l'utilisateur a fini de parler → ancre précise du « blanc »
    if (event.type === 'input_audio_buffer.speech_stopped') {
      fluidity.onUserSpeechStop()
    }

    // Comptage tokens en fin de chaque réponse IA
    if (event.type === 'response.done') {
      fluidity.onAiTurnComplete()
      // Fin du bonjour d'ouverture → on rouvre le micro (barge-in normal ensuite).
      openMicGate('bonjour terminé')
      const u = event.response?.usage
      if (u) {
        const totalAudioIn  = u.input_token_details?.audio_tokens                       ?? 0
        const cachedAudioIn = u.input_token_details?.cached_tokens_details?.audio_tokens ?? 0
        tokens.input_audio        += Math.max(0, totalAudioIn - cachedAudioIn)
        tokens.input_audio_cached += cachedAudioIn
        tokens.input_text         += u.input_token_details?.text_tokens   ?? 0
        tokens.output_audio       += u.output_token_details?.audio_tokens ?? 0
        tokens.output_text        += u.output_token_details?.text_tokens  ?? 0
      }
    }

    // Interruption (l'utilisateur prend la parole pendant que l'IA parle)
    if (event.type === 'input_audio_buffer.speech_started') {
      if (markQueue.length > 0 && responseStartTimestamp != null && lastAssistantItem) {
        fluidity.onBargeIn()
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

  function setupSession() {
    if (setupDone) return
    setupDone = true

    const systemPrompt = buildSystemPrompt(opener, lang)
    const firstMessage = buildFirstMessage(opener)
    const turnDetection  = buildTurnDetection()
    const noiseReduction = buildNoiseReduction()
    console.log(`📤 [openai] session.update + response.create (mode ${opener ? 'opener custom' : 'MODECT'}, lang=${lang}, VAD ${openaiVadSummary()})`)

    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        type:              'realtime',
        model:             MODEL,
        output_modalities: ['audio'],
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            // Fin de tour (anti-« blanc ») + réduction de bruit (anti faux barge-in).
            // Omis si kill-switch (OPENAI_VAD_DISABLED) → défauts OpenAI.
            ...(turnDetection  ? { turn_detection:  turnDetection }  : {}),
            ...(noiseReduction ? { noise_reduction: noiseReduction } : {}),
          },
          output: {
            format: { type: 'audio/pcmu' },
            voice:  VOICE,
          },
        },
        instructions: systemPrompt,
      },
    }))

    // Bonjour PROACTIF (défaut GREETING_FALLBACK_MS=0 = immédiat). La porte micro
    // reste FERMÉE le temps du bonjour (cf. handleTwilioEvent) → un « allô »
    // réflexe ne coupe pas le bonjour. Filet : rouvrir même si response.done manquait.
    greetingTimer = setTimeout(() => {
      greetingTimer = null
      if (greetingHandled || openaiWs.readyState !== WebSocket.OPEN) return
      greetingHandled = true
      console.log('📤 [openai] bonjour proactif')
      openaiWs.send(JSON.stringify({
        type:     'response.create',
        response: { instructions: firstMessage },
      }))
    }, GREETING_FALLBACK_MS)
    micGateTimer = setTimeout(() => { micGateTimer = null; openMicGate('sécurité') }, GREETING_PROTECT_MAX_MS)
  }

  // Rouvre la porte micro (idempotent) : l'audio user est de nouveau transmis à
  // OpenAI → barge-in normal.
  function openMicGate(reason) {
    if (micGateOpen) return
    micGateOpen = true
    if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
    console.log(`• [openai] micro ouvert (${reason}) → barge-in actif`)
  }

  return {
    handleTwilioEvent(data) {
      switch (data.event) {
        case 'media':
          latestMediaTimestamp = data.media.timestamp
          // Ne forwarder l'audio QU'APRÈS setupDone (sinon OpenAI ne connaît pas
          // encore le format µ-law ni son contexte) ET porte micro ouverte : tant
          // que le bonjour d'ouverture n'est pas fini, on DROP l'audio (un « allô »
          // réflexe ne coupe pas le bonjour).
          if (setupDone && micGateOpen && openaiWs.readyState === WebSocket.OPEN) {
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
    },
    close() {
      if (greetingTimer) { clearTimeout(greetingTimer); greetingTimer = null }
      if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close()
    },
    getTokens() {
      return { ...tokens }
    },
    getFluidityMetrics(durationSeconds) {
      return fluidity.compute(null, durationSeconds, 'openai')
    },
  }
}
