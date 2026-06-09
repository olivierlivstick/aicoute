import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SIGNUP_URL } from '@/config/links'

/**
 * Page publique /achat/merci — affichée après un paiement Stripe réussi (achat
 * invité). Le webhook génère le CODE de façon asynchrone : on poll
 * get-purchase-code jusqu'à l'obtenir, puis on l'affiche en grand. Le code part
 * aussi par email (filet de sécurité si le poll expire).
 */

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15  // ~30 s

type State =
  | { kind: 'polling' }
  | { kind: 'ready'; code: string; packName: string; minutes: number }
  | { kind: 'timeout' }
  | { kind: 'invalid' }

export function PurchaseSuccessPage() {
  const [state, setState] = useState<State>({ kind: 'polling' })
  const [copied, setCopied] = useState(false)
  const attempts = useRef(0)

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId || !sessionId.startsWith('cs_')) {
      setState({ kind: 'invalid' })
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      attempts.current += 1
      try {
        const { data } = await supabase.functions.invoke('get-purchase-code', {
          body: { session_id: sessionId },
        })
        const res = data as { status?: string; code?: string; pack_name?: string; minutes?: number } | null
        if (cancelled) return
        if (res?.status === 'ready' && res.code) {
          setState({ kind: 'ready', code: res.code, packName: res.pack_name ?? '', minutes: res.minutes ?? 0 })
          return
        }
      } catch {
        // on réessaie quand même
      }
      if (cancelled) return
      if (attempts.current >= MAX_ATTEMPTS) {
        setState({ kind: 'timeout' })
        return
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponible */ }
  }

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-creme-sable shadow-sm p-8 md:p-10 text-center">
        <a href="/" className="inline-block font-serif text-2xl text-terracotta mb-6">aicoute</a>

        {state.kind === 'polling' && (
          <>
            <div className="mx-auto w-10 h-10 border-4 border-terracotta border-t-transparent rounded-full animate-spin mb-5" />
            <h1 className="font-serif text-2xl text-brun-900 mb-2">Paiement confirmé 🎉</h1>
            <p className="text-brun-700">Nous préparons votre code d'activation…</p>
          </>
        )}

        {state.kind === 'ready' && (
          <>
            <h1 className="font-serif text-2xl md:text-3xl text-brun-900 mb-2">Merci pour votre achat&nbsp;!</h1>
            <p className="text-brun-700 mb-6">
              {state.packName}{state.minutes ? ` — ${state.minutes} minutes` : ''}. Voici votre code d'activation&nbsp;:
            </p>

            <div className="bg-creme-sable border-2 border-dashed border-terracotta rounded-xl py-5 px-4 mb-3">
              <span className="font-serif text-2xl md:text-3xl font-semibold tracking-widest text-terracotta-dark break-all">
                {state.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copy(state.code)}
              className="text-sm text-terracotta-dark underline underline-offset-2 mb-7"
            >
              {copied ? '✓ Copié' : 'Copier le code'}
            </button>

            <div className="bg-creme rounded-xl p-4 text-left text-sm text-brun-700 leading-relaxed mb-7">
              <p className="font-semibold text-brun-900 mb-1">Pour créditer vos minutes :</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Créez votre compte (ou connectez-vous).</li>
                <li>Allez dans <strong>Mon compte → Mes achats</strong>.</li>
                <li>Saisissez ce code : vos minutes sont créditées aussitôt.</li>
              </ol>
              <p className="mt-2 text-brun-700/80">Ce code vous a aussi été envoyé par email.</p>
            </div>

            <a
              href={SIGNUP_URL}
              className="inline-flex items-center justify-center w-full px-6 py-3 rounded-md font-medium bg-terracotta hover:bg-terracotta-dark text-creme transition-colors"
            >
              Créer mon compte / me connecter
            </a>
          </>
        )}

        {state.kind === 'timeout' && (
          <>
            <h1 className="font-serif text-2xl text-brun-900 mb-2">Paiement confirmé 🎉</h1>
            <p className="text-brun-700 mb-6">
              Votre code d'activation vous a été envoyé par <strong>email</strong>. Pensez à vérifier
              vos courriers indésirables s'il n'apparaît pas tout de suite.
            </p>
            <a
              href={SIGNUP_URL}
              className="inline-flex items-center justify-center w-full px-6 py-3 rounded-md font-medium bg-terracotta hover:bg-terracotta-dark text-creme transition-colors"
            >
              Créer mon compte / me connecter
            </a>
          </>
        )}

        {state.kind === 'invalid' && (
          <>
            <h1 className="font-serif text-2xl text-brun-900 mb-2">Lien invalide</h1>
            <p className="text-brun-700 mb-6">
              Cette page s'ouvre après un paiement. Si vous venez d'acheter un pack, votre code vous
              a été envoyé par email.
            </p>
            <a href="/#tarifs" className="text-terracotta-dark underline underline-offset-2">
              Retour aux tarifs
            </a>
          </>
        )}
      </div>
    </div>
  )
}
