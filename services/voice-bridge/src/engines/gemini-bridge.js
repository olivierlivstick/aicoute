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
import { mulawB64ToPcm16B64At16k, pcm24B64ToMulawB64At8k, mulawB64ToPcm8Samples } from './audio.js'
import { buildRealtimeInputConfig, vadSummary } from './vad.js'
import { createFluidityTracker, mulaw8kMs } from './fluidity.js'
import { createEndpointDetector, endpointSummary } from './endpointing.js'
import { GREETING_FALLBACK_MS, GREETING_PROTECT_MAX_MS } from './greeting.js'

// Modèle et voix surchargeables par env pour itérer sans redéploiement de code.
// Valeur par défaut validée en test réel le 2026-05-28 (Aoede sonne mieux en
// français que cedar côté OpenAI, conversation fluide).
const MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview'
const VOICE = process.env.GEMINI_VOICE || 'Aoede'

const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export function createGeminiBridge({ twilioWs, streamSid, opener, geminiApiKey, lang = 'fr' }) {
  let setupAcked      = false
  let greetingHandled = false  // bonjour proactif envoyé
  let greetingTimer   = null
  let micGateOpen     = false  // porte micro : fermée tant que le bonjour d'ouverture n'est pas fini
  let micGateTimer    = null

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

  // Métriques de fluidité (Étape 0 — observation). inputAudioTranscription est
  // activé dans le setup → presence_checks + suspected_false mesurables. La fin
  // de parole est mesurée acoustiquement (endpoint ci-dessous) → « blanc » précis.
  const fluidity = createFluidityTracker({ hasUserTranscription: true })

  // Détecteur de fin de parole acoustique sur l'audio entrant (lecture seule).
  const endpoint = createEndpointDetector({
    onSpeechStop: (at) => fluidity.onUserSpeechStop(at),
    sampleRate:   8000,
  })

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

    // 1er message attendu : setupComplete → amorce PROACTIVE (défaut immédiat).
    // La porte micro reste FERMÉE le temps du bonjour (cf. handleTwilioEvent) →
    // un « allô » réflexe ne coupe pas le bonjour. Filet : rouvrir le micro même
    // si turnComplete manquait.
    if (msg.setupComplete && !setupAcked) {
      setupAcked = true
      console.log('• [gemini] setupComplete reçu — bonjour protégé (micro fermé)')
      greetingTimer = setTimeout(() => {
        greetingTimer = null
        if (greetingHandled) return
        greetingHandled = true
        console.log('📤 [gemini] amorce proactive')
        sendFirstMessage()
      }, GREETING_FALLBACK_MS)
      micGateTimer = setTimeout(() => { micGateTimer = null; openMicGate('sécurité') }, GREETING_PROTECT_MAX_MS)
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
          fluidity.onAiAudio(mulaw8kMs(mulawB64))
        }
      }

      // Transcript user (fluidité : presence_checks + ancre proxy du « blanc »)
      if (sc.inputTranscription?.text) {
        fluidity.onUserText(sc.inputTranscription.text)
      }

      if (sc.turnComplete) {
        fluidity.onAiTurnComplete()
        // Fin du bonjour d'ouverture → on rouvre le micro (barge-in normal ensuite).
        openMicGate('bonjour terminé')
      }

      // Barge-in : l'utilisateur a interrompu → vider le buffer Twilio
      if (sc.interrupted) {
        twilioWs.send(JSON.stringify({ event: 'clear', streamSid }))
        fluidity.onBargeIn()
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
    const systemPrompt = buildSystemPrompt(opener, lang)
    const realtimeInputConfig = buildRealtimeInputConfig()
    console.log(`📤 [gemini] setup (modèle=${MODEL}, voix=${VOICE}, VAD ${vadSummary()}, endpoint ${endpointSummary()}, mode ${opener ? 'opener custom' : 'MODECT'}, lang=${lang})`)
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
        // Adoucit l'interruption (barge-in moins nerveux). Omis si kill-switch.
        ...(realtimeInputConfig ? { realtimeInputConfig } : {}),
        // Active les transcriptions pour pouvoir les afficher dans le dashboard
        // plus tard. Champ vide = activation par défaut.
        outputAudioTranscription: {},
        inputAudioTranscription:  {},
      },
    }))
  }

  // Rouvre la porte micro (idempotent) : l'audio user est de nouveau transmis à
  // Gemini → barge-in normal.
  function openMicGate(reason) {
    if (micGateOpen) return
    micGateOpen = true
    if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
    console.log(`• [gemini] micro ouvert (${reason}) → barge-in actif`)
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
          // Porte micro fermée tant que le bonjour d'ouverture n'est pas fini →
          // on DROP l'audio (un « allô » réflexe ne coupe pas le bonjour).
          if (setupAcked && micGateOpen && geminiWs.readyState === WebSocket.OPEN) {
            // Mesure de fin de parole acoustique (lecture seule, avant l'envoi).
            endpoint.feed(mulawB64ToPcm8Samples(data.media.payload))
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
      if (greetingTimer) { clearTimeout(greetingTimer); greetingTimer = null }
      if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
      if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close()
    },
    getTokens() {
      return { ...tokens }
    },
    getFluidityMetrics(durationSeconds) {
      return fluidity.compute(null, durationSeconds, 'gemini')
    },
  }
}
