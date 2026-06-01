/**
 * Page de simulation d'appel — conversation vocale WebRTC directe avec OpenAI
 * Realtime (API GA). Plus de LiveKit : le navigateur se connecte en direct.
 *
 * Accès : /call?call_id=XXX&persona=XXX
 * Flux :
 *   1. realtime-token (Edge Fn) → ephemeral token + modèle GA
 *   2. RealtimeSession (packages/shared) → handshake WebRTC + transcript live
 *   3. À la fin → save-transcript (Edge Fn) → generate-summary
 */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { RealtimeSession, browserPlatform, type RealtimeStatus } from '@modect/shared'

export function SimulateCallPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const callId       = params.get('call_id') ?? ''
  const personaParam = params.get('persona')  ?? ''

  const [status,   setStatus]   = useState<RealtimeStatus>('connecting')
  const [persona,  setPersona]  = useState(personaParam || 'votre compagnon')
  const [error,    setError]    = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const sessionRef   = useRef<RealtimeSession | null>(null)
  const audioRef     = useRef<HTMLAudioElement | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const endedRef     = useRef(false)

  // Chrono
  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Connexion Realtime
  useEffect(() => {
    if (!callId) {
      setError('Paramètre call_id manquant')
      return
    }

    let cancelled = false
    let localSession: RealtimeSession | null = null

    ;(async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('realtime-token', {
          body: { call_id: callId },
        })
        if (fnErr || !data?.value) {
          throw new Error(fnErr?.message ?? data?.error ?? 'Token Realtime indisponible')
        }
        if (cancelled) return
        if (data.persona_name) setPersona(data.persona_name)

        const session = new RealtimeSession({
          ephemeralKey: data.value,
          model:        data.model,
          platform:     browserPlatform(),
          onRemoteStream: (stream) => {
            if (audioRef.current) {
              audioRef.current.srcObject = stream as MediaStream
              void audioRef.current.play().catch(() => { /* autoplay géré par interaction */ })
            }
          },
          onStatusChange: (s) => { if (!cancelled) setStatus(s) },
          onError:        (e) => { if (!cancelled) setError(e.message) },
        })

        localSession     = session
        sessionRef.current = session
        startedAtRef.current = Date.now()
        await session.start()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de connexion')
      }
    })()

    return () => {
      cancelled = true
      localSession?.stop()
    }
  }, [callId])

  const endCall = async () => {
    if (endedRef.current) { navigate(-1); return }
    endedRef.current = true

    const session    = sessionRef.current
    const transcript = session?.transcript ?? []
    session?.stop()

    const durationSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000)

    try {
      await supabase.functions.invoke('save-transcript', {
        body: {
          call_id:          callId,
          transcript,
          duration_seconds: durationSeconds,
          status:           'completed',
        },
      })
    } catch { /* la persistance échouée ne doit pas bloquer la sortie */ }

    navigate(-1)
  }

  const formatDuration = (s: number) => {
    const m   = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const isSpeaking   = status === 'speaking'
  const isConnecting = status === 'connecting'

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white px-4 text-center">
        <p className="text-lg">Connexion impossible</p>
        <p className="text-slate-400 text-sm max-w-md">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-6 h-11 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          Retour
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-slate-900 text-white px-4">
      {/* Sortie audio de l'IA */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Avatar animé */}
      <div className="relative flex items-center justify-center">
        {isSpeaking && (
          <>
            <div className="absolute w-40 h-40 rounded-full bg-blue-500/20 animate-ping" />
            <div className="absolute w-52 h-52 rounded-full bg-blue-500/10 animate-pulse" />
          </>
        )}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-2xl">
          <span className="text-5xl">🎙️</span>
        </div>
      </div>

      {/* Nom + statut */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{persona}</h1>
        <p className="text-slate-400 mt-1">
          {isConnecting
            ? 'Connexion…'
            : isSpeaking
              ? '🗣 En train de parler…'
              : '👂 En train d\'écouter…'}
        </p>
        <p className="text-slate-500 text-sm mt-2 font-mono">{formatDuration(duration)}</p>
      </div>

      {/* Indicateur micro */}
      <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2 text-sm text-slate-300">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Microphone actif
      </div>

      {/* Bouton raccrocher */}
      <button
        onClick={endCall}
        className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center shadow-lg transition-colors"
        title="Raccrocher"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
        </svg>
      </button>

      <p className="text-slate-600 text-xs">Simulation Aicoute — mode test</p>
    </div>
  )
}
