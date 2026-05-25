// SECTION 4 — Bénéfices (grille 2x2)
import { Icon } from '@/marketing/components/icons'

export function Benefits() {
  const items = [
    {
      Icon: Icon.Heart,
      title: 'Une présence qui écoute vraiment',
      text:
        "Notre IA se souvient des conversations passées, du nom du chat, du jardin, du dernier rendez-vous chez le médecin. Pas un assistant générique : une présence qui s'inscrit dans la vie de votre proche.",
    },
    {
      Icon: Icon.CalendarCheck,
      title: "La régularité qu'on n'arrive pas toujours à tenir",
      text:
        "Vous ne pouvez pas appeler tous les jours, et c'est normal. MODECT le fait à votre place, sans jamais oublier, sans jamais se lasser, à l'heure qui convient le mieux.",
    },
    {
      Icon: Icon.Eye,
      title: 'Une vigilance bienveillante',
      text:
        "Les résumés vous permettent de détecter un changement d'humeur, un sujet inquiétant, un événement à appeler vous-même. Vous gardez la main, MODECT vous éclaire.",
    },
    {
      Icon: Icon.ShieldCheck,
      title: 'Le respect avant tout',
      text:
        "Votre proche est informé au début du premier appel. À tout moment, il peut demander à ne plus être appelé. Nous ne sommes jamais un substitut à votre présence — un complément, jamais un remplaçant.",
    },
  ]

  return (
    <section className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Ce que cela change
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Une présence régulière,<br className="hidden md:block" />
            <span className="italic text-terracotta-dark">une famille rassurée.</span>
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {items.map(({ Icon: ItemIcon, title, text }) => (
            <div
              key={title}
              className="bg-white border border-creme-sable rounded-xl p-8 transition-colors hover:border-terracotta/30"
            >
              <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
                <ItemIcon size={26} />
              </div>
              <h3 className="mt-5 font-sans font-medium text-xl text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
