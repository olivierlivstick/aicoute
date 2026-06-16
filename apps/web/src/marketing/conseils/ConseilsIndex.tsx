// Page racine de la section éditoriale : /conseils
import { ConseilsLayout, Lead, Section, P, A, ConseilsCTA } from '@/marketing/conseils/ConseilsLayout'

const GUIDES = [
  {
    href: '/conseils/rompre-isolement-personne-agee',
    title: "Rompre l'isolement d'une personne âgée : les solutions qui existent vraiment",
    teaser:
      "Le tour d'horizon complet : visites, associations, aide à domicile, téléassistance, appels réguliers. Toutes les pistes, leurs forces et leurs limites.",
  },
  {
    href: '/conseils/parent-age-seul-vivre-loin',
    title: 'Votre parent vit seul et vous vivez loin',
    teaser:
      'Organiser un relais de proximité, tenir un rythme malgré la distance, et être rassuré sur son quotidien sans pouvoir passer.',
  },
  {
    href: '/conseils/aider-parent-veuf-isolement',
    title: 'Aider un parent qui vient de perdre son conjoint',
    teaser:
      'Accompagner le deuil, repérer les signaux d’isolement, et maintenir une présence dans la durée sans étouffer.',
  },
  {
    href: '/conseils/culpabilite-ne-pas-appeler-parents',
    title: '« Je culpabilise de ne pas appeler assez mes parents »',
    teaser:
      'Comprendre cette culpabilité si répandue, sortir du tout-ou-rien, et bâtir une présence qui ne repose pas que sur vous.',
  },
]

export function ConseilsIndexPage() {
  return (
    <ConseilsLayout
      title="Conseils aux aidants : accompagner un proche âgé | Aicoute"
      description="Des conseils concrets et honnêtes pour accompagner un parent âgé isolé : éloignement, deuil, culpabilité, solutions pour rompre la solitude et garder le lien."
      canonical="https://www.aicoute.fr/conseils"
      h1="Conseils aux aidants"
    >
      <Lead>
        Accompagner un parent qui vieillit, surtout quand il vit seul, soulève beaucoup de questions
        et peu de réponses simples. Comment rester présent à distance ? Comment l'aider après la perte
        d'un conjoint ? Comment composer avec la culpabilité de ne jamais en faire assez ?
      </Lead>
      <P>
        Nous avons réuni ici des conseils concrets et honnêtes, pensés pour les proches aidants. Vous y
        trouverez des solutions humaines, des dispositifs existants et des repères pratiques — y compris
        quand ils ne passent pas par nous. Parce que notre conviction, chez Aicoute, est simple : la
        lutte contre l'isolement des aînés ne se résume jamais à un seul outil.
      </P>

      <Section title="Nos guides">
        <ul className="space-y-6">
          {GUIDES.map((g) => (
            <li key={g.href}>
              <A href={g.href}>{g.title} →</A>
              <p className="mt-1 text-brun-700 leading-relaxed text-pretty">{g.teaser}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Notre place dans tout ça">
        <P>
          Aicoute propose des appels téléphoniques réguliers à votre proche, et un compte-rendu qui
          vous tient informé de comment il va. Nous le disons sans détour : nous ne remplaçons ni vos
          appels, ni vos visites, ni personne. Notre rôle est de compléter votre présence sur les jours
          où vous ne pouvez pas être là — pas de la remplacer.
        </P>
      </Section>

      <ConseilsCTA />
    </ConseilsLayout>
  )
}
