// Guide — /conseils/parent-age-seul-vivre-loin
import { Icon } from '@/marketing/components/icons'
import {
  GuidePage,
  Section,
  P,
  Callout,
  ReliefCard,
  StatBlock,
  ConseilsCTA,
  GUIDE_META,
} from '@/marketing/conseils/ConseilsLayout'

const lead = (
  <>
    Vous habitez une autre ville, parfois un autre pays. Votre père ou votre mère vit seul, et entre
    deux visites les semaines s'étirent. Vous appelez, mais vous avez toujours l'impression que ce
    n'est pas assez. Et au fond, une inquiétude sourde vous accompagne :{' '}
    <em className="text-brun-900">est-ce qu'il ou elle va bien, vraiment, les jours où je ne suis pas là ?</em>
  </>
)

const RELAIS = [
  {
    icon: Icon.Users,
    title: 'Un voisin de confiance',
    text: "Un simple « si vous voyez quelque chose d'inhabituel, appelez-moi » change tout. Des dispositifs comme Voisin-Âge formalisent ce lien.",
  },
  {
    icon: Icon.Heart,
    title: 'Une aide à domicile (SAAD)',
    text: "Au-delà du ménage ou des repas, c'est une présence humaine régulière qui voit votre parent et peut vous alerter.",
  },
  {
    icon: Icon.Stethoscope,
    title: 'Le pharmacien, le médecin',
    text: "Des sentinelles précieuses : ils connaissent votre parent, le voient régulièrement, et repèrent les premiers changements.",
  },
  {
    icon: Icon.Sun,
    title: 'Associations & clubs des aînés',
    text: "Quand votre parent est encore mobile et ouvert à de nouvelles rencontres, le lien collectif fait beaucoup.",
  },
]

const RYTHME = [
  [
    'Bloquer un créneau fixe',
    "dans la semaine, traité comme un rendez-vous, pas comme une tâche « si j'ai le temps ».",
  ],
  ['Partager le relais', 'avec vos frères et sœurs, pour répartir la charge plutôt que la porter seul.'],
  [
    'Accepter de ne pas tout tenir',
    "— l'enjeu n'est pas l'appel parfait, c'est la présence continue, qui ne doit pas reposer que sur vos épaules.",
  ],
]

function GuideBody() {
  return (
    <>
      <Section title="La distance, une double peine">
        <P>L'éloignement crée deux solitudes en même temps.</P>
        <P>
          Pour votre parent, ce sont les visites spontanées qui disparaissent. Plus personne qui passe
          « comme ça », plus de petites conversations du quotidien. Le silence s'installe, et avec lui
          le repli : on sort moins, on décroche moins le téléphone, on raconte de moins en moins.
        </P>
        <P>
          Pour vous, c'est l'impuissance. Vous imaginez le pire au moindre appel manqué, vous
          culpabilisez de ne pas appeler davantage, et même quand tout va bien, vous portez une charge
          mentale discrète : celle de ne pas savoir.
        </P>
      </Section>

      <StatBlock
        figure="1 / 2"
        label="Une personne âgée sur deux ne sort pas de chez elle tous les jours."
        source="3ᵉ Baromètre « Solitude et isolement », Petits Frères des Pauvres (2025)"
      />

      <Section title="Organiser un relais de proximité" eyebrow="Tisser le filet">
        <P>
          Vous ne pouvez pas être présent physiquement. Mais d'autres le peuvent, et votre rôle à
          distance peut être de tisser ce filet autour de votre parent. Quelques relais concrets à
          activer :
        </P>
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {RELAIS.map((r) => (
            <ReliefCard key={r.title} icon={r.icon} title={r.title}>
              {r.text}
            </ReliefCard>
          ))}
        </div>
        <P>
          L'objectif n'est pas de tout déléguer, mais de ne plus être le seul point de contact. Plus le
          filet est large, moins votre absence laisse de vide.
        </P>
      </Section>

      <Section title="Maintenir un rythme, même les jours sans temps">
        <P>
          Pour garder le lien, la régularité compte plus que la durée. Un appel court mais fidèle,
          chaque semaine au même moment, rassure davantage qu'une longue conversation imprévisible une
          fois par mois.
        </P>
        <P>
          Sauf que la vie réelle s'en mêle. On se dit « je l'appelle ce soir », et trois jours passent.
          Puis une semaine. Quelques réflexes aident :
        </P>
        <div className="rounded-xl border border-creme-sable bg-creme p-6 space-y-3.5">
          {RYTHME.map(([b, rest]) => (
            <div key={b} className="flex gap-3">
              <Icon.ArrowRight size={18} className="text-terracotta mt-0.5 shrink-0" />
              <p className="text-brun-700 leading-relaxed text-pretty text-[17px]">
                <strong className="text-brun-900 font-medium">{b}</strong> {rest}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Être rassuré sans être sur place">
        <P>
          C'est souvent le vrai besoin de l'aidant à distance : la visibilité. Savoir que votre parent
          va bien entre deux de vos appels.
        </P>
        <P>
          La <strong className="text-brun-900 font-medium">téléassistance</strong> répond à une partie
          du problème : en cas de chute ou d'urgence, votre parent peut alerter. C'est utile, souvent
          indispensable. Mais elle vous dit seulement si <em>quelque chose ne va pas</em>. Elle ne vous
          dit pas comment votre parent va au quotidien — s'il a parlé à quelqu'un aujourd'hui, s'il sort
          encore, si le moral tient. Or c'est précisément ce lien ordinaire que la distance creuse en
          premier.
        </P>
      </Section>

      <Section title="Aicoute : une présence régulière, même quand vous êtes loin" eyebrow="Notre rôle">
        <P>C'est exactement ce vide que nous avons voulu aider à combler.</P>
        <P>
          Aicoute, ce sont des appels téléphoniques réguliers passés à votre parent — et, s'il le
          souhaite, qu'il peut désormais passer lui-même quand l'envie de parler vient. Une vraie
          conversation, chaleureuse, à son rythme. Après chaque appel, vous recevez un compte-rendu :
          vous savez comment il ou elle va, sans avoir à tout porter.
        </P>
        <Callout label="En toute honnêteté">
          <p>
            Aicoute est un compagnon téléphonique, pas un être humain, et ne remplacera jamais ni vos
            appels, ni vos visites, ni la chaleur d'une famille. Ce n'est pas notre ambition. Notre
            place est ailleurs : sur les jours creux, ceux où personne ne passe et où vous ne pouvez pas
            être là. Une présence régulière qui s'ajoute à la vôtre, sans jamais s'y substituer.
          </p>
        </Callout>
        <P>
          Pour votre parent, une présence de plus dans la semaine. Pour vous, l'esprit un peu plus
          tranquille.
        </P>
      </Section>

      <ConseilsCTA note="Faites l'essai, voyez comment votre parent réagit, et décidez ensuite." />
    </>
  )
}

export function ParentSeulVivreLoinPage() {
  return (
    <GuidePage
      seo={{
        title: 'Parent âgé seul, vous vivez loin : garder le lien | Aicoute',
        description:
          "Votre parent âgé vit seul et vous êtes loin ? Des conseils concrets pour organiser un relais de proximité, garder le lien au quotidien et retrouver l'esprit tranquille.",
        canonical: 'https://www.aicoute.fr/conseils/parent-age-seul-vivre-loin',
      }}
      tag={GUIDE_META.parentSeul.tag}
      minutes={GUIDE_META.parentSeul.minutes}
      breadcrumbLabel="Parent seul, vivre loin"
      h1="Votre parent vit seul et vous êtes loin : comment garder le lien"
      lead={lead}
      heroImage="/conseils/lecture-fenetre.jpg"
      heroAlt="Une femme âgée lisant tranquillement près d'une fenêtre, lumière naturelle"
      articleHeadline="Votre parent vit seul et vous êtes loin : comment garder le lien"
      articleImage="https://www.aicoute.fr/conseils/lecture-fenetre.jpg"
      related={[GUIDE_META.isolement, GUIDE_META.culpabilite]}
    >
      <GuideBody />
    </GuidePage>
  )
}
