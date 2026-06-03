/**
 * Internationalisation des COMPTES-RENDUS (côté Edge Functions / Deno).
 *
 * La « langue des retours » (beneficiaries.report_language, snapshotée dans
 * calls.report_language) gouverne la langue dans laquelle l'appel est analysé
 * puis retransmis à l'aidant : email + page publique /r/:token.
 *
 * Ce module centralise : libellés catégories/sévérité/humeur, habillage email,
 * locale de date, et le nom « humain » de chaque langue (pour le prompt GPT-4o).
 *
 * ⚠️ Existe en double avec apps/web/src/lib/reportI18n.ts (Deno n'importe pas le
 * code web) — garder les deux en phase pour l'affichage CallDetail / PublicReport.
 */

export type ReportLang = 'fr' | 'en' | 'es' | 'de' | 'it'

export const REPORT_LANGS: ReportLang[] = ['fr', 'en', 'es', 'de', 'it']

export function normalizeReportLang(raw: unknown): ReportLang {
  const v = String(raw ?? '').trim().toLowerCase()
  return (REPORT_LANGS as string[]).includes(v) ? (v as ReportLang) : 'fr'
}

/** Nom de la langue EN FRANÇAIS (utilisé dans le prompt d'analyse, rédigé en FR). */
export const LANG_NAME_FR: Record<ReportLang, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
}

/** Locale Intl pour le formatage des dates. */
export const DATE_LOCALE: Record<ReportLang, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
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

/** Libellé d'humeur (avec emoji) — utilisé dans l'email + le sujet. */
export const MOOD_LABELS: Record<ReportLang, Record<Mood, string>> = {
  fr: { positive: 'Positif 😊', neutral: 'Neutre 😐', concerned: 'Préoccupant 😟' },
  en: { positive: 'Positive 😊', neutral: 'Neutral 😐', concerned: 'Concerning 😟' },
  es: { positive: 'Positivo 😊', neutral: 'Neutro 😐', concerned: 'Preocupante 😟' },
  de: { positive: 'Positiv 😊', neutral: 'Neutral 😐', concerned: 'Besorgniserregend 😟' },
  it: { positive: 'Positivo 😊', neutral: 'Neutro 😐', concerned: 'Preoccupante 😟' },
}

export interface EmailStrings {
  tagline:             string
  greeting:            (name: string) => string
  intro:               (beneficiary: string) => string
  moodPrefix:          string   // ex « Humeur : »
  summaryTitle:        string
  topicsTitle:         string
  alertsTitle:         string   // avec ⚠️
  cta:                 string
  shareNote:           string
  manageNotifications: string
  subject:             (first: string, moodLabel: string, concerned: boolean) => string
  // Email « sans réponse »
  noAnswerTagline:     string
  noAnswerIntro:       (beneficiary: string, time: string, attempts: number) => string
  noAnswerReassurance: string
  noAnswerCta:         string
  noAnswerSubject:     (first: string) => string
}

export const EMAIL_STRINGS: Record<ReportLang, EmailStrings> = {
  fr: {
    tagline: 'La présence qui réchauffe',
    greeting: (n) => `Bonjour <strong>${n}</strong>,`,
    intro: (b) => `Voici le compte-rendu de l'appel de <strong>${b}</strong>.`,
    moodPrefix: 'Humeur :',
    summaryTitle: 'Résumé de la conversation',
    topicsTitle: 'Thèmes abordés',
    alertsTitle: '⚠️ Signaux faibles détectés',
    cta: 'Voir le compte-rendu complet →',
    shareNote: 'Ce lien est valable 48 heures et peut être partagé avec un proche, sans création de compte.',
    manageNotifications: 'Gérer les notifications',
    subject: (f, m, c) => `Compte-rendu de l'appel de ${f} — ${c ? '⚠️ ' : ''}${m}`,
    noAnswerTagline: '⚠️ Appel sans réponse',
    noAnswerIntro: (b, t, a) => `Nous n'avons pas réussi à joindre <strong>${b}</strong> lors de l'appel planifié à <strong>${t}</strong>${a > 1 ? `, malgré ${a} tentatives` : ''}.`,
    noAnswerReassurance: 'Cela peut être normal (sortie, sieste, téléphone hors de portée). Si cette situation se répète, n\'hésitez pas à prendre contact directement avec votre proche.',
    noAnswerCta: 'Vérifier les plannings →',
    noAnswerSubject: (f) => `⚠️ ${f} n'a pas répondu`,
  },
  en: {
    tagline: 'The presence that warms',
    greeting: (n) => `Hello <strong>${n}</strong>,`,
    intro: (b) => `Here is the report of the call with <strong>${b}</strong>.`,
    moodPrefix: 'Mood:',
    summaryTitle: 'Conversation summary',
    topicsTitle: 'Topics discussed',
    alertsTitle: '⚠️ Early warning signs detected',
    cta: 'View the full report →',
    shareNote: 'This link is valid for 48 hours and can be shared with a loved one, with no account needed.',
    manageNotifications: 'Manage notifications',
    subject: (f, m, c) => `Report of the call with ${f} — ${c ? '⚠️ ' : ''}${m}`,
    noAnswerTagline: '⚠️ Unanswered call',
    noAnswerIntro: (b, t, a) => `We were unable to reach <strong>${b}</strong> for the call scheduled at <strong>${t}</strong>${a > 1 ? `, despite ${a} attempts` : ''}.`,
    noAnswerReassurance: 'This may be perfectly normal (out, napping, phone out of reach). If it keeps happening, feel free to get in touch with your loved one directly.',
    noAnswerCta: 'Check the schedule →',
    noAnswerSubject: (f) => `⚠️ ${f} did not answer`,
  },
  es: {
    tagline: 'La presencia que reconforta',
    greeting: (n) => `Hola <strong>${n}</strong>,`,
    intro: (b) => `Aquí tiene el resumen de la llamada con <strong>${b}</strong>.`,
    moodPrefix: 'Estado de ánimo:',
    summaryTitle: 'Resumen de la conversación',
    topicsTitle: 'Temas tratados',
    alertsTitle: '⚠️ Señales de alerta detectadas',
    cta: 'Ver el informe completo →',
    shareNote: 'Este enlace es válido durante 48 horas y puede compartirse con un allegado, sin crear una cuenta.',
    manageNotifications: 'Gestionar las notificaciones',
    subject: (f, m, c) => `Resumen de la llamada con ${f} — ${c ? '⚠️ ' : ''}${m}`,
    noAnswerTagline: '⚠️ Llamada sin respuesta',
    noAnswerIntro: (b, t, a) => `No hemos podido contactar con <strong>${b}</strong> en la llamada programada a las <strong>${t}</strong>${a > 1 ? `, a pesar de ${a} intentos` : ''}.`,
    noAnswerReassurance: 'Puede ser algo normal (salida, siesta, teléfono fuera de alcance). Si la situación se repite, no dude en ponerse en contacto directamente con su allegado.',
    noAnswerCta: 'Revisar la planificación →',
    noAnswerSubject: (f) => `⚠️ ${f} no ha contestado`,
  },
  de: {
    tagline: 'Die Präsenz, die wärmt',
    greeting: (n) => `Hallo <strong>${n}</strong>,`,
    intro: (b) => `Hier ist der Bericht des Anrufs mit <strong>${b}</strong>.`,
    moodPrefix: 'Stimmung:',
    summaryTitle: 'Zusammenfassung des Gesprächs',
    topicsTitle: 'Besprochene Themen',
    alertsTitle: '⚠️ Schwache Signale erkannt',
    cta: 'Vollständigen Bericht ansehen →',
    shareNote: 'Dieser Link ist 48 Stunden gültig und kann ohne Konto mit Angehörigen geteilt werden.',
    manageNotifications: 'Benachrichtigungen verwalten',
    subject: (f, m, c) => `Bericht des Anrufs mit ${f} — ${c ? '⚠️ ' : ''}${m}`,
    noAnswerTagline: '⚠️ Anruf ohne Antwort',
    noAnswerIntro: (b, t, a) => `Wir konnten <strong>${b}</strong> beim geplanten Anruf um <strong>${t}</strong> nicht erreichen${a > 1 ? `, trotz ${a} Versuchen` : ''}.`,
    noAnswerReassurance: 'Das kann ganz normal sein (unterwegs, Mittagsschlaf, Telefon außer Reichweite). Wenn sich das wiederholt, nehmen Sie gerne direkt Kontakt mit Ihrem Angehörigen auf.',
    noAnswerCta: 'Termine prüfen →',
    noAnswerSubject: (f) => `⚠️ ${f} hat nicht geantwortet`,
  },
  it: {
    tagline: 'La presenza che scalda',
    greeting: (n) => `Ciao <strong>${n}</strong>,`,
    intro: (b) => `Ecco il resoconto della chiamata con <strong>${b}</strong>.`,
    moodPrefix: 'Umore:',
    summaryTitle: 'Riepilogo della conversazione',
    topicsTitle: 'Argomenti trattati',
    alertsTitle: '⚠️ Segnali deboli rilevati',
    cta: 'Vedi il resoconto completo →',
    shareNote: 'Questo link è valido per 48 ore e può essere condiviso con una persona cara, senza creare un account.',
    manageNotifications: 'Gestisci le notifiche',
    subject: (f, m, c) => `Resoconto della chiamata con ${f} — ${c ? '⚠️ ' : ''}${m}`,
    noAnswerTagline: '⚠️ Chiamata senza risposta',
    noAnswerIntro: (b, t, a) => `Non siamo riusciti a contattare <strong>${b}</strong> nella chiamata programmata alle <strong>${t}</strong>${a > 1 ? `, nonostante ${a} tentativi` : ''}.`,
    noAnswerReassurance: 'Può essere del tutto normale (uscita, riposino, telefono non raggiungibile). Se la situazione si ripete, non esiti a contattare direttamente la persona cara.',
    noAnswerCta: 'Controllare la pianificazione →',
    noAnswerSubject: (f) => `⚠️ ${f} non ha risposto`,
  },
}
