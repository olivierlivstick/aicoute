// SECTION — Nous contacter (formulaire → contact@aicoute.fr via Edge Fn contact-form)
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/marketing/components/icons'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = 'idle' | 'sending' | 'sent' | 'error'

const inputClass =
  'w-full px-4 py-3 rounded-md border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60'

export function Contact() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot anti-spam : champ caché, invisible pour un humain. Un bot qui
  // remplit aveuglément tous les champs le renseigne → la demande est ignorée.
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const sending = status === 'sending'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !message.trim()) {
      setError('Merci de remplir tous les champs.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Votre adresse email semble incorrecte.')
      return
    }

    setStatus('sending')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('contact-form', {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          message: message.trim(),
          company, // honeypot — doit rester vide
        },
      })
      if (invokeError || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error ?? invokeError?.message)
      }
      setStatus('sent')
      setFirstName('')
      setLastName('')
      setEmail('')
      setMessage('')
    } catch {
      setStatus('error')
      setError("L'envoi a échoué. Réessayez dans un instant ou écrivez-nous à contact@aicoute.fr.")
    }
  }

  return (
    <section id="contact" className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:sticky md:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
              Nous contacter
            </p>
            <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
              Une question ? Écrivez-nous.
            </h2>
            <p className="mt-5 text-brun-700 leading-relaxed">
              Dites-nous comment nous pouvons vous aider. Nous vous répondons
              sous 24&nbsp;heures ouvrées.
            </p>
            <p className="mt-4 text-brun-700">
              <a
                href="mailto:contact@aicoute.fr"
                className="text-terracotta-dark link-underline font-medium"
              >
                contact@aicoute.fr
              </a>
            </p>
          </div>

          <div className="md:col-span-2">
            {status === 'sent' ? (
              <div className="bg-white rounded-xl border border-creme-sable p-8 flex items-start gap-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-sauge/15 text-sauge flex items-center justify-center">
                  <Icon.Check size={20} />
                </span>
                <div>
                  <h3 className="text-brun-900 font-medium text-lg">Message envoyé</h3>
                  <p className="mt-1 text-brun-700 leading-relaxed">
                    Merci&nbsp;! Votre message est bien parti. Nous revenons
                    vers vous très vite.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl border border-creme-sable p-6 md:p-8 space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-firstname" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Prénom
                    </label>
                    <input
                      id="contact-firstname"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Marie"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-lastname" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Nom
                    </label>
                    <input
                      id="contact-lastname"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-brun-900 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={sending}
                    className={inputClass}
                    placeholder="marie.dupont@email.fr"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-brun-900 mb-1.5">
                    Votre message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    className={`${inputClass} resize-none`}
                    placeholder="Comment pouvons-nous vous aider ?"
                  />
                </div>

                {/* Honeypot — caché aux humains, leurré aux bots. Ne pas supprimer. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="contact-company">Société (laisser vide)</label>
                  <input
                    id="contact-company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-brique" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-creme font-medium px-6 py-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Envoi…' : 'Envoyer'}
                  {!sending && <Icon.ArrowRight size={18} />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
