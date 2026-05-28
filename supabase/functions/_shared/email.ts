/**
 * Service email via Resend
 * Doc : https://resend.com/docs/api-reference/emails/send-email
 */

export interface SendEmailOptions {
  to:      string | string[]
  subject: string
  html:    string
  text?:   string
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey  = Deno.env.get('RESEND_API_KEY')
  const from    = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@modect.app'

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY non défini — email non envoyé')
    return false
  }

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

const CATEGORY_LABELS: Record<EmailAlertCategory, string> = {
  health:    'Santé',
  mood:      'Humeur',
  cognition: 'Cognition',
  social:    'Lien social',
  autonomy:  'Autonomie',
  other:     'Autre',
}

const SEVERITY_STYLE: Record<EmailAlertSeverity, { bg: string; fg: string; label: string }> = {
  low:    { bg: '#FEF3C7', fg: '#92400E', label: 'Faible' },
  medium: { bg: '#FED7AA', fg: '#9A3412', label: 'Modérée' },
  high:   { bg: '#FECACA', fg: '#991B1B', label: 'Élevée' },
}

export function reportEmailHtml(params: {
  caregiver_name:  string
  beneficiary_name: string
  call_date:       string
  duration_min:    number
  mood_emoji:      string
  mood_label:      string
  summary:         string
  key_topics:      string[]
  alerts:          EmailAlert[]
  app_url:         string
}): string {
  const {
    caregiver_name, beneficiary_name, call_date, duration_min,
    mood_emoji, mood_label, summary, key_topics, alerts, app_url,
  } = params

  const alertsHtml = alerts.length > 0
    ? `<div style="background:#FFF7ED;border-left:4px solid #F97316;padding:16px;border-radius:8px;margin:16px 0">
        <strong style="color:#9A3412;display:block;margin-bottom:10px">⚠️ Signaux faibles détectés</strong>
        ${alerts.map((a) => {
          const sty = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low
          const cat = CATEGORY_LABELS[a.category] ?? CATEGORY_LABELS.other
          return `<div style="background:white;border-radius:8px;padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
              <span style="background:#F3F4F6;color:#374151;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600">${cat}</span>
              <span style="background:${sty.bg};color:${sty.fg};font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600">${sty.label}</span>
            </div>
            <p style="color:#475569;font-size:13px;margin:0;line-height:1.5">${escapeHtml(a.evidence)}</p>
          </div>`
        }).join('')}
       </div>`
    : ''

  const topicsHtml = key_topics.length > 0
    ? `<div style="margin:12px 0">
        ${key_topics.map((t) => `<span style="display:inline-block;background:#E8F4FD;color:#2D6A9F;padding:4px 12px;border-radius:20px;font-size:13px;margin:3px">${t}</span>`).join('')}
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Source Sans Pro',Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#2D6A9F;padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700">MODECT</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">La présence qui réchauffe</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="color:#475569;font-size:16px;margin:0 0 20px">
        Bonjour <strong>${caregiver_name}</strong>,
      </p>
      <p style="color:#475569;font-size:16px;margin:0 0 24px">
        Le compte-rendu de l'appel de <strong>${beneficiary_name}</strong> est disponible.
      </p>

      <!-- Résumé de l'appel -->
      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="color:#64748B;font-size:14px">📅 ${call_date}</span>
          <span style="color:#64748B;font-size:14px">⏱ ${duration_min} min</span>
          <span style="font-size:22px">${mood_emoji}</span>
        </div>
        <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0">
          <strong>Humeur :</strong> ${mood_label}
        </p>
      </div>

      <!-- Résumé narratif -->
      <h2 style="color:#1E293B;font-size:18px;margin:0 0 12px">Résumé de la conversation</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px">${summary}</p>

      <!-- Thèmes abordés -->
      ${key_topics.length > 0 ? `<h3 style="color:#1E293B;font-size:16px;margin:0 0 8px">Thèmes abordés</h3>${topicsHtml}` : ''}

      <!-- Alertes -->
      ${alertsHtml}

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px">
        <a href="${app_url}/reports"
           style="display:inline-block;background:#F4A261;color:white;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none">
          Voir le compte-rendu complet →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E2E8F0">
      <p style="color:#94A3B8;font-size:13px;margin:0">
        © 2026 MODECT · <a href="${app_url}/settings" style="color:#94A3B8">Gérer les notifications</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export function noAnswerEmailHtml(params: {
  caregiver_name:   string
  beneficiary_name: string
  attempts:         number
  call_time:        string
  app_url:          string
}): string {
  const { caregiver_name, beneficiary_name, attempts, call_time, app_url } = params
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Source Sans Pro',Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:#C75D3A;padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700">MODECT</h1>
      <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">⚠️ Appel sans réponse</p>
    </div>
    <div style="padding:32px">
      <p style="color:#475569;font-size:16px;margin:0 0 16px">
        Bonjour <strong>${caregiver_name}</strong>,
      </p>
      <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 16px">
        Nous n'avons pas réussi à joindre <strong>${beneficiary_name}</strong> lors de l'appel planifié à <strong>${call_time}</strong>${attempts > 1 ? `, malgré ${attempts} tentatives` : ''}.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px">
        Cela peut être normal (sortie, sieste, téléphone hors de portée). Si cette situation se répète, n'hésitez pas à prendre contact directement avec votre proche.
      </p>
      <div style="text-align:center;margin-top:24px">
        <a href="${app_url}/sessions"
           style="display:inline-block;background:#C75D3A;color:white;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none">
          Vérifier les plannings →
        </a>
      </div>
    </div>
    <div style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E2E8F0">
      <p style="color:#94A3B8;font-size:13px;margin:0">
        © 2026 MODECT · <a href="${app_url}/settings" style="color:#94A3B8">Gérer les notifications</a>
      </p>
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
