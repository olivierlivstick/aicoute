/**
 * Cœur de la couche conversationnelle Realtime (OpenAI API GA).
 *
 * Établit une connexion WebRTC directe navigateur/app ↔ OpenAI, gère le data
 * channel d'events et accumule le transcript. Les primitives WebRTC
 * (RTCPeerConnection, getUserMedia) sont INJECTÉES par la plateforme, pour que
 * ce module soit réutilisable côté web (DOM) comme mobile (react-native-webrtc).
 *
 * Source de vérité : le test fonctionnel `test/public/index.html`.
 * Doc : https://platform.openai.com/docs/guides/realtime (GA)
 */

import type { TranscriptEntry } from './types'

// --- Statut de session (pilote l'UI) ----------------------------------------
export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'speaking'   // l'IA parle
  | 'listening'  // on écoute / c'est au tour de l'utilisateur
  | 'ended'
  | 'error'

export interface RealtimeMessage {
  itemId: string
  role:   'user' | 'assistant'
  text:   string
  done:   boolean
  at:     string  // ISO timestamp (figé à la complétion)
}

// --- Interfaces structurelles minimales des primitives WebRTC ----------------
// (évite de dépendre de lib.dom OU des types react-native-webrtc)
export interface RTCSdpLike { type: string; sdp?: string }

export interface RTCDataChannelLike {
  readyState: string
  send(data: string): void
  close(): void
  onopen: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: string }) => void) | null
  onclose?: ((ev?: unknown) => void) | null
}

export interface RTCPeerConnectionLike {
  createDataChannel(label: string): RTCDataChannelLike
  createOffer(): Promise<RTCSdpLike>
  setLocalDescription(desc: RTCSdpLike): Promise<void>
  setRemoteDescription(desc: RTCSdpLike): Promise<void>
  addTrack(track: unknown, ...streams: unknown[]): unknown
  close(): void
  localDescription: RTCSdpLike | null
  ontrack: ((ev: { streams: unknown[] }) => void) | null
}

export interface MediaStreamLike {
  getTracks(): Array<{ stop(): void }>
  getAudioTracks(): unknown[]
}

export interface RealtimePlatform {
  createPeerConnection: () => RTCPeerConnectionLike
  getUserMedia: () => Promise<MediaStreamLike>
}

export interface RealtimeSessionConfig {
  /** Token éphémère renvoyé par l'Edge Function realtime-token (champ `value`). */
  ephemeralKey: string
  /** Modèle GA — DOIT être celui renvoyé par realtime-token (réutilisé dans ?model=). */
  model: string
  platform: RealtimePlatform
  /** La plateforme attache ce flux à sa sortie audio (élément <audio> / RTCView). */
  onRemoteStream: (stream: unknown) => void
  onStatusChange?: (status: RealtimeStatus) => void
  onMessagesChange?: (messages: RealtimeMessage[]) => void
  onError?: (error: Error) => void
  /** Modèle de transcription des entrées utilisateur (défaut: whisper-1). */
  inputTranscriptionModel?: string
}

const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

export class RealtimeSession {
  private cfg: RealtimeSessionConfig
  private pc: RTCPeerConnectionLike | null = null
  private dc: RTCDataChannelLike | null = null
  private localStream: MediaStreamLike | null = null
  private status: RealtimeStatus = 'idle'

  private messages: RealtimeMessage[] = []
  private messageIndex = new Map<string, RealtimeMessage>()

  constructor(config: RealtimeSessionConfig) {
    this.cfg = config
  }

  /** Transcript ordonné, prêt à persister (format attendu par generate-summary). */
  get transcript(): TranscriptEntry[] {
    return this.messages
      .filter((m) => m.done && m.text.trim().length > 0)
      .map((m) => ({ role: m.role, text: m.text.trim(), timestamp: m.at }))
  }

  async start(): Promise<void> {
    try {
      this.setStatus('connecting')

      // 1. Peer connection + sortie audio de l'IA
      const pc = this.cfg.platform.createPeerConnection()
      this.pc = pc
      pc.ontrack = (e) => {
        if (e.streams?.[0]) this.cfg.onRemoteStream(e.streams[0])
      }

      // 2. Micro local
      this.localStream = await this.cfg.platform.getUserMedia()
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) pc.addTrack(audioTrack, this.localStream)

      // 3. Data channel d'events
      const dc = pc.createDataChannel('oai-events')
      this.dc = dc
      dc.onopen = () => {
        // L'IA démarre la conversation (salutation) → état "speaking"
        this.setStatus('speaking')
        // Activer la transcription des entrées utilisateur + régler la fluidité :
        //  - turn_detection semantic_vad → l'IA répond quand on a VRAIMENT fini de
        //    parler (selon les mots, pas un délai de silence fixe) → moins de « blanc ».
        //  - noise_reduction far_field → filtre le bruit d'ambiance AVANT la VAD,
        //    pour ne pas prendre un bruit pour un coupage de parole.
        // (Pendant WebRTC : ces réglages sont fixés ici, l'équivalent côté téléphone /
        //  appels planifiés est tunable par env OPENAI_VAD_* dans le voice-bridge.)
        this.send({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            audio: {
              input: {
                transcription: { model: this.cfg.inputTranscriptionModel ?? 'whisper-1' },
                turn_detection: { type: 'semantic_vad', eagerness: 'medium' },
                noise_reduction: { type: 'far_field' },
              },
            },
          },
        })
      }
      dc.onmessage = (e) => this.handleServerEvent(e.data)

      // 4. Négociation SDP (offer → OpenAI → answer)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const offerSdp = offer.sdp ?? pc.localDescription?.sdp ?? ''

      const sdpRes = await fetch(`${OPENAI_CALLS_URL}?model=${encodeURIComponent(this.cfg.model)}`, {
        method: 'POST',
        body: offerSdp,
        headers: {
          'Authorization': `Bearer ${this.cfg.ephemeralKey}`,
          'Content-Type':  'application/sdp',
        },
      })

      const answerSdp = await sdpRes.text()
      if (!sdpRes.ok) {
        throw new Error(`OpenAI a refusé la connexion (${sdpRes.status}): ${answerSdp}`)
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (err) {
      this.fail(err)
      throw err
    }
  }

  stop(): void {
    try { this.dc?.close() } catch { /* ignore */ }
    try { this.pc?.close() } catch { /* ignore */ }
    this.localStream?.getTracks().forEach((t) => { try { t.stop() } catch { /* ignore */ } })
    this.dc = null
    this.pc = null
    this.localStream = null
    if (this.status !== 'error') this.setStatus('ended')
  }

  // --- Events serveur (data channel) -----------------------------------------

  private handleServerEvent(raw: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw)
    } catch {
      return
    }

    const type   = event.type as string
    const itemId = event.item_id as string | undefined

    switch (type) {
      // Transcription de l'utilisateur
      case 'conversation.item.input_audio_transcription.delta':
        if (itemId) this.appendDelta(itemId, 'user', (event.delta as string) ?? '')
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (itemId) this.completeMessage(itemId, 'user', event.transcript as string)
        break

      // Transcription de l'IA (GA + fallback Beta)
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        if (itemId) this.appendDelta(itemId, 'assistant', (event.delta as string) ?? '')
        break
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (itemId) this.completeMessage(itemId, 'assistant', event.transcript as string)
        break

      // États de tour de parole (VAD serveur)
      case 'input_audio_buffer.speech_started':
        this.setStatus('listening')
        break
      case 'input_audio_buffer.speech_stopped':
        this.setStatus('speaking')
        break
      case 'response.output_audio.done':
      case 'response.audio.done':
        this.setStatus('listening')
        break

      case 'error': {
        const detail = (event.error as { message?: string })?.message ?? 'erreur Realtime inconnue'
        this.cfg.onError?.(new Error(detail))
        break
      }
    }
  }

  // --- Gestion du transcript --------------------------------------------------

  private upsert(itemId: string, role: 'user' | 'assistant'): RealtimeMessage {
    let m = this.messageIndex.get(itemId)
    if (!m) {
      m = { itemId, role, text: '', done: false, at: new Date().toISOString() }
      this.messages.push(m)
      this.messageIndex.set(itemId, m)
    }
    return m
  }

  private appendDelta(itemId: string, role: 'user' | 'assistant', delta: string): void {
    const m = this.upsert(itemId, role)
    m.text += delta
    this.emitMessages()
  }

  private completeMessage(itemId: string, role: 'user' | 'assistant', finalText?: string): void {
    const m = this.upsert(itemId, role)
    if (finalText != null) m.text = finalText
    m.done = true
    m.at   = new Date().toISOString()
    this.emitMessages()
  }

  // --- Helpers ----------------------------------------------------------------

  private send(payload: object): void {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(payload))
    }
  }

  private setStatus(status: RealtimeStatus): void {
    this.status = status
    this.cfg.onStatusChange?.(status)
  }

  private emitMessages(): void {
    this.cfg.onMessagesChange?.([...this.messages])
  }

  private fail(err: unknown): void {
    this.setStatus('error')
    this.cfg.onError?.(err instanceof Error ? err : new Error(String(err)))
    this.stop()
  }
}

/** Fabrique la plateforme WebRTC pour un navigateur (web). */
export function browserPlatform(): RealtimePlatform {
  return {
    createPeerConnection: () => new RTCPeerConnection() as unknown as RTCPeerConnectionLike,
    getUserMedia: () =>
      navigator.mediaDevices.getUserMedia({ audio: true }) as unknown as Promise<MediaStreamLike>,
  }
}
