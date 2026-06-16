// Guide pilier — /conseils/rompre-isolement-personne-agee
import { Icon } from '@/marketing/components/icons'
import {
  GuidePage,
  Section,
  P,
  Callout,
  ReliefCard,
  ConseilsCTA,
  GUIDE_META,
} from '@/marketing/conseils/ConseilsLayout'

const lead = (
  <>
    Quand un parent vieillit seul, on se sent souvent démuni. On voudrait l'aider, sans toujours savoir
    par où commencer ni à qui s'adresser. Bonne nouvelle :{' '}
    <strong className="text-brun-900 font-medium">
      les solutions existent, elles sont nombreuses, et la plupart se combinent.
    </strong>{' '}
    Ce guide les passe en revue honnêtement — celles qui reposent sur le lien humain, celles du
    quotidien, celles qui sécurisent, et celles qui maintiennent le contact à distance.
  </>
)

// Mini-visualisation de la progression de la « mort sociale ».
function TrendBars() {
  const rows = [
    { year: '2017', value: 300000, label: '300 000' },
    { year: '2021', value: 530000, label: '530 000' },
    { year: '2025', value: 750000, label: '750 000', highlight: true },
  ]
  const max = 750000
  return (
    <figure className="my-2 rounded-xl border border-creme-sable bg-creme-sable/40 px-7 py-7 md:px-9 md:py-8">
      <figcaption className="text-brun-900 leading-snug text-lg text-pretty mb-6">
        Personnes âgées en situation de « mort sociale » en France — presque aucun contact humain.
      </figcaption>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.year} className="flex items-center gap-4">
            <span className="w-12 shrink-0 text-sm font-medium text-brun-700/80 tabular-nums">
              {r.year}
            </span>
            <div className="flex-1 h-8 rounded-md bg-creme overflow-hidden border border-creme-sable">
              <div
                className={`h-full rounded-md ${r.highlight ? 'bg-terracotta' : 'bg-ocre/60'}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span
              className={`w-[88px] shrink-0 text-right tabular-nums ${
                r.highlight ? 'font-serif text-terracotta text-xl' : 'text-brun-700 text-[15px]'
              }`}
            >
              {r.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-brun-700/70">
        Source : 3ᵉ Baromètre « Solitude et isolement », Petits Frères des Pauvres / CSA Research
        (septembre 2025).
      </p>
    </figure>
  )
}

const HUMAIN = [
  {
    icon: Icon.Users,
    title: 'Les visites régulières',
    text: "Les vôtres comme celles d'autres proches, voisins ou amis. La régularité compte plus que la durée.",
  },
  {
    icon: Icon.Heart,
    title: 'Les associations de lien social',
    text: "Les Petits Frères des Pauvres organisent visites et accompagnements ; Voisin-Âge met en relation aînés et voisins bienveillants.",
  },
  {
    icon: Icon.Sun,
    title: 'Clubs des aînés & activités',
    text: "Municipalité, maisons des seniors, ateliers — quand votre parent est encore mobile et ouvert aux rencontres.",
  },
]

const QUOTIDIEN = [
  {
    icon: Icon.Home,
    title: "L'aide à domicile (SAAD)",
    text: "Au-delà du ménage ou des repas, c'est un visage familier qui passe et qui veille.",
  },
  {
    icon: Icon.Utensils,
    title: 'Le portage de repas',
    text: "Une bonne alimentation assurée et, avec elle, un passage quotidien à domicile.",
  },
  {
    icon: Icon.Calendar,
    title: "L'accueil de jour",
    text: "Pour rompre la solitude quelques heures par semaine, dans un cadre adapté.",
  },
]

const PARLER = [
  ['Présenter chaque solution comme un confort', 'et non comme un constat de dépendance.'],
  ['Avancer par petites touches', "plutôt que tout proposer d'un coup."],
  [
    'Impliquer votre parent dans le choix',
    "— le but n'est pas de décider à sa place, mais de lui ouvrir des portes.",
  ],
]

function PillarBody() {
  return (
    <>
      <Section title="L'isolement des aînés, une réalité qui s'aggrave">
        <P>
          Avant les solutions, un constat. Selon le 3ᵉ Baromètre « Solitude et isolement » des Petits
          Frères des Pauvres,{' '}
          <strong className="text-brun-900 font-medium">
            750 000 personnes âgées vivent aujourd'hui en France en situation de « mort sociale »
          </strong>
          , c'est-à-dire sans presque aucun contact humain. Le phénomène ne recule pas, il s'accélère.
        </P>
      </Section>

      <TrendBars />

      <Section>
        <P>
          Ces chiffres ne sont pas là pour faire peur, mais pour rappeler une chose simple : si votre
          parent souffre de solitude, vous n'êtes pas en train de surréagir. C'est un enjeu réel, et il
          se traite.
        </P>
      </Section>

      <Section title="Les solutions qui reposent sur le lien humain" eyebrow="Par où commencer">
        <P>Rien ne remplace une présence humaine. C'est par là qu'il faut commencer.</P>
        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          {HUMAIN.map((r) => (
            <ReliefCard key={r.title} icon={r.icon} title={r.title}>
              {r.text}
            </ReliefCard>
          ))}
        </div>
      </Section>

      <Section title="Les solutions du quotidien">
        <P>
          Certaines aides créent du lien sans en avoir l'air, parce qu'elles amènent une présence
          régulière à domicile.
        </P>
        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          {QUOTIDIEN.map((r) => (
            <ReliefCard key={r.title} icon={r.icon} title={r.title}>
              {r.text}
            </ReliefCard>
          ))}
        </div>
      </Section>

      <Section title="Les solutions qui sécurisent">
        <div className="flex gap-4 rounded-xl border border-creme-sable bg-creme p-6">
          <span className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center shrink-0 text-terracotta-dark">
            <Icon.Bell size={20} />
          </span>
          <div>
            <h3 className="font-medium text-brun-900 leading-snug">La téléassistance</h3>
            <p className="mt-1 text-[15px] text-brun-700 leading-relaxed text-pretty">
              Elle permet à votre parent d'alerter en cas de chute ou d'urgence — souvent
              indispensable. Gardez toutefois en tête qu'elle signale ce qui va mal ; elle ne dit pas si
              votre parent va bien au quotidien, ni s'il souffre de solitude.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Garder le lien, même à distance" eyebrow="Notre rôle">
        <P>
          Quand on vit loin, le défi est double : maintenir le contact et savoir comment va son parent
          entre deux visites. Des appels réguliers restent le meilleur outil — encore faut-il pouvoir
          les tenir.
        </P>
        <P>
          C'est précisément la situation que nous accompagnons chez Aicoute : des appels téléphoniques
          réguliers passés à votre parent (et qu'il peut désormais passer lui-même quand l'envie de
          parler vient), suivis d'un compte-rendu qui vous tient informé.
        </P>
        <Callout label="En toute honnêteté">
          <p>
            Aicoute est un compagnon téléphonique, pas un être humain, et ne remplace ni vos appels, ni
            vos visites, ni la chaleur d'une famille. Sa place est sur les jours creux, ceux où personne
            ne passe. Une présence de plus, jamais une présence à la place.
          </p>
        </Callout>
      </Section>

      <ConseilsCTA />

      <Section title="Comment en parler à votre parent sans le braquer">
        <P>Beaucoup d'aînés refusent l'aide par fierté ou par peur de « déranger ». Quelques principes aident :</P>
        <div className="rounded-xl border border-creme-sable bg-creme p-6 space-y-3.5">
          {PARLER.map(([b, rest]) => (
            <div key={b} className="flex gap-3">
              <Icon.ArrowRight size={18} className="text-terracotta mt-0.5 shrink-0" />
              <p className="text-brun-700 leading-relaxed text-pretty text-[17px]">
                <strong className="text-brun-900 font-medium">{b}</strong> {rest}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

export function RompreIsolementPage() {
  return (
    <GuidePage
      seo={{
        title: "Rompre l'isolement d'une personne âgée : les solutions | Aicoute",
        description:
          "Visites, associations, aide à domicile, téléassistance, appels réguliers… Le guide des solutions concrètes pour rompre l'isolement d'un parent âgé et garder le lien.",
        canonical: 'https://www.aicoute.fr/conseils/rompre-isolement-personne-agee',
      }}
      tag={GUIDE_META.isolement.tag}
      minutes={GUIDE_META.isolement.minutes}
      breadcrumbLabel="Rompre l'isolement"
      h1="Rompre l'isolement d'une personne âgée : les solutions qui existent vraiment"
      lead={lead}
      heroImage="/hero-etablissements.jpg"
      heroAlt="Une femme âgée souriante au téléphone, près d'une plante verte, dans une lumière douce"
      related={[GUIDE_META.parentSeul, GUIDE_META.veuf, GUIDE_META.culpabilite]}
    >
      <PillarBody />
    </GuidePage>
  )
}
