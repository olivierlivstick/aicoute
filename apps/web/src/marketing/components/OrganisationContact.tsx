// Formulaire de contact / demande partagé par les pages Organisations
// (hub + /etablissements + /municipalites + /assurances). Extrait à l'identique
// de l'ancien ContactEtablissements : MÊME mécanisme (Edge Function `contact-form`,
// mêmes champs firstName/lastName/email/message + honeypot, message B2B composé).
// Les libellés et l'étiquette de demande sont paramétrables ; aucun CTA ne pointe
// vers l'inscription self-service B2C.
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/marketing/components/icons'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClass =
  'w-full px-4 py-3 rounded-md border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60'

type Status = 'idle' | 'sending' | 'sent' | 'error'

// Champ optionnel de « volume » (ex. nombre de résidents pour les établissements).
export type VolumeField = {
  label: string
  sublabel?: string
  placeholder: string
  messageLabel: string // libellé utilisé dans le message composé
}

export type OrganisationContactProps = {
  anchorId: string // id de section (cible des ancres CTA) + préfixe des champs
  eyebrow: string
  title: string
  intro: string
  messageHeading: string // ex. '— Demande ÉTABLISSEMENT (B2B) —'
  orgLabel: string // ex. 'Établissement', 'Collectivité / CCAS', 'Organisation'
  orgPlaceholder: string
  messagePlaceholder: string
  submitLabel?: string
  volume?: VolumeField | null
}

export function OrganisationContact({
  anchorId,
  eyebrow,
  title,
  intro,
  messageHeading,
  orgLabel,
  orgPlaceholder,
  messagePlaceholder,
  submitLabel = 'Demander une présentation',
  volume = null,
}: OrganisationContactProps) {
  const p = anchorId // préfixe d'id unique
  const [nom, setNom] = useState('')
  const [fonction, setFonction] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [volumeValue, setVolumeValue] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot anti-spam : même dispositif que le formulaire de contact de la home.
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const sending = status === 'sending'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nom.trim() || !organisation.trim() || !email.trim() || !message.trim()) {
      setError(
        `Merci de renseigner au minimum votre nom, votre ${orgLabel.toLowerCase()}, votre email et un message.`,
      )
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Votre adresse email semble incorrecte.')
      return
    }

    // On réutilise l'Edge Function `contact-form` (mêmes champs firstName/lastName/
    // email/message + honeypot). Les champs sont assemblés dans le message pour
    // arriver dans l'email sans modifier le backend déjà déployé.
    const parts = nom.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '—'

    const composedMessage =
      `${messageHeading}\n\n` +
      `Nom : ${nom.trim()}\n` +
      `Fonction : ${fonction.trim() || '—'}\n` +
      `${orgLabel} : ${organisation.trim()}\n` +
      (volume ? `${volume.messageLabel} : ${volumeValue.trim() || '—'}\n` : '') +
      `Téléphone : ${telephone.trim() || '—'}\n\n` +
      `Message :\n${message.trim()}`

    setStatus('sending')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('contact-form', {
        body: {
          firstName,
          lastName,
          email: email.trim(),
          message: composedMessage,
          company, // honeypot — doit rester vide
        },
      })
      if (invokeError || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error ?? invokeError?.message)
      }
      setStatus('sent')
      setNom('')
      setFonction('')
      setOrganisation('')
      setVolumeValue('')
      setEmail('')
      setTelephone('')
      setMessage('')
    } catch {
      setStatus('error')
      setError(
        "L'envoi a échoué. Réessayez dans un instant ou écrivez-nous à contact@aicoute.fr.",
      )
    }
  }

  return (
    <section id={anchorId} className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:sticky md:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
              {eyebrow}
            </p>
            <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
              {title}
            </h2>
            <p className="mt-5 text-brun-700 leading-relaxed">{intro}</p>
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
                  <h3 className="text-brun-900 font-medium text-lg">Demande envoyée</h3>
                  <p className="mt-1 text-brun-700 leading-relaxed">
                    Merci&nbsp;! Votre demande est bien partie. Nous revenons vers
                    vous sous 48&nbsp;h ouvrées.
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
                    <label htmlFor={`${p}-nom`} className="block text-sm font-medium text-brun-900 mb-1.5">
                      Nom
                    </label>
                    <input
                      id={`${p}-nom`}
                      type="text"
                      autoComplete="name"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Marie Dupont"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${p}-fonction`} className="block text-sm font-medium text-brun-900 mb-1.5">
                      Fonction
                    </label>
                    <input
                      id={`${p}-fonction`}
                      type="text"
                      autoComplete="organization-title"
                      value={fonction}
                      onChange={(e) => setFonction(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Directrice, responsable, chargé de projet…"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor={`${p}-org`} className="block text-sm font-medium text-brun-900 mb-1.5">
                      {orgLabel}
                    </label>
                    <input
                      id={`${p}-org`}
                      type="text"
                      autoComplete="organization"
                      value={organisation}
                      onChange={(e) => setOrganisation(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder={orgPlaceholder}
                    />
                  </div>
                  {volume ? (
                    <div>
                      <label htmlFor={`${p}-volume`} className="block text-sm font-medium text-brun-900 mb-1.5">
                        {volume.label}{' '}
                        {volume.sublabel && (
                          <span className="text-brun-700/60">{volume.sublabel}</span>
                        )}
                      </label>
                      <input
                        id={`${p}-volume`}
                        type="text"
                        inputMode="numeric"
                        value={volumeValue}
                        onChange={(e) => setVolumeValue(e.target.value)}
                        disabled={sending}
                        className={inputClass}
                        placeholder={volume.placeholder}
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor={`${p}-telephone`} className="block text-sm font-medium text-brun-900 mb-1.5">
                        Téléphone
                      </label>
                      <input
                        id={`${p}-telephone`}
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        disabled={sending}
                        className={inputClass}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor={`${p}-email`} className="block text-sm font-medium text-brun-900 mb-1.5">
                      Email
                    </label>
                    <input
                      id={`${p}-email`}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="marie.dupont@organisation.fr"
                    />
                  </div>
                  {/* Quand le champ « volume » occupe la 1re ligne, le téléphone vient ici. */}
                  {volume && (
                    <div>
                      <label htmlFor={`${p}-telephone`} className="block text-sm font-medium text-brun-900 mb-1.5">
                        Téléphone
                      </label>
                      <input
                        id={`${p}-telephone`}
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        disabled={sending}
                        className={inputClass}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor={`${p}-message`} className="block text-sm font-medium text-brun-900 mb-1.5">
                    Message
                  </label>
                  <textarea
                    id={`${p}-message`}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    className={`${inputClass} resize-none`}
                    placeholder={messagePlaceholder}
                  />
                </div>

                {/* Honeypot — caché aux humains, leurré aux bots. Ne pas supprimer. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor={`${p}-company`}>Société (laisser vide)</label>
                  <input
                    id={`${p}-company`}
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
                  {sending ? 'Envoi…' : submitLabel}
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
