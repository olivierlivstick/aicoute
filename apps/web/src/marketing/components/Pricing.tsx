// SECTION 7 — Tarifs (3 cartes, centrale mise en avant)
import { Icon } from '@/marketing/components/icons'
import { SIGNUP_URL } from '@/config/links'

type Plan = {
  name: string
  price: string
  tagline: string
  features: string[]
  cta: string
  featured: boolean
}

export function Pricing() {
  const plans: Plan[] = [
    {
      name: 'Essentiel',
      price: '14,90',
      tagline: "Pour rester en lien sans s'engager.",
      features: [
        '1 appel par semaine',
        'Résumé email après chaque appel',
        '1 profil de proche',
        'Support par email',
      ],
      cta: 'Choisir Essentiel',
      featured: false,
    },
    {
      name: 'Famille',
      price: '24,90',
      tagline: 'Pour une vraie régularité.',
      features: [
        '3 appels par semaine',
        'Résumé + transcription complète',
        "Jusqu'à 2 profils de proches",
        'Personnalisation avancée',
        'Support prioritaire',
      ],
      cta: 'Choisir Famille',
      featured: true,
    },
    {
      name: 'Sérénité',
      price: '49',
      tagline: 'Pour un accompagnement quotidien.',
      features: [
        '1 appel par jour',
        "Alertes en temps réel si point d'attention",
        "Jusqu'à 4 profils de proches",
        'Rapport mensuel détaillé',
        'Accompagnement humain dédié',
      ],
      cta: 'Choisir Sérénité',
      featured: false,
    },
  ]

  return (
    <section id="tarifs" className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Choisissez la formule qui vous ressemble.
          </h2>
          <p className="mt-4 text-lg text-brun-700">
            Sans engagement. Annulable à tout moment.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>

        <p className="mt-10 text-sm text-center text-brun-700 max-w-2xl mx-auto">
          Tous les tarifs incluent l'accès à l'espace personnel et la mémoire
          des conversations sur 12 mois glissants.
        </p>
      </div>
    </section>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const { featured } = plan
  return (
    <div
      className={`relative bg-white rounded-xl p-8 flex flex-col ${
        featured
          ? 'border-2 border-terracotta md:-translate-y-2'
          : 'border border-creme-sable'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terracotta text-creme rounded-full px-3 py-1 text-xs font-medium tracking-wide">
          Le plus choisi
        </span>
      )}

      <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark">
        {plan.name}
      </p>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-serif text-5xl text-brun-900">{plan.price}</span>
        <span className="text-base text-brun-700">€ / mois</span>
      </div>

      <p className="mt-2 text-brun-700 text-pretty">{plan.tagline}</p>

      <ul className="mt-7 space-y-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[15px] text-brun-900">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-creme flex items-center justify-center text-terracotta">
              <Icon.Check size={12} />
            </span>
            <span className="leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={SIGNUP_URL}
        className={`mt-8 inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-colors ${
          featured
            ? 'bg-terracotta hover:bg-terracotta-dark text-creme'
            : 'border border-terracotta text-terracotta-dark hover:bg-terracotta hover:text-creme'
        }`}
      >
        {plan.cta}
      </a>
    </div>
  )
}
