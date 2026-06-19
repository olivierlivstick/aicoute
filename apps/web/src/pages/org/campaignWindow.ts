import type { Campaign } from '@modect/shared'

export type WindowState = 'calling' | 'waiting_window' | 'before_start' | 'after_end'

/** Date locale (YYYY-MM-DD) + minutes depuis minuit dans le fuseau donné. */
function localParts(date: Date, tz: string): { date: string; minutes: number } {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(date).map((x) => [x.type, x.value]),
    )
    const hour = parseInt(p.hour, 10) % 24
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + parseInt(p.minute, 10) }
  } catch {
    return { date: date.toISOString().slice(0, 10), minutes: date.getUTCHours() * 60 + date.getUTCMinutes() }
  }
}

function toMinutes(t: string): number {
  const [h, m] = (t ?? '00:00').split(':')
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)
}

/**
 * État effectif d'une campagne `running` vis-à-vis de sa fenêtre de dates +
 * plage horaire (miroir de la logique du worker campaign-dispatch). Permet
 * d'afficher un statut honnête (« appels en cours » vs « hors plage »).
 */
export function campaignWindowState(c: Campaign, now: Date = new Date()): WindowState {
  const { date, minutes } = localParts(now, c.timezone)
  if (c.starts_on && date < c.starts_on) return 'before_start'
  if (c.ends_on && date > c.ends_on) return 'after_end'
  const start = toMinutes(c.daily_start_time)
  const end = toMinutes(c.daily_end_time)
  if (minutes < start || minutes >= end) return 'waiting_window'
  return 'calling'
}
