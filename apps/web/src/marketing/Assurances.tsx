// Page « Assureurs & mutuelles » (/assurances) — B2B2C / marque blanche.
// Positionnement : « vous DISTRIBUEZ le service », argumentaire P&L (différenciation,
// rétention, prévention). Marque blanche CONFIRMÉE (présent OK) ; l'intégration en
// garantie assistance régulée reste un « partenariat à construire ». CTA = partenariat,
// jamais self-service. Gabarit commun + réassurance commune + formulaire partagé.
// JSON-LD : Organization global de index.html (pas d'injection par page).
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'
import {
  OrgSection,
  SectionHeader,
  OrgBackLink,
  OrgReassurance,
  OrgHeroImage,
  useMarketingSeo,
} from '@/marketing/components/orgLayout'
import { OrganisationContact } from '@/marketing/components/OrganisationContact'

const META = {
  title:
    'Intégrez un service de veille et de présence à vos garanties | Aicoute pour assureurs et assisteurs',
  description:
    "Enrichissez vos garanties assistance, dépendance et vieillesse d'un service de présence téléphonique et de veille relationnelle pour vos assurés âgés. En marque blanche, opéré par Aicoute.",
  canonical: 'https://www.aicoute.fr/assurances',
}

const APPORTS = [
  {
    Icon: Icon.Heart,
    title: 'Une garantie qui se ressent',
    text: "Un service récurrent, humain, émotionnellement tangible — là où l'assistance reste souvent invisible tant qu'il n'y a pas de sinistre.",
  },
  {
    Icon: Icon.Loop,
    title: 'De la rétention',
    text: "Un bénéfice que l'assuré (et son aidant) perçoit chaque semaine renforce l'attachement et la valeur de votre contrat.",
  },
  {
    Icon: Icon.Briefcase,
    title: 'Une montée en gamme naturelle',
    text: "En option premium ou en différenciation d'offre, Aicoute valorise vos garanties haut de gamme.",
  },
  {
    Icon: Icon.Hand,
    title: 'Une charge opérationnelle externalisée',
    text: "Vous n'avez ni à monter ni à opérer un plateau d'appels : Aicoute opère le service de bout en bout.",
  },
  {
    Icon: Icon.Bell,
    title: 'Un signal de prévention',
    text: "En repérant la fragilité avant la crise, Aicoute peut alimenter vos dispositifs d'assistance en amont. Agir tôt, c'est souvent agir moins cher.",
  },
]

export function AssurancesPage() {
  useMarketingSeo(META)

  return (
    <div className="bg-creme">
      <Header />
      <main>
        {/* Hero */}
        <section className="bg-creme">
          <div className="max-w-container mx-auto px-6 lg:px-8 pt-8 md:pt-12 pb-20 md:pb-28">
            <OrgBackLink className="mb-8" />
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="order-2 md:order-1">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-6">
                  <span className="w-6 h-px bg-terracotta-dark/40" />
                  Pour les assureurs, mutuelles &amp; assisteurs
                </span>
                <h1 className="font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.1] text-balance">
                  Un service de présence et de veille{' '}
                  <span className="italic text-terracotta-dark">
                    à intégrer à vos garanties.
                  </span>
                </h1>
                <p className="mt-6 text-xl text-brun-700 leading-relaxed text-pretty">
                  Le vieillissement et la perte d'autonomie redessinent les attentes
                  de vos assurés — et de leurs proches. Au-delà des prestations
                  ponctuelles, c'est un lien régulier qui rassure.
                </p>
                <p className="mt-5 text-lg text-brun-900 font-medium leading-relaxed text-pretty">
                  Aicoute est un service de présence téléphonique et de veille
                  relationnelle, conçu pour s'intégrer à vos garanties assistance,
                  dépendance ou vieillesse — sous votre marque.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <a
                    href="#contact-assurances"
                    className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
                  >
                    Discuter d'un partenariat
                  </a>
                </div>
                <p className="mt-6 text-sm text-brun-700/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Marque blanche</span>
                  <span className="text-brun-700/40">·</span>
                  <span>Opéré de bout en bout</span>
                  <span className="text-brun-700/40">·</span>
                  <span>Conforme RGPD &amp; IA Act</span>
                </p>
              </div>
              <div className="order-1 md:order-2">
                <OrgHeroImage
                  src="/organisations/aicoute-hero-assurances.png"
                  alt="Tableau de bord Aicoute « Appels & veille » : planning d'appels récurrents et signaux faibles remontés dans le dispositif d'assistance"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Ce que ça apporte */}
        <OrgSection tone="sable">
          <SectionHeader
            eyebrow="Ce que cela apporte à votre offre"
            title="Une garantie tangible, qui se vit entre deux sinistres."
          />
          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {APPORTS.map(({ Icon: ApportIcon, title, text }) => (
              <div
                key={title}
                className="bg-white border border-creme-sable rounded-xl p-8 transition-colors hover:border-terracotta/30"
              >
                <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
                  <ApportIcon size={26} />
                </div>
                <h3 className="mt-5 font-sans font-medium text-xl text-brun-900 text-balance">
                  {title}
                </h3>
                <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
              </div>
            ))}
          </div>
        </OrgSection>

        {/* Sous votre marque */}
        <OrgSection tone="dark">
          <SectionHeader
            dark
            eyebrow="Marque blanche"
            title={
              <>
                Sous <span className="italic text-ocre">votre marque.</span>
              </>
            }
            intro={
              <>
                Aicoute s'intègre en marque blanche : vos assurés vivent l'expérience
                sous votre identité, vous gardez la relation client.
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* La détection */}
        <OrgSection tone="creme">
          <SectionHeader
            eyebrow="La détection, au cœur du service"
            title="Pas seulement des appels : un dispositif de remontée d'alerte."
            intro={
              <>
                Comme pour tous nos publics, Aicoute ne se contente pas de passer des
                appels : il repère les signaux de fragilité et déclenche les remontées
                prévues dans votre dispositif.{' '}
                {"{{Articulation avec vos services d'assistance à définir ensemble}}"}
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* Construisons ensemble */}
        <OrgSection tone="sable">
          <SectionHeader
            eyebrow="Construisons ensemble"
            title="Un partenariat sur mesure, pas une brique en libre-service."
            intro={
              <>
                L'intégration à une offre assurantielle se conçoit sur mesure :
                périmètre, parcours, marque, articulation avec vos garanties
                existantes. Nous ne proposons pas une brique en libre-service, mais un
                partenariat — un cadrage, un pilote, puis un déploiement.
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* Réassurance commune */}
        <OrgReassurance />

        {/* Contact / partenariat */}
        <OrganisationContact
          anchorId="contact-assurances"
          eyebrow="Discutons de l'intégration à votre offre"
          title="Construisons votre service de présence, sous votre marque."
          intro="Dites-nous quelques mots de votre offre et de vos assurés. Réponse sous 48 h ouvrées."
          messageHeading="— Demande ASSUREUR / PARTENARIAT —"
          orgLabel="Compagnie / mutuelle / assisteur"
          orgPlaceholder="Nom de votre organisation"
          messagePlaceholder="Parlez-nous de votre offre et du partenariat envisagé."
          submitLabel="Être recontacté"
        />
      </main>
      <Footer />
    </div>
  )
}
