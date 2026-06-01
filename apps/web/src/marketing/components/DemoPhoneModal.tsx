/**
 * Modal de démo téléphonique (vitrine publique).
 *
 * Flux :
 *   1. L'utilisateur saisit son numéro (format E.164 +33...).
 *   2. POST `${VITE_VOICE_BRIDGE_URL}/call` { phoneNumber } → Twilio appelle.
 *   3. Le téléphone de l'utilisateur sonne ; au décroché, Twilio ouvre le
 *      Media Stream vers le service voice-bridge qui fait le pont vers OpenAI.
 *
 * Note : la modal ne suit pas le déroulé de l'appel (pas de WebSocket vers
 * voice-bridge depuis le front). On affiche juste « votre téléphone sonne »
 * avec une indication de durée.
 */

import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
  engine:  'openai' | 'gemini'
}

const VOICE_BRIDGE_URL = import.meta.env.VITE_VOICE_BRIDGE_URL as string | undefined

// Phrase d'ouverture par défaut. L'utilisateur peut la remplacer pour tester
// d'autres scénarios (cousin qui appelle, mère qui appelle son fils, etc.).
const DEFAULT_OPENER =
  "Bonjour, c'est Olivier, je vous appelle pour prendre de vos nouvelles, comment allez-vous ?"

const OPENER_MAX_LENGTH = 500

type State =
  | { kind: 'idle' }
  | { kind: 'calling' }
  | { kind: 'ringing'; callSid: string }
  | { kind: 'error'; message: string }

export function DemoPhoneModal({ onClose, engine }: Props) {
  const [phone,  setPhone]  = useState('')
  const [opener, setOpener] = useState(DEFAULT_OPENER)
  const [accept, setAccept] = useState(false)
  const [state,  setState]  = useState<State>({ kind: 'idle' })

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cleaned = sanitizePhone(phone)
  const isValid = /^\+\d{8,15}$/.test(cleaned)

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !accept || state.kind === 'calling') return

    if (!VOICE_BRIDGE_URL) {
      setState({ kind: 'error', message: 'Le service téléphonique n\'est pas encore configuré (VITE_VOICE_BRIDGE_URL manquant).' })
      return
    }

    setState({ kind: 'calling' })
    try {
      const openerTrimmed = opener.trim().slice(0, OPENER_MAX_LENGTH)
      const res = await fetch(`${VOICE_BRIDGE_URL.replace(/\/$/, '')}/call`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phoneNumber: cleaned,
          opener:      openerTrimmed || undefined,
          engine,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur ${res.status}`)
      }

      setState({ kind: 'ringing', callSid: data.callSid ?? '' })
    } catch (err) {
      setState({
        kind:    'error',
        message: err instanceof Error ? err.message : 'Impossible de lancer l\'appel',
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brun-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-phone-title"
    >
      <div
        className="bg-creme rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-creme-sable"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-creme-sable">
          <h2 id="demo-phone-title" className="font-serif text-xl text-brun-900">
            Démo — appel téléphonique
          </h2>
          <button
            onClick={onClose}
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
        <div className="px-6 py-6">
          {state.kind === 'ringing' ? (
            <Ringing phone={cleaned} onClose={onClose} />
          ) : (
            <form onSubmit={handleCall} className="space-y-5">
              <p className="text-brun-700 leading-relaxed text-pretty">
                Entrez votre numéro de téléphone. Aicoute vous rappelle dans
                les secondes qui suivent. La conversation est gratuite et dure
                quelques minutes.
              </p>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-brun-900 mb-1.5">
                  Votre numéro
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+33 6 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={state.kind === 'calling'}
                  className="w-full px-4 py-3 rounded-md border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60"
                />
                <p className="mt-1.5 text-xs text-brun-700/70">
                  Format international, commençant par +. Exemple France : +33 6 12 34 56 78
                </p>
              </div>

              <div>
                <label htmlFor="opener" className="block text-sm font-medium text-brun-900 mb-1.5">
                  Phrase d'ouverture
                </label>
                <textarea
                  id="opener"
                  rows={3}
                  value={opener}
                  onChange={(e) => setOpener(e.target.value.slice(0, OPENER_MAX_LENGTH))}
                  disabled={state.kind === 'calling'}
                  className="w-full px-4 py-3 rounded-md border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60 resize-none"
                />
                <p className="mt-1.5 text-xs text-brun-700/70 flex justify-between gap-2">
                  <span>L'IA dira exactement cette phrase au décroché, puis continuera naturellement la conversation.</span>
                  <span className="font-mono tabular-nums whitespace-nowrap">{opener.length}/{OPENER_MAX_LENGTH}</span>
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-sm text-brun-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  disabled={state.kind === 'calling'}
                  className="mt-0.5 accent-terracotta"
                />
                <span>
                  J'accepte d'être rappelé par Aicoute pour cette démonstration.
                  Mon numéro est utilisé uniquement pour passer cet appel et
                  n'est pas conservé.
                </span>
              </label>

              {state.kind === 'error' && (
                <p className="text-sm text-brique bg-brique/10 border border-brique/20 rounded-md px-3 py-2">
                  {state.message}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!isValid || !accept || state.kind === 'calling'}
                  className="flex-1 inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark disabled:bg-terracotta/40 disabled:cursor-not-allowed text-creme px-6 py-3 rounded-md font-medium transition-colors"
                >
                  {state.kind === 'calling' ? 'Appel en cours…' : 'M\'appeler maintenant'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-md font-medium text-brun-700 hover:bg-creme-sable transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-creme-sable bg-creme-sable/40">
          <p className="text-xs text-brun-700/70 text-center">
            Appel gratuit pour vous · Numéro non conservé · Limité à quelques minutes
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Vue « le téléphone sonne » ---------------------------------------------

function Ringing({ phone, onClose }: { phone: string; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      {/* Téléphone qui sonne (animation simple) */}
      <div className="relative w-20 h-20 rounded-full bg-terracotta/15 flex items-center justify-center">
        <span className="absolute w-20 h-20 rounded-full bg-terracotta/20 animate-ping" />
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C75D3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>
      <div>
        <p className="font-serif text-xl text-brun-900">Votre téléphone sonne</p>
        <p className="mt-2 text-brun-700 text-sm">
          Nous appelons <span className="font-medium text-brun-900">{phone}</span> à l'instant.
          Décrochez pour discuter avec Aicoute.
        </p>
      </div>
      <p className="text-xs text-brun-700/70 font-mono">
        Appel lancé il y a {elapsed}s
      </p>
      <button
        onClick={onClose}
        className="mt-2 px-5 py-2.5 rounded-md font-medium text-brun-700 hover:bg-creme-sable transition-colors"
      >
        Fermer cette fenêtre
      </button>
    </div>
  )
}

function sanitizePhone(input: string): string {
  // Garde le + initial s'il existe, supprime tout le reste sauf les chiffres.
  const trimmed = input.trim()
  const plus    = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/\D/g, '')
}
