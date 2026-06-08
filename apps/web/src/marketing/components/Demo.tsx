// SECTION — Essayez maintenant : deux cartes (web micro / téléphone)
// Permet au visiteur de tester la voix Aicoute directement depuis la home.
import { useState } from 'react'
import { Icon } from '@/marketing/components/icons'
import { DemoWebModal } from '@/marketing/components/DemoWebModal'
import { DemoPhoneModal } from '@/marketing/components/DemoPhoneModal'

type Mode   = null | 'web' | 'phone'
export type Engine = 'openai' | 'gemini'

// Langues proposées pour la démo (alignées avec le back : public-realtime-token
// + voice-bridge prompt.js). La conversation se déroule dans la langue choisie.
const DEMO_LANGUAGES = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]

export function Demo() {
  const [mode, setMode] = useState<Mode>(null)
  const [lang, setLang] = useState<string>('fr')
  // Moteur figé : après tests, on retient Gemini pour la vitrine (le choix
  // OpenAI/Gemini reste possible côté admin /admin/sante pour comparer).
  const engine: Engine = 'gemini'

  return (
    <section id="essai" className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            La voix d'Aicoute
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Essayez la conversation,<br className="hidden md:block" />
            <span className="italic text-terracotta-dark">avant de parler d'Aicoute à vos parents.</span>
          </h2>
          <p className="mt-5 text-lg text-brun-700 leading-relaxed text-pretty">
            Découvrez vous-même comment l'IA parle, écoute et rebondit. Deux
            façons d'essayer, gratuitement, en moins d'une minute.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <LanguageSelect lang={lang} onChange={setLang} />
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {/* Carte 1 — Mode web */}
          <article className="bg-white border border-creme-sable rounded-xl p-8 transition-colors hover:border-terracotta/30 flex flex-col">
            <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
              <Icon.MessageCircle size={26} />
            </div>
            <h3 className="mt-5 font-sans font-medium text-xl text-brun-900">
              Parlez depuis votre navigateur
            </h3>
            <p className="mt-3 text-brun-700 leading-relaxed text-pretty">
              Autorisez votre micro et discutez en direct avec l'assistant
              Aicoute. Idéal pour entendre la voix, le ton, le rythme — et
              comprendre ce que vos parents vivront.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-brun-700">
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Aucune inscription
              </li>
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Démarre en 5 secondes
              </li>
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Conversation de 2 minutes max
              </li>
            </ul>
            <div className="mt-auto pt-7">
              <button
                onClick={() => setMode('web')}
                className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors w-full sm:w-auto"
              >
                Démarrer la conversation
              </button>
            </div>
          </article>

          {/* Carte 2 — Mode téléphone */}
          <article className="bg-white border border-creme-sable rounded-xl p-8 transition-colors hover:border-terracotta/30 flex flex-col">
            <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
              <Icon.Phone size={26} />
            </div>
            <h3 className="mt-5 font-sans font-medium text-xl text-brun-900">
              Recevez un appel sur votre téléphone
            </h3>
            <p className="mt-3 text-brun-700 leading-relaxed text-pretty">
              Entrez votre numéro et Aicoute vous rappelle dans les secondes
              qui suivent. C'est exactement ce que vivra votre proche, dans
              les conditions réelles d'un appel téléphonique.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-brun-700">
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Appel gratuit pour vous
              </li>
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Numéro non conservé
              </li>
              <li className="flex items-center gap-2">
                <Icon.Check size={16} stroke="#7BA05B" /> Vous pouvez raccrocher à tout moment
              </li>
            </ul>
            <div className="mt-auto pt-7">
              <button
                onClick={() => setMode('phone')}
                className="inline-flex items-center justify-center bg-white hover:bg-creme-sable text-terracotta-dark border border-terracotta px-6 py-3.5 rounded-md font-medium transition-colors w-full sm:w-auto"
              >
                Me faire appeler
              </button>
            </div>
          </article>
        </div>

        <p className="mt-10 text-sm text-brun-700/80 text-center">
          La démo utilise un assistant générique. Le compagnon de votre proche
          sera personnalisé selon son profil, ses centres d'intérêt et ses
          précédentes conversations.
        </p>
      </div>

      {mode === 'web'   && <DemoWebModal   engine={engine} lang={lang} onClose={() => setMode(null)} />}
      {mode === 'phone' && <DemoPhoneModal engine={engine} lang={lang} onClose={() => setMode(null)} />}
    </section>
  )
}

// --- Sélecteur de langue de la conversation ---------------------------------
function LanguageSelect({ lang, onChange }: { lang: string; onChange: (l: string) => void }) {
  return (
    <div className="w-full max-w-xs">
      <p className="text-center text-[11px] uppercase tracking-[0.18em] text-brun-700/70 mb-2.5">
        Langue de la conversation
      </p>
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Langue de la conversation"
        className="w-full px-4 py-2.5 bg-white border border-creme-sable rounded-lg text-sm font-medium text-brun-900 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 cursor-pointer"
      >
        {DEMO_LANGUAGES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
