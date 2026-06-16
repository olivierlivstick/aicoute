// Guide — /conseils/aider-parent-veuf-isolement
import { Icon } from '@/marketing/components/icons'
import {
  GuidePage,
  Section,
  P,
  Callout,
  ConseilsCTA,
  GUIDE_META,
} from '@/marketing/conseils/ConseilsLayout'

const lead = (
  <>
    La perte d'un conjoint est l'un des bouleversements les plus profonds d'une vie. Pour un parent
    âgé, elle ne marque pas seulement un deuil : elle fait souvent disparaître, du jour au lendemain,
    le principal — parfois le seul — lien quotidien. La maison devient silencieuse. Et l'isolement, qui
    guettait peut-être déjà, peut s'installer très vite.
  </>
)

const SIGNAUX = [
  'Votre parent ne sort plus, refuse les invitations, délaisse ses activités.',
  'Il néglige ses repas, son apparence, son logement.',
  'Il parle de moins en moins, ou semble avoir « décroché ».',
  "Le sommeil, l'humeur ou l'appétit changent durablement.",
]

function VeufBody() {
  return (
    <>
      <Section>
        <P>Vous le sentez, et vous cherchez comment être présent sans tout porter. Voici des repères.</P>
      </Section>

      <Section title="Ce que traverse un parent qui perd son conjoint">
        <P>
          Le deuil d'une vie partagée pendant des décennies ne ressemble à aucun autre. Au chagrin
          s'ajoute une réorganisation totale du quotidien : les repas qu'on ne prépare plus pour deux,
          les habitudes qui n'ont plus de sens, les journées qui n'ont plus de rythme. Beaucoup de
          personnes âgées décrivent moins une tristesse continue qu'un grand vide — et c'est dans ce
          vide que l'isolement s'installe.
        </P>
        <P>
          Ce risque n'est pas marginal. Le sentiment de solitude touche durablement plusieurs millions
          d'aînés en France, et la perte du conjoint en est l'un des principaux déclencheurs.
        </P>
      </Section>

      <Section title="Les premières semaines, puis les mois suivants">
        <P>
          Dans les premières semaines, votre parent est souvent entouré : famille, amis, voisins se
          relaient. Le danger vient plus tard. Quand l'entourage reprend sa vie, quand les visites
          s'espacent, c'est là que la solitude s'installe vraiment — souvent deux ou trois mois après,
          au moment où l'on s'y attend le moins.
        </P>
        <div className="rounded-xl border border-creme-sable bg-creme-sable/50 p-6 md:p-7">
          <p className="font-serif italic text-brun-900 text-xl md:text-2xl leading-snug text-balance">
            Tenez sur la durée plutôt que sur l'intensité.
          </p>
          <p className="mt-3 text-brun-700 leading-relaxed text-pretty text-[17px]">
            Mieux vaut une présence régulière et modeste, maintenue sur des mois, qu'un grand élan qui
            retombe une fois les funérailles passées.
          </p>
        </div>
      </Section>

      <Section title="Les signaux qui doivent vous alerter">
        <P>Sans transformer chaque appel en interrogatoire, restez attentif à certains changements :</P>
        <div className="rounded-xl border border-creme-sable bg-creme p-6 space-y-3.5">
          {SIGNAUX.map((s) => (
            <div key={s} className="flex gap-3">
              <Icon.Eye size={18} className="text-terracotta mt-0.5 shrink-0" />
              <p className="text-brun-700 leading-relaxed text-pretty text-[17px]">{s}</p>
            </div>
          ))}
        </div>
        <P>
          Si ces signes s'installent et persistent, parlez-en à son médecin traitant : le deuil peut
          glisser vers une dépression, fréquente et traitable chez la personne âgée.
        </P>
      </Section>

      <Section title="Maintenir une présence sans l'étouffer">
        <P>
          Accompagner ne veut pas dire envahir. Votre parent a besoin de retrouver une autonomie, à son
          rythme. Quelques façons d'être là sans peser : instaurer un rendez-vous régulier plutôt que
          des appels anxieux et imprévisibles, encourager doucement la reprise d'une activité ou d'un
          lien, et tisser autour de lui un réseau de proximité (voisins, aide à domicile, pharmacien)
          pour ne pas être le seul recours.
        </P>
      </Section>

      <Section title="Une présence régulière, sur les jours les plus silencieux" eyebrow="Notre rôle">
        <P>
          Sur les jours où personne ne passe — et ils sont nombreux après une perte — une présence
          supplémentaire peut aider à rompre le silence.
        </P>
        <P>
          C'est ce que nous proposons chez Aicoute : des appels téléphoniques réguliers, une
          conversation chaleureuse au rythme de votre parent, et un compte-rendu qui vous rassure sur la
          façon dont il traverse cette période.
        </P>
        <Callout label="En toute honnêteté">
          <p>
            Aicoute n'apaise pas un deuil, et ne remplace ni votre présence ni celle de vos proches. Ce
            n'est pas sa vocation. Sa place est plus modeste : une présence de plus dans la semaine, là
            où le silence s'était installé.
          </p>
        </Callout>
      </Section>

      <ConseilsCTA />
    </>
  )
}

export function ParentVeufPage() {
  return (
    <GuidePage
      seo={{
        title: 'Aider un parent veuf à ne pas rester seul | Aicoute',
        description:
          "Votre père ou votre mère vient de perdre son conjoint ? Comment l'accompagner, repérer les signes d'isolement et maintenir une présence sans l'étouffer.",
        canonical: 'https://www.aicoute.fr/conseils/aider-parent-veuf-isolement',
      }}
      tag={GUIDE_META.veuf.tag}
      minutes={GUIDE_META.veuf.minutes}
      breadcrumbLabel="Parent veuf, isolement"
      h1="Aider un parent qui vient de perdre son conjoint à ne pas rester seul"
      lead={lead}
      heroImage="/conseils/the-fenetre.jpg"
      heroAlt="Une tasse de thé tenue près d'une fenêtre baignée d'une lumière dorée"
      articleHeadline="Aider un parent qui vient de perdre son conjoint à ne pas rester seul"
      articleImage="https://www.aicoute.fr/conseils/the-fenetre.jpg"
      related={[GUIDE_META.isolement, GUIDE_META.parentSeul]}
    >
      <VeufBody />
    </GuidePage>
  )
}
