/**
 * Edge Function: resend-report
 *
 * Renvoie l'email de compte-rendu d'un appel à l'aidant (action manuelle
 * « Renvoyer le mail » depuis /admin/appels). Réservée aux admins.
 *
 * Deux cas :
 *   1. Le compte-rendu n'a JAMAIS été généré (summary IS NULL — typiquement le
 *      bug « generate-summary avalé en silence ») → on délègue à
 *      generate-summary, qui génère résumé + alertes + mémoires PUIS envoie
 *      l'email. C'est la seule branche qui touche conversation_memory.
 *   2. Le compte-rendu existe déjà (summary présent) → on RECONSTRUIT l'email à
 *      partir des champs déjà stockés et on le renvoie, SANS rappeler GPT-4o et
 *      SANS réinsérer de mémoires (sinon clic répété = doublons). Idempotent :
 *      cliquable autant de fois que voulu.
 *
 * Input : { call_id: string }
 * verify_jwt: false — auth gérée en interne via requireAdmin (JWT appelant).
 */

import { corsHeaders, handleCors }      from '../_shared/cors.ts'
import { getSupabaseAdmin }             from '../_shared/supabaseAdmin.ts'
import { requireAdmin }                 from '../_shared/requireAdmin.ts'
import { sendEmail, reportEmailHtml, normalizeRecipients } from '../_shared/email.ts'
import type { EmailAlert }              from '../_shared/email.ts'
import { issueReportToken }             from '../_shared/reportToken.ts'
import { normalizeReportLang, MOOD_LABELS, DATE_LOCALE, EMAIL_STRINGS } from '../_shared/reportI18n.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseAdmin()

    // Garde-fou : appelant admin authentifié uniquement.
    const auth = await requireAdmin(req, supabase)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const { call_id } = await req.json() as { call_id: string }
    if (!call_id) return jsonResponse({ error: 'call_id requis' }, 400)

    const appUrl = Deno.env.get('VITE_APP_URL') ?? 'https://app.aicoute.fr'

    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('*, beneficiaries(*, profiles(full_name, email, timezone))')
      .eq('id', call_id)
      .single()

    if (callErr || !call) return jsonResponse({ error: 'Call introuvable' }, 404)

    const beneficiary = call.beneficiaries
    const caregiver   = beneficiary?.profiles

    // Destinataires : aidant + proches déclarés (beneficiaries.report_recipients).
    const recipients = normalizeRecipients([
      caregiver?.email,
      ...(Array.isArray(beneficiary?.report_recipients) ? beneficiary.report_recipients : []),
    ])
    if (recipients.length === 0) {
      return jsonResponse({ error: "Aucune adresse email valide (aidant ni destinataires)." }, 422)
    }

    // ── Cas 1 : compte-rendu jamais généré → on délègue à generate-summary.
    //    (generate-summary enverra l'email lui-même puisque report_email_sent_at
    //    est NULL ; il insère aussi les mémoires — légitime, c'est la 1re fois.)
    const hasSummary = typeof call.summary === 'string' && call.summary.trim().length > 0
    if (!hasSummary) {
      const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-summary`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ call_id }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return jsonResponse({ error: `Génération du compte-rendu échouée (HTTP ${res.status})`, detail: detail.slice(0, 300) }, 502)
      }
      const body = await res.json().catch(() => ({}))
      return jsonResponse({ success: true, mode: 'generated', report_email_sent: body?.report_email_sent ?? true })
    }

    // ── Cas 2 : compte-rendu déjà là → on renvoie l'email tel quel.
    // Langue = snapshot du rapport (calls.report_language) pour rester cohérent
    // avec le texte déjà stocké ; fallback réglage bénéficiaire puis 'fr'.
    const reportLang  = normalizeReportLang(call.report_language ?? beneficiary?.report_language)
    const callDate    = new Date(call.ended_at ?? call.scheduled_at)
    const durationMin = call.duration_seconds ? Math.round(call.duration_seconds / 60) : 0
    const moodKey     = (['positive', 'neutral', 'concerned'] as const).includes(call.mood_detected)
                        ? call.mood_detected as 'positive' | 'neutral' | 'concerned' : 'neutral'
    const moodLabel   = MOOD_LABELS[reportLang][moodKey]
    // timeZone explicite (Edge en UTC) → fuseau de l'aidant, défaut Europe/Paris.
    const dateFormatted = callDate.toLocaleDateString(DATE_LOCALE[reportLang], {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: caregiver?.timezone ?? 'Europe/Paris',
    })

    // Renvoi → jeton de partage frais (la fenêtre 48h repart de ce renvoi,
    // l'éventuel ancien lien devient invalide).
    const { url: reportUrl } = await issueReportToken(supabase, call_id)

    const ok = await sendEmail({
      to:      recipients,
      subject: EMAIL_STRINGS[reportLang].subject(beneficiary.first_name, moodLabel, moodKey === 'concerned'),
      html: reportEmailHtml({
        caregiver_name:   caregiver.full_name ?? 'Aidant',
        beneficiary_name: `${beneficiary.first_name} ${beneficiary.last_name}`,
        call_date:        dateFormatted,
        duration_min:     durationMin,
        mood_label:       moodLabel,
        summary:          call.summary,
        key_topics:       Array.isArray(call.key_topics) ? call.key_topics : [],
        alerts:           (Array.isArray(call.alerts) ? call.alerts : []) as EmailAlert[],
        app_url:          appUrl,
        report_url:       reportUrl,
        lang:             reportLang,
      }),
    })

    if (!ok) return jsonResponse({ error: "L'envoi via Resend a échoué (voir logs)." }, 502)

    // Met à jour l'horodatage d'envoi (renseigne aussi le 1er envoi si NULL).
    await supabase
      .from('calls')
      .update({ report_email_sent_at: new Date().toISOString() })
      .eq('id', call_id)

    return jsonResponse({ success: true, mode: 'resent', report_email_sent: true })

  } catch (err) {
    console.error('[resend-report] Erreur:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
