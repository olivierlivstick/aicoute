/**
 * Edge Function: regenerate-future-calls
 *
 * Pré-crée les calls futurs (status='scheduled') pour les schedules actifs
 * sur un horizon glissant de 15 jours. Idempotent grâce au UNIQUE partial
 * index sur calls(schedule_id, scheduled_at).
 *
 * Modes :
 *   - { schedule_id: string } → régénère uniquement pour ce schedule.
 *       Si le schedule est inactif ou n'existe plus, les futurs calls
 *       scheduled de ce schedule sont supprimés.
 *   - {} ou {schedule_id: null} → boucle sur tous les schedules actifs
 *       (utilisé par le cron quotidien pour étendre l'horizon).
 *
 * Sécurité : appelée depuis le trigger SQL avec la service-role key, depuis
 * le client back-office avec le JWT user (RLS bloquerait l'INSERT sans
 * service-role — donc on by-pass via getSupabaseAdmin).
 *
 * verify_jwt: false → on accepte tous les callers (trigger SQL n'a pas de
 * JWT utilisateur). Les opérations sont bornées au scope d'un schedule
 * passé en input, donc pas d'élévation de privilèges côté client.
 */

import { corsHeaders, handleCors }    from '../_shared/cors.ts'
import { getSupabaseAdmin }           from '../_shared/supabaseAdmin.ts'

const HORIZON_DAYS = 15

interface ScheduleRow {
  id:                     string
  beneficiary_id:         string
  days_of_week:           number[]
  time_of_day:            string  // 'HH:MM:SS'
  timezone:               string
  calls_per_week:         number
  is_active:              boolean
  beneficiaries: { is_active: boolean } | null
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json().catch(() => ({})) as { schedule_id?: string | null }
    const supabase = getSupabaseAdmin()

    let schedules: ScheduleRow[] = []

    if (body.schedule_id) {
      const { data } = await supabase
        .from('session_schedules')
        .select('id, beneficiary_id, days_of_week, time_of_day, timezone, calls_per_week, is_active, beneficiaries(is_active)')
        .eq('id', body.schedule_id)
        .maybeSingle()

      // Le schedule peut être :
      //  - absent (cas DELETE) → on supprime les futurs scheduled liés
      //  - inactif (is_active=false) → idem
      //  - actif → on régénère
      if (!data) {
        const removed = await removeFutureCalls(supabase, body.schedule_id)
        return jsonResponse({ success: true, mode: 'delete', removed })
      }
      const s = data as unknown as ScheduleRow
      if (!s.is_active || !s.beneficiaries?.is_active) {
        const removed = await removeFutureCalls(supabase, s.id)
        return jsonResponse({ success: true, mode: 'inactive', removed })
      }
      schedules = [s]
    } else {
      const { data } = await supabase
        .from('session_schedules')
        .select('id, beneficiary_id, days_of_week, time_of_day, timezone, calls_per_week, is_active, beneficiaries(is_active)')
        .eq('is_active', true)
      schedules = ((data ?? []) as unknown as ScheduleRow[])
        .filter((s) => s.beneficiaries?.is_active !== false)
    }

    let inserted = 0
    let skipped  = 0
    for (const s of schedules) {
      const slots = projectSlots(s, HORIZON_DAYS)
      if (slots.length === 0) continue

      // UPSERT en bulk : pour chaque créneau, INSERT … ON CONFLICT DO NOTHING
      const rows = slots.map((at) => ({
        beneficiary_id: s.beneficiary_id,
        schedule_id:    s.id,
        status:         'scheduled',
        scheduled_at:   at.toISOString(),
        attempt_number: 1,
      }))

      const { error, count } = await supabase
        .from('calls')
        .upsert(rows, {
          onConflict:        'schedule_id,scheduled_at',
          ignoreDuplicates:  true,
          count:             'exact',
        })
      if (error) {
        console.error(`[regenerate-future-calls] upsert schedule=${s.id}: ${error.message}`)
        continue
      }
      inserted += count ?? 0
      skipped  += slots.length - (count ?? 0)
    }

    return jsonResponse({ success: true, schedules: schedules.length, inserted, skipped })

  } catch (err) {
    console.error('[regenerate-future-calls] erreur:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      500,
    )
  }
})

/** Supprime les futurs calls 'scheduled' liés à un schedule (au moment de DELETE / désactivation). */
async function removeFutureCalls(supabase: ReturnType<typeof getSupabaseAdmin>, scheduleId: string): Promise<number> {
  const nowIso = new Date().toISOString()
  const { count, error } = await supabase
    .from('calls')
    .delete({ count: 'exact' })
    .eq('schedule_id', scheduleId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', nowIso)
  if (error) {
    console.error(`[regenerate-future-calls] removeFutureCalls schedule=${scheduleId}: ${error.message}`)
    return 0
  }
  return count ?? 0
}

/**
 * Projection des créneaux futurs sur N jours pour un schedule.
 * Logique identique à HistoriquePage.projectUpcomingSlots côté front, calée
 * dans le timezone local du serveur (UTC en pratique côté Deno) puis ajustée
 * pour le timezone du schedule.
 *
 * Volontairement simple : on parcourt jour par jour. Pour calls_per_week<7,
 * c'est forcément aligné sur days_of_week (CHECK trigger côté DB l'impose).
 */
function projectSlots(s: ScheduleRow, days: number): Date[] {
  const [hStr, mStr] = s.time_of_day.split(':')
  const hour   = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)

  const slots: Date[] = []
  const nowLocal = toZonedDate(new Date(), s.timezone)

  for (let d = 0; d <= days; d++) {
    const candidate = new Date(nowLocal)
    candidate.setDate(nowLocal.getDate() + d)
    candidate.setHours(hour, minute, 0, 0)

    if (!s.days_of_week.includes(candidate.getDay())) continue
    if (candidate <= nowLocal) continue  // on n'insère QUE des créneaux strictement futurs

    slots.push(zonedToUtc(candidate, s.timezone))
  }
  return slots
}

function toZonedDate(utcDate: Date, timezone: string): Date {
  const str = utcDate.toLocaleString('en-US', { timeZone: timezone })
  return new Date(str)
}

function zonedToUtc(localDate: Date, timezone: string): Date {
  const utcStr   = localDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = localDate.toLocaleString('en-US', { timeZone: timezone })
  const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime()
  return new Date(localDate.getTime() - offsetMs)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
