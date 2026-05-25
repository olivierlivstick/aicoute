// Liens centralisés vitrine → dashboard aidant (app.modect.com).
// L'URL de base est pilotée par VITE_DASHBOARD_URL (cf .env.example / .env.local).
// Les routes /auth/login et /auth/register correspondent aux routes réelles du dashboard.

export const DASHBOARD_URL: string =
  import.meta.env.VITE_DASHBOARD_URL ?? 'https://app.modect.com'

export const LOGIN_URL = `${DASHBOARD_URL}/auth/login`
export const SIGNUP_URL = `${DASHBOARD_URL}/auth/register`
