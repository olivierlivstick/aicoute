// Header sticky avec changement subtil de bordure au scroll
import { useState, useEffect } from 'react'
import { Logo } from '@/components/Logo'
import { Icon } from '@/marketing/components/icons'
import { LOGIN_URL, SIGNUP_URL } from '@/config/links'

// Section « Organisations » : le hub en tête, puis les 3 offres (spokes). Desktop =
// dropdown ; mobile = lien vers le hub. Remplace l'ancienne entrée « Établissements »
// du premier niveau.
const ORG_LINKS = [
  { href: '/organisations', label: "Vue d'ensemble" },
  { href: '/etablissements', label: 'Établissements' },
  { href: '/municipalites', label: 'Collectivités' },
  { href: '/assurances', label: 'Assureurs & mutuelles' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Le Header est partagé home + sous-pages (et prérendu dans la home). On ne lit
  // donc PAS window au rendu (sinon mismatch d'hydratation) : on détecte après
  // montage si on est sur une sous-page. Sur la home, isSubpage reste false →
  // rendu identique au prérendu. Sur une sous-page (rendu client only, pas
  // d'hydratation), les ancres « #section » deviennent « /#section » pour revenir
  // à la home puis scroller, et le logo pointe sur la racine.
  const [isSubpage, setIsSubpage] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setIsSubpage(window.location.pathname !== '/')
  }, [])

  // Résout un lien de nav : les ancres sont préfixées par « / » hors de la home.
  const resolve = (href: string) =>
    isSubpage && href.startsWith('#') ? `/${href}` : href

  const navLinks = [
    { href: '#comment', label: 'Comment ça marche' },
    { href: '#essai', label: 'Essayer' },
    { href: '#tarifs', label: 'Tarifs' },
    { href: '#securite', label: 'Sécurité' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <header
      className={`sticky top-0 z-50 bg-creme/90 backdrop-blur-sm transition-[border-color] ${
        scrolled ? 'border-b border-creme-sable' : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-container mx-auto px-6 lg:px-8 h-[72px] flex items-center justify-between">
        <a href={isSubpage ? '/' : '#'} className="flex items-center" aria-label="Accueil Aicoute">
          <Logo variant="full" size={35} />
        </a>

        <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={resolve(l.href)}
              className="text-sm text-brun-900 hover:text-terracotta-dark transition-colors"
            >
              {l.label}
            </a>
          ))}

          {/* Organisations — dropdown desktop (ouvert au survol / focus, SSR-safe :
              affichage piloté en CSS, aucun accès window au rendu). */}
          <div className="relative group">
            <a
              href="/organisations"
              className="inline-flex items-center gap-1 text-sm text-brun-900 hover:text-terracotta-dark transition-colors"
              aria-haspopup="true"
            >
              Organisations
              <Icon.ChevronDown
                size={14}
                className="transition-transform group-hover:rotate-180"
              />
            </a>
            {/* pt-2 = pont de survol pour ne pas perdre le hover dans l'interstice */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-150">
              <div className="w-60 bg-creme border border-creme-sable rounded-lg shadow-lg shadow-brun-900/5 p-2">
                {ORG_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="block px-3 py-2 rounded-md text-sm text-brun-900 hover:bg-creme-sable hover:text-terracotta-dark transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="hidden md:flex items-center gap-5">
          <a
            href={LOGIN_URL}
            className="text-sm text-brun-900 hover:text-terracotta-dark transition-colors"
          >
            Connexion
          </a>
          <a
            href={SIGNUP_URL}
            className="bg-terracotta hover:bg-terracotta-dark text-creme text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
          >
            Créer un compte
          </a>
        </div>

        <button
          className="md:hidden p-2 -mr-2 text-brun-900"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="md:hidden border-t border-creme-sable bg-creme">
          <div className="max-w-container mx-auto px-6 py-4 flex flex-col gap-3">
            {navLinks.map((l) => (
              <a key={l.href} href={resolve(l.href)} className="py-2 text-brun-900" onClick={() => setMobileOpen(false)}>
                {l.label}
              </a>
            ))}
            {/* Mobile : un seul lien vers le hub Organisations (pas de sous-menu). */}
            <a href="/organisations" className="py-2 text-brun-900" onClick={() => setMobileOpen(false)}>
              Organisations
            </a>
            <div className="flex items-center gap-3 pt-2 border-t border-creme-sable mt-1">
              <a
                href={LOGIN_URL}
                className="flex-1 py-2.5 text-center text-brun-900 border border-creme-sable rounded-md"
              >
                Connexion
              </a>
              <a
                href={SIGNUP_URL}
                className="flex-1 py-2.5 text-center bg-terracotta text-creme rounded-md font-medium"
              >
                Créer un compte
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
