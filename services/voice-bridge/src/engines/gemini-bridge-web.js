// Engine bridge Google Gemini Live ↔ navigateur web (proxy WebSocket).
//
// Différence avec gemini-bridge.js (téléphone) :
//   - Pas de Twilio dans la boucle. Le client est directement le navigateur,
//     qui parle un protocole JSON simple via WebSocket (cf. ci-dessous).
//   - Aucune conversion audio : le navigateur envoie déjà du PCM16 16kHz LE et
//     attend du PCM16 24kHz LE en retour, ce sont les formats Gemini natifs.
//   - On expose les transcriptions input/output (inputAudioTranscription /
//     outputAudioTranscription activés dans le setup) au client pour affichage
//     dans le transcript live (cohérent avec ce que fait RealtimeSession côté
//     OpenAI via whisper-1).
//
// Protocole client (browser) ↔ ce bridge :
//
//   Client → bridge :
//     { type: "start",  opener: string|null }     // init + system prompt
//     { type: "audio",  data: base64-pcm16-16k }  // chunk micro
//     { type: "stop" }                            // raccrocher proprement
//
//   Bridge → client :
//     { type: "ready" }                                            // Gemini prêt
//     { type: "audio", data: base64-pcm16-24k }                    // chunk à jouer
//     { type: "interrupted" }                                      // vider buffer
//     { type: "transcript", role, text, done, itemId }             // delta texte
//     { type: "turn_complete" }                                    // fin de tour IA
//     { type: "ended" }                                            // Gemini fermé
//     { type: "error", message: string }                           // erreur applicative

import { WebSocket } from 'ws'
import { buildSystemPrompt, buildFirstMessage } from '../prompt.js'
import { buildRealtimeInputConfig, vadSummary } from './vad.js'
import { buildThinkingConfig, thinkingSummary } from './generation.js'
import { createFluidityTracker, pcm16Ms } from './fluidity.js'
import { GREETING_FALLBACK_MS, GREETING_PROTECT_MAX_MS } from './greeting.js'

const MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview'
const VOICE = process.env.GEMINI_VOICE || 'Aoede'

const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export function createGeminiBridgeWeb({ clientWs, geminiApiKey, onEnd }) {
  let geminiWs            = null
  let setupAcked          = false
  let started             = false
  let opener              = null
  let lang                = 'fr'
  let greetingHandled     = false  // amorce proactive envoyée
  let greetingTimer       = null
  let micGateOpen         = false  // porte micro : fermée tant que le bonjour d'ouverture n'est pas fini
  let micGateTimer        = null
  // Identifiants de tour pour le transcript live. Le client utilise itemId
  // pour mettre à jour le bon message dans l'UI (delta vs done).
  let currentAssistantId  = null
  let currentUserId       = null
  let turnSeq             = 0

  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

  // Métriques de fluidité (Étape 0 — observation). Audio sortant = PCM16 24kHz.
  const fluidity = createFluidityTracker({ hasUserTranscription: true })

  // --- Client (browser) → bridge ------------------------------------------
  clientWs.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'start' && !started) {
      started = true
      opener  = typeof msg.opener === 'string' && msg.opener.trim() ? msg.opener.trim() : null
      lang    = typeof msg.lang === 'string' && msg.lang.trim() ? msg.lang.trim() : 'fr'
      connectGemini()
      return
    }

    if (msg.type === 'audio' && setupAcked && micGateOpen && geminiWs?.readyState === WebSocket.OPEN) {
      // Porte micro fermée tant que le bonjour d'ouverture n'est pas fini → on
      // DROP l'audio (un « allô » réflexe ne coupe pas le bonjour).
      // Le client envoie déjà du base64 PCM16 16k LE → forward sans conversion
      geminiWs.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data:     msg.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      }))
    }

    if (msg.type === 'stop') {
      cleanup()
    }
  })

  clientWs.on('close', () => {
    cleanup()
    onEnd?.({ tokens })
  })
  clientWs.on('error', (err) => {
    console.error('❌ [web/client] WS :', err?.message || err)
    cleanup()
  })

  // --- Connexion Gemini ----------------------------------------------------
  function connectGemini() {
    const url = `${ENDPOINT}?key=${encodeURIComponent(geminiApiKey)}`
    geminiWs = new WebSocket(url)

    geminiWs.on('open', () => {
      console.log('✅ [web] Connecté à Gemini Live')
      sendSetup()
    })

    geminiWs.on('error', (err) => {
      console.error('❌ [web] Gemini WS :', err?.message || err)
      sendClient({ type: 'error', message: 'Connexion Gemini échouée' })
    })

    geminiWs.on('close', (code, reason) => {
      console.log(`• [web] Gemini déconnecté (${code}${reason ? ` ${reason.toString()}` : ''})`)
      sendClient({ type: 'ended' })
      try { clientWs.close() } catch { /* */ }
    })

    geminiWs.on('message', (data) => {
      let msg
      try { msg = JSON.parse(data.toString()) } catch { return }

      // 1er message après setup → on prévient le client (UI) + amorce PROACTIVE
      // (défaut immédiat). La porte micro reste FERMÉE le temps du bonjour → un
      // « allô » réflexe ne coupe pas le bonjour. Filet : rouvrir même si
      // turnComplete manquait.
      if (msg.setupComplete && !setupAcked) {
        setupAcked = true
        sendClient({ type: 'ready' })
        greetingTimer = setTimeout(() => {
          greetingTimer = null
          if (greetingHandled) return
          greetingHandled = true
          console.log('📤 [web/gemini] amorce proactive')
          sendFirstMessage()
        }, GREETING_FALLBACK_MS)
        micGateTimer = setTimeout(() => { micGateTimer = null; openMicGate('sécurité') }, GREETING_PROTECT_MAX_MS)
        return
      }

      if (msg.serverContent) {
        const sc = msg.serverContent

        // Audio out → forward base64 PCM16 24k tel quel
        const parts = sc.modelTurn?.parts ?? []
        for (const part of parts) {
          const b64 = part.inlineData?.data
          if (b64) {
            if (!currentAssistantId) currentAssistantId = `g-a-${turnSeq++}`
            sendClient({ type: 'audio', data: b64 })
            fluidity.onAiAudio(pcm16Ms(b64, 24000))
          }
        }

        // Transcript IA (delta)
        if (sc.outputTranscription?.text) {
          if (!currentAssistantId) currentAssistantId = `g-a-${turnSeq++}`
          sendClient({
            type:   'transcript',
            role:   'assistant',
            text:   sc.outputTranscription.text,
            done:   false,
            itemId: currentAssistantId,
          })
        }

        // Transcript utilisateur (delta)
        if (sc.inputTranscription?.text) {
          if (!currentUserId) currentUserId = `g-u-${turnSeq++}`
          sendClient({
            type:   'transcript',
            role:   'user',
            text:   sc.inputTranscription.text,
            done:   false,
            itemId: currentUserId,
          })
          fluidity.onUserText(sc.inputTranscription.text)
        }

        if (sc.interrupted) {
          sendClient({ type: 'interrupted' })
          currentAssistantId = null
          fluidity.onBargeIn()
        }

        if (sc.turnComplete) {
          // Marque les deux derniers items comme done pour figer leur état UI
          if (currentAssistantId) {
            sendClient({ type: 'transcript', role: 'assistant', text: '', done: true, itemId: currentAssistantId })
            currentAssistantId = null
          }
          if (currentUserId) {
            sendClient({ type: 'transcript', role: 'user', text: '', done: true, itemId: currentUserId })
            currentUserId = null
          }
          sendClient({ type: 'turn_complete' })
          fluidity.onAiTurnComplete()
          // Fin du bonjour d'ouverture → on rouvre le micro (barge-in normal ensuite).
          openMicGate('bonjour terminé')
        }
      }

      // Comptage tokens (peut accompagner n'importe quel message serveur)
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
        console.error('❌ [web] Gemini :', msg.error?.message ?? msg.error)
        sendClient({ type: 'error', message: msg.error?.message ?? 'Erreur Gemini' })
      }
    })
  }

  function sendSetup() {
    const systemPrompt = buildSystemPrompt(opener, lang)
    const realtimeInputConfig = buildRealtimeInputConfig()
    console.log(`📤 [web/gemini] setup (modèle=${MODEL}, voix=${VOICE}, VAD ${vadSummary()}, thinking ${thinkingSummary()}, mode ${opener ? 'opener custom' : 'MODECT'})`)
    geminiWs.send(JSON.stringify({
      setup: {
        model: MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          ...(buildThinkingConfig() ?? {}),
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
        outputAudioTranscription: {},
        inputAudioTranscription:  {},
      },
    }))
  }

  // Rouvre la porte micro (idempotent) : l'audio client est de nouveau transmis
  // à Gemini → barge-in normal.
  function openMicGate(reason) {
    if (micGateOpen) return
    micGateOpen = true
    if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
    console.log(`• [web/gemini] micro ouvert (${reason}) → barge-in actif`)
  }

  function sendFirstMessage() {
    const firstMessage = buildFirstMessage(opener)
    geminiWs.send(JSON.stringify({
      clientContent: {
        turns: [
          { role: 'user', parts: [{ text: firstMessage }] },
        ],
        turnComplete: true,
      },
    }))
  }

  function sendClient(payload) {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload))
    }
  }

  function cleanup() {
    if (greetingTimer) { clearTimeout(greetingTimer); greetingTimer = null }
    if (micGateTimer) { clearTimeout(micGateTimer); micGateTimer = null }
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      try { geminiWs.close() } catch { /* */ }
    }
  }

  return {
    getTokens() { return { ...tokens } },
    getFluidityMetrics(durationSeconds) {
      return fluidity.compute(null, durationSeconds, 'gemini')
    },
    close: cleanup,
  }
}
