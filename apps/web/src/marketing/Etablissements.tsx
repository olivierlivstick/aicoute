// Page B2B « Établissements » (/etablissements) — EHPAD, maisons de retraite,
// résidences. Reprend à l'identique le système visuel de la home (Header/Footer
// partagés, mêmes tokens, mêmes primitives de section : surtitre + titre +
// paragraphe, cartes numérotées 01/02/03, grille de bénéfices, section
// « engagement » à 4 blocs). Aucun CTA ne pointe vers l'inscription self-service ;
// tout converge vers le formulaire B2B #contact-etablissements.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClass =
  'w-full px-4 py-3 rounded-md border border-creme-sable bg-white text-brun-900 placeholder:text-brun-700/40 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60'

// SEO / métadonnées de la page (best-effort côté client : la page n'est pas
// prérendue, on met à jour title + canonical + og/twitter au montage et on
// restaure les valeurs de la home au démontage).
const META = {
  title:
    'Aicoute pour les établissements — une présence qui écoute chacun de vos résidents',
  description:
    "Aicoute propose aux EHPAD, maisons de retraite et résidences une présence vocale qui prend le temps d'écouter chaque résident, en complément des équipes. Déploiement simple, conforme RGPD et IA Act. Demandez une présentation.",
  canonical: 'https://www.aicoute.fr/etablissements',
}

export function EtablissementsPage() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = META.title

    const restorers: Array<() => void> = []
    const apply = (selector: string, attr: 'content' | 'href', value: string) => {
      const el = document.head.querySelector<HTMLElement>(selector)
      if (!el) return
      const prev = el.getAttribute(attr)
      el.setAttribute(attr, value)
      restorers.push(() => {
        if (prev === null) el.removeAttribute(attr)
        else el.setAttribute(attr, prev)
      })
    }

    apply('meta[name="description"]', 'content', META.description)
    apply('link[rel="canonical"]', 'href', META.canonical)
    apply('meta[property="og:url"]', 'content', META.canonical)
    apply('meta[property="og:title"]', 'content', META.title)
    apply('meta[property="og:description"]', 'content', META.description)
    apply('meta[name="twitter:title"]', 'content', META.title)
    apply('meta[name="twitter:description"]', 'content', META.description)

    return () => {
      document.title = prevTitle
      restorers.forEach((r) => r())
    }
  }, [])

  return (
    <div className="bg-creme">
      <Header />
      <main>
        <Hero />
        <Probleme />
        <Deploiement />
        <Benefices />
        <NeRemplacePersonne />
        <CadreEthique />
        <Modele />
        <Pilote />
        <ContactEtablissements />
      </main>
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ HERO -- */
function Hero() {
  return (
    <section className="bg-creme">
      <div className="max-w-container mx-auto px-6 lg:px-8 pt-12 md:pt-20 pb-20 md:pb-28">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* Colonne texte */}
          <div className="order-2 md:order-1">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-6">
              <span className="w-6 h-px bg-terracotta-dark/40" />
              Pour les établissements accueillant des personnes âgées
            </span>

            <h1 className="font-serif font-normal text-brun-900 text-4xl md:text-5xl leading-[1.1] text-balance">
              Du temps de conversation pour chacun de vos résidents —{' '}
              <span className="italic text-terracotta-dark">
                sans alourdir vos équipes.
              </span>
            </h1>

            <p className="mt-6 text-xl text-brun-700 leading-relaxed max-w-xl text-pretty">
              Vos soignants et animateurs font déjà l'essentiel. Aicoute vient en
              complément&nbsp;: une présence vocale disponible chaque jour, qui
              prend le temps d'écouter chaque résident, se souvient de son
              histoire, et restitue à vos équipes ce qui compte. Pour que personne
              ne passe une journée sans une vraie conversation.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href="#contact-etablissements"
                className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
              >
                Demander une présentation
              </a>
              <a
                href="#deploiement"
                className="inline-flex items-center gap-1.5 text-terracotta-dark font-medium link-underline"
              >
                Voir comment ça s'intègre
                <Icon.ArrowRight size={16} />
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

          {/* Colonne image */}
          <div className="order-1 md:order-2">
            <HeroPhoto />
          </div>
        </div>
      </div>
    </section>
  )
}

// Photo du hero B2B — `public/hero-etablissements.jpg` cadrée en portrait, lueur
// dorée derrière et carte flottante « Compte-rendu transmis ». Même habillage que
// le hero de la home.
function HeroPhoto() {
  return (
    <div className="relative">
      {/* Soleil chaud en arrière-plan */}
      <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-ocre/35 blur-2xl" />

      <div className="relative rounded-xl overflow-hidden aspect-[4/5] md:aspect-[5/6] w-full shadow-sm">
        <img
          src="/hero-etablissements.jpg"
          alt="Une résidente âgée souriante, au téléphone, dans un salon lumineux"
          className="w-full h-full object-cover object-[32%_center]"
          loading="eager"
        />
        {/* Lueur dorée bas pour fondre la carte flottante */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-terracotta/15 to-transparent" />
      </div>

      {/* Carte flottante — la valeur côté équipe */}
      <div className="hidden md:flex absolute -left-6 bottom-10 bg-creme border border-creme-sable rounded-xl p-4 pr-5 items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-creme-sable flex items-center justify-center text-terracotta">
          <Icon.Mail size={20} />
        </div>
        <div>
          <p className="text-xs text-brun-700">Après chaque appel</p>
          <p className="font-serif text-base text-brun-900 leading-tight mt-0.5 whitespace-nowrap">
            Compte-rendu transmis à l'équipe
          </p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- PROBLÈME -- */
function Probleme() {
  // Constats qualitatifs, sans chiffre non sourcé.
  const constats = [
    "Une grande partie du temps soignant est absorbée par les soins et la logistique, laissant peu de place à la relation.",
    "Les fins de journée et les week-ends concentrent les moments de solitude ressentie.",
    // [SOURCE À AJOUTER] — claim factuel à étayer par une référence avant mise en avant publique.
    "La conversation individualisée reste l'un des facteurs les plus protecteurs face au déclin cognitif et à la dépression du grand âge.",
  ]

  return (
    <section className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            La réalité du quotidien en établissement
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Entourés, mais pas toujours écoutés.
          </h2>
          <p className="mt-6 text-lg text-brun-700 leading-relaxed text-pretty">
            Vos équipes sont mobilisées du matin au soir. Mais entre les soins,
            les repas et la logistique, le temps de la conversation — celle qui
            n'a pas d'autre but qu'écouter — est le premier à manquer. Les
            après-midi s'étirent, les soirées et les week-ends sont plus calmes,
            et certains résidents passent des journées entières sans un échange
            qui les concerne vraiment, eux, leur jardin d'avant, leurs
            petits-enfants, leurs souvenirs.
          </p>
        </div>

        <ul className="mt-12 grid md:grid-cols-3 gap-8">
          {constats.map((text) => (
            <li
              key={text}
              className="bg-white border border-creme-sable rounded-xl p-7 flex flex-col gap-3"
            >
              <span className="w-9 h-9 rounded-full bg-creme flex items-center justify-center text-terracotta">
                <Icon.Heart size={18} />
              </span>
              <p className="text-brun-700 leading-relaxed text-pretty">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- DÉPLOIEMENT -- */
function Deploiement() {
  const steps = [
    {
      num: '01',
      Icon: Icon.UserPlus,
      title: 'Vous nous présentez vos résidents',
      text:
        "Avec votre équipe d'animation ou les familles, vous renseignez le profil de chaque résident participant : son histoire, ses centres d'intérêt, ses sujets sensibles à éviter. Plus le contexte est riche, plus la conversation est juste.",
    },
    {
      num: '02',
      Icon: Icon.Phone,
      title: 'Aicoute appelle, et reste joignable',
      text:
        "Chaque résident reçoit des appels réguliers, aux créneaux que vous définissez (y compris les plages creuses : fin d'après-midi, soirée, week-end). Et quand l'envie de parler le prend, il peut appeler Aicoute lui-même, depuis un téléphone de la chambre ou un poste dédié.",
    },
    {
      num: '03',
      Icon: Icon.Mail,
      title: 'Vos équipes reçoivent ce qui compte',
      text:
        "Après chaque échange, un compte-rendu sensible remonte à votre équipe : humeur, sujets abordés, et surtout les points de vigilance — un coup de moins bien, une douleur évoquée, une inquiétude. Aicoute ne décide rien : il éclaire vos soignants, qui gardent la main.",
    },
  ]

  return (
    <section id="deploiement" className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Un déploiement simple, pensé pour vos équipes
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Aucune installation. Aucun matériel. Une mise en route en quelques
            jours.
          </h2>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-12 md:gap-10 relative">
          {/* fil reliant les 3 étapes en desktop */}
          <div
            className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-creme-sable"
            style={{
              background:
                'repeating-linear-gradient(to right, #C75D3A33 0 6px, transparent 6px 12px)',
            }}
            aria-hidden="true"
          />

          {steps.map(({ num, Icon: StepIcon, title, text }) => (
            <div key={num} className="relative">
              <div className="bg-creme rounded-full w-16 h-16 flex items-center justify-center text-terracotta border border-creme-sable relative z-10">
                <StepIcon size={26} />
              </div>
              <p className="mt-6 font-serif text-2xl text-ocre">{num}</p>
              <h3 className="mt-2 font-sans text-xl font-medium text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- BÉNÉFICES -- */
function Benefices() {
  const items = [
    {
      Icon: Icon.Heart,
      title: 'Pour vos résidents',
      text:
        "Une écoute patiente, individualisée, qui se souvient d'eux et ne se lasse jamais. Du lien, même aux heures où l'établissement est plus calme.",
    },
    {
      Icon: Icon.Hand,
      title: 'Pour vos équipes',
      text:
        "Pas une charge de plus, un soulagement : Aicoute prend en charge le temps de conversation que vos soignants n'ont pas, et leur signale les points d'attention qu'ils n'auraient peut-être pas captés.",
    },
    {
      Icon: Icon.Mail,
      title: 'Pour les familles',
      text:
        "Une tranquillité nouvelle : elles peuvent recevoir, si vous le souhaitez, les mêmes résumés chaleureux que dans notre offre familiale. Un argument fort de réassurance et de différenciation pour votre établissement.",
    },
    {
      Icon: Icon.ShieldCheck,
      title: 'Pour votre direction',
      text:
        "Un marqueur concret de votre projet de vie et de votre démarche qualité : une innovation au service du lien, valorisable auprès des familles, des tutelles et lors des évaluations.",
    },
  ]

  return (
    <section className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Une seule présence, quatre bénéfices
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Le lien pour vos résidents, le soulagement pour vos équipes.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {items.map(({ Icon: ItemIcon, title, text }) => (
            <div
              key={title}
              className="bg-white border border-creme-sable rounded-xl p-8 transition-colors hover:border-terracotta/30"
            >
              <div className="w-12 h-12 rounded-lg bg-creme flex items-center justify-center text-terracotta">
                <ItemIcon size={26} />
              </div>
              <h3 className="mt-5 font-sans font-medium text-xl text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------- NE REMPLACE PERSONNE -- */
function NeRemplacePersonne() {
  return (
    <section className="bg-brun-900 text-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="font-serif font-normal text-3xl md:text-4xl leading-[1.15] text-balance">
            Aicoute ne remplace personne.{' '}
            <span className="italic text-ocre">C'est tout l'inverse.</span>
          </h2>
          <p className="mt-6 text-lg text-creme/80 leading-relaxed text-pretty">
            Nous sommes convaincus que rien ne vaut la présence d'un soignant,
            d'un animateur, d'un proche. Aicoute n'a pas vocation à occuper leur
            place — il occupe le vide qu'aucune équipe, aussi dévouée soit-elle,
            ne peut combler : les heures creuses, les conversations individuelles
            que le rythme d'un établissement ne permet pas toujours. En libérant
            un peu de ce temps de présence non médicale, nous redonnons à vos
            équipes la possibilité de se concentrer sur ce que seules elles
            peuvent faire : le soin, la relation incarnée, le geste humain.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- CADRE ÉTHIQUE -- */
function CadreEthique() {
  const cols = [
    {
      Icon: Icon.Eye,
      title: 'Transparence',
      text:
        "Chaque résident est informé dès le premier appel qu'il échange avec une IA. Aucune confusion, jamais.",
    },
    {
      Icon: Icon.Hand,
      title: 'Consentement',
      text:
        "La participation repose sur le consentement du résident, recueilli avec la famille ou la personne de confiance selon sa situation. Tout résident peut demander à tout moment à ne plus être appelé.",
    },
    {
      Icon: Icon.Lock,
      title: 'Données protégées',
      text:
        "Hébergement en Europe, conformité RGPD et IA Act, chiffrement des conversations. Vous restez responsable de traitement ; nous sommes votre sous-traitant, encadré par contrat.",
    },
    {
      Icon: Icon.Heart,
      title: "Articulation au projet d'accompagnement",
      text:
        "Aicoute s'inscrit dans le projet personnalisé du résident, en lien avec votre équipe, jamais à côté.",
    },
  ]

  return (
    <section className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Cadre éthique &amp; conformité
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Une technologie encadrée, à la hauteur de votre responsabilité.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
          {cols.map(({ Icon: ColIcon, title, text }) => (
            <div key={title}>
              <ColIcon size={32} className="text-terracotta" />
              <h3 className="mt-5 font-sans font-medium text-xl text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <a
            href="/charte-ethique"
            className="inline-flex items-center gap-1.5 text-terracotta-dark font-medium link-underline"
          >
            Lire notre charte éthique
            <Icon.ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- MODÈLE -- */
function Modele() {
  return (
    <section className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Une offre dimensionnée pour les établissements.
          </h2>
          <p className="mt-6 text-lg text-brun-700 leading-relaxed text-pretty">
            Pas de paiement à la minute comme pour les familles. Pour les
            établissements, nous proposons un forfait par résident participant,
            dégressif selon le volume, sans matériel à installer. Un
            accompagnement au déploiement et un interlocuteur dédié sont inclus.
          </p>
          <div className="mt-8">
            <a
              href="#contact-etablissements"
              className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
            >
              Demander un devis adapté à votre établissement
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- PILOTE -- */
function Pilote() {
  return (
    <section className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Commençons par un pilote.
          </h2>
          <p className="mt-6 text-lg text-brun-700 leading-relaxed text-pretty">
            Nous savons qu'on n'introduit pas une nouvelle présence dans un
            établissement à la légère. Nous vous proposons de démarrer par un
            pilote de quelques semaines sur un petit groupe de résidents
            volontaires, sans engagement, pour mesurer ensemble l'accueil, le
            bénéfice ressenti et l'intégration dans vos pratiques.
          </p>
          <div className="mt-8">
            <a
              href="#contact-etablissements"
              className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
            >
              Mettre en place un pilote
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------- CONTACT B2B (formulaire) -- */
type Status = 'idle' | 'sending' | 'sent' | 'error'

function ContactEtablissements() {
  const [nom, setNom] = useState('')
  const [fonction, setFonction] = useState('')
  const [etablissement, setEtablissement] = useState('')
  const [residents, setResidents] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot anti-spam : même dispositif que le formulaire de contact de la home.
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const sending = status === 'sending'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nom.trim() || !etablissement.trim() || !email.trim() || !message.trim()) {
      setError('Merci de renseigner au minimum votre nom, votre établissement, votre email et un message.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Votre adresse email semble incorrecte.')
      return
    }

    // On réutilise l'Edge Function `contact-form` (mêmes champs firstName/lastName/
    // email/message + honeypot). Les champs B2B sont assemblés dans le message pour
    // arriver dans l'email sans modifier le backend déjà déployé.
    const parts = nom.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '—'

    const composedMessage =
      `— Demande ÉTABLISSEMENT (B2B) —\n\n` +
      `Nom : ${nom.trim()}\n` +
      `Fonction : ${fonction.trim() || '—'}\n` +
      `Établissement : ${etablissement.trim()}\n` +
      `Nombre de résidents (approx.) : ${residents.trim() || '—'}\n` +
      `Téléphone : ${telephone.trim() || '—'}\n\n` +
      `Message :\n${message.trim()}`

    setStatus('sending')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('contact-form', {
        body: {
          firstName,
          lastName,
          email: email.trim(),
          message: composedMessage,
          company, // honeypot — doit rester vide
        },
      })
      if (invokeError || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error ?? invokeError?.message)
      }
      setStatus('sent')
      setNom('')
      setFonction('')
      setEtablissement('')
      setResidents('')
      setEmail('')
      setTelephone('')
      setMessage('')
    } catch {
      setStatus('error')
      setError("L'envoi a échoué. Réessayez dans un instant ou écrivez-nous à contact@aicoute.fr.")
    }
  }

  return (
    <section id="contact-etablissements" className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:sticky md:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
              Parlons de votre établissement
            </p>
            <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
              Offrez à chacun de vos résidents une voix qui prend le temps.
            </h2>
            <p className="mt-5 text-brun-700 leading-relaxed">
              Parlons de votre établissement, de vos résidents, et de la façon
              dont Aicoute peut s'y intégrer. Réponse sous 48&nbsp;h ouvrées.
            </p>
            <p className="mt-4 text-brun-700">
              <a
                href="mailto:contact@aicoute.fr"
                className="text-terracotta-dark link-underline font-medium"
              >
                contact@aicoute.fr
              </a>
            </p>
          </div>

          <div className="md:col-span-2">
            {status === 'sent' ? (
              <div className="bg-white rounded-xl border border-creme-sable p-8 flex items-start gap-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-sauge/15 text-sauge flex items-center justify-center">
                  <Icon.Check size={20} />
                </span>
                <div>
                  <h3 className="text-brun-900 font-medium text-lg">Demande envoyée</h3>
                  <p className="mt-1 text-brun-700 leading-relaxed">
                    Merci&nbsp;! Votre demande est bien partie. Nous revenons vers
                    vous sous 48&nbsp;h ouvrées.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl border border-creme-sable p-6 md:p-8 space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="etab-nom" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Nom
                    </label>
                    <input
                      id="etab-nom"
                      type="text"
                      autoComplete="name"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Marie Dupont"
                    />
                  </div>
                  <div>
                    <label htmlFor="etab-fonction" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Fonction
                    </label>
                    <input
                      id="etab-fonction"
                      type="text"
                      autoComplete="organization-title"
                      value={fonction}
                      onChange={(e) => setFonction(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Directrice, cadre de santé, animatrice…"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="etab-etablissement" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Établissement
                    </label>
                    <input
                      id="etab-etablissement"
                      type="text"
                      autoComplete="organization"
                      value={etablissement}
                      onChange={(e) => setEtablissement(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Résidence Les Tilleuls"
                    />
                  </div>
                  <div>
                    <label htmlFor="etab-residents" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Nombre de résidents <span className="text-brun-700/60">(approximatif)</span>
                    </label>
                    <input
                      id="etab-residents"
                      type="text"
                      inputMode="numeric"
                      value={residents}
                      onChange={(e) => setResidents(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="Ex. 80"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="etab-email" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Email
                    </label>
                    <input
                      id="etab-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="marie.dupont@etablissement.fr"
                    />
                  </div>
                  <div>
                    <label htmlFor="etab-telephone" className="block text-sm font-medium text-brun-900 mb-1.5">
                      Téléphone
                    </label>
                    <input
                      id="etab-telephone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      disabled={sending}
                      className={inputClass}
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="etab-message" className="block text-sm font-medium text-brun-900 mb-1.5">
                    Message
                  </label>
                  <textarea
                    id="etab-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    className={`${inputClass} resize-none`}
                    placeholder="Parlez-nous de votre établissement et de votre projet."
                  />
                </div>

                {/* Honeypot — caché aux humains, leurré aux bots. Ne pas supprimer. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="etab-company">Société (laisser vide)</label>
                  <input
                    id="etab-company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-brique" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-creme font-medium px-6 py-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Envoi…' : 'Demander une présentation'}
                  {!sending && <Icon.ArrowRight size={18} />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
