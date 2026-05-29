// Engine bridge Google Gemini Live ↔ Twilio Media Stream pour les APPELS
// PLANIFIÉS MODECT (équivalent de modect-call-bridge.js mais avec Gemini).
//
// Différences avec engines/gemini-bridge.js (qui sert la démo vitrine) :
//   - Le system prompt vient de get-call-context (Edge Fn protégée par
//     MODECT_INTERNAL_TOKEN) au lieu d'être construit localement.
//   - Le transcript est accumulé (outputTranscription côté IA +
//     inputTranscription côté user) puis flushé vers save-transcript en
//     fin d'appel.
//   - Les tokens et le coût IA réel sont écrits dans `calls` via
//     recordCallTokens(..., 'gemini') (tarifs distincts d'OpenAI).
//
// Interface identique aux autres bridges :
//   createModectGeminiBridge({ twilioWs, streamSid, callId, ... }) → {
//     handleTwilioEvent(data), close(), getTokens(), flushFinal(durationSec, status)
//   }

import { WebSocket } from 'ws'
import { mulawB64ToPcm16B64At16k, pcm24B64ToMulawB64At8k } from './audio.js'
import { logEvent } from '../persistence/system-events.js'

const MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview'
const VOICE_DEFAULT = process.env.GEMINI_VOICE || 'Aoede'

const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

/**
 * @param {object} opts
 * @param {WebSocket} opts.twilioWs       WS Twilio (Stream)
 * @param {string}    opts.streamSid      Stream sid Twilio
 * @param {string}    opts.callId         id du call Modect
 * @param {string}    opts.geminiApiKey
 * @param {string}    opts.supabaseUrl    pour fetch get-call-context et save-transcript
 * @param {string}    opts.internalToken  MODECT_INTERNAL_TOKEN
 * @param {string}    opts.serviceRoleKey pour save-transcript (Bearer)
 * @param {(end: { tokens, transcript, durationSeconds }) => void} [opts.onEnd]
 */
export function createModectGeminiBridge(opts) {
  const {
    twilioWs, streamSid, callId,
    geminiApiKey, supabaseUrl, internalToken, serviceRoleKey,
    onEnd,
  } = opts

  // --- État interne ---------------------------------------------------------
  let voice               = VOICE_DEFAULT
  let instructions        = null
  let firstMessageHint    = null
  let setupAcked          = false
  let setupSent           = false
  let contextFetched      = false
  let geminiReady         = false

  // Tokens accumulés (snapshot final → calls.ai_cost_eur_real). Gemini ne
  // distingue pas cached vs non-cached pour l'audio → input_audio_cached = 0.
  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

  // Transcript accumulé. Gemini envoie les transcriptions par chunks au fil
  // de l'eau via serverContent.outputTranscription / inputTranscription. On
  // bufferise par speaker et on commit à chaque turn (turnComplete).
  const transcript    = []
  let assistantBuffer = ''
  let userBuffer      = ''
  let flushed         = false

  // --- Connexion Gemini Live ------------------------------------------------
  const url = `${ENDPOINT}?key=${encodeURIComponent(geminiApiKey)}`
  const geminiWs = new WebSocket(url)

  geminiWs.on('open', () => {
    console.log(`✅ [modect-gemini:${shortId(callId)}] Gemini Live connecté`)
    geminiReady = true
    maybeSendSetup()
  })

  geminiWs.on('error', (err) => {
    console.error(`❌ [modect-gemini:${shortId(callId)}] Gemini WS:`, err?.message || err)
  })

  geminiWs.on('close', (code, reason) => {
    console.log(`• [modect-gemini:${shortId(callId)}] Gemini déconnecté (${code}${reason ? ` ${reason.toString()}` : ''})`)
  })

  geminiWs.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    // 1er ack : on peut envoyer le first message
    if (msg.setupComplete && !setupAcked) {
      setupAcked = true
      console.log(`📤 [modect-gemini:${shortId(callId)}] setupComplete reçu — envoi du first message`)
      sendFirstMessage()
      return
    }

    if (msg.serverContent) {
      const sc = msg.serverContent

      // Audio sortant → Twilio (PCM16 24kHz → µ-law 8kHz)
      const parts = sc.modelTurn?.parts ?? []
      for (const part of parts) {
        const b64 = part.inlineData?.data
        if (b64 && streamSid) {
          const mulawB64 = pcm24B64ToMulawB64At8k(b64)
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: mulawB64 },
          }))
          twilioWs.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'ai-chunk' } }))
        }
      }

      // Transcriptions (assistant + user) — accumulent au fil du turn
      if (sc.outputTranscription?.text) {
        assistantBuffer += sc.outputTranscription.text
      }
      if (sc.inputTranscription?.text) {
        userBuffer += sc.inputTranscription.text
      }

      // Fin de turn → commit les buffers dans l'ordre temporel : l'user a
      // parlé en premier, l'assistant a répondu ensuite. Au tout premier
      // turn (initié par le firstMessageHint serveur), userBuffer est vide
      // et seul l'assistant est commité — ordre correct dans tous les cas.
      if (sc.turnComplete) {
        const uText = userBuffer.trim()
        if (uText) {
          transcript.push({
            role:      'user',
            text:      uText,
            timestamp: new Date().toISOString(),
          })
        }
        const aText = assistantBuffer.trim()
        if (aText) {
          transcript.push({
            role:      'assistant',
            text:      aText,
            timestamp: new Date().toISOString(),
          })
        }
        assistantBuffer = ''
        userBuffer      = ''
      }

      // Barge-in : user a interrompu l'IA → vider le buffer Twilio
      if (sc.interrupted) {
        twilioWs.send(JSON.stringify({ event: 'clear', streamSid }))
      }
    }

    // Tokens : usageMetadata peut accompagner n'importe quel message serveur
    if (msg.usageMetadata) {
      const u = msg.usageMetadata
      for (const d of u.promptTokensDetails ?? []) {
        if (d.modality === 'AUDIO') tokens.input_audio += d.tokenCount ?? 0
        else if (d.modality === 'TEXT') tokens.input_text += d.tokenCount ?? 0
      }
      for (const d of u.responseTokensDetails ?? []) {
        if (d.modality === 'AUDIO') tokens.output_audio += d.tokenCount ?? 0
        else if (d.modality === 'TEXT') tokens.output_text += d.tokenCount ?? 0
      }
    }

    if (msg.error) {
      console.error(`❌ [modect-gemini:${shortId(callId)}] Gemini error:`, msg.error?.message ?? msg.error)
    }
  })

  // --- Fetch du contexte (parallèle à l'ouverture WS Gemini) ----------------
  ;(async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/get-call-context`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internalToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ call_id: callId }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error(`❌ [modect-gemini:${shortId(callId)}] get-call-context ${res.status}: ${detail}`)
        void logEvent({
          level:   'error',
          source:  'voice-bridge/scheduled-gemini',
          call_id: callId,
          message: `get-call-context HTTP ${res.status}`,
          payload: { detail: detail.slice(0, 500) },
        })
        try { twilioWs.close() } catch { /* */ }
        return
      }
      const ctx = await res.json()
      // Pour Gemini on garde la voice Gemini (Aoede par défaut) — la voice
      // OpenAI (cedar/marin) ne s'applique pas. Si plus tard on ajoute un
      // champ voice côté ctx, on le respectera.
      instructions     = ctx.instructions     ?? ''
      firstMessageHint = buildFirstMessageHint(ctx.persona_name, ctx.beneficiary_name)
      contextFetched   = true
      console.log(`📥 [modect-gemini:${shortId(callId)}] contexte fetché (model=${MODEL}, voice=${voice}, persona=${ctx.persona_name})`)
      maybeSendSetup()
    } catch (err) {
      console.error(`❌ [modect-gemini:${shortId(callId)}] fetch context:`, err?.message || err)
      void logEvent({
        level:   'error',
        source:  'voice-bridge/scheduled-gemini',
        call_id: callId,
        message: `Exception fetch get-call-context: ${err?.message || 'inconnue'}`,
      })
      try { twilioWs.close() } catch { /* */ }
    }
  })()

  function maybeSendSetup() {
    if (setupSent || !geminiReady || !contextFetched) return
    setupSent = true
    console.log(`📤 [modect-gemini:${shortId(callId)}] setup`)
    geminiWs.send(JSON.stringify({
      setup: {
        model: MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: instructions }],
        },
        outputAudioTranscription: {},
        inputAudioTranscription:  {},
      },
    }))
  }

  function sendFirstMessage() {
    geminiWs.send(JSON.stringify({
      clientContent: {
        turns: [
          { role: 'user', parts: [{ text: firstMessageHint }] },
        ],
        turnComplete: true,
      },
    }))
  }

  // --- Flush final (transcript + tokens) vers Supabase ----------------------
  async function flushFinal(durationSeconds, status) {
    if (flushed) return
    flushed = true

    // Commit les buffers restants en best-effort (même ordre temporel que ci-dessus)
    const uText = userBuffer.trim()
    if (uText) transcript.push({ role: 'user', text: uText, timestamp: new Date().toISOString() })
    const aText = assistantBuffer.trim()
    if (aText) transcript.push({ role: 'assistant', text: aText, timestamp: new Date().toISOString() })

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/save-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          call_id:          callId,
          transcript,
          duration_seconds: Math.round(durationSeconds),
          status,
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error(`❌ [modect-gemini:${shortId(callId)}] save-transcript ${res.status}: ${detail}`)
        void logEvent({
          level:   'error',
          source:  'voice-bridge/scheduled-gemini',
          call_id: callId,
          message: `save-transcript HTTP ${res.status}`,
          payload: { detail: detail.slice(0, 500), transcript_entries: transcript.length },
        })
      } else {
        console.log(`✅ [modect-gemini:${shortId(callId)}] transcript persisté (${transcript.length} entrées, ${Math.round(durationSeconds)}s)`)
      }
    } catch (err) {
      console.error(`❌ [modect-gemini:${shortId(callId)}] save-transcript fetch:`, err?.message || err)
      void logEvent({
        level:   'error',
        source:  'voice-bridge/scheduled-gemini',
        call_id: callId,
        message: `Exception save-transcript: ${err?.message || 'inconnue'}`,
      })
    }

    onEnd?.({ tokens: { ...tokens }, transcript, durationSeconds })
  }

  return {
    handleTwilioEvent(data) {
      switch (data.event) {
        case 'media':
          if (setupAcked && geminiWs.readyState === WebSocket.OPEN) {
            const pcm16B64 = mulawB64ToPcm16B64At16k(data.media.payload)
            geminiWs.send(JSON.stringify({
              realtimeInput: {
                audio: {
                  data:     pcm16B64,
                  mimeType: 'audio/pcm;rate=16000',
                },
              },
            }))
          }
          break

        case 'mark':
          // Gemini gère l'interruption via serverContent.interrupted (pas via mark queue)
          break

        case 'stop':
          console.log(`• [modect-gemini:${shortId(callId)}] Stream Twilio stoppé`)
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close()
          break
      }
    },
    close() {
      if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close()
    },
    getTokens() {
      return { ...tokens }
    },
    flushFinal,
  }
}

function buildFirstMessageHint(personaName, beneficiaryName) {
  const persona = personaName ?? 'Marie'
  const name    = beneficiaryName ?? ''
  return `Commence maintenant la conversation, exactement comme demandé dans tes instructions : un bonjour chaleureux à ${name}, en te présentant comme ${persona}, puis une question ouverte sur sa journée.`
}

function shortId(s) {
  return (s ?? '').toString().slice(0, 8)
}
