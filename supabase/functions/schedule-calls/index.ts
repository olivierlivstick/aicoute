/**
 * Edge Function: schedule-calls
 *
 * Cron job exécuté toutes les minutes. Trois passes :
 *
 *   A — Planning principal : lire les session_schedules dont next_scheduled_at
 *       tombe dans ±90s, créer un call (attempt_number=1), déclencher
 *       initiate-call, recalculer next_scheduled_at.
 *
 *   B — Détection no-answer : lire les calls 'notified' dont notified_at est
 *       plus vieux que schedule.no_answer_timeout_seconds. Selon retry_count :
 *         - Si on peut encore retry → marquer 'missed' + créer un nouveau call
 *           (attempt_number+1, scheduled_at = now + retry_interval_minutes*60)
 *         - Sinon → marquer 'missed' définitif + email aidant si notify_on_no_answer
 *
 *   C — Déclenchement des retries : lire les calls 'scheduled' avec
 *       attempt_number > 1 et scheduled_at ≤ now → trigger initiate-call.
 *
 *   D — Rattrapage des comptes-rendus : lire les calls 'completed' avec un
 *       transcript mais summary IS NULL (depuis > 2 min, < 6 h) → relancer
 *       generate-summary. Filet de sécurité contre les échecs transitoires de
 *       generate-summary (cf. save-transcript qui avale la réponse non-OK).
 *
 * Appelé par : Supabase Cron (pg_cron) — toutes les minutes
 * verify_jwt: false (appelé en interne)
 */

import { getSupabaseAdmin }              from '../_shared/supabaseAdmin.ts'
import { sendEmail, noAnswerEmailHtml, trialEndedEmailHtml, normalizeRecipients }  from '../_shared/email.ts'
import { normalizeReportLang, DATE_LOCALE, EMAIL_STRINGS } from '../_shared/reportI18n.ts'
import { evaluateSubscriptionForCall } from '../_shared/subscription.ts'
import { logEvent }                      from '../_shared/systemEvents.ts'

type Supabase = ReturnType<typeof getSupabaseAdmin>

interface CallRow {
  id: string
  beneficiary_id: string
  schedule_id: string | null
  status: string
  scheduled_at: string
  notified_at: string | null
  attempt_number: number
}

Deno.serve(async (_req: Request) => {
  const supabase    = getSupabaseAdmin()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const appUrl      = Deno.env.get('VITE_APP_URL') ?? 'https://app.aicoute.fr'

  const results = {
    triggered:      0,
    retried:        0,
    noAnswer:       0,
    retriesFired:   0,
    summaryRescued: 0,
    skipped:        0,
    errors:         [] as string[],
  }

  try {
    await passA_main(supabase, supabaseUrl, serviceKey, appUrl, results)
    await passB_noAnswer(supabase, appUrl, results)
    await passC_retryFire(supabase, supabaseUrl, serviceKey, results)
    await passD_summaryRescue(supabase, supabaseUrl, serviceKey, results)

    console.log(`[schedule-calls] A:${results.triggered} déclenchés · B:${results.retried} retry / ${results.noAnswer} no-answer · C:${results.retriesFired} retries lancés · D:${results.summaryRescued} résumés rattrapés · ${results.errors.length} erreurs`)

    // Trace système : un événement résumé par tick — utile pour suivre le pouls
    // du worker dans /admin/sante. Niveau 'warn' s'il y a eu des erreurs.
    if (results.triggered > 0 || results.retried > 0 || results.noAnswer > 0 || results.retriesFired > 0 || results.summaryRescued > 0 || results.errors.length > 0) {
      await logEvent(supabase, {
        level:   results.errors.length > 0 ? 'warn' : 'info',
        source:  'schedule-calls',
        message: `tick: A=${results.triggered} B=${results.retried}/${results.noAnswer} C=${results.retriesFired} D=${results.summaryRescued}`,
        payload: { ...results },
      })
    }

    return okResponse(results)

  } catch (err) {
    console.error('[schedule-calls] Erreur fatale:', err)
    await logEvent(supabase, {
      level:   'error',
      source:  'schedule-calls',
      message: `Erreur fatale: ${err instanceof Error ? err.message : 'inconnue'}`,
      payload: { results },
    })
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne', results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

// ============================================================================
// Pass A — Déclenchement des calls pré-créés (créneau récurrent)
// ============================================================================
// Depuis la refonte « pré-création » : les calls sont déjà en base avec
// status='scheduled' (créés par regenerate-future-calls). La passe A se
// contente de DÉCLENCHER ceux dont scheduled_at tombe dans la fenêtre ±90s.
//
// Le filtre attempt_number=1 distingue les premières tentatives (gérées ici)
// des retries (gérés par la passe C, qui scrute scheduled_at déjà passé).

async function passA_main(
  supabase: Supabase,
  supabaseUrl: string,
  serviceKey: string,
  appUrl: string,
  results: { triggered: number; skipped: number; errors: string[] },
): Promise<void> {
  const windowStart = new Date(Date.now() - 90_000).toISOString()
  const windowEnd   = new Date(Date.now() + 90_000).toISOString()

  const { data: due, error } = await supabase
    .from('calls')
    .select('id, beneficiary_id, beneficiaries(is_active, caregiver_id, profiles(email, full_name))')
    .eq('status', 'scheduled')
    .eq('attempt_number', 1)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (error) throw new Error(`Fetch due calls: ${error.message}`)
  if (!due || due.length === 0) return

  // deno-lint-ignore no-explicit-any
  for (const call of due as Array<any>) {
    try {
      const ben = call.beneficiaries
      // Bénéficiaire désactivé entre-temps → on saute (le call reste 'scheduled'
      // mais ne sera jamais déclenché ; régénération suivante le supprimera).
      if (ben && ben.is_active === false) {
        results.skipped++
        continue
      }

      // Paywall : pas d'appel si l'essai/abonnement est expiré. Un compte sans
      // abonnement (créé avant la feature) reste autorisé (grandfather).
      const caregiverId = ben?.caregiver_id ?? null
      if (caregiverId) {
        const verdict = await evaluateSubscriptionForCall(supabase, caregiverId)
        if (verdict !== 'ok') {
          results.skipped++
          if (verdict === 'just_expired') {
            // Met les plannings du compte en pause + prévient l'aidant (une fois).
            await supabase
              .from('session_schedules')
              .update({ is_active: false })
              .eq('caregiver_id', caregiverId)
              .eq('is_active', true)
            const caregiver = ben?.profiles
            if (caregiver?.email) {
              await sendEmail({
                to:      caregiver.email,
                subject: 'Votre essai Aicoute est terminé',
                html:    trialEndedEmailHtml({
                  caregiver_name: caregiver.full_name ?? 'Aidant',
                  app_url:        appUrl,
                }),
              })
            }
            await logEvent(supabase, {
              level:   'info',
              source:  'schedule-calls/A',
              call_id: call.id,
              message: 'Essai expiré → plannings mis en pause, appel non déclenché',
              payload: { caregiver_id: caregiverId },
            })
          }
          continue
        }
      }

      triggerInitiateCall(supabaseUrl, serviceKey, call.id)
      results.triggered++
    } catch (callErr) {
      const msg = callErr instanceof Error ? callErr.message : String(callErr)
      console.error(`[schedule-calls/A] Erreur call ${call.id}:`, msg)
      results.errors.push(`A:${call.id}: ${msg}`)
    }
  }
}

// ============================================================================
// Pass B — Politique no-answer (relances + email final)
// ============================================================================
// Découplée du statut 'notified' (cf. migration 20260629000001) : le webhook
// Twilio /scheduled-status (et l'AMD) marque l'appel 'missed' en quelques
// secondes, donc on NE PEUT PLUS attendre un appel bloqué en 'notified' pour
// décider de la relance. On agit sur les appels DÉJÀ 'missed'/'failed' d'un
// planning récurrent qui n'ont pas encore été arbitrés (no_answer_handled_at
// IS NULL), quel que soit QUI les a marqués. Deux sous-étapes :
//
//   B1 — Filet « webhook perdu » : un appel resté 'notified' au-delà de
//        no_answer_timeout_seconds → on le passe 'missed' (sans rien décider de
//        plus : B2 le récupérera, possiblement au même tick).
//   B2 — Arbitrage : pour chaque appel 'missed'/'failed' non traité d'un
//        schedule, créer une relance si attempt_number ≤ retry_count, sinon
//        envoyer l'email « pas de réponse » à l'aidant + aux proches. On pose
//        no_answer_handled_at en PREMIER (claim-then-act, condition IS NULL)
//        pour qu'un chevauchement de ticks ne double ni la relance ni l'email.

async function passB_noAnswer(
  supabase: Supabase,
  appUrl: string,
  results: { retried: number; noAnswer: number; errors: string[] },
): Promise<void> {
  await passB1_markStaleNotified(supabase, results)
  await passB2_handleMissed(supabase, appUrl, results)
}

/** B1 — Filet de sécurité si le statusCallback Twilio est perdu : un appel resté
 *  en 'notified' au-delà du timeout passe 'missed'. La relance/email est laissée
 *  à B2 (qui le verra au même tick, no_answer_handled_at étant NULL). */
async function passB1_markStaleNotified(
  supabase: Supabase,
  results: { errors: string[] },
): Promise<void> {
  // Borne large : on relit ensuite le timeout précis du schedule (30→600s).
  const cutoff = new Date(Date.now() - 30_000).toISOString()

  const { data: stuck, error } = await supabase
    .from('calls')
    .select('id, schedule_id, notified_at')
    .eq('status', 'notified')
    .lt('notified_at', cutoff)

  if (error) throw new Error(`Fetch stuck notified calls: ${error.message}`)
  if (!stuck || stuck.length === 0) return

  for (const call of stuck as Array<{ id: string; schedule_id: string | null; notified_at: string | null }>) {
    try {
      if (!call.schedule_id || !call.notified_at) continue

      const { data: schedule } = await supabase
        .from('session_schedules')
        .select('no_answer_timeout_seconds')
        .eq('id', call.schedule_id)
        .single()
      if (!schedule) continue

      const elapsedMs = Date.now() - new Date(call.notified_at).getTime()
      if (elapsedMs < schedule.no_answer_timeout_seconds * 1000) continue

      await supabase
        .from('calls')
        .update({ status: 'missed', ended_at: new Date().toISOString() })
        .eq('id', call.id)
        .eq('status', 'notified')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[schedule-calls/B1] Erreur call ${call.id}:`, msg)
      results.errors.push(`B1:${call.id}: ${msg}`)
    }
  }
}

/** B2 — Arbitrage des appels non aboutis d'un planning récurrent. */
async function passB2_handleMissed(
  supabase: Supabase,
  appUrl: string,
  results: { retried: number; noAnswer: number; errors: string[] },
): Promise<void> {
  // 'missed' = no-answer / occupé / répondeur (AMD). 'failed' = échec technique
  // (Twilio failed/canceled) — relancé aussi (décision produit). schedule_id non
  // NULL exclut nativement les appels entrants et de campagne.
  const { data: pending, error } = await supabase
    .from('calls')
    .select('id, beneficiary_id, schedule_id, scheduled_at, attempt_number')
    .in('status', ['missed', 'failed'])
    .not('schedule_id', 'is', null)
    .is('no_answer_handled_at', null)

  if (error) throw new Error(`Fetch pending no-answer calls: ${error.message}`)
  if (!pending || pending.length === 0) return

  for (const call of pending as CallRow[]) {
    try {
      // Claim : poser le marqueur AVANT d'agir. Si une autre exécution l'a déjà
      // pris (race entre ticks), la condition IS NULL ne matche pas → on saute.
      const { data: claimed } = await supabase
        .from('calls')
        .update({ no_answer_handled_at: new Date().toISOString() })
        .eq('id', call.id)
        .is('no_answer_handled_at', null)
        .select('id')
        .maybeSingle()
      if (!claimed) continue

      // Garde-fou anti-acharnement : un appel non abouti vieux de plus de 6 h
      // (cron en retard, appel resté bloqué…) est marqué traité sans relance ni
      // email — on ne relance pas un rendez-vous périmé. Cohérent avec la passe D.
      const ageMs = Date.now() - new Date(call.scheduled_at).getTime()
      if (ageMs > 6 * 3600_000) {
        console.log(`[schedule-calls/B2] Appel non abouti périmé (>6h) ignoré call=${call.id}`)
        continue
      }

      const { data: schedule } = await supabase
        .from('session_schedules')
        .select('id, retry_count, retry_interval_minutes, notify_on_no_answer, timezone, beneficiaries(first_name, last_name, caregiver_id, report_language, report_recipients, profiles(email, full_name))')
        .eq('id', call.schedule_id!)
        .single()

      if (!schedule) continue

      // Peut-on encore relancer ? retry_count = nb de rappels EN PLUS du 1er appel.
      const canRetry = call.attempt_number <= schedule.retry_count
      if (canRetry) {
        const nextScheduledAt = new Date(Date.now() + schedule.retry_interval_minutes * 60_000).toISOString()
        await supabase.from('calls').insert({
          beneficiary_id: call.beneficiary_id,
          schedule_id:    call.schedule_id,
          status:         'scheduled',
          scheduled_at:   nextScheduledAt,
          attempt_number: call.attempt_number + 1,
        })
        console.log(`[schedule-calls/B2] Non abouti → relance #${call.attempt_number + 1} planifiée à ${nextScheduledAt}`)
        results.retried++
      } else {
        // Plus de relance possible → email « pas de réponse » à l'aidant + proches.
        results.noAnswer++
        await logEvent(supabase, {
          level:   'warn',
          source:  'schedule-calls/B2',
          call_id: call.id,
          message: `No-answer définitif après ${call.attempt_number} tentative(s)`,
          payload: { schedule_id: call.schedule_id, attempt_number: call.attempt_number },
        })
        if (schedule.notify_on_no_answer) {
          // deno-lint-ignore no-explicit-any
          const beneficiary = (schedule as any).beneficiaries
          const caregiver   = beneficiary?.profiles
          const recipients  = normalizeRecipients([
            caregiver?.email,
            ...(beneficiary?.report_recipients ?? []),
          ])
          if (recipients.length > 0) {
            const reportLang = normalizeReportLang(beneficiary.report_language)
            await sendEmail({
              to:      recipients,
              subject: EMAIL_STRINGS[reportLang].noAnswerSubject(beneficiary.first_name),
              html: noAnswerEmailHtml({
                caregiver_name:         caregiver?.full_name ?? 'Aidant',
                beneficiary_name:       `${beneficiary.first_name} ${beneficiary.last_name}`,
                beneficiary_first_name: beneficiary.first_name,
                attempts:               call.attempt_number,
                // Fuseau du planning (défaut Europe/Paris) : sans timeZone, l'Edge
                // Function formate en UTC → heure décalée dans l'email.
                call_time:              new Date(call.scheduled_at).toLocaleString(DATE_LOCALE[reportLang], {
                  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                  timeZone: schedule.timezone ?? 'Europe/Paris',
                }),
                app_url:                appUrl,
                lang:                   reportLang,
              }),
            })
          }
        }
        console.log(`[schedule-calls/B2] No-answer définitif (${call.attempt_number} tentative(s)) call=${call.id}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[schedule-calls/B2] Erreur call ${call.id}:`, msg)
      results.errors.push(`B2:${call.id}: ${msg}`)
    }
  }
}

// ============================================================================
// Pass C — Déclenchement des retries (calls scheduled, attempt > 1, dus)
// ============================================================================

async function passC_retryFire(
  supabase: Supabase,
  supabaseUrl: string,
  serviceKey: string,
  results: { retriesFired: number; errors: string[] },
): Promise<void> {
  const nowIso = new Date().toISOString()

  const { data: due, error } = await supabase
    .from('calls')
    .select('id')
    .eq('status', 'scheduled')
    .gt('attempt_number', 1)
    .lte('scheduled_at', nowIso)

  if (error) throw new Error(`Fetch retry-due calls: ${error.message}`)
  if (!due || due.length === 0) return

  for (const call of due) {
    try {
      triggerInitiateCall(supabaseUrl, serviceKey, call.id)
      console.log(`[schedule-calls/C] Retry déclenché call=${call.id}`)
      results.retriesFired++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`C:${call.id}: ${msg}`)
    }
  }
}

// ============================================================================
// Pass D — Rattrapage des comptes-rendus manquants
// ============================================================================
// Filet de sécurité : generate-summary peut échouer de façon transitoire (ex:
// GPT-4o momentanément indisponible) au moment de l'appel. save-transcript avale
// cette réponse non-OK (renvoie quand même 200 au voice-bridge) → le compte-rendu
// + l'email sont perdus en silence, sans retry. Cette passe repère ces calls et
// relance generate-summary.
//
// Critère : status='completed', transcript présent, summary IS NULL.
//   - summary IS NULL est le signal propre que generate-summary n'a pas abouti
//     (au pire elle écrit un summary placeholder, donc non-null → plus repris).
//   - ended_at > now-2min : on laisse la 1re tentative (save-transcript→summary,
//     ~10s) se terminer avant de doublonner.
//   - ended_at < now-6h : borne anti-acharnement (un call cassé n'est pas relancé
//     indéfiniment ; au-delà, rattrapage manuel).
// Plafonné à 5 par tick (await en parallèle) pour borner la latence + le coût.

async function passD_summaryRescue(
  supabase: Supabase,
  supabaseUrl: string,
  serviceKey: string,
  results: { summaryRescued: number; errors: string[] },
): Promise<void> {
  const minAge = new Date(Date.now() - 2 * 60_000).toISOString()   // > 2 min
  const maxAge = new Date(Date.now() - 6 * 3600_000).toISOString() // < 6 h

  const { data: orphans, error } = await supabase
    .from('calls')
    .select('id')
    .eq('status', 'completed')
    .is('summary', null)
    .not('transcript', 'is', null)
    .lt('ended_at', minAge)
    .gt('ended_at', maxAge)
    .order('ended_at', { ascending: false })
    .limit(5)

  if (error) throw new Error(`Fetch summary-orphan calls: ${error.message}`)
  if (!orphans || orphans.length === 0) return

  // await en parallèle : generate-summary est invoquée pour de bon (pas de
  // fire-and-forget, peu fiable côté runtime Edge — cf. CLAUDE.md). ~10-15s.
  const outcomes = await Promise.all(
    orphans.map((c) => triggerGenerateSummary(supabaseUrl, serviceKey, c.id)),
  )

  orphans.forEach((c, i) => {
    if (outcomes[i].ok) {
      results.summaryRescued++
      console.log(`[schedule-calls/D] Compte-rendu rattrapé call=${c.id}`)
    } else {
      results.errors.push(`D:${c.id}: ${outcomes[i].error}`)
      console.error(`[schedule-calls/D] Échec rattrapage call=${c.id}: ${outcomes[i].error}`)
    }
  })

  if (results.summaryRescued > 0) {
    await logEvent(supabase, {
      level:   'warn',
      source:  'schedule-calls/D',
      message: `${results.summaryRescued} compte(s)-rendu(s) rattrapé(s) après échec transitoire de generate-summary`,
      payload: { rescued: results.summaryRescued, candidates: orphans.length },
    })
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Relance generate-summary en attendant la réponse (filet passe D). */
async function triggerGenerateSummary(
  supabaseUrl: string,
  serviceKey: string,
  callId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ call_id: callId }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status} ${detail.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function triggerInitiateCall(supabaseUrl: string, serviceKey: string, callId: string): void {
  fetch(`${supabaseUrl}/functions/v1/initiate-call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ call_id: callId }),
  }).catch((err) => console.error(`[schedule-calls] initiate-call error: ${err.message}`))
}

function okResponse(results: object): Response {
  return new Response(JSON.stringify({ success: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
