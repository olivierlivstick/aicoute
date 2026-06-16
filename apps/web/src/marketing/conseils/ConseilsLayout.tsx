// Système de la section éditoriale /conseils (vitrine) — refonte visuelle.
// Branche les vrais composants du site (Header/Footer/Icon marketing, tokens
// Tailwind de la charte) et expose les primitives de prose + cartes éditoriales
// partagées par le hub et les 4 guides.
//
// SEO : best-effort côté client (les pages ne sont pas prérendues), même patron
// que Etablissements.tsx — title + meta description + canonical + og/twitter posés
// au montage via useConseilsSeo, restaurés au démontage.
import { useEffect, type ReactNode } from 'react'
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'

/* ------------------------------------------------------------------- SEO -- */
export type Seo = { title: string; description: string; canonical: string }

export function useConseilsSeo({ title, description, canonical }: Seo) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

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

    apply('meta[name="description"]', 'content', description)
    apply('link[rel="canonical"]', 'href', canonical)
    apply('meta[property="og:url"]', 'content', canonical)
    apply('meta[property="og:title"]', 'content', title)
    apply('meta[property="og:description"]', 'content', description)
    apply('meta[name="twitter:title"]', 'content', title)
    apply('meta[name="twitter:description"]', 'content', description)

    return () => {
      document.title = prevTitle
      restorers.forEach((r) => r())
    }
  }, [title, description, canonical])
}

/* ---------------------------------------------------------- Motif d'ondes -- */
// Écho du logo (ondes sonores) en filigrane — décor de fond discret.
export function WaveMotif({
  className = '',
  stroke = '#FBF5EE',
  opacity = 0.16,
}: {
  className?: string
  stroke?: string
  opacity?: number
}) {
  const heights = [16, 34, 22, 46, 28, 52, 24, 40, 18, 36, 26, 48, 20, 38]
  return (
    <svg
      viewBox="0 0 300 80"
      className={className}
      aria-hidden="true"
      style={{ opacity }}
      preserveAspectRatio="xMidYMid meet"
    >
      {heights.map((h, i) => (
        <line
          key={i}
          x1={12 + i * 21}
          x2={12 + i * 21}
          y1={40 - h / 2}
          y2={40 + h / 2}
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------ Fil d'Ariane -- */
type Crumb = { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-brun-700"
    >
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {it.href ? (
            <a href={it.href} className="hover:text-terracotta-dark transition-colors">
              {it.label}
            </a>
          ) : (
            <span className="text-brun-900/70" aria-current="page">
              {it.label}
            </span>
          )}
          {i < items.length - 1 && <Icon.ChevronRight size={14} className="text-brun-700/45" />}
        </span>
      ))}
    </nav>
  )
}

/* ------------------------------------------------- Primitives de prose -- */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs uppercase tracking-[0.18em] text-terracotta-dark font-medium ${className}`}>
      {children}
    </p>
  )
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-lg md:text-xl text-brun-700 leading-relaxed text-pretty">{children}</p>
}

export function Section({
  title,
  eyebrow,
  children,
}: {
  title?: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
      {title && (
        <h2 className="font-serif font-normal text-brun-900 text-2xl md:text-[28px] leading-snug text-balance">
          {title}
        </h2>
      )}
      <div
        className={`${title || eyebrow ? 'mt-4 ' : ''}space-y-4 text-brun-700 leading-relaxed text-pretty text-[17px]`}
      >
        {children}
      </div>
    </section>
  )
}

export function P({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-5 list-disc marker:text-terracotta/60">{children}</ul>
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="text-pretty pl-1">{children}</li>
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-terracotta-dark font-medium link-underline">
      {children}
    </a>
  )
}

export function Hr() {
  return <hr className="border-creme-sable" />
}

/* ---------------------------------------------------------- Chiffre-clé -- */
export function StatBlock({
  figure,
  label,
  source,
}: {
  figure: ReactNode
  label: ReactNode
  source?: ReactNode
}) {
  return (
    <figure className="my-2 rounded-xl border border-creme-sable bg-creme-sable/40 px-7 py-7 md:px-9 md:py-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
      <div
        className="font-serif text-terracotta leading-none text-5xl md:text-6xl shrink-0"
        style={{ fontWeight: 500 }}
      >
        {figure}
      </div>
      <div>
        <p className="text-brun-900 leading-snug text-lg text-pretty">{label}</p>
        {source && <figcaption className="mt-2 text-sm text-brun-700/70">{source}</figcaption>}
      </div>
    </figure>
  )
}

/* ------------------------------------------------- Encadré « note honnête » -- */
export function Callout({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <aside className="my-2 rounded-xl border border-creme-sable bg-creme-sable/50 p-6 md:p-7">
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <Icon.Heart size={16} className="text-terracotta" />
          <span className="text-xs uppercase tracking-[0.16em] text-terracotta-dark font-medium">
            {label}
          </span>
        </div>
      )}
      <div className="text-brun-700 leading-relaxed text-pretty text-[17px] space-y-3">{children}</div>
    </aside>
  )
}

/* ------------------------------------------------------------ Carte relais -- */
type IconCmp = (typeof Icon)[keyof typeof Icon]

export function ReliefCard({
  icon: Ic,
  title,
  children,
}: {
  icon: IconCmp
  title: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-creme-sable bg-creme p-5 flex gap-4">
      <span className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center shrink-0 text-terracotta-dark">
        <Ic size={20} />
      </span>
      <div>
        <h3 className="font-medium text-brun-900 leading-snug">{title}</h3>
        <p className="mt-1 text-[15px] text-brun-700 leading-relaxed text-pretty">{children}</p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- CTA -- */
// ⚠️ L'URL secondaire pointe vers app.modect.com (ANCIEN domaine) : intégrée
// telle quelle pour l'instant, dans le MÊME onglet — à migrer vers app.aicoute.fr
// (ou mieux, vers SIGNUP_URL de @/config/links qui résout app.<domaine-courant>).
const PRIMARY_CTA_HREF = '/#essai'
const SECONDARY_CTA_HREF = 'https://app.modect.com/auth/register'

export function ConseilsCTA({ note }: { note?: string }) {
  return (
    <div className="my-2 rounded-xl border border-creme-sable bg-creme-sable/50 p-7 md:p-8">
      <p className="font-serif text-xl md:text-2xl text-brun-900 leading-snug">
        Le premier appel est offert, sans engagement.
      </p>
      {note && <p className="mt-2 text-brun-700 leading-relaxed text-pretty">{note}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={PRIMARY_CTA_HREF}
          className="inline-flex items-center justify-center bg-terracotta hover:bg-terracotta-dark text-creme px-6 py-3.5 rounded-md font-medium transition-colors"
        >
          Essayez
        </a>
        <a
          href={SECONDARY_CTA_HREF}
          className="inline-flex items-center gap-1.5 border border-terracotta/40 hover:border-terracotta hover:bg-terracotta/5 text-terracotta-dark px-6 py-3.5 rounded-md font-medium transition-colors"
        >
          Testez-nous en vrai
          <Icon.ArrowRight size={16} />
        </a>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Métadonnées guides -- */
export type GuideMeta = {
  href: string
  tag: string
  title: string
  teaser: string
  minutes: number
}

export const GUIDE_META: Record<'isolement' | 'parentSeul' | 'veuf' | 'culpabilite', GuideMeta> = {
  isolement: {
    href: '/conseils/rompre-isolement-personne-agee',
    tag: 'Guide complet',
    title: "Rompre l'isolement d'une personne âgée : les solutions qui existent vraiment",
    teaser:
      "Le tour d'horizon complet des pistes : visites, associations, aide à domicile, téléassistance, appels réguliers.",
    minutes: 6,
  },
  parentSeul: {
    href: '/conseils/parent-age-seul-vivre-loin',
    tag: 'À distance',
    title: 'Votre parent vit seul et vous vivez loin',
    teaser:
      "Organiser un relais de proximité, tenir un rythme malgré la distance, et être rassuré sur son quotidien sans pouvoir passer.",
    minutes: 5,
  },
  veuf: {
    href: '/conseils/aider-parent-veuf-isolement',
    tag: 'Deuil',
    title: 'Aider un parent qui vient de perdre son conjoint',
    teaser:
      "Accompagner le deuil, repérer les signaux d'isolement, et maintenir une présence dans la durée sans étouffer.",
    minutes: 4,
  },
  culpabilite: {
    href: '/conseils/culpabilite-ne-pas-appeler-parents',
    tag: 'Charge mentale',
    title: '« Je culpabilise de ne pas appeler assez mes parents »',
    teaser:
      "Comprendre cette culpabilité si répandue, sortir du tout-ou-rien, et bâtir une présence qui ne repose pas que sur vous.",
    minutes: 4,
  },
}

/* ---------------------------------------------------------- En-tête d'article -- */
export function GuideHero({
  tag,
  minutes,
  h1,
  lead,
  heroImage,
  heroAlt,
  pullQuote,
}: {
  tag: string
  minutes: number
  h1: ReactNode
  lead: ReactNode
  heroImage?: string
  heroAlt?: string
  pullQuote?: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-terracotta-dark bg-terracotta/[0.08] border border-terracotta/15 rounded-full px-3 py-1 whitespace-nowrap">
          {tag}
        </span>
        <span className="inline-flex items-center gap-1.5 text-brun-700/70 text-sm whitespace-nowrap">
          <Icon.Clock size={14} />
          {minutes} min de lecture
        </span>
      </div>
      <h1 className="mt-5 font-serif font-normal text-brun-900 text-[32px] md:text-[44px] leading-[1.08] text-balance max-w-3xl">
        {h1}
      </h1>
      <div className="mt-6 text-lg md:text-xl text-brun-700 leading-relaxed text-pretty max-w-2xl">
        {lead}
      </div>

      {heroImage ? (
        <div className="mt-9 relative rounded-2xl overflow-hidden border border-creme-sable aspect-[16/9]">
          <img src={heroImage} alt={heroAlt} className="w-full h-full object-cover" loading="eager" />
        </div>
      ) : pullQuote ? (
        <figure className="mt-9 relative overflow-hidden rounded-2xl border border-creme-sable bg-creme-sable/50 px-8 py-10 md:px-12 md:py-14">
          <WaveMotif className="absolute -right-4 top-3 w-64 h-20 pointer-events-none" stroke="#C75D3A" opacity={0.1} />
          <span className="font-serif text-terracotta/30 text-6xl leading-none select-none" aria-hidden="true">
            “
          </span>
          <blockquote className="relative -mt-4 font-serif italic font-normal text-brun-900 text-2xl md:text-[32px] leading-snug text-balance max-w-2xl">
            {pullQuote}
          </blockquote>
        </figure>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------ Carte guide -- */
export function GuideCard({ href, tag, title, teaser, minutes }: GuideMeta) {
  return (
    <a
      href={href}
      className="group flex flex-col rounded-xl border border-creme-sable bg-creme p-7 transition-all duration-200 hover:border-terracotta/40 hover:-translate-y-1"
    >
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-terracotta-dark bg-terracotta/[0.08] border border-terracotta/15 rounded-full px-3 py-1 whitespace-nowrap">
          {tag}
        </span>
      </div>
      <h3 className="mt-4 font-serif font-normal text-brun-900 text-xl leading-snug text-balance group-hover:text-terracotta-dark transition-colors">
        {title}
      </h3>
      <p className="mt-2.5 text-brun-700 leading-relaxed text-pretty text-[15px] flex-1">{teaser}</p>
      <div className="mt-5 pt-4 border-t border-creme-sable flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm text-brun-700/70">
          <Icon.Clock size={14} />
          {minutes} min de lecture
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-terracotta-dark">
          Lire
          <Icon.ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </a>
  )
}

/* --------------------------------------------------- Bloc « pour aller plus loin » -- */
export function RelatedGuides({
  items,
  title = 'Selon votre situation',
}: {
  items: GuideMeta[]
  title?: string
}) {
  const cols = items.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
  return (
    <section>
      <Eyebrow>Pour aller plus loin</Eyebrow>
      <h2 className="mt-2.5 font-serif font-normal text-brun-900 text-2xl md:text-3xl leading-snug text-balance">
        {title}
      </h2>
      <div className={`mt-7 grid ${cols} gap-6`}>
        {items.map((g) => (
          <GuideCard key={g.title} {...g} />
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------- Coquille de guide -- */
export function GuidePage({
  seo,
  tag,
  minutes,
  breadcrumbLabel,
  h1,
  lead,
  heroImage,
  heroAlt,
  pullQuote,
  customHero,
  related,
  children,
}: {
  seo: Seo
  tag?: string
  minutes?: number
  breadcrumbLabel: string
  h1?: ReactNode
  lead?: ReactNode
  heroImage?: string
  heroAlt?: string
  pullQuote?: ReactNode
  customHero?: ReactNode
  related: GuideMeta[]
  children: ReactNode
}) {
  useConseilsSeo(seo)
  return (
    <div className="bg-creme min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-7">
          <Breadcrumb
            items={[
              { label: 'Accueil', href: '/' },
              { label: 'Conseils', href: '/conseils' },
              { label: breadcrumbLabel },
            ]}
          />
        </div>

        <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-9 md:pt-12">
          {customHero || (
            <GuideHero
              tag={tag!}
              minutes={minutes!}
              h1={h1}
              lead={lead}
              heroImage={heroImage}
              heroAlt={heroAlt}
              pullQuote={pullQuote}
            />
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-12 md:pt-16">
          <article className="space-y-12 md:space-y-14">{children}</article>
        </div>

        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-14 md:py-20">
          <Hr />
          <div className="mt-12 md:mt-16">
            <RelatedGuides items={related} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
