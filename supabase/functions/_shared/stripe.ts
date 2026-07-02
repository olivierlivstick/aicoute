/**
 * Helpers Stripe partagés entre les Edge Functions d'achat de minutes.
 *
 * ⚠️ Compte Stripe PARTAGÉ avec une autre application : tous nos paiements
 * portent `metadata.app = 'aicoute'` et le webhook ignore tout ce qui ne le
 * porte pas (cf. stripe-webhook).
 *
 * ⚠️ Gotcha Deno : la vérification de signature webhook DOIT utiliser
 * `constructEventAsync` + un SubtleCryptoProvider (la version synchrone utilise
 * le crypto Node, indisponible dans le runtime Edge).
 */

// esm.sh + ?target=deno : convention du projet (cf. @supabase/supabase-js) et
// pattern officiel Supabase × Stripe (expose createFetchHttpClient /
// createSubtleCryptoProvider nécessaires en Deno).
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

export const APP_TAG = 'aicoute'

let _stripe: Stripe | null = null
let _cryptoProvider: Stripe.CryptoProvider | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY non défini')
  _stripe = new Stripe(key, {
    // Version d'API épinglée (stabilité du webhook). Castée pour rester insensible
    // au littéral exact attendu par la version du SDK.
    apiVersion: '2024-12-18.acacia' as Stripe.StripeConfig['apiVersion'],
    // Client fetch (pas le client http Node) — requis en Deno.
    httpClient: Stripe.createFetchHttpClient(),
  })
  return _stripe
}

/** Provider crypto pour constructEventAsync (vérif de signature en Deno). */
export function getCryptoProvider(): Stripe.CryptoProvider {
  if (!_cryptoProvider) _cryptoProvider = Stripe.createSubtleCryptoProvider()
  return _cryptoProvider
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue SERVEUR des packs — source de vérité des minutes/montants.
// On ne fait JAMAIS confiance au client pour le prix ou la quantité.
// Duplication assumée de MINUTE_PACKS (packages/shared) car Deno n'importe pas
// `packages/shared` — même pattern « à garder en phase » que voices.ts /
// reportI18n.ts. Le Price ID Stripe de chaque pack est lu en env (test vs live).
// ─────────────────────────────────────────────────────────────────────────────

export interface StripePack {
  id: string
  name: string
  minutes: number
  amount_eur: number
  priceEnv: string
}

export const STRIPE_PACKS: Record<string, StripePack> = {
  rendezvous: { id: 'rendezvous', name: 'Le rendez-vous', minutes: 50,  amount_eur: 25,  priceEnv: 'STRIPE_PRICE_RENDEZVOUS' },
  lien:       { id: 'lien',       name: 'Le lien',         minutes: 100, amount_eur: 45,  priceEnv: 'STRIPE_PRICE_LIEN' },
  presence:   { id: 'presence',   name: 'La présence',     minutes: 250, amount_eur: 100, priceEnv: 'STRIPE_PRICE_PRESENCE' },
}

export function getPack(packId: unknown): StripePack | null {
  if (typeof packId !== 'string') return null
  return STRIPE_PACKS[packId] ?? null
}

/** Price ID Stripe d'un pack (lu en env). Throw si non configuré. */
export function priceIdForPack(pack: StripePack): string {
  const id = Deno.env.get(pack.priceEnv)
  if (!id) throw new Error(`${pack.priceEnv} non défini`)
  return id
}

// ─────────────────────────────────────────────────────────────────────────────
// Abonnement « Le contrôle » — RÉCURRENT (mode subscription), ≠ packs one-shot.
// 18 €/mois : 1 appel de contrôle par jour + email aux proches si non-réponse.
// Le Price ID récurrent est lu en env (test vs live).
// ─────────────────────────────────────────────────────────────────────────────

export const CONTROL_PLAN = {
  id: 'controle',
  name: 'Le contrôle',
  amount_eur: 18,
  priceEnv: 'STRIPE_PRICE_CONTROLE',
} as const

/** Price ID Stripe (récurrent) de l'abonnement « Le contrôle ». Throw si absent. */
export function controlPriceId(): string {
  const id = Deno.env.get(CONTROL_PLAN.priceEnv)
  if (!id) throw new Error(`${CONTROL_PLAN.priceEnv} non défini`)
  return id
}

// ─────────────────────────────────────────────────────────────────────────────
// URLs de redirection (surchargeables en env).
// ─────────────────────────────────────────────────────────────────────────────

/** Base vitrine (page publique /achat/merci). */
export function siteUrl(): string {
  return Deno.env.get('PUBLIC_SITE_URL')
    ?? Deno.env.get('PUBLIC_REPORT_URL')
    ?? 'https://www.aicoute.fr'
}

/** Base back-office (achat direct par un utilisateur connecté → /compte). */
export function appUrl(): string {
  return Deno.env.get('APP_URL') ?? 'https://app.aicoute.fr'
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération de code lisible : AICOUTE-XXXX-XXXX.
// Alphabet sans caractères ambigus (pas de O/0/I/1) pour la dictée téléphone.
// ─────────────────────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
  return `AICOUTE-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`
}
