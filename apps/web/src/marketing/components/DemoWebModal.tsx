/**
 * Modal de démo vocale WebRTC (vitrine publique).
 *
 * Flux :
 *   1. Récupère un ephemeral token via `public-realtime-token` (Edge Fn publique)
 *   2. Ouvre une RealtimeSession WebRTC vers OpenAI Realtime GA
 *   3. Affiche un orb animé + le transcript live
 *   4. Coupe automatiquement après 3 min (limite démo)
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  RealtimeSession,
  browserPlatform,
  type RealtimeMessage,
  type RealtimeStatus,
} from '@modect/shared'

const MAX_DURATION_SECONDS = 120 // 2 minutes (contrôle du coût de démo)

interface Props {
  onClose: () => void
}

export function DemoWebModal({ onClose }: Props) {
  const [status,   setStatus]   = useState<RealtimeStatus>('idle')
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [error,    setError]    = useState<string | null>(null)
  const [started,  setStarted]  = useState(false)
  const [elapsed,  setElapsed]  = useState(0)

  const sessionRef     = useRef<RealtimeSession | null>(null)
  const audioRef       = useRef<HTMLAudioElement | null>(null)
  const transcriptRef  = useRef<HTMLDivElement | null>(null)

  // Chrono + coupure automatique à 3 min
  useEffect(() => {
    if (!started) return
    const t = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1
        if (next >= MAX_DURATION_SECONDS) stop()
        return next
      })
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  // Auto-scroll du transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Cleanup au démontage
  useEffect(() => {
    return () => { sessionRef.current?.stop() }
  }, [])

  // Coupe le bouton "Échap" pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    setError(null)
    setStatus('connecting')
    setStarted(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('public-realtime-token')
      if (fnErr || !data?.value) {
        throw new Error(fnErr?.message ?? data?.error ?? 'Token Realtime indisponible')
      }

      const session = new RealtimeSession({
        ephemeralKey: data.value,
        model:        data.model,
        platform:     browserPlatform(),
        onRemoteStream: (stream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream as MediaStream
            void audioRef.current.play().catch(() => { /* autoplay géré par interaction utilisateur */ })
          }
        },
        onStatusChange:   (s)  => setStatus(s),
        onMessagesChange: (m)  => setMessages(m),
        onError:          (e)  => setError(e.message),
      })

      sessionRef.current = session
      await session.start()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion')
      setStatus('error')
      setStarted(false)
    }
  }

  const stop = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }

  const handleClose = () => {
    stop()
    onClose()
  }

  const ended      = status === 'ended' || status === 'error'
  const live       = started && !ended
  const isListening = status === 'listening'
  const isSpeaking  = status === 'speaking'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brun-900/60 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-web-title"
    >
      <div
        className="bg-creme rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-creme-sable"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sortie audio de l'IA */}
        <audio ref={audioRef} autoPlay className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-creme-sable">
          <div>
            <h2 id="demo-web-title" className="font-serif text-xl text-brun-900">
              Démo — conversation vocale
            </h2>
            <p className="text-xs text-brun-700/70 mt-0.5">
              {live
                ? `${formatTime(elapsed)} / ${formatTime(MAX_DURATION_SECONDS)}`
                : 'L\'assistant MODECT vous parle directement.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-lg hover:bg-creme-sable flex items-center justify-center text-brun-900 transition-colors"
            aria-label="Fermer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="6" y1="6"  x2="18" y2="18" />
              <line x1="18" y1="6" x2="6"  y2="18" />
            </svg>
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 flex flex-col items-center justify-start px-6 py-8 gap-6 overflow-hidden">
          {/* Orb */}
          <Orb status={status} />

          {/* État textuel */}
          <p className="text-sm text-brun-700 min-h-[20px]">
            {!started && !error && 'Cliquez sur démarrer et autorisez votre micro.'}
            {status === 'connecting' && 'Connexion en cours…'}
            {isSpeaking  && '🗣 L\'assistant parle…'}
            {isListening && '👂 À vous, je vous écoute…'}
            {status === 'ended' && 'Conversation terminée.'}
            {error && <span className="text-brique">{error}</span>}
          </p>

          {/* Transcript */}
          {messages.length > 0 && (
            <div
              ref={transcriptRef}
              className="w-full flex-1 overflow-y-auto bg-white border border-creme-sable rounded-xl p-4 max-h-[200px] space-y-3"
            >
              {messages.map((m) => (
                <div key={m.itemId} className="text-sm leading-relaxed">
                  <span
                    className={
                      m.role === 'user'
                        ? 'text-xs uppercase tracking-widest text-ocre font-medium'
                        : 'text-xs uppercase tracking-widest text-terracotta-dark font-medium'
                    }
                  >
                    {m.role === 'user' ? 'Vous' : 'MODECT'}
                  </span>
                  <p className={`mt-1 ${m.done ? 'text-brun-900' : 'text-brun-700 italic'}`}>
                    {m.text || (m.done ? '…' : '…')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Boutons */}
          <div className="flex items-center gap-3 pt-2">
            {!started && !ended && (
              <button
                onClick={start}
                className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3 rounded-md font-medium transition-colors"
              >
                Démarrer la conversation
              </button>
            )}
            {live && (
              <button
                onClick={() => { stop(); setStatus('ended') }}
                className="inline-flex items-center justify-center bg-white border border-brique text-brique hover:bg-brique hover:text-creme px-6 py-3 rounded-md font-medium transition-colors"
              >
                Raccrocher
              </button>
            )}
            {ended && (
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3 rounded-md font-medium transition-colors"
              >
                Fermer
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-creme-sable bg-creme-sable/40">
          <p className="text-xs text-brun-700/70 text-center">
            Démo limitée à 2 minutes · Audio non enregistré · Aucune donnée personnelle collectée
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Orb animé ---------------------------------------------------------------

function Orb({ status }: { status: RealtimeStatus }) {
  const isSpeaking   = status === 'speaking'
  const isListening  = status === 'listening'
  const isConnecting = status === 'connecting'
  const isIdle       = status === 'idle'

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {(isSpeaking || isListening) && (
        <>
          <span
            className={`absolute w-40 h-40 rounded-full ${
              isListening ? 'bg-ocre/20' : 'bg-terracotta/20'
            } animate-ping`}
          />
          <span
            className={`absolute w-48 h-48 rounded-full ${
              isListening ? 'bg-ocre/10' : 'bg-terracotta/10'
            } animate-pulse`}
          />
        </>
      )}
      <div
        className={`relative w-28 h-28 rounded-full shadow-lg transition-[background] duration-500 ${
          isListening
            ? 'bg-gradient-to-br from-accent-300 to-accent-600'
            : 'bg-gradient-to-br from-primary-300 to-primary-600'
        } ${isIdle ? 'opacity-60' : ''}`}
        style={{
          animation: isIdle ? 'breathe 4s ease-in-out infinite' : undefined,
        }}
      />
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
      `}</style>
      {isConnecting && (
        <span className="absolute inset-0 flex items-center justify-center text-creme text-xs font-medium">
          ●●●
        </span>
      )}
    </div>
  )
}

function formatTime(s: number): string {
  const m   = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
