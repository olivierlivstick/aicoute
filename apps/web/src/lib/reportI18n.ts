/**
 * Internationalisation de l'AFFICHAGE des comptes-rendus (côté web).
 *
 * La « langue des retours » (calls.report_language, snapshot écrit par
 * generate-summary) gouverne la langue des libellés et titres affichés sur la
 * page back-office CallDetail et la page publique PublicReport — pour rester
 * cohérent avec le texte (résumé/alertes) déjà rédigé dans cette langue.
 *
 * ⚠️ Doublon volontaire de supabase/functions/_shared/reportI18n.ts (runtime
 * Deno distinct) — garder les libellés en phase.
 */

export type ReportLang = 'fr' | 'en' | 'es' | 'de' | 'it'

const REPORT_LANGS: ReportLang[] = ['fr', 'en', 'es', 'de', 'it']

export function normalizeReportLang(raw: unknown): ReportLang {
  const v = String(raw ?? '').trim().toLowerCase()
  return (REPORT_LANGS as string[]).includes(v) ? (v as ReportLang) : 'fr'
}

type Category = 'health' | 'mood' | 'cognition' | 'social' | 'autonomy' | 'other'
type Severity = 'low' | 'medium' | 'high'
type Mood     = 'positive' | 'neutral' | 'concerned'

export const CATEGORY_LABELS: Record<ReportLang, Record<Category, string>> = {
  fr: { health: 'Santé', mood: 'Humeur', cognition: 'Cognition', social: 'Lien social', autonomy: 'Autonomie', other: 'Autre' },
  en: { health: 'Health', mood: 'Mood', cognition: 'Cognition', social: 'Social', autonomy: 'Autonomy', other: 'Other' },
  es: { health: 'Salud', mood: 'Estado de ánimo', cognition: 'Cognición', social: 'Vínculo social', autonomy: 'Autonomía', other: 'Otro' },
  de: { health: 'Gesundheit', mood: 'Stimmung', cognition: 'Kognition', social: 'Soziales', autonomy: 'Selbstständigkeit', other: 'Sonstiges' },
  it: { health: 'Salute', mood: 'Umore', cognition: 'Cognizione', social: 'Legame sociale', autonomy: 'Autonomia', other: 'Altro' },
}

export const SEVERITY_LABELS: Record<ReportLang, Record<Severity, string>> = {
  fr: { low: 'Faible', medium: 'Modérée', high: 'Élevée' },
  en: { low: 'Low', medium: 'Medium', high: 'High' },
  es: { low: 'Baja', medium: 'Media', high: 'Alta' },
  de: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' },
  it: { low: 'Bassa', medium: 'Media', high: 'Alta' },
}

/** Texte du libellé d'humeur (l'emoji + la couleur sont indépendants, ci-dessous). */
export const MOOD_LABELS: Record<ReportLang, Record<Mood, string>> = {
  fr: { positive: 'Bien', neutral: 'Neutre', concerned: 'Inquiet' },
  en: { positive: 'Good', neutral: 'Neutral', concerned: 'Concerned' },
  es: { positive: 'Bien', neutral: 'Neutro', concerned: 'Inquieto' },
  de: { positive: 'Gut', neutral: 'Neutral', concerned: 'Besorgt' },
  it: { positive: 'Bene', neutral: 'Neutro', concerned: 'Preoccupato' },
}

export const MOOD_EMOJI: Record<Mood, string> = {
  positive: '😊', neutral: '😐', concerned: '😟',
}

export const MOOD_COLOR: Record<Mood, string> = {
  positive: 'text-green-600', neutral: 'text-slate-500', concerned: 'text-orange-600',
}

/** Locale Intl pour le formatage des dates/heures affichées. */
export const DATE_LOCALE: Record<ReportLang, string> = {
  fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE', it: 'it-IT',
}

/** Tous les libellés affichés sur les pages de compte-rendu (CallDetail + PublicReport). */
export interface ReportText {
  tagline:          string
  headerPrefix:     string                  // « Compte-rendu — »
  moodTitle:        string
  alertsTitle:      string
  summary:          string
  topics:           string
  memorableMoments: string
  transcript:       (n: number) => string
  generating:       string
  shareValidUntil:  (date: string) => string
}

export const REPORT_TEXT: Record<ReportLang, ReportText> = {
  fr: {
    tagline: 'La présence qui réchauffe',
    headerPrefix: 'Compte-rendu —',
    moodTitle: 'Humeur générale',
    alertsTitle: 'Signaux faibles détectés',
    summary: 'Résumé de la conversation',
    topics: 'Thèmes abordés',
    memorableMoments: 'Moments mémorables',
    transcript: (n) => `Transcript complet (${n} échanges)`,
    generating: 'Le compte-rendu est en cours de génération…',
    shareValidUntil: (d) => `Lien de partage valable jusqu'au ${d}.`,
  },
  en: {
    tagline: 'The presence that warms',
    headerPrefix: 'Report —',
    moodTitle: 'Overall mood',
    alertsTitle: 'Early warning signs detected',
    summary: 'Conversation summary',
    topics: 'Topics discussed',
    memorableMoments: 'Memorable moments',
    transcript: (n) => `Full transcript (${n} exchanges)`,
    generating: 'The report is being generated…',
    shareValidUntil: (d) => `Share link valid until ${d}.`,
  },
  es: {
    tagline: 'La presencia que reconforta',
    headerPrefix: 'Resumen —',
    moodTitle: 'Estado de ánimo general',
    alertsTitle: 'Señales de alerta detectadas',
    summary: 'Resumen de la conversación',
    topics: 'Temas tratados',
    memorableMoments: 'Momentos memorables',
    transcript: (n) => `Transcripción completa (${n} intercambios)`,
    generating: 'El informe se está generando…',
    shareValidUntil: (d) => `Enlace para compartir válido hasta el ${d}.`,
  },
  de: {
    tagline: 'Die Präsenz, die wärmt',
    headerPrefix: 'Bericht —',
    moodTitle: 'Allgemeine Stimmung',
    alertsTitle: 'Schwache Signale erkannt',
    summary: 'Zusammenfassung des Gesprächs',
    topics: 'Besprochene Themen',
    memorableMoments: 'Besondere Momente',
    transcript: (n) => `Vollständiges Transkript (${n} Wortwechsel)`,
    generating: 'Der Bericht wird gerade erstellt…',
    shareValidUntil: (d) => `Freigabelink gültig bis ${d}.`,
  },
  it: {
    tagline: 'La presenza che scalda',
    headerPrefix: 'Resoconto —',
    moodTitle: 'Umore generale',
    alertsTitle: 'Segnali deboli rilevati',
    summary: 'Riepilogo della conversazione',
    topics: 'Argomenti trattati',
    memorableMoments: 'Momenti memorabili',
    transcript: (n) => `Trascrizione completa (${n} scambi)`,
    generating: 'Il resoconto è in fase di generazione…',
    shareValidUntil: (d) => `Link di condivisione valido fino al ${d}.`,
  },
}

/** Helper humeur : renvoie { label, emoji, color } pour une langue donnée. */
export function moodMeta(lang: ReportLang, mood: string): { label: string; emoji: string; color: string } | null {
  if (mood !== 'positive' && mood !== 'neutral' && mood !== 'concerned') return null
  return { label: MOOD_LABELS[lang][mood], emoji: MOOD_EMOJI[mood], color: MOOD_COLOR[mood] }
}
