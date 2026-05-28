// Engine bridge Google Gemini Live ↔ Twilio Media Stream.
//
// Différences clés vs openai-bridge :
//   - Endpoint WSS différent (?key=API_KEY au lieu de Bearer)
//   - Format audio : Twilio envoie µ-law 8kHz, Gemini veut PCM16 16kHz LE
//     et renvoie PCM16 24kHz LE → conversion bidirectionnelle (cf. audio.js)
//   - Setup en 1 seul message (pas de séparation session.update / response.create)
//   - First message déclenché via un user-turn clientContent
//   - Interruption signalée par serverContent.interrupted (équivalent du
//     truncate OpenAI + clear Twilio)
//
// Interface identique à openai-bridge → server.js peut les utiliser
// indifféremment (createXxxBridge → { handleTwilioEvent, close, getTokens }).

import { WebSocket } from 'ws'
import { buildSystemPrompt, buildFirstMessage } from '../prompt.js'
import { mulawB64ToPcm16B64At16k, pcm24B64ToMulawB64At8k } from './audio.js'

// Modèle et voix surchargeables par env pour itérer sans redéploiement de code.
// Valeur par défaut validée en test réel le 2026-05-28 (Aoede sonne mieux en
// français que cedar côté OpenAI, conversation fluide).
const MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview'
const VOICE = process.env.GEMINI_VOICE || 'Aoede'

const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export function createGeminiBridge({ twilioWs, streamSid, opener, geminiApiKey }) {
  let setupAcked = false

  // Accumulateur tokens. Schéma aligné sur OpenAI pour réutiliser les colonnes
  // demo_calls.tokens_* existantes. input_audio_cached reste à 0 (Gemini ne
  // facture pas le cache audio à ce jour).
  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

  const url = `${ENDPOINT}?key=${encodeURIComponent(geminiApiKey)}`
  const geminiWs = new WebSocket(url)

  geminiWs.on('open', () => {
    console.log('✅ Connecté à Gemini Live')
    sendSetup()
  })

  geminiWs.on('error', (err) => console.error('❌ Gemini WS :', err?.message || err))
  geminiWs.on('close', (code, reason) => {
    console.log(`• Gemini déconnecté (${code}${reason ? ` ${reason.toString()}` : ''})`)
  })

  geminiWs.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }

    // 1er message attendu : setupComplete → on peut envoyer l'amorce
    if (msg.setupComplete && !setupAcked) {
      setupAcked = true
      console.log('📤 [gemini] setupComplete reçu — envoi du first message')
      sendFirstMessage()
      return
    }

    // Audio sortant + flags d'état (turnComplete, interrupted)
    if (msg.serverContent) {
      const sc = msg.serverContent

      const parts = sc.modelTurn?.parts ?? []
      for (const part of parts) {
        const b64 = part.inlineData?.data
        if (b64 && streamSid) {
          // PCM16 24kHz → µ-law 8kHz, push vers Twilio
          const mulawB64 = pcm24B64ToMulawB64At8k(b64)
          twilioWs.send(JSON.stringify({
            event:     'media',
            streamSid,
            media:     { payload: mulawB64 },
          }))
          twilioWs.send(JSON.stringify({
            event:     'mark',
            streamSid,
            mark:      { name: 'ai-chunk' },
          }))
        }
      }

      // Barge-in : l'utilisateur a interrompu → vider le buffer Twilio
      if (sc.interrupted) {
        twilioWs.send(JSON.stringify({ event: 'clear', streamSid }))
      }
    }

    // Comptage tokens : usageMetadata peut accompagner n'importe quel message
    // serveur. On accumule modality par modality. (Gemini ne distingue pas
    // cached vs non-cached pour l'audio → tout va dans input_audio.)
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

    // Erreur explicite (rare mais possible)
    if (msg.error) {
      console.error('❌ Gemini :', msg.error?.message ?? msg.error)
    }
  })

  function sendSetup() {
    const systemPrompt = buildSystemPrompt(opener)
    console.log(`📤 [gemini] setup (modèle=${MODEL}, voix=${VOICE}, mode ${opener ? 'opener custom' : 'MODECT'})`)
    geminiWs.send(JSON.stringify({
      setup: {
        model: MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICE },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        // Active les transcriptions pour pouvoir les afficher dans le dashboard
        // plus tard. Champ vide = activation par défaut.
        outputAudioTranscription: {},
        inputAudioTranscription:  {},
      },
    }))
  }

  function sendFirstMessage() {
    const firstMessage = buildFirstMessage(opener)
    // Gemini ne répond que lorsque le user envoie quelque chose. On simule donc
    // un user turn texte avec l'instruction d'amorce — Gemini répond en audio.
    geminiWs.send(JSON.stringify({
      clientContent: {
        turns: [
          { role: 'user', parts: [{ text: firstMessage }] },
        ],
        turnComplete: true,
      },
    }))
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
          // Pas de suivi de marks côté Gemini (gestion d'interruption faite via
          // l'event serverContent.interrupted plutôt que markQueue).
          break

        case 'stop':
          console.log('• Stream stoppé par Twilio')
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
  }
}
