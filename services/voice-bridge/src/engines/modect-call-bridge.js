// Engine bridge OpenAI Realtime ↔ Twilio pour les APPELS PLANIFIÉS MODECT.
//
// Différences avec openai-bridge.js (qui sert la démo vitrine) :
//   - Le system prompt N'est PAS construit localement : il est fetché depuis
//     l'Edge Function `get-call-context` au moment du start (qui injecte le
//     contexte bénéficiaire, mémoires, extra prompt aidant…).
//   - Le transcript est ACCUMULÉ (events `response.output_audio_transcript.*`
//     côté assistant + `conversation.item.input_audio_transcription.completed`
//     côté user) puis flushé vers `save-transcript` à la fin de l'appel.
//   - Les tokens sont écrits dans `calls` (pas `demo_calls`) via la fonction
//     `recordModectCallEnd` du module persistence/modect-call.js.
//
// Interface identique aux autres engines :
//   createModectCallBridge({ twilioWs, streamSid, callId, ... }) → {
//     handleTwilioEvent(data), close(), getTokens()
//   }

import { WebSocket } from 'ws'
import { buildTurnDetection, buildNoiseReduction, openaiVadSummary } from './openai-vad.js'
import { createFluidityTracker, mulaw8kMs } from './fluidity.js'
import { GREETING_FALLBACK_MS, GREETING_PROTECT_MAX_MS } from './greeting.js'
import { logEvent } from '../persistence/system-events.js'

const MODEL_DEFAULT = 'gpt-realtime-2'
const VOICE_DEFAULT = 'cedar'

/**
 * @param {object} opts
 * @param {WebSocket}        opts.twilioWs       WS Twilio (Stream)
 * @param {string}           opts.streamSid      Stream sid Twilio
 * @param {string}           opts.callId         id du call Modect
 * @param {string}           opts.openaiApiKey
 * @param {string}           opts.supabaseUrl    pour fetch get-call-context et save-transcript
 * @param {string}           opts.internalToken  MODECT_INTERNAL_TOKEN (auth get-call-context)
 * @param {string}           opts.serviceRoleKey pour save-transcript (Bearer)
 * @param {(end: { tokens, transcript, durationSeconds }) => void} [opts.onEnd]
 *     Callback synchrone appelé après le flush final (pour log/tracking côté server).
 */
export function createModectCallBridge(opts) {
  const {
    twilioWs, streamSid, callId,
    openaiApiKey, supabaseUrl, internalToken, serviceRoleKey,
    onEnd,
  } = opts

  // --- État interne ---------------------------------------------------------
  let model                 = MODEL_DEFAULT
  let voice                 = VOICE_DEFAULT
  let instructions          = null
  let firstMessageHint      = null  // construit à partir du persona_name
  let setupDone             = false
  let openaiReady           = false  // openai WS ouverte ET context fetché
  let contextFetched        = false
  let greetingHandled       = false  // bonjour proactif envoyé
  let greetingTimer         = null
  let micGateOpen           = false  // porte micro : fermée tant que le bonjour d'ouverture n'est pas fini
  let micGateTimer          = null

  let latestMediaTimestamp   = 0
  let lastAssistantItem      = null
  let markQueue              = []
  let responseStartTimestamp = null

  // Tokens accumulés (snapshot final → calls.ai_cost_eur_real)
  const tokens = {
    input_audio:        0,
    input_audio_cached: 0,
    output_audio:       0,
    input_text:         0,
    output_text:        0,
  }

  // Transcript accumulé
  //   - Assistant : on bufferise les deltas par item_id puis on commit l'item
  //     une fois `response.output_audio_transcript.done` reçu (ou fin de réponse).
  //   - User     : on attend `conversation.item.input_audio_transcription.completed`
  //     qui porte le texte final dans event.transcript.
  const transcript      = []
  const assistantBuffer = new Map()  // item_id → { text, started_at }
  let flushed           = false

  // Métriques de fluidité (Étape 0 — observation). OpenAI fournit le transcript
  // user (whisper) → presence_checks + suspected_false mesurables.
  const fluidity = createFluidityTracker({ hasUserTranscription: true })

  // --- Connexion OpenAI Realtime -------------------------------------------
  const openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${MODEL_DEFAULT}`,
    { headers: { Authorization: `Bearer ${openaiApiKey}` } },
  )

  openaiWs.on('open', () => {
    console.log(`✅ [modect:${shortId(callId)}] OpenAI Realtime connecté`)
    openaiReady = true
    maybeSetupSession()
  })

  openaiWs.on('error', (err) => {
    console.error(`❌ [modect:${shortId(callId)}] OpenAI WS:`, err?.message || err)
  })

  openaiWs.on('close', () => {
    console.log(`• [modect:${shortId(callId)}] OpenAI déconnecté`)
  })

  openaiWs.on('message', (raw) => {
    let event
    try { event = JSON.parse(raw.toString()) } catch { return }

    if (event.type === 'error') {
      console.error(`❌ [modect:${shortId(callId)}] OpenAI error:`, event.error?.message || event)
      return
    }

    // Audio sortant → Twilio
    if (event.type === 'response.output_audio.delta' && event.delta && streamSid) {
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: event.delta },
      }))
      if (!responseStartTimestamp) responseStartTimestamp = latestMediaTimestamp
      if (event.item_id) lastAssistantItem = event.item_id
      twilioWs.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'ai-chunk' } }))
      markQueue.push('ai-chunk')
      fluidity.onAiAudio(mulaw8kMs(event.delta))
    }

    // Transcript assistant (GA : response.output_audio_transcript.* ;
    //                       fallback Beta : response.audio_transcript.*)
    if (event.type === 'response.output_audio_transcript.delta'
        || event.type === 'response.audio_transcript.delta') {
      const itemId = event.item_id ?? 'unknown'
      const delta  = event.delta ?? ''
      const entry  = assistantBuffer.get(itemId) ?? { text: '', started_at: new Date().toISOString() }
      entry.text += delta
      assistantBuffer.set(itemId, entry)
    }

    if (event.type === 'response.output_audio_transcript.done'
        || event.type === 'response.audio_transcript.done') {
      const itemId = event.item_id ?? 'unknown'
      const entry  = assistantBuffer.get(itemId)
      const text   = (event.transcript ?? entry?.text ?? '').trim()
      if (text) {
        transcript.push({
          role:      'assistant',
          text,
          timestamp: entry?.started_at ?? new Date().toISOString(),
        })
      }
      assistantBuffer.delete(itemId)
    }

    // Transcript user (transcription Whisper côté input)
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const text = (event.transcript ?? '').trim()
      if (text) {
        transcript.push({
          role:      'user',
          text,
          timestamp: new Date().toISOString(),
        })
        fluidity.onUserText(text)
      }
    }

    // Fin de réponse IA = fin de tour (fluidité)
    if (event.type === 'response.done') {
      fluidity.onAiTurnComplete()
      // Fin du bonjour d'ouverture → on rouvre le micro (barge-in normal ensuite).
      openMicGate('bonjour terminé')
    }

    // VAD : l'utilisateur a fini de parler → ancre précise du « blanc »
    if (event.type === 'input_audio_buffer.speech_stopped') {
      fluidity.onUserSpeechStop()
    }

    // Tokens (en fin de chaque réponse IA)
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

    // Interruption (user prend la parole pendant que l'IA parle)
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

  // --- Fetch du contexte (parallèle à l'ouverture WS OpenAI) ----------------
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
        console.error(`❌ [modect:${shortId(callId)}] get-call-context ${res.status}: ${detail}`)
        void logEvent({
          level:   'error',
          source:  'voice-bridge/scheduled',
          call_id: callId,
          message: `get-call-context HTTP ${res.status}`,
          payload: { detail: detail.slice(0, 500) },
        })
        try { twilioWs.close() } catch { /* */ }
        return
      }
      const ctx = await res.json()
      model            = ctx.model            ?? MODEL_DEFAULT
      voice            = ctx.voice            ?? VOICE_DEFAULT
      instructions     = ctx.instructions     ?? ''
      firstMessageHint = buildFirstMessageHint(ctx.persona_name, ctx.beneficiary_name)
      contextFetched   = true
      console.log(`📥 [modect:${shortId(callId)}] contexte fetché (model=${model}, voice=${voice}, persona=${ctx.persona_name})`)
      maybeSetupSession()
    } catch (err) {
      console.error(`❌ [modect:${shortId(callId)}] fetch context:`, err?.message || err)
      void logEvent({
        level:   'error',
        source:  'voice-bridge/scheduled',
        call_id: callId,
        message: `Exception fetch get-call-context: ${err?.message || 'inconnue'}`,
      })
      try { twilioWs.close() } catch { /* */ }
    }
  })()

  function maybeSetupSession() {
    if (setupDone || !openaiReady || !contextFetched) return
    setupDone = true

    const turnDetection  = buildTurnDetection()
    const noiseReduction = buildNoiseReduction()
    console.log(`📤 [modect:${shortId(callId)}] session.update + response.create (VAD ${openaiVadSummary()})`)
    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        type:              'realtime',
        model,
        output_modalities: ['audio'],
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            transcription: { model: 'whisper-1' },  // transcript user pour save-transcript
            // Fin de tour (anti-« blanc ») + réduction de bruit (anti faux barge-in).
            // Omis si kill-switch (OPENAI_VAD_DISABLED) → défauts OpenAI.
            ...(turnDetection  ? { turn_detection:  turnDetection }  : {}),
            ...(noiseReduction ? { noise_reduction: noiseReduction } : {}),
          },
          output: {
            format: { type: 'audio/pcmu' },
            voice,
          },
        },
        instructions,
      },
    }))

    // Bonjour PROACTIF (défaut GREETING_FALLBACK_MS=0 = immédiat). La porte micro
    // reste FERMÉE le temps du bonjour (cf. handleTwilioEvent) → un « allô »
    // réflexe ne coupe pas le bonjour. Filet : rouvrir le micro même si
    // response.done manquait.
    greetingTimer = setTimeout(() => {
      greetingTimer = null
      if (greetingHandled || openaiWs.readyState !== WebSocket.OPEN) return
      greetingHandled = true
      console.log(`📤 [modect:${shortId(callId)}] bonjour proactif`)
      openaiWs.send(JSON.stringify({
        type:     'response.create',
        response: { instructions: firstMessageHint },
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
    console.log(`• [modect:${shortId(callId)}] micro ouvert (${reason}) → barge-in actif`)
  }

  // --- Flush final (transcript + tokens) vers Supabase ----------------------
  async function flushFinal(durationSeconds, status) {
    if (flushed) return
    flushed = true

    // Tout reste d'assistant buffer non commit → commit en best-effort
    for (const [, entry] of assistantBuffer) {
      const text = (entry.text ?? '').trim()
      if (text) {
        transcript.push({
          role:      'assistant',
          text,
          timestamp: entry.started_at,
        })
      }
    }
    assistantBuffer.clear()

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
        console.error(`❌ [modect:${shortId(callId)}] save-transcript ${res.status}: ${detail}`)
        void logEvent({
          level:   'error',
          source:  'voice-bridge/scheduled',
          call_id: callId,
          message: `save-transcript HTTP ${res.status}`,
          payload: { detail: detail.slice(0, 500), transcript_entries: transcript.length },
        })
      } else {
        console.log(`✅ [modect:${shortId(callId)}] transcript persisté (${transcript.length} entrées, ${Math.round(durationSeconds)}s)`)
      }
    } catch (err) {
      console.error(`❌ [modect:${shortId(callId)}] save-transcript fetch:`, err?.message || err)
      void logEvent({
        level:   'error',
        source:  'voice-bridge/scheduled',
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
          latestMediaTimestamp = data.media.timestamp
          // Porte micro fermée tant que le bonjour d'ouverture n'est pas fini →
          // on DROP l'audio (un « allô » réflexe ne coupe pas le bonjour).
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
          console.log(`• [modect:${shortId(callId)}] Stream Twilio stoppé`)
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
      return fluidity.compute(transcript, durationSeconds, 'openai')
    },
    flushFinal,
  }
}

// "Démarre la conversation" — petit hint pour la 1re réponse de l'IA.
// On NE remet PAS le full prompt ici (déjà dans session.instructions).
function buildFirstMessageHint(personaName, beneficiaryName) {
  const persona = personaName ?? 'Marie'
  const name    = beneficiaryName ?? ''
  return `Commence maintenant la conversation, exactement comme demandé dans tes instructions : un bonjour chaleureux à ${name}, en te présentant comme ${persona}, puis une question ouverte sur sa journée.`
}

function shortId(s) {
  return (s ?? '').toString().slice(0, 8)
}
