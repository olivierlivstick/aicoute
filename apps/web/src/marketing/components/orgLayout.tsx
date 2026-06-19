// Gabarit commun aux pages « Organisations » (hub + spokes : /organisations,
// /etablissements, /municipalites, /assurances). Primitives de section reprenant
// à l'identique le système visuel de /etablissements (conteneur max-w-container,
// alternance crème / crème-sable / brun, surtitre + titre Fraunces), + le bloc de
// réassurance commun, le back-link vers le hub, le placeholder d'image (visuels
// licenciés fournis plus tard — PAS d'IA générative) et le hook SEO best-effort.
import { useEffect, type ReactNode } from 'react'
import { Icon } from '@/marketing/components/icons'

/* ------------------------------------------------------------------ SEO -- */
// Met à jour title + canonical + og/twitter au montage et restaure au démontage
// (les pages ne sont pas prérendues). Même logique que /etablissements.
export type MarketingMeta = { title: string; description: string; canonical: string }

export function useMarketingSeo(meta: MarketingMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = meta.title

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

    apply('meta[name="description"]', 'content', meta.description)
    apply('link[rel="canonical"]', 'href', meta.canonical)
    apply('meta[property="og:url"]', 'content', meta.canonical)
    apply('meta[property="og:title"]', 'content', meta.title)
    apply('meta[property="og:description"]', 'content', meta.description)
    apply('meta[name="twitter:title"]', 'content', meta.title)
    apply('meta[name="twitter:description"]', 'content', meta.description)

    return () => {
      document.title = prevTitle
      restorers.forEach((r) => r())
    }
  }, [meta.title, meta.description, meta.canonical])
}

/* -------------------------------------------------------------- SECTION -- */
type Tone = 'creme' | 'sable' | 'dark'

const TONE_BG: Record<Tone, string> = {
  creme: 'bg-creme',
  sable: 'bg-creme-sable',
  dark: 'bg-brun-900 text-creme',
}

export function OrgSection({
  tone = 'creme',
  id,
  className = '',
  children,
}: {
  tone?: Tone
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} className={`${TONE_BG[tone]} py-20 md:py-28 ${className}`}>
      <div className="max-w-container mx-auto px-6 lg:px-8">{children}</div>
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  maxW = 'max-w-2xl',
  dark = false,
}: {
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  maxW?: string
  dark?: boolean
}) {
  return (
    <div className={maxW}>
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-serif font-normal text-3xl md:text-4xl leading-[1.15] text-balance ${
          dark ? 'text-creme' : 'text-brun-900'
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={`mt-6 text-lg leading-relaxed text-pretty ${
            dark ? 'text-creme/80' : 'text-brun-700'
          }`}
        >
          {intro}
        </p>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- BACK-LINK -- */
// Retour vers le hub /organisations, en tête de chaque page spoke.
export function OrgBackLink({ className = '' }: { className?: string }) {
  return (
    <a
      href="/organisations"
      className={`inline-flex items-center gap-1.5 text-sm text-terracotta-dark font-medium link-underline ${className}`}
    >
      <Icon.ArrowRight size={15} className="rotate-180" />
      Toutes nos offres pour les organisations
    </a>
  )
}

/* --------------------------------------------------- IMAGE PLACEHOLDER -- */
// Emplacement d'un visuel RÉEL et licencié, à fournir plus tard (registre sobre et
// digne). Aucune image IA générative dans ce secteur sensible.
export function OrgImagePlaceholder({
  ratio = 'aspect-[4/5]',
  label,
  className = '',
}: {
  ratio?: string
  label: string
  className?: string
}) {
  return (
    <div
      className={`relative ${ratio} w-full rounded-xl border-2 border-dashed border-terracotta/25 bg-creme-sable/60 flex items-center justify-center p-6 ${className}`}
      role="img"
      aria-label={`Emplacement d'image : ${label}`}
    >
      <div className="text-center max-w-xs">
        <Icon.Eye size={26} className="mx-auto text-terracotta/50" />
        <p className="mt-3 text-sm text-brun-700/70 leading-snug">
          Visuel à insérer — {label}
        </p>
        <p className="mt-1 text-xs text-brun-700/50">
          Photo réelle licenciée (pas d'image générée)
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- HERO IMAGE -- */
// Visuel de hero (même habillage que le hero de /etablissements : lueur dorée +
// coins arrondis). Ratio naturel de l'image (h-auto) → aucun rognage du mockup.
export function OrgHeroImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Soleil chaud en arrière-plan */}
      <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-ocre/35 blur-2xl" />
      <div className="relative rounded-xl overflow-hidden w-full shadow-sm">
        <img src={src} alt={alt} className="w-full h-auto" loading="eager" />
      </div>
    </div>
  )
}

/* ------------------------------------------------ RÉASSURANCE COMMUNE -- */
// Bloc partagé par toutes les pages Organisations : ce qui ne change pas d'un
// métier à l'autre. Les {{…}} sont des placeholders de contenu à compléter.
export function OrgReassurance() {
  const items = [
    {
      Icon: Icon.Bell,
      title: 'Une détection, pas seulement des appels.',
      text: "Aicoute repère les signaux faibles dans les échanges et les non-réponses, et déclenche une remontée d'alerte vers les bons contacts.",
    },
    {
      Icon: Icon.Hand,
      title: "L'humain au centre.",
      text: "Aicoute ne remplace ni vos équipes ni le lien familial : c'est un renfort qui prend en charge les appels réguliers, pour que l'attention humaine se concentre là où elle compte vraiment.",
    },
    {
      Icon: Icon.Lock,
      title: 'Vos données protégées.',
      text: 'Hébergement et traitement conformes au RGPD, confidentialité stricte des échanges. {{Préciser hébergeur / engagement}}',
    },
    {
      Icon: Icon.Heart,
      title: 'Une équipe française, joignable.',
      text: '{{1 phrase sur la société / le sérieux}}',
    },
  ]

  return (
    <OrgSection tone="creme">
      <SectionHeader
        eyebrow="Ce qui ne change pas"
        title="Une même exigence, quel que soit votre métier."
      />
      <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
        {items.map(({ Icon: ItemIcon, title, text }) => (
          <div key={title}>
            <ItemIcon size={32} className="text-terracotta" />
            <h3 className="mt-5 font-sans font-medium text-lg text-brun-900 text-balance">
              {title}
            </h3>
            <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
          </div>
        ))}
      </div>
    </OrgSection>
  )
}
