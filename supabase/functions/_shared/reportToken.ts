/**
 * Jeton de partage public du compte-rendu.
 *
 * `issueReportToken` génère un jeton aléatoire non devinable, l'écrit sur la
 * ligne `calls` avec une expiration (défaut 48h) et renvoie l'URL publique
 * complète (`${baseUrl}/r/${token}`) à mettre dans l'email.
 *
 * Chaque envoi/renvoi d'email ré-émet un jeton frais → la fenêtre de 48h court
 * à partir du dernier envoi (et l'ancien lien devient invalide).
 */

const REPORT_TTL_HOURS = 48

// Base URL de la page publique. Vitrine par défaut (partageable avec des tiers
// qui n'ont pas de compte back-office). Surchargeable via env si besoin.
export function publicReportBaseUrl(): string {
  return Deno.env.get('PUBLIC_REPORT_URL') ?? 'https://www.aicoute.fr'
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// deno-lint-ignore no-explicit-any
export async function issueReportToken(
  supabase: any,
  callId: string,
  ttlHours: number = REPORT_TTL_HOURS,
): Promise<{ token: string; expiresAt: string; url: string }> {
  const token     = generateToken()
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()

  const { error } = await supabase
    .from('calls')
    .update({ report_token: token, report_token_expires_at: expiresAt })
    .eq('id', callId)

  if (error) throw new Error(`issueReportToken update failed: ${error.message}`)

  return { token, expiresAt, url: `${publicReportBaseUrl()}/r/${token}` }
}
