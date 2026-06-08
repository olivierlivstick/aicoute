// Rate limit en mémoire (best-effort, par instance).
// Suffisant pour la démo vitrine : un dérapage = facturation Twilio limitée.

const buckets = new Map() // key → number[] (timestamps ms)

export function rateLimit({ key, max, windowMs }) {
  const now = Date.now()
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= max) {
    buckets.set(key, timestamps)
    const retryMs = windowMs - (now - timestamps[0])
    return { ok: false, retryMs }
  }
  timestamps.push(now)
  buckets.set(key, timestamps)
  return { ok: true }
}

// Limites par défaut (lisibles ici, modifiables par appelant) :
//  - 3 appels téléphone par IP par heure (perIp) — empêche un visiteur de spammer
//  - 3 appels vers un même numéro par 24h (perNumber) — empêche le harcèlement
//  - 5 sessions web Gemini par IP par heure (perIpWeb) — démo navigateur, plus
//    de tolérance car aucun appel sortant ni numéro destinataire en jeu
//  - 6 appels ENTRANTS par numéro source par heure (perInbound) — filet anti-
//    martèlement AVANT même l'identification/cooldown en base. Au-delà, on coupe
//    sans toucher la DB. Un usage légitime reste très en dessous (cooldown 30min).
export const LIMITS = {
  perIp:      { max: 3,  windowMs: 60 * 60 * 1000 },
  perNumber:  { max: 3,  windowMs: 24 * 60 * 60 * 1000 },
  perIpWeb:   { max: 5,  windowMs: 60 * 60 * 1000 },
  perInbound: { max: 6,  windowMs: 60 * 60 * 1000 },
}
