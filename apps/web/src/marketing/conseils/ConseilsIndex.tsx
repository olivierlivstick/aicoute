// Page hub /conseils — refonte éditoriale.
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'
import {
  useConseilsSeo,
  Breadcrumb,
  Eyebrow,
  GuideCard,
  WaveMotif,
  GUIDE_META,
} from '@/marketing/conseils/ConseilsLayout'

const GUIDES = [GUIDE_META.parentSeul, GUIDE_META.veuf, GUIDE_META.culpabilite]

function HubHero() {
  return (
    <section>
      <div className="grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="order-2 md:order-1">
          <Eyebrow>Conseils aux aidants</Eyebrow>
          <h1 className="mt-4 font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.08] text-balance">
            Accompagner un proche âgé,{' '}
            <span className="text-terracotta-dark italic">sans jamais le faire seul.</span>
          </h1>
          <p className="mt-6 text-lg text-brun-700 leading-relaxed text-pretty">
            Rester présent à distance, aider après la perte d'un conjoint, composer avec la culpabilité
            de ne jamais en faire assez… Des conseils concrets et honnêtes, pensés pour les proches
            aidants — y compris quand ils ne passent pas par nous.
          </p>
          <div className="mt-7 flex items-center gap-5">
            <a
              href="#guides"
              className="inline-flex items-center gap-1.5 bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
            >
              Voir nos guides
              <Icon.ArrowRight size={16} />
            </a>
            <span className="text-sm text-brun-700/70">4 guides · lecture honnête</span>
          </div>
        </div>

        <div className="order-1 md:order-2 relative">
          <div className="relative rounded-2xl overflow-hidden border border-creme-sable aspect-[5/4]">
            <img
              src="/hero-etablissements.jpg"
              alt="Une femme âgée souriante au téléphone, près d'une plante verte, dans une lumière douce"
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-brun-900/15 to-transparent"
              aria-hidden="true"
            />
          </div>
          <div className="absolute -bottom-5 -left-3 sm:left-6 bg-creme rounded-xl border border-creme-sable shadow-sm px-5 py-3.5 max-w-[230px]">
            <div className="flex items-center gap-2 text-xs text-brun-700/80">
              <Icon.Phone size={13} className="text-terracotta" /> Dernier appel — mardi
            </div>
            <p className="mt-1 font-serif text-brun-900 leading-snug text-[17px]">
              «&nbsp;Mes rosiers ont fleuri&nbsp;!&nbsp;»
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function HubIntro() {
  return (
    <section className="max-w-3xl">
      <p className="text-brun-700 leading-relaxed text-pretty text-[17px]">
        Accompagner un parent qui vieillit, surtout quand il vit seul, soulève beaucoup de questions et
        peu de réponses simples. Vous trouverez ici des solutions humaines, des dispositifs existants et
        des repères pratiques. Parce que notre conviction, chez Aicoute, est simple :{' '}
        <span className="text-brun-900 font-medium">
          la lutte contre l'isolement des aînés ne se résume jamais à un seul outil.
        </span>
      </p>
    </section>
  )
}

function PillarCard() {
  return (
    <a
      href={GUIDE_META.isolement.href}
      className="group relative block overflow-hidden rounded-2xl bg-terracotta text-creme p-8 md:p-10"
    >
      <WaveMotif className="absolute -right-4 top-4 w-72 h-24 pointer-events-none" stroke="#FBF5EE" opacity={0.16} />
      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-medium text-creme/85 border border-creme/30 rounded-full px-3 py-1">
          <Icon.ShieldCheck size={13} /> Guide complet
        </span>
        <h3 className="mt-5 font-serif font-normal text-creme text-[26px] md:text-3xl leading-[1.15] text-balance">
          Rompre l'isolement d'une personne âgée : les solutions qui existent vraiment
        </h3>
        <p className="mt-4 text-creme/85 leading-relaxed text-pretty md:text-lg">
          Le tour d'horizon complet : visites, associations, aide à domicile, téléassistance, appels
          réguliers. Toutes les pistes, leurs forces et leurs limites.
        </p>
        <div className="mt-7 flex items-center gap-5">
          <span className="inline-flex items-center gap-2 bg-creme text-terracotta-dark px-5 py-3 rounded-md font-medium transition-transform group-hover:translate-x-0.5">
            Lire le guide pilier
            <Icon.ArrowRight size={16} />
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-creme/80">
            <Icon.Clock size={14} />6 min de lecture
          </span>
        </div>
      </div>
    </a>
  )
}

function HubGuides() {
  return (
    <section id="guides" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <Eyebrow>Nos guides</Eyebrow>
          <h2 className="mt-2.5 font-serif font-normal text-brun-900 text-3xl md:text-4xl leading-tight text-balance">
            Par où commencer ?
          </h2>
        </div>
        <p className="text-brun-700/80 text-pretty max-w-sm text-[15px]">
          Commencez par le guide complet, ou allez droit à votre situation.
        </p>
      </div>

      <div className="mt-9">
        <PillarCard />
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-6">
        {GUIDES.map((g) => (
          <GuideCard key={g.title} {...g} />
        ))}
      </div>
    </section>
  )
}

function HubPlace() {
  return (
    <section>
      <div className="rounded-2xl border border-creme-sable bg-creme-sable/50 p-8 md:p-12 grid md:grid-cols-[1.3fr_1fr] gap-9 items-center">
        <div>
          <Eyebrow>Notre place dans tout ça</Eyebrow>
          <h2 className="mt-2.5 font-serif font-normal text-brun-900 text-2xl md:text-3xl leading-snug text-balance">
            Un complément à votre présence,{' '}
            <span className="italic text-terracotta-dark">jamais un remplaçant.</span>
          </h2>
          <p className="mt-5 text-brun-700 leading-relaxed text-pretty text-[17px]">
            Aicoute propose des appels téléphoniques réguliers à votre proche, et un compte-rendu qui
            vous tient informé de comment il va. Nous le disons sans détour : nous ne remplaçons ni vos
            appels, ni vos visites, ni personne. Notre rôle est de compléter votre présence sur les
            jours où vous ne pouvez pas être là.
          </p>
        </div>
        <div className="rounded-xl overflow-hidden border border-creme-sable aspect-[4/5] max-w-[280px] mx-auto md:mx-0 md:justify-self-end">
          <img
            src="/conseils/the-fenetre.jpg"
            alt="Une tasse de thé tenue près d'une fenêtre, lumière dorée, livres anciens"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}

export function ConseilsIndexPage() {
  useConseilsSeo({
    title: 'Conseils aux aidants : accompagner un proche âgé | Aicoute',
    description:
      "Des conseils concrets et honnêtes pour accompagner un parent âgé isolé : éloignement, deuil, culpabilité, solutions pour rompre la solitude et garder le lien.",
    canonical: 'https://www.aicoute.fr/conseils',
  })

  return (
    <div className="bg-creme min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-container mx-auto px-6 lg:px-8 pt-7">
          <Breadcrumb items={[{ label: 'Accueil', href: '/' }, { label: 'Conseils' }]} />
        </div>

        <div className="max-w-container mx-auto px-6 lg:px-8 pt-10 md:pt-14 pb-6">
          <HubHero />
        </div>

        <div className="max-w-container mx-auto px-6 lg:px-8 py-12 md:py-16 space-y-14 md:space-y-20">
          <HubIntro />
          <HubGuides />
          <HubPlace />
        </div>
      </main>
      <Footer />
    </div>
  )
}
