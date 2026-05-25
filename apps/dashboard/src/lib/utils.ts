import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('fr-FR', options ?? { dateStyle: 'long' }).format(new Date(date))
}

export function formatTime(time: string) {
  // Convertit '10:00:00' en '10h00'
  const [hours, minutes] = time.split(':')
  return `${hours}h${minutes}`
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return s === 0 ? `${m} min` : `${m} min ${s}s`
}

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
export const DAY_LABELS_FULL = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
]

export const MOOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  positive: { label: 'Bien', emoji: '😊', color: 'text-green-600' },
  neutral:  { label: 'Neutre', emoji: '😐', color: 'text-slate-500' },
  concerned: { label: 'Inquiet', emoji: '😟', color: 'text-orange-600' },
}
