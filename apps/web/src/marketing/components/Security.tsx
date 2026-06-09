// SECTION 6 — Sécurité & éthique
import { Icon } from '@/marketing/components/icons'

export function Security() {
  const cols = [
    {
      Icon: Icon.Lock,
      title: 'Vos données restent les vôtres',
      text:
        "Hébergement en Europe, conformité RGPD, chiffrement des conversations. Vous pouvez exporter ou supprimer toutes les données à tout moment.",
    },
    {
      Icon: Icon.MessageCircle,
      title: 'Une IA transparente',
      text:
        "Votre proche est informé dès le premier appel qu'il échange avec une IA. Aucune supercherie, aucune confusion. La confiance avant tout.",
    },
    {
      Icon: Icon.Hand,
      title: 'Vous gardez le contrôle',
      text:
        "Fréquence, sujets à privilégier, sujets à éviter, arrêt immédiat : tout est ajustable depuis votre espace personnel. Et parce que votre proche peut aussi appeler de lui-même, le lien ne dépend plus seulement de ce que les autres programment pour lui — il en garde, lui aussi, l'initiative.",
    },
  ]

  return (
    <section id="securite" className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Notre engagement
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Une technologie qui sert le lien humain,
            <span className="italic text-terracotta-dark"> sans jamais le remplacer.</span>
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-12">
          {cols.map(({ Icon: ColIcon, title, text }) => (
            <div key={title}>
              <ColIcon size={32} className="text-terracotta" />
              <h3 className="mt-5 font-sans font-medium text-xl text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a href="/charte-ethique" className="inline-flex items-center gap-1.5 text-terracotta-dark font-medium link-underline">
            Lire notre charte éthique complète
            <Icon.ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  )
}
