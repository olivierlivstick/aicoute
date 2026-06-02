/**
 * Edge Function: contact-form
 *
 * Reçoit une demande du formulaire « Nous contacter » de la vitrine
 * (www.aicoute.fr, section #contact) et l'envoie par email à
 * contact@aicoute.fr via Resend.
 *
 *  POST { firstName, lastName, email, message }
 *    → envoie l'email, renvoie { ok: true }
 *
 * Le `reply_to` est l'adresse du visiteur → répondre depuis sa boîte mail
 * répond directement à la personne.
 *
 * Public (verify_jwt = false) : appelée depuis la vitrine sans auth.
 * Destinataire surchargeable via env CONTACT_EMAIL (défaut contact@aicoute.fr).
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_MESSAGE_LEN = 5000

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'méthode non autorisée' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const firstName = String(body?.firstName ?? '').trim()
    const lastName  = String(body?.lastName ?? '').trim()
    const email     = String(body?.email ?? '').trim()
    const message   = String(body?.message ?? '').trim()
    const honeypot  = String(body?.company ?? '').trim()

    // Anti-spam léger : le champ caché « company » ne doit jamais être rempli
    // par un humain. S'il l'est, c'est un bot → on répond OK sans rien envoyer.
    if (honeypot) {
      console.warn('[contact-form] honeypot déclenché — demande ignorée')
      return jsonResponse({ ok: true })
    }

    if (!firstName || !lastName || !email || !message) {
      return jsonResponse({ error: 'Tous les champs sont requis.' }, 400)
    }
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'Adresse email invalide.' }, 400)
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return jsonResponse({ error: 'Message trop long.' }, 400)
    }

    const to = Deno.env.get('CONTACT_EMAIL') ?? 'contact@aicoute.fr'
    const fullName = `${firstName} ${lastName}`

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; color: #3D2817; line-height: 1.6;">
        <h2 style="color: #C75D3A; font-weight: 600;">Nouveau message — formulaire de contact</h2>
        <p style="margin: 4px 0;"><strong>Nom :</strong> ${esc(fullName)}</p>
        <p style="margin: 4px 0;"><strong>Email :</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
        <p style="margin: 16px 0 4px;"><strong>Message :</strong></p>
        <div style="white-space: pre-wrap; background: #FBF5EE; border: 1px solid #F5EBDC; border-radius: 8px; padding: 14px;">${esc(message)}</div>
      </div>`

    const text =
      `Nouveau message — formulaire de contact\n\n` +
      `Nom : ${fullName}\n` +
      `Email : ${email}\n\n` +
      `Message :\n${message}\n`

    const sent = await sendEmail({
      to,
      subject: `Contact vitrine — ${fullName}`,
      html,
      text,
      reply_to: email,
    })

    if (!sent) {
      return jsonResponse({ error: "L'envoi a échoué. Réessayez plus tard." }, 502)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('[contact-form] Erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
