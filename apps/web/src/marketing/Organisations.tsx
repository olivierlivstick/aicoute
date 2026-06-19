// Hub « Organisations » (/organisations) — page LÉGÈRE : elle route vers les 3
// offres (Établissements / Collectivités / Assureurs) et rassure. Le SEO de fond
// vit sur les 3 pages spokes. Réutilise le gabarit commun (orgLayout) + le bloc de
// réassurance commun + le formulaire de contact partagé. JSON-LD : on s'appuie sur
// le bloc Organization global de index.html (pas d'injection par page).
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'
import {
  OrgSection,
  OrgReassurance,
  useMarketingSeo,
} from '@/marketing/components/orgLayout'
import { OrganisationContact } from '@/marketing/components/OrganisationContact'

const META = {
  title: 'Aicoute pour les organisations | Veille et présence pour les aînés',
  description:
    "Établissements, collectivités, assureurs : découvrez comment Aicoute aide les organisations à maintenir un lien humain et une veille fiable auprès des personnes âgées isolées.",
  canonical: 'https://www.aicoute.fr/organisations',
}

const OFFRES = [
  {
    href: '/etablissements',
    Icon: Icon.Home,
    audience: 'Vous accueillez des résidents',
    title: 'Établissements',
    text: "EHPAD, résidences services, résidences autonomie. Vos résidents sont entourés, et pourtant beaucoup souffrent de solitude relationnelle. Aicoute leur offre une présence d'écoute attentive, en complément de vos équipes.",
    cta: "Découvrir l'offre Établissements",
  },
  {
    href: '/municipalites',
    Icon: Icon.Users,
    audience: 'Vous protégez vos administrés',
    title: 'Collectivités',
    text: "Mairies, CCAS. Campagnes d'appels de prévention pendant les canicules et les grands froids, maintien du lien toute l'année, détection des situations à risque : un renfort fiable pour votre mission de veille auprès des aînés vulnérables.",
    cta: "Découvrir l'offre Collectivités",
  },
  {
    href: '/assurances',
    Icon: Icon.ShieldCheck,
    audience: 'Vous protégez vos assurés',
    title: 'Assureurs & mutuelles',
    text: "Mutuelles, assureurs, sociétés d'assistance. Enrichissez vos garanties assistance d'un service de présence et de veille relationnelle, intégré à votre offre, sous votre marque.",
    cta: "Découvrir l'offre Assureurs",
  },
]

export function OrganisationsPage() {
  useMarketingSeo(META)

  return (
    <div className="bg-creme">
      <Header />
      <main>
        {/* Hero — léger */}
        <OrgSection tone="creme">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-6">
              <span className="w-6 h-px bg-terracotta-dark/40" />
              Pour les organisations
            </span>
            <h1 className="font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.1] text-balance">
              Aicoute pour les organisations qui veillent sur{' '}
              <span className="italic text-terracotta-dark">leurs aînés.</span>
            </h1>
            <p className="mt-6 text-xl text-brun-700 leading-relaxed text-pretty">
              Maintenir un lien régulier avec des personnes âgées isolées — et
              repérer à temps celles qui vont moins bien — demande du temps, des
              appels, de la constance. Aicoute apporte ce lien à grande échelle, avec
              une détection des signaux de fragilité et une remontée d'alerte fiable.
            </p>
            <p className="mt-6 text-lg text-brun-700 leading-relaxed text-pretty">
              Selon votre métier, l'offre prend une forme différente&nbsp;:
            </p>
          </div>
        </OrgSection>

        {/* 3 offres */}
        <OrgSection tone="sable">
          <div className="grid md:grid-cols-3 gap-6">
            {OFFRES.map(({ href, Icon: OffreIcon, audience, title, text, cta }) => (
              <a
                key={href}
                href={href}
                className="group bg-white border border-creme-sable rounded-xl p-8 flex flex-col transition-colors hover:border-terracotta/40"
              >
                <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
                  <OffreIcon size={26} />
                </div>
                <p className="mt-5 text-xs uppercase tracking-[0.16em] text-terracotta-dark">
                  {audience}
                </p>
                <h2 className="mt-2 font-serif text-2xl text-brun-900 text-balance">
                  {title}
                </h2>
                <p className="mt-3 text-brun-700 leading-relaxed text-pretty flex-1">
                  {text}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-terracotta-dark font-medium">
                  {cta}
                  <Icon.ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </a>
            ))}
          </div>
        </OrgSection>

        {/* Réassurance commune */}
        <OrgReassurance />

        {/* Contact / mise en relation */}
        <OrganisationContact
          anchorId="contact-organisations"
          eyebrow="Parlons de votre projet"
          title="Découvrons ensemble ce qu'Aicoute peut apporter à votre organisation."
          intro="Dites-nous quelques mots de votre métier et de vos besoins. Réponse sous 48 h ouvrées."
          messageHeading="— Demande ORGANISATIONS —"
          orgLabel="Organisation"
          orgPlaceholder="Nom de votre organisation"
          messagePlaceholder="Parlez-nous de votre organisation et de votre projet."
          submitLabel="Être recontacté"
        />
      </main>
      <Footer />
    </div>
  )
}
