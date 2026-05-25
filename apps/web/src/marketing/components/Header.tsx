// Header sticky avec changement subtil de bordure au scroll
import { useState, useEffect } from 'react'
import { Logo } from '@/marketing/components/Logo'
import { LOGIN_URL, SIGNUP_URL } from '@/config/links'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '#comment', label: 'Comment ça marche' },
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
        <a href="#" className="flex items-center" aria-label="Accueil MODECT">
          <Logo variant="full" size={24} />
        </a>

        <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-brun-900 hover:text-terracotta-dark transition-colors"
            >
              {l.label}
            </a>
          ))}
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
              <a key={l.href} href={l.href} className="py-2 text-brun-900" onClick={() => setMobileOpen(false)}>
                {l.label}
              </a>
            ))}
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
