// Liens vitrine → back-office.
// Mono-site : la vitrine (www.modect.com) et le back-office (app.modect.com) sont
// servis par la MÊME app. VITE_DASHBOARD_URL pilote la cible des CTA :
//  - prod  : VITE_DASHBOARD_URL=https://app.modect.com → liens absolus (bascule de sous-domaine)
//  - local : non défini → DASHBOARD_URL = '' → liens relatifs (même origine, localhost:5173)

export const DASHBOARD_URL: string = import.meta.env.VITE_DASHBOARD_URL ?? ''

export const LOGIN_URL = `${DASHBOARD_URL}/auth/login`
export const SIGNUP_URL = `${DASHBOARD_URL}/auth/register`
