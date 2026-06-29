/**
 * Service email via Resend
 * Doc : https://resend.com/docs/api-reference/emails/send-email
 */

import {
  type ReportLang,
  normalizeReportLang,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  EMAIL_STRINGS,
} from './reportI18n.ts'

export interface SendEmailOptions {
  to:        string | string[]
  subject:   string
  html:      string
  text?:     string
  reply_to?: string | string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Assemble la liste de destinataires d'un email de compte-rendu :
 * valide chaque adresse, retire les doublons (insensible à la casse) en
 * conservant l'ordre (l'aidant en premier). Renvoie [] si rien de valide.
 */
export function normalizeRecipients(list: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const email = (raw ?? '').trim()
    if (!email || !EMAIL_RE.test(email)) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey  = Deno.env.get('RESEND_API_KEY')
  // FROM_EMAIL est le nom standard du projet (cf. CLAUDE.md). RESEND_FROM_EMAIL
  // est un fallback historique. Le placeholder noreply@modect.app est volontaire-
  // ment NON-vérifié dans Resend pour échouer bruyamment si aucune var n'est setté.
  const from    = Deno.env.get('FROM_EMAIL')
                  ?? Deno.env.get('RESEND_FROM_EMAIL')
                  ?? 'noreply@modect.app'

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY non défini — email non envoyé')
    return false
  }
  console.log(`[Email] envoi via Resend (from=${from}, to=${Array.isArray(options.to) ? options.to.join(',') : options.to})`)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from,
      to:      Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html:    options.html,
      text:    options.text,
      ...(options.reply_to ? { reply_to: options.reply_to } : {}),
    }),
  })

  if (!res.ok) {
    console.error('[Email] Resend error:', await res.text())
    return false
  }
  return true
}

// --- Templates ---

export type EmailAlertCategory =
  | 'health' | 'mood' | 'cognition' | 'social' | 'autonomy' | 'other'
export type EmailAlertSeverity = 'low' | 'medium' | 'high'

export interface EmailAlert {
  category: EmailAlertCategory
  severity: EmailAlertSeverity
  evidence: string
}

// Palette charte « cocon familial » (alignée avec apps/web/tailwind.config.js).
// Les LIBELLÉS (Faible/Modérée/Élevée…) viennent de reportI18n selon la langue
// des retours ; ici on ne garde que les couleurs (indépendantes de la langue).
const SEVERITY_STYLE: Record<EmailAlertSeverity, { bg: string; fg: string }> = {
  low:    { bg: '#FBF5EE', fg: '#6B4423' },   // crème + brun moyen
  medium: { bg: '#F5DCB0', fg: '#8B5A1F' },   // ocre pâle + ocre foncé
  high:   { bg: '#F0C5C5', fg: '#7C1F26' },   // brique pâle + brique
}

export function reportEmailHtml(params: {
  caregiver_name:   string
  beneficiary_name: string
  call_date:        string
  duration_min:     number
  mood_label:       string
  summary:          string
  key_topics:       string[]
  alerts:           EmailAlert[]
  app_url:          string
  report_url:       string
  lang?:            ReportLang
}): string {
  const {
    caregiver_name, beneficiary_name, call_date, duration_min,
    mood_label, summary, key_topics, alerts, app_url, report_url,
  } = params
  const lang = normalizeReportLang(params.lang)
  const s    = EMAIL_STRINGS[lang]

  // Fraunces pour les titres (fallback Georgia/serif), Inter pour le corps (fallback system).
  const fontSerif = `'Fraunces', Georgia, 'Times New Roman', serif`
  const fontSans  = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`

  const alertsHtml = alerts.length > 0
    ? `<div style="background:#F5EBDC;border-left:4px solid #C75D3A;padding:18px 20px;border-radius:12px;margin:24px 0">
        <strong style="font-family:${fontSerif};color:#7C1F26;display:block;margin-bottom:12px;font-size:16px">${s.alertsTitle}</strong>
        ${alerts.map((a) => {
          const sty = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low
          const cat = CATEGORY_LABELS[lang][a.category] ?? CATEGORY_LABELS[lang].other
          const sev = SEVERITY_LABELS[lang][a.severity] ?? SEVERITY_LABELS[lang].low
          return `<div style="background:white;border-radius:10px;padding:12px 14px;margin-bottom:10px;border:1px solid #E8DCC4">
            <div style="margin-bottom:6px">
              <span style="background:#F5EBDC;color:#3D2817;font-size:11px;padding:3px 10px;border-radius:12px;font-weight:600;margin-right:6px">${cat}</span>
              <span style="background:${sty.bg};color:${sty.fg};font-size:11px;padding:3px 10px;border-radius:12px;font-weight:600">${sev}</span>
            </div>
            <p style="color:#6B4423;font-size:14px;margin:0;line-height:1.55">${escapeHtml(a.evidence)}</p>
          </div>`
        }).join('')}
       </div>`
    : ''

  const topicsHtml = key_topics.length > 0
    ? `<div style="margin:12px 0 20px">
        ${key_topics.map((t) => `<span style="display:inline-block;background:#F5EBDC;color:#6B4423;padding:5px 14px;border-radius:18px;font-size:13px;margin:3px 4px 3px 0">${escapeHtml(t)}</span>`).join('')}
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FBF5EE;font-family:${fontSans};color:#3D2817">
  <div style="max-width:600px;margin:32px auto;background:#FFFEFA;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(199,93,58,0.10)">

    <!-- Header -->
    <div style="background:#C75D3A;padding:32px 32px 28px;text-align:center">
      <h1 style="font-family:${fontSerif};color:white;margin:0;font-size:28px;font-weight:600;letter-spacing:0.5px">Aicoute</h1>
      <p style="color:rgba(255,255,255,0.92);margin:6px 0 0;font-size:14px;font-style:italic">${s.tagline}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="color:#3D2817;font-size:16px;margin:0 0 8px;line-height:1.6">
        ${s.greeting(caregiver_name)}
      </p>
      <p style="color:#6B4423;font-size:16px;margin:0 0 24px;line-height:1.6">
        ${s.intro(beneficiary_name)}
      </p>

      <!-- Carte récap -->
      <div style="background:#F5EBDC;border-radius:12px;padding:18px 20px;margin-bottom:28px">
        <table role="presentation" style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#6B4423;font-size:14px;padding:4px 0">📅 ${call_date}</td>
            <td style="color:#6B4423;font-size:14px;padding:4px 0;text-align:right">⏱ ${duration_min} min</td>
          </tr>
        </table>
        <p style="color:#3D2817;font-size:15px;line-height:1.6;margin:10px 0 0">
          <strong>${s.moodPrefix}</strong> ${mood_label}
        </p>
      </div>

      <!-- Résumé narratif -->
      <h2 style="font-family:${fontSerif};color:#3D2817;font-size:20px;font-weight:600;margin:0 0 12px">${s.summaryTitle}</h2>
      <p style="color:#6B4423;font-size:15px;line-height:1.75;margin:0 0 24px">${summary}</p>

      <!-- Thèmes abordés -->
      ${key_topics.length > 0 ? `<h3 style="font-family:${fontSerif};color:#3D2817;font-size:17px;font-weight:600;margin:0 0 6px">${s.topicsTitle}</h3>${topicsHtml}` : ''}

      <!-- Alertes -->
      ${alertsHtml}

      <!-- CTA -->
      <div style="text-align:center;margin:32px 0 8px">
        <a href="${report_url}"
           style="display:inline-block;background:#C75D3A;color:white;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px">
          ${s.cta}
        </a>
      </div>
      <p style="color:#9A8467;font-size:12px;text-align:center;margin:14px 0 0;line-height:1.5">
        ${s.shareNote}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#FBF5EE;padding:20px 32px;text-align:center;border-top:1px solid #E8DCC4">
      <p style="color:#6B4423;font-size:13px;margin:0;line-height:1.6">
        © 2026 Aicoute · <a href="${app_url}/compte" style="color:#6B4423;text-decoration:underline">${s.manageNotifications}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export function noAnswerEmailHtml(params: {
  caregiver_name:         string
  beneficiary_name:       string
  beneficiary_first_name: string
  attempts:               number
  call_time:              string
  app_url:                string
  lang?:                  ReportLang
}): string {
  const { caregiver_name, beneficiary_name, beneficiary_first_name, attempts, call_time, app_url } = params
  const lang = normalizeReportLang(params.lang)
  const s    = EMAIL_STRINGS[lang]
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Source Sans Pro',Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:#C75D3A;padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700">Aicoute</h1>
      <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">${s.noAnswerTagline}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#475569;font-size:16px;margin:0 0 16px">
        ${s.greeting(caregiver_name)}
      </p>
      <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 16px">
        ${s.noAnswerIntro(beneficiary_name, call_time, attempts)}
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px">
        ${s.noAnswerReassurance(beneficiary_first_name)}
      </p>
      <div style="text-align:center;margin-top:24px">
        <a href="${app_url}/planning"
           style="display:inline-block;background:#C75D3A;color:white;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none">
          ${s.noAnswerCta}
        </a>
      </div>
    </div>
    <div style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E2E8F0">
      <p style="color:#94A3B8;font-size:13px;margin:0">
        © 2026 Aicoute · <a href="${app_url}/compte" style="color:#94A3B8">${s.manageNotifications}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Email « essai gratuit terminé » (compte aidant). Envoyé une fois quand l'essai
 * d'un mois arrive à échéance et que les appels sont mis en pause. Français
 * uniquement (email de compte, pas un compte-rendu de bénéficiaire).
 */
export function trialEndedEmailHtml(params: {
  caregiver_name: string
  app_url:        string
}): string {
  const { caregiver_name, app_url } = params
  const fontSerif = `'Fraunces', Georgia, 'Times New Roman', serif`
  const fontSans  = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FBF5EE;font-family:${fontSans};color:#3D2817">
  <div style="max-width:600px;margin:32px auto;background:#FFFEFA;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(199,93,58,0.10)">
    <div style="background:#C75D3A;padding:32px;text-align:center">
      <h1 style="font-family:${fontSerif};color:#ffffff;margin:0;font-size:28px;font-weight:600;letter-spacing:0.5px">Aicoute</h1>
      <p style="color:rgba(255,255,255,0.92);margin:6px 0 0;font-size:14px;font-style:italic">La présence qui réchauffe</p>
    </div>
    <div style="padding:36px 32px 28px">
      <h2 style="font-family:${fontSerif};color:#3D2817;font-size:22px;font-weight:600;margin:0 0 14px">
        Votre mois d'essai est terminé
      </h2>
      <p style="color:#6B4423;font-size:16px;line-height:1.65;margin:0 0 12px">
        Bonjour <strong>${caregiver_name}</strong>, nous espérons que ce premier mois
        avec Aicoute vous a plu. Votre essai gratuit vient de se terminer, et les
        appels sont <strong>en pause</strong> pour le moment.
      </p>
      <p style="color:#6B4423;font-size:16px;line-height:1.65;margin:0 0 12px">
        Pour que les appels reprennent, choisissez la formule qui vous convient
        depuis votre espace personnel.
      </p>
      <div style="text-align:center;margin:30px 0 6px">
        <a href="${app_url}/compte"
           style="display:inline-block;background:#C75D3A;color:#ffffff;padding:15px 34px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none">
          Choisir ma formule
        </a>
      </div>
    </div>
    <div style="background:#FBF5EE;padding:20px 32px;text-align:center;border-top:1px solid #E8DCC4">
      <p style="color:#6B4423;font-size:13px;margin:0">© 2026 Aicoute · Une présence pour ceux que vous aimez</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Email envoyé à l'acheteur d'un pack de minutes (paiement invité Stripe).
 * Contient le CODE à usage unique + la marche à suivre pour le créditer.
 * (Le reçu de paiement Stripe est un email distinct, géré par Stripe.)
 */
export function purchaseCodeEmailHtml(params: {
  code:      string
  pack_name: string
  minutes:   number
  amount_eur: number
  app_url:   string
}): string {
  const { code, pack_name, minutes, amount_eur, app_url } = params
  const fontSerif = `'Fraunces', Georgia, 'Times New Roman', serif`
  const fontSans  = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
  const amount = amount_eur.toFixed(2).replace('.', ',')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FBF5EE;font-family:${fontSans};color:#3D2817">
  <div style="max-width:600px;margin:32px auto;background:#FFFEFA;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(199,93,58,0.10)">
    <div style="background:#C75D3A;padding:28px 32px">
      <h1 style="font-family:${fontSerif};color:#FFFEFA;margin:0;font-size:22px;font-weight:600">Merci pour votre achat 💛</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px">
        Votre pack <strong>${escapeHtml(pack_name)}</strong> — <strong>${minutes} minutes</strong> (${amount} €) — est prêt.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 10px">Voici votre code :</p>
      <div style="background:#F5EBDC;border:2px dashed #C75D3A;border-radius:12px;padding:18px;text-align:center;margin:0 0 22px">
        <span style="font-family:${fontSerif};font-size:28px;font-weight:600;letter-spacing:2px;color:#7C1F26">${escapeHtml(code)}</span>
      </div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px"><strong>Pour créditer vos minutes :</strong></p>
      <ol style="font-size:15px;line-height:1.7;margin:0 0 22px;padding-left:20px;color:#6B4423">
        <li>Créez votre compte (ou connectez-vous) sur Aicoute.</li>
        <li>Allez dans <strong>Mon compte → Mes achats</strong>.</li>
        <li>Saisissez ce code : vos ${minutes} minutes sont créditées aussitôt.</li>
      </ol>
      <div style="text-align:center;margin:0 0 8px">
        <a href="${app_url}" style="display:inline-block;background:#C75D3A;color:#FFFEFA;text-decoration:none;font-weight:600;padding:13px 28px;border-radius:10px;font-size:15px">
          Créer mon compte / me connecter
        </a>
      </div>
    </div>
    <div style="background:#FBF5EE;padding:20px 32px;text-align:center;border-top:1px solid #E8DCC4">
      <p style="color:#6B4423;font-size:13px;margin:0">© 2026 Aicoute · Une présence pour ceux que vous aimez</p>
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
