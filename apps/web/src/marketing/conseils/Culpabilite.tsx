// Guide — /conseils/culpabilite-ne-pas-appeler-parents
import { Icon } from '@/marketing/components/icons'
import {
  GuidePage,
  Section,
  P,
  Callout,
  ConseilsCTA,
  WaveMotif,
  GUIDE_META,
} from '@/marketing/conseils/ConseilsLayout'

const lead = (
  <>
    Vous y pensez le soir, en vous couchant. Vous vous étiez dit « je l'appelle aujourd'hui », et la
    journée a filé. Encore. Et cette petite voix qui revient, tenace.
  </>
)

// Héro 2 colonnes : texte + photo (registre du soir, introspectif).
function CulpabiliteHero() {
  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-terracotta-dark bg-terracotta/[0.08] border border-terracotta/15 rounded-full px-3 py-1 whitespace-nowrap">
          {GUIDE_META.culpabilite.tag}
        </span>
        <span className="inline-flex items-center gap-1.5 text-brun-700/70 text-sm whitespace-nowrap">
          <Icon.Clock size={14} />
          {GUIDE_META.culpabilite.minutes} min de lecture
        </span>
      </div>
      <div className="mt-5 grid md:grid-cols-[1.08fr_0.92fr] gap-8 lg:gap-12 items-center">
        <div>
          <h1 className="font-serif font-normal text-brun-900 text-[30px] md:text-[40px] leading-[1.1] text-balance">
            « Je culpabilise de ne pas appeler assez mes parents »
          </h1>
          <div className="mt-5 text-lg text-brun-700 leading-relaxed text-pretty">{lead}</div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-creme-sable aspect-[4/5] md:aspect-[5/6]">
          <img
            src="/conseils/the-fenetre.jpg"
            alt="Une tasse de thé tenue près d'une fenêtre en fin de journée, lumière dorée"
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      </div>
    </section>
  )
}

// Citation forte (respiration en tête de corps).
function PullQuote() {
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-creme-sable bg-creme-sable/50 px-8 py-10 md:px-12 md:py-12">
      <WaveMotif className="absolute -right-4 top-3 w-64 h-20 pointer-events-none" stroke="#C75D3A" opacity={0.1} />
      <blockquote className="relative font-serif italic font-normal text-brun-900 text-2xl md:text-[32px] leading-snug text-balance max-w-2xl">
        « Je ne fais pas <span className="text-terracotta-dark">assez.</span> »
      </blockquote>
    </figure>
  )
}

// Schéma « génération pivot ».
const PIVOT = [
  { icon: Icon.Users, label: 'Des enfants encore à charge' },
  { icon: Icon.Briefcase, label: 'Une vie professionnelle exigeante' },
  { icon: Icon.Heart, label: 'Des parents qui vieillissent' },
]

function PivotSqueeze() {
  return (
    <div className="rounded-xl border border-creme-sable bg-creme-sable/40 p-6 md:p-8">
      <p className="text-xs uppercase tracking-[0.16em] text-terracotta-dark font-medium mb-5">
        Pris en étau
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        {PIVOT.map((p) => (
          <div
            key={p.label}
            className="flex flex-col items-center text-center gap-3 rounded-lg border border-creme-sable bg-creme p-5"
          >
            <span className="w-11 h-11 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta-dark">
              <p.icon size={22} />
            </span>
            <p className="text-[15px] text-brun-700 leading-snug text-pretty">{p.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-brun-900 text-pretty">
        Et vous, au milieu — sommé de trouver du temps pour tout le monde, alors qu'il n'y en a jamais
        assez.
      </p>
    </div>
  )
}

// Schéma « cercle vicieux ».
function CercleVicieux() {
  const steps = ['On vise un idéal impossible', 'On ne tient pas', 'On culpabilise de ne pas tenir']
  return (
    <div className="rounded-xl border border-creme-sable bg-creme p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
        {steps.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-terracotta/20 bg-terracotta/5 text-terracotta-dark text-[14px] font-medium px-4 py-2 text-center">
              {s}
            </span>
            {i < steps.length - 1 && (
              <Icon.ArrowRight size={16} className="text-terracotta/60 shrink-0" />
            )}
          </span>
        ))}
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-brun-700/80">
        <Icon.Loop size={15} className="text-terracotta" /> Le cercle se referme : on appréhende
        l'appel au lieu de l'attendre.
      </p>
    </div>
  )
}

const SORTIE = [
  [
    'Visez la régularité, pas la perfection.',
    "Un appel court mais fidèle, à un moment fixe de la semaine, vaut mieux qu'un idéal jamais atteint.",
  ],
  [
    'Distinguez ce que vous pouvez tenir de ce que vous ne pouvez pas.',
    "Mieux vaut une promesse modeste tenue qu'une grande promesse abandonnée.",
  ],
  ['Partagez la charge', 'avec vos frères et sœurs, plutôt que de tout porter seul.'],
]

function CulpabiliteBody() {
  return (
    <>
      <Section>
        <P>
          Si vous lisez ces lignes, c'est que vous tenez à vos parents. La culpabilité que vous
          ressentez n'est pas le signe que vous les négligez —{' '}
          <strong className="text-brun-900 font-medium">
            c'est le signe que vous les aimez, et que vous êtes débordé.
          </strong>{' '}
          Ce sont deux choses différentes, et il est possible de s'en sortir.
        </P>
      </Section>

      <PullQuote />

      <Section title="Pourquoi vous culpabilisez (et pourquoi c'est si fréquent)">
        <P>
          Vous appartenez sans doute à ce qu'on appelle la « génération pivot » : prise en étau entre
          des enfants encore à charge, une vie professionnelle exigeante, et des parents qui
          vieillissent. Tout le monde réclame du temps, et il n'y en a jamais assez pour tout le monde.
        </P>
        <PivotSqueeze />
        <P>
          S'ajoute la distance, parfois, qui transforme un simple appel en rendez-vous qu'on n'arrive
          pas à caser. Et le sentiment, tenace, que quoi qu'on fasse, ce ne sera jamais à la hauteur de
          ce que nos parents ont fait pour nous.
        </P>
        <P>
          Cette culpabilité est extrêmement répandue.{' '}
          <strong className="text-brun-900 font-medium">Elle n'est pas une faute.</strong> Mais laissée
          seule, elle épuise — et, paradoxalement, elle peut finir par éloigner.
        </P>
      </Section>

      <Section title="Sortir du tout-ou-rien" eyebrow="La sortie">
        <P>
          Le piège, c'est de penser en termes d'idéal impossible : « je devrais appeler tous les jours
          », « je devrais être présent ». Comme cet idéal est inatteignable, on ne tient pas, et on
          culpabilise de ne pas tenir.
        </P>
        <CercleVicieux />
        <P>La sortie passe par le réalisme :</P>
        <div className="rounded-xl border border-creme-sable bg-creme p-6 space-y-3.5">
          {SORTIE.map(([b, rest]) => (
            <div key={b} className="flex gap-3">
              <Icon.ArrowRight size={18} className="text-terracotta mt-0.5 shrink-0" />
              <p className="text-brun-700 leading-relaxed text-pretty text-[17px]">
                <strong className="text-brun-900 font-medium">{b}</strong> {rest}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Une présence qui ne repose pas que sur vous" eyebrow="Notre rôle">
        <P>
          Le vrai soulagement vient quand la présence auprès de votre parent ne dépend plus uniquement
          de votre disponibilité. Vous restez le lien essentiel — mais vous n'êtes plus le seul.
        </P>
        <P>
          Cela peut passer par un voisin, une aide à domicile, une association de visiteurs. Et, pour
          les jours où vous ne pouvez vraiment pas, par une présence régulière dédiée.
        </P>
        <P>
          C'est ce que nous proposons chez Aicoute : des appels téléphoniques réguliers à votre parent,
          une vraie conversation à son rythme, et un compte-rendu qui vous tient informé de comment il
          va.
        </P>
        <Callout label="En toute honnêteté">
          <p>
            Aicoute ne remplace pas vos appels, et n'efface pas le lien irremplaçable que vous avez avec
            votre parent. Sa place est sur les jours creux, ceux où vous ne pouvez pas être là. L'idée
            n'est pas de vous remplacer, mais de vous soulager : une présence pour votre parent, et un
            peu moins de cette voix qui vous dit, le soir, que vous n'en faites pas assez.
          </p>
        </Callout>
      </Section>

      <ConseilsCTA />
    </>
  )
}

export function CulpabilitePage() {
  return (
    <GuidePage
      seo={{
        title: 'Culpabilité de ne pas appeler ses parents âgés : que faire | Aicoute',
        description:
          "Vous culpabilisez de ne pas appeler assez vos parents âgés ? Pourquoi c'est si fréquent, comment sortir du tout-ou-rien et mettre en place une présence durable.",
        canonical: 'https://www.aicoute.fr/conseils/culpabilite-ne-pas-appeler-parents',
      }}
      breadcrumbLabel="Culpabilité d'appeler"
      customHero={<CulpabiliteHero />}
      related={[GUIDE_META.isolement, GUIDE_META.veuf]}
    >
      <CulpabiliteBody />
    </GuidePage>
  )
}
