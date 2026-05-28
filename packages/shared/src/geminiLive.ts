/**
 * Cœur de la couche conversationnelle Gemini Live, mode WebSocket.
 *
 * Différence majeure avec RealtimeSession (OpenAI WebRTC) :
 *  - Pas d'ephemeral token : la connexion se fait vers le voice-bridge MODECT
 *    (proxy serveur) qui détient la clé Google Gemini.
 *  - L'audio est échangé en PCM16 LE base64 dans des messages JSON (pas un
 *    flux WebRTC). Capture micro via AudioWorklet, playback via AudioBuffer
 *    enchaînés dans un AudioContext.
 *  - Le statut (RealtimeStatus) et les messages (RealtimeMessage) sont
 *    identiques à ceux d'OpenAI : DemoWebModal peut binder les deux moteurs
 *    sur le même état UI sans branchement.
 *
 * Doc Gemini Live : https://ai.google.dev/gemini-api/docs/live-api
 */

import type { TranscriptEntry } from './types'
import type { RealtimeMessage, RealtimeStatus } from './realtime'

export interface GeminiLiveConfig {
  /** WebSocket URL du voice-bridge, ex: wss://voice.modect.com/ws/gemini-web */
  bridgeUrl: string
  /** Phrase d'ouverture custom (mode caméléon), ou null pour le mode MODECT */
  opener?: string | null
  onStatusChange?: (status: RealtimeStatus) => void
  onMessagesChange?: (messages: RealtimeMessage[]) => void
  onError?: (err: Error) => void
  /** Path de l'AudioWorklet PCM16 16k (servi par /public). Défaut OK pour Vite. */
  workletUrl?: string
}

interface ServerMsg {
  type:    string
  data?:   string
  role?:   'user' | 'assistant'
  text?:   string
  done?:   boolean
  itemId?: string
  message?: string
}

const DEFAULT_WORKLET_URL = '/gemini-audio-worklet.js'

export class GeminiLiveSession {
  private cfg: GeminiLiveConfig
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private mediaStream: MediaStream | null = null
  // Queue de sources audio en cours de lecture, pour pouvoir tout couper d'un
  // coup en cas d'interruption (barge-in).
  private playbackSources: AudioBufferSourceNode[] = []
  // Timestamp (en audioContext.currentTime) auquel planifier le prochain buffer.
  // Permet d'enchaîner les chunks audio sans gap audible.
  private nextStartTime = 0
  private status: RealtimeStatus = 'idle'

  private messages: RealtimeMessage[] = []
  private messageIndex = new Map<string, RealtimeMessage>()

  constructor(cfg: GeminiLiveConfig) {
    this.cfg = cfg
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

      // 1. AudioContext (capture + playback dans le même contexte pour partager
      //    l'horloge audio). Sample rate natif (typiquement 48k) — Web Audio
      //    se charge du resampling implicite pour les AudioBuffer 24k qu'on
      //    crée au moment de jouer la voix de Gemini.
      this.audioContext = new AudioContext()
      // Sur Safari, AudioContext peut être suspended au démarrage tant qu'il
      // n'y a pas eu d'interaction utilisateur. start() est appelé sur clic
      // donc OK, mais on resume() explicitement par sécurité.
      await this.audioContext.resume()

      // 2. Capture micro + AudioWorklet de downsampling vers PCM16 16k
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const workletUrl = this.cfg.workletUrl ?? DEFAULT_WORKLET_URL
      await this.audioContext.audioWorklet.addModule(workletUrl)
      const micSource = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-downsampler')
      this.workletNode.port.onmessage = (e) => this.onMicChunk(e.data as ArrayBuffer)
      // Pas de connect(destination) sur le worklet : il ne sert qu'à capturer
      // (sinon on entendrait sa propre voix retardée en haut-parleur).
      micSource.connect(this.workletNode)

      // 3. WebSocket vers le voice-bridge
      this.ws = new WebSocket(this.cfg.bridgeUrl)
      this.ws.onopen = () => {
        this.send({ type: 'start', opener: this.cfg.opener ?? null })
      }
      this.ws.onmessage = (e) => this.onServerMessage(typeof e.data === 'string' ? e.data : '')
      this.ws.onerror = () => this.fail(new Error('Connexion au serveur Gemini impossible'))
      this.ws.onclose = () => {
        if (this.status !== 'error' && this.status !== 'ended') this.setStatus('ended')
      }
    } catch (err) {
      this.fail(err)
      throw err
    }
  }

  stop(): void {
    // Demande de fermeture propre côté serveur (Gemini envoie son dernier
    // usageMetadata avant de fermer)
    try { this.send({ type: 'stop' }) } catch { /* */ }
    try { this.ws?.close() } catch { /* */ }
    try { this.workletNode?.disconnect() } catch { /* */ }
    this.mediaStream?.getTracks().forEach((t) => { try { t.stop() } catch { /* */ } })
    this.stopAllPlayback()
    try { void this.audioContext?.close() } catch { /* */ }
    this.ws = null
    this.audioContext = null
    this.workletNode = null
    this.mediaStream = null
    if (this.status !== 'error') this.setStatus('ended')
  }

  // --- Mic → bridge --------------------------------------------------------

  private onMicChunk(buffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const b64 = arrayBufferToBase64(buffer)
    this.send({ type: 'audio', data: b64 })
  }

  // --- Bridge → client -----------------------------------------------------

  private onServerMessage(raw: string): void {
    if (!raw) return
    let msg: ServerMsg
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'ready':
        // Gemini est prêt → on bascule en 'speaking' (l'IA va commencer)
        this.setStatus('speaking')
        break
      case 'audio':
        if (msg.data) this.playAudio(msg.data)
        if (this.status !== 'speaking') this.setStatus('speaking')
        break
      case 'interrupted':
        this.stopAllPlayback()
        this.setStatus('listening')
        break
      case 'turn_complete':
        this.setStatus('listening')
        break
      case 'transcript':
        if (msg.itemId && msg.role) {
          this.handleTranscript(msg.itemId, msg.role, msg.text ?? '', msg.done === true)
        }
        break
      case 'ended':
        this.setStatus('ended')
        break
      case 'error':
        this.fail(new Error(msg.message ?? 'Erreur Gemini'))
        break
    }
  }

  private handleTranscript(itemId: string, role: 'user' | 'assistant', text: string, done: boolean): void {
    let m = this.messageIndex.get(itemId)
    if (!m) {
      m = { itemId, role, text: '', done: false, at: new Date().toISOString() }
      this.messages.push(m)
      this.messageIndex.set(itemId, m)
    }
    if (done) {
      // Si le serveur envoie le texte final, on le remplace ; sinon le delta
      // accumulé reste tel quel et on fige juste le `done`.
      if (text) m.text = text
      m.done = true
      m.at = new Date().toISOString()
    } else {
      m.text += text
    }
    this.cfg.onMessagesChange?.([...this.messages])
  }

  // --- Audio playback ------------------------------------------------------

  private playAudio(b64: string): void {
    if (!this.audioContext) return

    const binary = atob(b64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    // PCM16 LE 24kHz → Int16Array. Tronque à un multiple de 2 si jamais le
    // base64 contient un byte impair (paranoïa, ne devrait pas arriver).
    const evenLen = len & ~1
    const int16 = new Int16Array(bytes.buffer, 0, evenLen >> 1)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

    // AudioBuffer 24k mono → Web Audio API resample auto vers le sampleRate
    // natif du AudioContext (typiquement 48k).
    const buffer = this.audioContext.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32, 0)

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioContext.destination)

    // Planifie après le buffer précédent pour zéro gap audible. Si on a pris
    // du retard (chunks arrivés en rafale), nextStartTime peut être dans le
    // passé → max() avec currentTime resync.
    const now = this.audioContext.currentTime
    const startAt = Math.max(this.nextStartTime, now)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration

    this.playbackSources.push(source)
    source.onended = () => {
      const idx = this.playbackSources.indexOf(source)
      if (idx >= 0) this.playbackSources.splice(idx, 1)
    }
  }

  private stopAllPlayback(): void {
    for (const src of this.playbackSources) {
      try { src.stop() } catch { /* */ }
    }
    this.playbackSources = []
    this.nextStartTime = this.audioContext?.currentTime ?? 0
  }

  // --- Helpers -------------------------------------------------------------

  private send(payload: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private setStatus(status: RealtimeStatus): void {
    this.status = status
    this.cfg.onStatusChange?.(status)
  }

  private fail(err: unknown): void {
    this.setStatus('error')
    this.cfg.onError?.(err instanceof Error ? err : new Error(String(err)))
    this.stop()
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
