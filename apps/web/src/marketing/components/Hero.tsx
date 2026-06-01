// HERO — 2 colonnes, inversé en mobile
// Côté image : photo finale `public/hero.jpg` (portrait 4:5), avec lueur dorée
// en arrière-plan et carte flottante « Dernier appel ».
import { Icon } from '@/marketing/components/icons'
import { SIGNUP_URL } from '@/config/links'

export function Hero() {
  return (
    <section className="bg-creme">
      <div className="max-w-container mx-auto px-6 lg:px-8 pt-12 md:pt-20 pb-20 md:pb-28">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* Colonne texte */}
          <div className="order-2 md:order-1">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-6">
              <span className="w-6 h-px bg-terracotta-dark/40" />
              Une présence régulière, par téléphone
            </span>

            <h1 className="font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.1] text-balance">
              Pour ne jamais passer<br />
              <span className="italic text-terracotta-dark">une journée sans parler.</span>
            </h1>

            <p className="mt-6 text-xl text-brun-700 leading-relaxed max-w-xl text-pretty">
              Aicoute appelle régulièrement vos parents, prend de leurs
              nouvelles, et vous envoie un résumé chaleureux après chaque
              échange. Pour que la distance n'efface jamais la présence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
              >
                Créer un compte pour mes parents
              </a>
              <a
                href="#comment"
                className="inline-flex items-center gap-1.5 text-terracotta-dark font-medium link-underline"
              >
                Voir comment ça marche
                <Icon.ArrowRight size={16} />
              </a>
            </div>

            <p className="mt-6 text-sm text-brun-700/90 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Sans engagement</span>
              <span className="text-brun-700/40">·</span>
              <span>1ᵉʳ appel offert</span>
              <span className="text-brun-700/40">·</span>
              <span>Données protégées RGPD</span>
            </p>
          </div>

          {/* Colonne image */}
          <div className="order-1 md:order-2">
            <HeroPhoto />
          </div>
        </div>
      </div>
    </section>
  )
}

// Photo du Hero — `public/hero.jpg` cadrée en portrait, lueur dorée derrière
// et carte flottante « Dernier appel » par-dessus.
function HeroPhoto() {
  return (
    <div className="relative">
      {/* Soleil chaud en arrière-plan */}
      <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-ocre/35 blur-2xl" />

      <div className="relative rounded-xl overflow-hidden aspect-[4/5] md:aspect-[5/6] w-full shadow-sm">
        <img
          src="/hero.jpg"
          alt="Une personne âgée au téléphone, dans une lumière chaleureuse"
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Lueur dorée bas pour fondre la carte flottante */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-terracotta/15 to-transparent" />
      </div>

      {/* Carte flottante — petit moment de réconfort */}
      <div className="hidden md:flex absolute -left-6 bottom-10 bg-creme border border-creme-sable rounded-xl p-4 pr-5 items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-creme-sable flex items-center justify-center text-terracotta">
          <Icon.Heart size={20} />
        </div>
        <div>
          <p className="text-xs text-brun-700">Dernier appel — mardi</p>
          <p className="font-serif text-base text-brun-900 leading-tight mt-0.5 whitespace-nowrap">
            « Mes rosiers ont fleuri ! »
          </p>
        </div>
      </div>
    </div>
  )
}
