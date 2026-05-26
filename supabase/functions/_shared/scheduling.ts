/**
 * Calcul de la prochaine occurrence d'un planning récurrent
 *
 * Logique :
 *   - On cherche parmi les 7 prochains jours le premier qui correspond
 *     à un jour autorisé (days_of_week), à l'heure configurée.
 *   - Si aujourd'hui est un jour autorisé ET que l'heure n'est pas encore passée,
 *     on retourne aujourd'hui.
 */

export function calculateNextScheduledAt(
  daysOfWeek: number[],   // [0..6] — 0 = dimanche
  timeOfDay:  string,     // 'HH:MM:SS'
  timezone:   string,
): Date | null {
  if (daysOfWeek.length === 0) return null

  const [hStr, mStr] = timeOfDay.split(':')
  const targetHour   = parseInt(hStr, 10)
  const targetMinute = parseInt(mStr, 10)

  // Heure actuelle dans le fuseau cible
  const nowUtc   = new Date()
  const nowLocal = toZonedDate(nowUtc, timezone)

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(nowLocal)
    candidate.setDate(nowLocal.getDate() + daysAhead)
    candidate.setHours(targetHour, targetMinute, 0, 0)

    const dayOfWeek = candidate.getDay()  // 0 = dimanche

    if (!daysOfWeek.includes(dayOfWeek)) continue

    // Si c'est aujourd'hui, vérifier que l'heure n'est pas déjà passée
    if (daysAhead === 0 && candidate <= nowLocal) continue

    // Convertir en UTC pour stocker en base
    return zonedToUtc(candidate, timezone)
  }

  return null
}

/**
 * Convertit une date UTC en date locale (dans le timezone donné)
 * Approximation valable pour les fuseaux Europe/America courants.
 */
function toZonedDate(utcDate: Date, timezone: string): Date {
  const str      = utcDate.toLocaleString('en-US', { timeZone: timezone })
  return new Date(str)
}

/**
 * Convertit une date "locale naïve" en UTC en tenant compte du timezone.
 */
function zonedToUtc(localDate: Date, timezone: string): Date {
  // Trouver le décalage en minutes entre UTC et le timezone cible
  const utcStr   = localDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = localDate.toLocaleString('en-US', { timeZone: timezone })
  const utcParsed   = new Date(utcStr)
  const localParsed = new Date(localStr)
  const offsetMs = localParsed.getTime() - utcParsed.getTime()
  return new Date(localDate.getTime() - offsetMs)
}

/**
 * Vérifie si un planning est dû maintenant (dans la fenêtre ±90 secondes)
 */
export function isDue(nextScheduledAt: string | null, windowSeconds = 90): boolean {
  if (!nextScheduledAt) return false
  const diff = Math.abs(new Date(nextScheduledAt).getTime() - Date.now())
  return diff <= windowSeconds * 1000
}
