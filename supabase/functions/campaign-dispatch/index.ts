/**
 * Edge Function: campaign-dispatch
 *
 * Cron (toutes les minutes) — MOTEUR des campagnes d'appels en masse (org).
 * Pour chaque campagne `running` :
 *   1. Fenêtre de DATES (timezone campagne) : passé `ends_on` → `completed` ;
 *      avant `starts_on` → rien.
 *   2. Libère les appels zombies (status='notified' depuis trop longtemps =
 *      statusCallback Twilio perdu) → 'missed' (rend le créneau + relançable).
 *   3. Auto-complétion : si tous les bénéficiaires sont joints ou ont épuisé
 *      leurs relances et qu'aucun appel n'est en vol → `completed`.
 *   4. Plage HORAIRE quotidienne : hors plage → rien.
 *   5. CONCURRENCE par campagne : dispo = max_concurrent_calls − (en vol).
 *      Sélectionne jusqu'à `dispo` bénéficiaires éligibles (jamais tentés, ou
 *      dernier essai missed/failed assez ancien et relances non épuisées),
 *      crée un call (origin='campaign') et déclenche initiate-call.
 *
 * Appelé par : pg_cron (fonction SECURITY DEFINER public.dispatch_campaigns).
 * verify_jwt: false (appel interne service-role).
 */

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { logEvent }         from '../_shared/systemEvents.ts'

type Supabase = ReturnType<typeof getSupabaseAdmin>

// Un appel 'notified' (= en sonnerie, pas encore décroché) plus vieux que ce
// seuil signale un statusCallback Twilio perdu → on le considère manqué pour
// libérer le créneau de concurrence. La sonnerie réelle est bornée à ~30s.
const NOTIFIED_TIMEOUT_MS = 150_000

interface Campaign {
  id: string
  org_id: string
  starts_on: string | null
  ends_on: string | null
  timezone: string
  daily_start_time: string
  daily_end_time: string
  max_concurrent_calls: number
  retry_count: number
  retry_interval_minutes: number
}

interface CampaignCall {
  id: string
  beneficiary_id: string
  status: string
  notified_at: string | null
  scheduled_at: string | null
  created_at: string
}

const IN_FLIGHT = new Set(['scheduled', 'notified', 'in_progress'])

Deno.serve(async (_req: Request) => {
  const supabase    = getSupabaseAdmin()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const results = { triggered: 0, completed: 0, freed: 0, skipped: 0, errors: [] as string[] }

  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, org_id, starts_on, ends_on, timezone, daily_start_time, daily_end_time, max_concurrent_calls, retry_count, retry_interval_minutes')
      .eq('status', 'running')
    if (error) throw new Error(`Fetch running campaigns: ${error.message}`)

    for (const c of (campaigns ?? []) as Campaign[]) {
      try {
        await processCampaign(supabase, supabaseUrl, serviceKey, c, results)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.errors.push(`${c.id}: ${msg}`)
        console.error(`[campaign-dispatch] campagne ${c.id}:`, msg)
      }
    }

    if (results.triggered || results.completed || results.freed || results.errors.length) {
      await logEvent(supabase, {
        level:   results.errors.length ? 'warn' : 'info',
        source:  'campaign-dispatch',
        message: `tick: ${results.triggered} déclenchés · ${results.completed} terminées · ${results.freed} libérés · ${results.errors.length} erreurs`,
        payload: { ...results },
      })
    }

    return json({ success: true, ...results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[campaign-dispatch] fatal:', msg)
    await logEvent(supabase, { level: 'error', source: 'campaign-dispatch', message: `fatal: ${msg}`, payload: { results } })
    return json({ error: msg, results }, 500)
  }
})

async function processCampaign(
  supabase: Supabase,
  supabaseUrl: string,
  serviceKey: string,
  c: Campaign,
  results: { triggered: number; completed: number; freed: number; skipped: number; errors: string[] },
): Promise<void> {
  const now = new Date()
  const local = localParts(now, c.timezone)

  // 1. Fenêtre de dates
  if (c.ends_on && local.date > c.ends_on) {
    await complete(supabase, c.id)
    results.completed++
    return
  }
  if (c.starts_on && local.date < c.starts_on) {
    results.skipped++
    return
  }

  // Membres + appels de la campagne
  const { data: memberRows } = await supabase
    .from('campaign_beneficiaries')
    .select('beneficiary_id, beneficiaries(id, phone, is_active)')
    .eq('campaign_id', c.id)
  const members = ((memberRows ?? []) as unknown as { beneficiaries: { id: string; phone: string | null; is_active: boolean } | null }[])
    .map((r) => r.beneficiaries)
    .filter((b): b is { id: string; phone: string | null; is_active: boolean } => !!b)

  const { data: callRows } = await supabase
    .from('calls')
    .select('id, beneficiary_id, status, notified_at, scheduled_at, created_at')
    .eq('campaign_id', c.id)
  const calls = (callRows ?? []) as CampaignCall[]

  // 2. Libère les appels zombies (en vol depuis trop longtemps = statusCallback
  //    Twilio perdu, ou initiate-call qui n'a jamais basculé le call). On marque
  //    'missed' (notified : sonnerie sans réponse) ou 'failed' (scheduled jamais
  //    déclenché) → le créneau est rendu ET le bénéficiaire redevient relançable.
  //    Mutation locale aussi → les comptages ci-dessous voient l'état corrigé.
  const stuckMs = Date.now() - NOTIFIED_TIMEOUT_MS
  for (const k of calls) {
    const isStuckNotified  = k.status === 'notified'  && k.notified_at && new Date(k.notified_at).getTime()  < stuckMs
    const isStuckScheduled = k.status === 'scheduled' && new Date(k.scheduled_at ?? k.created_at).getTime() < stuckMs
    if (isStuckNotified || isStuckScheduled) {
      const newStatus = isStuckNotified ? 'missed' : 'failed'
      await supabase.from('calls').update({ status: newStatus, ended_at: now.toISOString() }).eq('id', k.id)
      k.status = newStatus
      results.freed++
    }
  }

  const byBenef = new Map<string, CampaignCall[]>()
  for (const k of calls) {
    const arr = byBenef.get(k.beneficiary_id) ?? []
    arr.push(k)
    byBenef.set(k.beneficiary_id, arr)
  }
  const inFlight = calls.filter((k) => IN_FLIGHT.has(k.status)).length
  const maxAttempts = c.retry_count + 1   // 1er essai + relances

  // Statut d'un membre vis-à-vis de la campagne
  const callable = members.filter((m) => m.phone && m.phone.trim() && m.is_active !== false)
  const classify = (m: { id: string }) => {
    const bc = byBenef.get(m.id) ?? []
    if (bc.some((k) => k.status === 'completed')) return 'done'
    if (bc.some((k) => IN_FLIGHT.has(k.status))) return 'inflight'
    const attempts = bc.length
    if (attempts >= maxAttempts) return 'exhausted'
    return 'pending'
  }

  // 3. Auto-complétion : tout le monde joint/épuisé/injoignable + rien en vol
  const allSettled = members.every((m) => {
    if (!m.phone || !m.phone.trim() || m.is_active === false) return true
    const cls = classify(m)
    return cls === 'done' || cls === 'exhausted'
  })
  if (members.length > 0 && allSettled && inFlight === 0) {
    await complete(supabase, c.id)
    results.completed++
    return
  }

  // 4. Plage horaire quotidienne
  const startMin = toMinutes(c.daily_start_time)
  const endMin   = toMinutes(c.daily_end_time)
  if (local.minutes < startMin || local.minutes >= endMin) {
    results.skipped++
    return
  }

  // 5. Concurrence : combien de créneaux libres ?
  const available = c.max_concurrent_calls - inFlight
  if (available <= 0) {
    results.skipped++
    return
  }

  // Éligibles : jamais tentés (prioritaires), ou relance due
  const eligible: { id: string; attempts: number; lastAt: number }[] = []
  for (const m of callable) {
    const bc = byBenef.get(m.id) ?? []
    if (classify(m) !== 'pending') continue
    const attempts = bc.length
    if (attempts === 0) {
      eligible.push({ id: m.id, attempts: 0, lastAt: 0 })
      continue
    }
    const lastAt = Math.max(...bc.map((k) => new Date(k.notified_at ?? k.scheduled_at ?? k.created_at).getTime()))
    if (Date.now() - lastAt < c.retry_interval_minutes * 60_000) continue   // pas encore l'heure de relancer
    eligible.push({ id: m.id, attempts, lastAt })
  }
  // jamais tentés d'abord, puis le plus ancien essai
  eligible.sort((a, b) => (a.attempts - b.attempts) || (a.lastAt - b.lastAt))

  const batch = eligible.slice(0, available)
  for (const e of batch) {
    const { data: inserted, error: insErr } = await supabase
      .from('calls')
      .insert({
        beneficiary_id: e.id,
        campaign_id:    c.id,
        origin:         'campaign',
        status:         'scheduled',
        scheduled_at:   now.toISOString(),
        attempt_number: e.attempts + 1,
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      results.errors.push(`${c.id}/${e.id}: insert ${insErr?.message}`)
      continue
    }
    triggerInitiateCall(supabaseUrl, serviceKey, (inserted as { id: string }).id)
    results.triggered++
  }
}

async function complete(supabase: Supabase, campaignId: string): Promise<void> {
  // Ferme la période ouverte + passe la campagne en 'completed'.
  await supabase
    .from('campaign_activity_periods')
    .update({ ended_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .is('ended_at', null)
  await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)
}

function triggerInitiateCall(supabaseUrl: string, serviceKey: string, callId: string): void {
  fetch(`${supabaseUrl}/functions/v1/initiate-call`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ call_id: callId }),
  }).catch((err) => console.error(`[campaign-dispatch] initiate-call: ${err.message}`))
}

/** Date locale (YYYY-MM-DD) + minutes depuis minuit, dans le fuseau donné. */
function localParts(date: Date, tz: string): { date: string; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))
    const hour = parseInt(p.hour, 10) % 24   // certains runtimes rendent '24' à minuit
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + parseInt(p.minute, 10) }
  } catch {
    // Fuseau invalide → repli UTC
    return { date: date.toISOString().slice(0, 10), minutes: date.getUTCHours() * 60 + date.getUTCMinutes() }
  }
}

/** 'HH:MM[:SS]' → minutes depuis minuit. */
function toMinutes(t: string): number {
  const [h, m] = (t ?? '00:00').split(':')
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
