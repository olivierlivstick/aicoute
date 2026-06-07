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

const MODEL = 'gpt-realtime-2'
const VOICE = 'cedar'

export function createOpenaiBridge({ twilioWs, streamSid, opener, openaiApiKey, lang = 'fr' }) {
  // État de l'interaction OpenAI ↔ Twilio
  let latestMediaTimestamp   = 0
  let lastAssistantItem      = null
  let markQueue              = []
  let responseStartTimestamp = null
  let setupDone              = false

  // Accumulateur tokens (incrémenté à chaque response.done OpenAI).
  // En fin d'appel, server.js lit ça via getTokens() pour calculer le coût réel.
  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

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
    }

    // Comptage tokens en fin de chaque réponse IA
    if (event.type === 'response.done') {
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

    // Petit délai pour laisser OpenAI digérer session.update avant la 1re réponse
    setTimeout(() => {
      if (openaiWs.readyState !== WebSocket.OPEN) return
      openaiWs.send(JSON.stringify({
        type:     'response.create',
        response: { instructions: firstMessage },
      }))
    }, 250)
  }

  return {
    handleTwilioEvent(data) {
      switch (data.event) {
        case 'media':
          latestMediaTimestamp = data.media.timestamp
          // Ne forwarder l'audio QU'APRÈS setupDone (sinon OpenAI ne connaît
          // pas encore le format µ-law ni son contexte system prompt).
          if (setupDone && openaiWs.readyState === WebSocket.OPEN) {
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
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close()
    },
    getTokens() {
      return { ...tokens }
    },
  }
}
