// Layout partagé de la section éditoriale /conseils (vitrine).
// Compose le système existant : Header + Footer marketing (comme /etablissements),
// conteneur de prose en largeur de lecture, et primitives typographiques réutilisées
// telles quelles depuis LegalLayout (Section/P/UL/LI). SEO best-effort côté client
// (les pages ne sont pas prérendues) sur le même patron que Etablissements.tsx :
// title + meta description + canonical + og/twitter posés au montage, restaurés au
// démontage.
import { useEffect, type ReactNode } from 'react'
import { Header } from '@/marketing/components/Header'
import { Footer } from '@/marketing/components/Footer'
import { Icon } from '@/marketing/components/icons'

// Primitives de prose réutilisées telles quelles (titres h2, paragraphes, listes).
export { Section, P, UL, LI } from '@/marketing/legal/LegalLayout'

type ConseilsLayoutProps = {
  /** Titre SEO (balise <title>), distinct du h1 visible. */
  title: string
  description: string
  /** URL canonique absolue de la page. */
  canonical: string
  /** Titre h1 affiché en tête de l'article. */
  h1: ReactNode
  children: ReactNode
}

export function ConseilsLayout({ title, description, canonical, h1, children }: ConseilsLayoutProps) {
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

  return (
    <div className="bg-creme min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 lg:px-8 py-14 md:py-20">
          <h1 className="font-serif font-normal text-brun-900 text-3xl md:text-4xl leading-tight text-balance">
            {h1}
          </h1>
          <div className="mt-10 space-y-8">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  )
}

/** Paragraphe d'introduction (chapô), légèrement plus grand que le corps. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-lg text-brun-700 leading-relaxed text-pretty">{children}</p>
}

/** Lien interne / inline dans la prose, style « lien terracotta souligné » du site. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-terracotta-dark font-medium link-underline">
      {children}
    </a>
  )
}

/** Séparateur de section, équivalent d'un `---` Markdown. */
export function Hr() {
  return <hr className="border-creme-sable" />
}

// Bloc d'appel à l'action partagé par toutes les pages /conseils.
// Reprend la blockquote des brouillons : phrase d'accroche + note optionnelle +
// deux boutons (primaire plein terracotta = classe exacte du site ; secondaire en
// bouton outline sur les mêmes tokens).
// ⚠️ L'URL secondaire pointe vers app.modect.com (ANCIEN domaine) : intégrée telle
// quelle pour l'instant, dans le MÊME onglet — à migrer vers app.aicoute.fr (ou
// mieux, vers SIGNUP_URL de @/config/links qui résout app.<domaine-courant>).
const PRIMARY_CTA_HREF = '/#essai'
const SECONDARY_CTA_HREF = 'https://app.modect.com/auth/register'

export function ConseilsCTA({ note }: { note?: string }) {
  return (
    <div className="my-4 rounded-xl border border-creme-sable bg-creme-sable/50 p-7 md:p-8">
      <p className="font-serif text-xl text-brun-900 leading-snug">
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
