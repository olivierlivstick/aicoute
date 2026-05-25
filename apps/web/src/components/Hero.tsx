// HERO — 2 colonnes, inversé en mobile
// Côté image : placeholder chaleureux (mains + téléphone + tasse) — à remplacer
// par la photo finale dans l'asset pipeline. Aucun visage stock cliché.
import { Icon } from '@/components/icons'
import { Logo } from '@/components/Logo'
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

            <h1 className="font-serif font-normal text-brun-900 text-5xl md:text-6xl leading-[1.05] text-balance">
              Gardez le lien,<br />
              <span className="italic text-terracotta-dark">même à distance.</span>
            </h1>

            <p className="mt-6 text-xl text-brun-700 leading-relaxed max-w-xl text-pretty">
              MODECT appelle régulièrement vos parents, prend de leurs
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

// Placeholder photo — composition douce (motif rayé + tasse + téléphone)
// pour visualiser le cadrage. À remplacer par une vraie photo dans l'asset pipeline.
function HeroPhoto() {
  return (
    <div className="relative">
      <div
        className="photo-placeholder rounded-xl aspect-[4/5] md:aspect-[5/6] w-full"
        data-label="PHOTO — mains de personne âgée, téléphone, tasse fumante, lumière dorée"
      >
        {/* Soleil chaud en arrière-plan */}
        <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-ocre/35 blur-2xl" />
        {/* Lueur dorée bas */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-terracotta/15 to-transparent" />

        {/* Suggestion : tasse + vapeur */}
        <div className="absolute top-[18%] left-[10%] flex flex-col items-center">
          <svg width="44" height="36" viewBox="0 0 44 36" fill="none" stroke="#8B4A2B" strokeWidth="1.2" strokeLinecap="round" opacity="0.55">
            <path d="M14 4c-1 3 1 5 0 8M20 2c-1 3 1 5 0 8M26 4c-1 3 1 5 0 8" />
          </svg>
          <div className="w-16 h-12 rounded-b-[20px] rounded-t-md border border-brun-700/40 bg-creme/60 relative -mt-1">
            <div className="absolute -right-2 top-2 w-3 h-5 rounded-r-full border border-brun-700/40 border-l-0" />
          </div>
        </div>

        {/* Suggestion : téléphone tenu */}
        <div className="absolute bottom-[14%] right-[14%] w-28 h-44 rounded-[18px] bg-brun-900/70 border border-brun-700/50 rotate-[-8deg] shadow-sm">
          <div className="absolute inset-2 rounded-[12px] bg-creme/95 flex flex-col items-center justify-center text-center px-2">
            <Logo variant="mark" size={18} />
            <p className="font-serif text-[11px] mt-2 text-brun-900 leading-tight">
              modect<br />appelle…
            </p>
            <div className="mt-3 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse [animation-delay:240ms]" />
            </div>
          </div>
        </div>
      </div>

      {/* Carte flottante — petit moment de réconfort */}
      <div className="hidden md:flex absolute -left-6 bottom-10 bg-creme border border-creme-sable rounded-xl p-4 pr-5 items-center gap-3 max-w-[260px]">
        <div className="w-10 h-10 rounded-full bg-creme-sable flex items-center justify-center text-terracotta">
          <Icon.Heart size={20} />
        </div>
        <div>
          <p className="text-xs text-brun-700">Dernier appel — mardi</p>
          <p className="font-serif text-base text-brun-900 leading-tight mt-0.5">
            « Mes rosiers ont fleuri ! »
          </p>
        </div>
      </div>
    </div>
  )
}
