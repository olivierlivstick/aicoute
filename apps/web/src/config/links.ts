// Liens vitrine → back-office.
// Mono-site : la vitrine (www.<domaine>) et le back-office (app.<domaine>) sont
// servis par la MÊME app sur deux sous-domaines. Les CTA doivent pointer en
// ABSOLU vers app.<domaine> pour basculer de sous-domaine — et rester sur le
// MÊME domaine que la vitrine courante (aicoute.fr ↔ aicoute.fr,
// modect.com ↔ modect.com) tant que les deux coexistent.
//
//  - prod  : dérivé du hostname courant → https://app.<domaine-courant>
//  - local : localhost / 127.0.0.1 → '' → liens relatifs (même origine)
//  - SSR/build (pas de window) : fallback sur VITE_DASHBOARD_URL

function resolveDashboardUrl(): string {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_DASHBOARD_URL ?? ''
  }

  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return ''

  // www.aicoute.fr / aicoute.fr → app.aicoute.fr ; www.modect.com → app.modect.com
  const baseDomain = host.replace(/^www\./, '')
  return `https://app.${baseDomain}`
}

export const DASHBOARD_URL: string = resolveDashboardUrl()

export const LOGIN_URL = `${DASHBOARD_URL}/auth/login`
export const SIGNUP_URL = `${DASHBOARD_URL}/auth/register`
