/**
 * Edge Function: stripe-webhook
 *
 * Reçoit les événements Stripe et, sur `checkout.session.completed`, crédite
 * l'achat de minutes.
 *
 * Public (verify_jwt = false) — l'authenticité est garantie par la signature
 * Stripe (STRIPE_WEBHOOK_SECRET), vérifiée via constructEventAsync.
 *
 * ⚠️ Compte Stripe PARTAGÉ avec une autre app : on n'agit QUE sur les sessions
 * portant `metadata.app === 'aicoute'` et un pack connu. Tout le reste renvoie
 * 200 sans rien faire (sinon Stripe rejouerait l'événement indéfiniment).
 *
 * Deux chemins selon les metadata :
 *  - `caregiver_id` présent  → crédit DIRECT de minute_purchases (achat connecté)
 *  - sinon (achat invité)    → génère un CODE, l'insère dans minute_codes, l'email
 *
 * Idempotent : `stripe_session_id` est UNIQUE dans les deux tables → un webhook
 * rejoué ne crée pas de doublon.
 */

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendEmail, purchaseCodeEmailHtml } from '../_shared/email.ts'
import {
  getStripe, getCryptoProvider, getPack, generateCode, appUrl, APP_TAG,
} from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('méthode non autorisée', { status: 405 })
  }

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET non défini')
    return new Response('configuration manquante', { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('signature manquante', { status: 400 })

  const rawBody = await req.text()

  let event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      rawBody, sig, secret, undefined, getCryptoProvider(),
    )
  } catch (err) {
    console.error('[stripe-webhook] signature invalide:', err instanceof Error ? err.message : err)
    return new Response('signature invalide', { status: 400 })
  }

  // On ne traite que la fin de checkout. Tout le reste : accusé de réception.
  if (event.type !== 'checkout.session.completed') {
    return new Response('ok', { status: 200 })
  }

  try {
    // deno-lint-ignore no-explicit-any
    const session = event.data.object as any
    const meta = session.metadata ?? {}

    // Garde anti-compte-partagé : ignorer ce qui n'est pas à nous.
    if (meta.app !== APP_TAG) {
      return new Response('ignoré (autre app)', { status: 200 })
    }
    const pack = getPack(meta.pack_id)
    if (!pack) {
      console.warn('[stripe-webhook] pack inconnu dans metadata:', meta.pack_id)
      return new Response('ignoré (pack inconnu)', { status: 200 })
    }
    if (session.payment_status !== 'paid') {
      return new Response('ignoré (non payé)', { status: 200 })
    }

    const admin = getSupabaseAdmin()
    const sessionId: string = session.id
    const buyerEmail: string | null = session.customer_details?.email ?? null

    // ── Chemin 1 : achat connecté → crédit direct ──
    if (meta.caregiver_id) {
      const { error } = await admin.from('minute_purchases').insert({
        caregiver_id: meta.caregiver_id,
        pack_id: pack.id,
        pack_name: pack.name,
        minutes: pack.minutes,
        amount_eur: pack.amount_eur,
        stripe_session_id: sessionId,
      })
      if (error && error.code !== '23505') {  // 23505 = doublon → déjà crédité
        throw new Error(`insert minute_purchases: ${error.message}`)
      }
      console.log(`[stripe-webhook] crédit direct ${pack.minutes}min → ${meta.caregiver_id}`)
      return new Response('ok', { status: 200 })
    }

    // ── Chemin 2 : achat invité → génère un code ──
    // Idempotence : si la session est déjà enregistrée, on récupère son code
    // (et on ne renvoie pas d'email).
    const { data: existing } = await admin
      .from('minute_codes')
      .select('code')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()
    if (existing) {
      return new Response('ok', { status: 200 })
    }

    const code = generateCode()
    const { error } = await admin.from('minute_codes').insert({
      code,
      pack_id: pack.id,
      pack_name: pack.name,
      minutes: pack.minutes,
      amount_eur: pack.amount_eur,
      buyer_email: buyerEmail,
      stripe_session_id: sessionId,
    })
    if (error) {
      if (error.code === '23505') {  // course : un autre delivery a déjà inséré
        return new Response('ok', { status: 200 })
      }
      throw new Error(`insert minute_codes: ${error.message}`)
    }

    if (buyerEmail) {
      await sendEmail({
        to: buyerEmail,
        subject: `Votre code Aicoute — ${pack.name} (${pack.minutes} min)`,
        html: purchaseCodeEmailHtml({
          code,
          pack_name: pack.name,
          minutes: pack.minutes,
          amount_eur: pack.amount_eur,
          app_url: appUrl(),
        }),
      })
    }
    console.log(`[stripe-webhook] code ${code} généré (${pack.minutes}min) pour ${buyerEmail ?? 'sans email'}`)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[stripe-webhook] Erreur traitement:', err)
    // 500 → Stripe rejouera (notre traitement est idempotent).
    return new Response('erreur interne', { status: 500 })
  }
})
