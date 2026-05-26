/**
 * Edge Function: schedule-calls
 *
 * Rôle : Cron job exécuté toutes les minutes.
 *   1. Lit tous les session_schedules actifs avec next_scheduled_at dans ±90s
 *   2. Vérifie qu'aucun call en cours/planifié n'existe déjà pour ce créneau
 *   3. Crée un enregistrement calls (status='scheduled')
 *   4. Déclenche initiate-call
 *   5. Recalcule next_scheduled_at pour la prochaine occurrence
 *
 * Appelé par : Supabase Cron (pg_cron) — toutes les minutes
 * verify_jwt: false (appelé en interne)
 */

import { getSupabaseAdmin }        from '../_shared/supabaseAdmin.ts'
import { calculateNextScheduledAt, isDue } from '../_shared/scheduling.ts'
import { sendEmail }               from '../_shared/email.ts'

Deno.serve(async (_req: Request) => {
  const supabase    = getSupabaseAdmin()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const appUrl      = Deno.env.get('VITE_APP_URL') ?? 'https://app.modect.app'

  const results = {
    checked:    0,
    triggered:  0,
    skipped:    0,
    errors:     [] as string[],
  }

  try {
    // 1. Récupérer tous les plannings actifs dont next_scheduled_at est proche
    const windowStart = new Date(Date.now() - 90_000).toISOString()
    const windowEnd   = new Date(Date.now() + 90_000).toISOString()

    const { data: schedules, error: schedErr } = await supabase
      .from('session_schedules')
      .select('*, beneficiaries(id, first_name, last_name, push_token, is_active, caregiver_id, profiles(email, full_name))')
      .eq('is_active', true)
      .not('next_scheduled_at', 'is', null)
      .gte('next_scheduled_at', windowStart)
      .lte('next_scheduled_at', windowEnd)

    if (schedErr) throw new Error(`Fetch schedules: ${schedErr.message}`)
    if (!schedules || schedules.length === 0) {
      console.log('[schedule-calls] Aucun planning à déclencher')
      return okResponse(results)
    }

    results.checked = schedules.length
    console.log(`[schedule-calls] ${schedules.length} planning(s) à traiter`)

    for (const schedule of schedules) {
      try {
        const beneficiary = schedule.beneficiaries

        // 2. Vérifier que le bénéficiaire est actif
        if (!beneficiary?.is_active) {
          results.skipped++
          console.log(`[schedule-calls] Bénéficiaire inactif: ${schedule.beneficiary_id}`)
          continue
        }

        // 3. Vérifier qu'aucun call doublon n'existe dans les 10 dernières minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
        const { count: existingCount } = await supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('beneficiary_id', beneficiary.id)
          .eq('schedule_id', schedule.id)
          .in('status', ['scheduled', 'notified', 'in_progress'])
          .gte('created_at', tenMinAgo)

        if (existingCount && existingCount > 0) {
          results.skipped++
          console.log(`[schedule-calls] Call déjà existant pour schedule ${schedule.id}`)
          // Recalculer quand même le prochain créneau
          await recalculateNext(supabase, schedule)
          continue
        }

        // 4. Créer l'entrée call
        const { data: newCall, error: callErr } = await supabase
          .from('calls')
          .insert({
            beneficiary_id: beneficiary.id,
            schedule_id:    schedule.id,
            status:         'scheduled',
            scheduled_at:   schedule.next_scheduled_at,
          })
          .select('id')
          .single()

        if (callErr || !newCall) {
          throw new Error(`Insert call failed: ${callErr?.message}`)
        }

        console.log(`[schedule-calls] Call créé: ${newCall.id} pour ${beneficiary.first_name}`)

        // 5. Déclencher initiate-call (fire-and-forget)
        fetch(`${supabaseUrl}/functions/v1/initiate-call`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ call_id: newCall.id }),
        }).catch((err) => console.error(`[schedule-calls] initiate-call error: ${err.message}`))

        // 6. Recalculer next_scheduled_at
        await recalculateNext(supabase, schedule)

        results.triggered++

      } catch (scheduleErr) {
        const msg = scheduleErr instanceof Error ? scheduleErr.message : String(scheduleErr)
        console.error(`[schedule-calls] Erreur schedule ${schedule.id}:`, msg)
        results.errors.push(`${schedule.id}: ${msg}`)

        // Notifier l'aidant si l'appel a échoué à se déclencher
        await notifyCaregiverOfMissedCall(supabase, schedule, appUrl)
      }
    }

    console.log(`[schedule-calls] Bilan: ${results.triggered} déclenchés, ${results.skipped} ignorés, ${results.errors.length} erreurs`)
    return okResponse(results)

  } catch (err) {
    console.error('[schedule-calls] Erreur fatale:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne', results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

// --- Helpers ---

async function recalculateNext(
  supabase: ReturnType<typeof import('../_shared/supabaseAdmin.ts').getSupabaseAdmin>,
  schedule: { id: string; days_of_week: number[]; time_of_day: string; timezone: string },
) {
  const next = calculateNextScheduledAt(
    schedule.days_of_week,
    schedule.time_of_day,
    schedule.timezone,
  )

  await supabase
    .from('session_schedules')
    .update({ next_scheduled_at: next?.toISOString() ?? null })
    .eq('id', schedule.id)

  if (next) {
    console.log(`[schedule-calls] Prochain créneau pour ${schedule.id}: ${next.toISOString()}`)
  }
}

async function notifyCaregiverOfMissedCall(
  supabase: ReturnType<typeof import('../_shared/supabaseAdmin.ts').getSupabaseAdmin>,
  schedule: {
    beneficiaries?: {
      first_name: string
      caregiver_id: string
      profiles?: { email: string; full_name: string } | null
    }
  },
  appUrl: string,
) {
  const beneficiary = schedule.beneficiaries
  const caregiver   = beneficiary?.profiles
  if (!caregiver?.email) return

  // Marquer tout call scheduled comme 'missed'
  await supabase
    .from('calls')
    .update({ status: 'missed' })
    .eq('schedule_id', (schedule as { id: string }).id)
    .eq('status', 'scheduled')

  await sendEmail({
    to:      caregiver.email,
    subject: `⚠️ Appel manqué — ${beneficiary?.first_name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#DC2626">⚠️ Appel manqué</h2>
        <p>Bonjour <strong>${caregiver.full_name}</strong>,</p>
        <p>L'appel planifié pour <strong>${beneficiary?.first_name}</strong> n'a pas pu être déclenché.</p>
        <p>Vérifiez la connexion internet de votre proche et la configuration du planning.</p>
        <a href="${appUrl}/sessions"
           style="display:inline-block;background:#2D6A9F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">
          Vérifier les plannings →
        </a>
      </div>`,
  })
}

function okResponse(results: object): Response {
  return new Response(JSON.stringify({ success: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
