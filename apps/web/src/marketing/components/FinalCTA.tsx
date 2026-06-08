// SECTION 10 — CTA final, fond terracotta plein
import { Icon } from '@/marketing/components/icons'
import { SIGNUP_URL } from '@/config/links'

export function FinalCTA() {
  return (
    <section className="bg-terracotta py-20 md:py-28 text-center relative overflow-hidden">
      {/* Petit motif organique en arrière-plan : arcs entrelacés très discrets */}
      <svg
        viewBox="0 0 600 200"
        className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M -40 100 Q 100 -40 240 100 T 520 100" fill="none" stroke="#FBF5EE" strokeWidth="2" strokeLinecap="round" />
        <path d="M 80 120 Q 220 -20 360 120 T 640 120" fill="none" stroke="#FBF5EE" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="relative max-w-container mx-auto px-6 lg:px-8">
        <h2 className="font-serif font-normal text-creme text-4xl md:text-5xl leading-[1.1] text-balance max-w-3xl mx-auto">
          Et si vous offriez à votre maman une voix qui appelle — et qui répond ?
        </h2>
        <p className="mt-5 text-xl text-creme/85 max-w-2xl mx-auto text-pretty">
          Créez son profil en moins de 5 minutes. Le premier appel est offert.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center bg-creme hover:bg-creme-sable text-terracotta-dark px-8 py-4 rounded-md font-medium text-lg transition-colors"
          >
            Créer un compte gratuitement
          </a>
          <a
            href="#tarifs"
            className="inline-flex items-center gap-1.5 text-creme/90 hover:text-creme font-medium link-underline"
          >
            Voir les tarifs
            <Icon.ArrowRight size={16} />
          </a>
        </div>

        <p className="mt-6 text-sm text-creme/70">
          Sans engagement · 1ᵉʳ appel offert · Données protégées RGPD
        </p>
      </div>
    </section>
  )
}
