// Page « Collectivités » (/municipalites) — mairies / CCAS. Héros = prévention +
// veille + protocole d'alerte (ce n'est PAS de la compagnie : c'est de la veille
// fiable). CTA = démo/contact, jamais self-service. Gabarit commun (orgLayout) +
// réassurance commune + formulaire partagé. JSON-LD : Organization global de
// index.html (pas d'injection par page).
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'
import {
  OrgSection,
  SectionHeader,
  OrgBackLink,
  OrgReassurance,
  OrgImagePlaceholder,
  useMarketingSeo,
} from '@/marketing/components/orgLayout'
import { OrganisationContact } from '@/marketing/components/OrganisationContact'

const META = {
  title:
    'Veille téléphonique des aînés vulnérables | Aicoute pour les communes et CCAS',
  description:
    "Campagnes d'appels de prévention canicule et grand froid, veille toute l'année, détection des situations à risque. Aicoute, un renfort fiable pour la veille des personnes âgées isolées de votre commune.",
  canonical: 'https://www.aicoute.fr/municipalites',
}

const ACTIONS = [
  {
    Icon: Icon.Bell,
    title: "Des campagnes d'appels de prévention",
    text: "Déclenchez une campagne en cas de canicule, de grand froid ou d'épisode à risque : Aicoute appelle les personnes inscrites, prend de leurs nouvelles, rappelle les bons gestes.",
  },
  {
    Icon: Icon.Calendar,
    title: "Une veille toute l'année, pas seulement pendant les alertes",
    text: "Au-delà des pics, Aicoute maintient un lien régulier avec les aînés isolés de votre territoire. Rompre la solitude ne se fait pas qu'en été.",
  },
  {
    Icon: Icon.Eye,
    title: 'Une détection des situations à risque',
    text: "À chaque appel, Aicoute repère les signaux faibles — une voix qui inquiète, des propos préoccupants, une non-réponse répétée — et fait remonter une alerte vers les contacts que vous définissez (proche, agent d'astreinte, service compétent). Vous gardez la main sur la chaîne d'intervention : Aicoute détecte et alerte, votre commune décide et agit.",
  },
]

export function MunicipalitesPage() {
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
                  Pour les communes &amp; CCAS
                </span>
                <h1 className="font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.1] text-balance">
                  Veiller sur vos aînés vulnérables,{' '}
                  <span className="italic text-terracotta-dark">
                    même quand les appels se comptent par centaines.
                  </span>
                </h1>
                <p className="mt-6 text-xl text-brun-700 leading-relaxed text-pretty">
                  Lorsqu'une alerte canicule est déclenchée, votre CCAS doit
                  contacter chaque personne inscrite au registre — chaque jour, le
                  temps que dure l'alerte. Sur une commune de quelque taille, cela
                  représente des centaines d'appels quotidiens qu'aucune équipe ne
                  peut absorber seule.
                </p>
                <p className="mt-5 text-lg text-brun-900 font-medium leading-relaxed text-pretty">
                  Aicoute prend en charge ces appels, repère les personnes qui vont
                  moins bien, et vous les signale.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <a
                    href="#contact-municipalites"
                    className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
                  >
                    Demander une démo
                  </a>
                </div>
                <p className="mt-6 text-sm text-brun-700/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Conforme RGPD &amp; IA Act</span>
                  <span className="text-brun-700/40">·</span>
                  <span>Conçu en France</span>
                  <span className="text-brun-700/40">·</span>
                  <span>Sans installation matérielle</span>
                </p>
              </div>
              <div className="order-1 md:order-2">
                <OrgImagePlaceholder
                  ratio="aspect-[4/5] md:aspect-[5/6]"
                  label="aîné·e au téléphone / agent de CCAS / mairie — registre digne"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Obligation + défi */}
        <OrgSection tone="sable">
          <SectionHeader
            eyebrow="Une obligation, un vrai défi opérationnel"
            title="Une mission de veille que le terrain rend difficile à tenir."
            intro={
              <>
                Le maire a l'obligation de tenir un registre communal des personnes
                vulnérables (article L. 121-6-1 du Code de l'action sociale et des
                familles), afin d'assurer une veille en cas de plan d'alerte et
                d'urgence. Sur le terrain, cette veille repose souvent sur quelques
                agents qui appellent un à un. Aicoute leur donne les moyens de tenir
                cette mission, à l'échelle.
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* Ce qu'Aicoute fait */}
        <OrgSection tone="creme">
          <SectionHeader
            eyebrow="Ce qu'Aicoute fait pour votre commune"
            title="Des appels pris en charge, des alertes qui remontent au bon endroit."
          />
          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {ACTIONS.map(({ Icon: ActionIcon, title, text }) => (
              <div
                key={title}
                className="bg-white border border-creme-sable rounded-xl p-7 flex flex-col gap-3"
              >
                <span className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
                  <ActionIcon size={24} />
                </span>
                <h3 className="mt-2 font-sans font-medium text-xl text-brun-900 text-balance">
                  {title}
                </h3>
                <p className="text-brun-700 leading-relaxed text-pretty">{text}</p>
              </div>
            ))}
          </div>
        </OrgSection>

        {/* Renfort, pas remplacement */}
        <OrgSection tone="dark">
          <SectionHeader
            dark
            title={
              <>
                Un renfort, <span className="italic text-ocre">pas un remplacement.</span>
              </>
            }
            intro={
              <>
                Aicoute ne remplace ni vos agents ni le contact humain. Il absorbe le
                volume d'appels réguliers pour que vos équipes se concentrent sur les
                situations qui exigent une présence humaine. La technologie au service
                de votre veille — pas à sa place.
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* Données */}
        <OrgSection tone="creme">
          <SectionHeader
            eyebrow="Vos données, la confiance d'abord"
            title="Le registre a une finalité encadrée. Aicoute la respecte."
            intro={
              <>
                Les données du registre ont une finalité strictement encadrée par la
                loi. Aicoute les traite dans ce cadre, avec un hébergement et des
                engagements conformes au RGPD, et la confidentialité des échanges.{' '}
                {'{{Préciser hébergeur + contrat de sous-traitance / DPA}}'}
              </>
            }
            maxW="max-w-3xl"
          />
        </OrgSection>

        {/* Pourquoi cela compte */}
        <OrgSection tone="sable">
          <SectionHeader
            eyebrow="Pourquoi cela compte"
            title="L'isolement des plus fragiles a un prix. La veille le réduit."
            maxW="max-w-3xl"
          />
          <div className="mt-8 max-w-3xl space-y-5 text-lg text-brun-700 leading-relaxed text-pretty">
            <p>
              L'été 2003 a rappelé le prix de l'isolement : près de{' '}
              <strong className="text-brun-900">15 000 personnes</strong>, en grande
              majorité âgées et isolées, sont décédées en France pendant la canicule.{' '}
              {'{{SOURCE à citer — Santé publique France / Inserm}}'} Depuis, la veille
              des plus fragiles est un devoir — et un défi qui grandit avec le
              vieillissement et la multiplication des épisodes extrêmes.
            </p>
            <p className="text-brun-700/80">
              {"{{Insérer ici ta statistique d'isolement actuelle (celle déjà utilisée sur le site) — sourcing à finaliser plus tard}}"}
            </p>
          </div>
        </OrgSection>

        {/* Réassurance commune */}
        <OrgReassurance />

        {/* Contact / démo */}
        <OrganisationContact
          anchorId="contact-municipalites"
          eyebrow="Voir Aicoute en conditions réelles"
          title="Parlons de la veille de votre commune."
          intro="Dites-nous quelques mots de votre territoire et de votre registre. Réponse sous 48 h ouvrées."
          messageHeading="— Demande COLLECTIVITÉ / CCAS —"
          orgLabel="Commune / CCAS"
          orgPlaceholder="Mairie de…, CCAS de…"
          messagePlaceholder="Parlez-nous de votre commune et de votre besoin de veille."
          submitLabel="Demander une démo"
        />
      </main>
      <Footer />
    </div>
  )
}
