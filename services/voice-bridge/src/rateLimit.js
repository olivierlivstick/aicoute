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
//  - 3 appels par IP par heure  → empêche un visiteur de spammer
//  - 3 appels vers un même numéro par 24h → empêche le harcèlement
export const LIMITS = {
  perIp:      { max: 3,  windowMs: 60 * 60 * 1000 },
  perNumber:  { max: 3,  windowMs: 24 * 60 * 60 * 1000 },
}
