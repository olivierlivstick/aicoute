// FOOTER — fond brun-900, 4 colonnes
import { Icon } from '@/marketing/components/icons'
import { Logo } from '@/components/Logo'

type FooterLink = { label: string; href: string; newTab?: boolean }
type FooterEntry = FooterLink | { group: FooterLink[] }
type FooterGroup = { title: string; links: FooterEntry[] }

function renderLink(l: FooterLink) {
  return (
    <a
      href={l.href}
      {...(l.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="text-creme/70 hover:text-creme transition-colors text-[15px]"
    >
      {l.label}
    </a>
  )
}

export function Footer() {
  const groups: FooterGroup[] = [
    {
      title: 'Produit',
      links: [
        { label: 'Comment ça marche', href: '/#comment' },
        { label: 'Tarifs', href: '/#tarifs' },
        { label: 'Sécurité', href: '/#securite' },
        { label: 'FAQ', href: '/#faq' },
      ],
    },
    {
      title: 'Entreprise',
      links: [
        { label: 'À propos', href: '/a-propos' },
        { label: 'Conseils', href: '/conseils' },
        { label: 'Organisations', href: '/organisations' },
        { label: 'Charte éthique', href: '/charte-ethique' },
        { label: 'Contact', href: '/#contact' },
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: 'Mentions légales', href: '/mentions-legales' },
        {
          group: [
            { label: 'CGU', href: '/cgu' },
            { label: 'CGV', href: '/cgv', newTab: true },
          ],
        },
        { label: 'RGPD', href: '/rgpd' },
        { label: 'IA Act', href: '/ia-act' },
      ],
    },
  ]

  return (
    <footer className="bg-brun-900 text-creme/80 pt-16 pb-10">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-10 md:gap-8">
          {/* Col 1 — Logo + tagline + socials */}
          <div className="md:col-span-1">
            <Logo variant="mono" size={41} />
            <p className="mt-5 text-creme/70 leading-relaxed max-w-xs">
              Une présence pour ceux que vous aimez.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full border border-creme/15 flex items-center justify-center hover:border-creme/40 hover:text-creme transition-colors"
              >
                <Icon.Instagram size={16} />
              </a>
              <a
                href="https://www.linkedin.com/company/aicoute/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-9 h-9 rounded-full border border-creme/15 flex items-center justify-center hover:border-creme/40 hover:text-creme transition-colors"
              >
                <Icon.Linkedin size={16} />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="w-9 h-9 rounded-full border border-creme/15 flex items-center justify-center hover:border-creme/40 hover:text-creme transition-colors"
              >
                <Icon.Facebook size={16} />
              </a>
            </div>
          </div>

          {/* Cols 2-4 */}
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="text-creme font-medium text-sm uppercase tracking-[0.14em] mb-5">
                {g.title}
              </h3>
              <ul className="space-y-3">
                {g.links.map((l) =>
                  'group' in l ? (
                    <li key={l.group.map((g) => g.label).join('-')}>
                      {l.group.map((sub, i) => (
                        <span key={sub.label}>
                          {i > 0 && <span className="text-creme/40"> — </span>}
                          {renderLink(sub)}
                        </span>
                      ))}
                    </li>
                  ) : (
                    <li key={l.label}>{renderLink(l)}</li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-creme/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-creme/60">
            © 2026 Aicoute · Une présence pour ceux que vous aimez
          </p>
          <p className="text-xs text-creme/50">
            Conçu en France · Hébergé en Europe
          </p>
        </div>
      </div>
    </footer>
  )
}
