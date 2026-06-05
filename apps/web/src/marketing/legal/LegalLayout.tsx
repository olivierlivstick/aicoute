// Layout commun des pages légales (vitrine) : barre minimale (logo + retour),
// titre, date de mise à jour, contenu en colonne lisible, puis Footer.
// Liens internes en <a> simple (full reload) → pas de dépendance react-router,
// donc ces pages restent SSR-safe et le Footer pré-rendu ne casse pas.
import { useEffect, type ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { Footer } from '@/marketing/components/Footer'

type LegalLayoutProps = {
  title: string
  updated?: string
  intro?: ReactNode
  children: ReactNode
}

export function LegalLayout({ title, updated, intro, children }: LegalLayoutProps) {
  useEffect(() => {
    const prev = document.title
    document.title = `${title} — Aicoute`
    return () => {
      document.title = prev
    }
  }, [title])

  return (
    <div className="bg-creme min-h-screen flex flex-col">
      {/* Barre minimale */}
      <header className="border-b border-creme-sable">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" aria-label="Retour à l'accueil Aicoute">
            <Logo size={30} />
          </a>
          <a
            href="/"
            className="text-sm text-terracotta-dark font-medium link-underline"
          >
            ← Retour à l'accueil
          </a>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 lg:px-8 py-14 md:py-20">
          <h1 className="font-serif font-normal text-brun-900 text-3xl md:text-4xl leading-tight text-balance">
            {title}
          </h1>
          {updated && (
            <p className="mt-3 text-sm text-brun-700/70">Dernière mise à jour : {updated}</p>
          )}
          {intro && <div className="mt-6 text-brun-700 leading-relaxed text-pretty">{intro}</div>}

          <div className="mt-10 space-y-8">{children}</div>
        </article>
      </main>

      <Footer />
    </div>
  )
}

// --- Primitives typographiques (évitent de répéter les classes) ---

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif font-normal text-brun-900 text-xl md:text-2xl leading-snug">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-brun-700 leading-relaxed text-pretty">{children}</div>
    </section>
  )
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 pl-5 list-disc marker:text-terracotta/60">{children}</ul>
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="text-pretty">{children}</li>
}

export function Mail({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className="text-terracotta-dark font-medium link-underline">
      {address}
    </a>
  )
}
