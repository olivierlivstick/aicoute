import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Clock, Calendar, AlertTriangle, Sparkles, Heart,
  Stethoscope, Smile, Brain, Users, HandHeart, Info, Clock3,
} from 'lucide-react'
import { formatDate, formatDuration, MOOD_LABELS, cn } from '@/lib/utils'
import type { TranscriptEntry, CallAlert, AlertCategory, AlertSeverity } from '@modect/shared'

const CATEGORY_META: Record<AlertCategory, { label: string; icon: React.ReactNode }> = {
  health:    { label: 'Santé',       icon: <Stethoscope size={14} /> },
  mood:      { label: 'Humeur',      icon: <Smile       size={14} /> },
  cognition: { label: 'Cognition',   icon: <Brain       size={14} /> },
  social:    { label: 'Lien social', icon: <Users       size={14} /> },
  autonomy:  { label: 'Autonomie',   icon: <HandHeart   size={14} /> },
  other:     { label: 'Autre',       icon: <Info        size={14} /> },
}

const SEVERITY_META: Record<AlertSeverity, { label: string; cls: string; barCls: string }> = {
  low:    { label: 'Faible',  cls: 'bg-amber-50  text-amber-700  border-amber-100',  barCls: 'bg-amber-300' },
  medium: { label: 'Modérée', cls: 'bg-orange-50 text-orange-700 border-orange-100', barCls: 'bg-orange-400' },
  high:   { label: 'Élevée',  cls: 'bg-red-50    text-red-700    border-red-100',    barCls: 'bg-red-500' },
}

interface Report {
  beneficiary_first_name: string
  beneficiary_last_name:  string
  ai_persona_name:        string
  scheduled_at:           string
  ended_at:               string | null
  duration_seconds:       number | null
  summary:                string | null
  mood_detected:          string | null
  key_topics:             string[]
  memorable_moments:      string[]
  alerts:                 CallAlert[]
  transcript:             TranscriptEntry[]
  report_available:       boolean
  expires_at:             string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; report: Report }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'error' }

export function PublicReportPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!token) { setState({ kind: 'not_found' }); return }
    let cancelled = false

    ;(async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-report?token=${encodeURIComponent(token)}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        })
        if (cancelled) return

        if (res.status === 410) { setState({ kind: 'expired' }); return }
        if (res.status === 404 || res.status === 400) { setState({ kind: 'not_found' }); return }
        if (!res.ok) { setState({ kind: 'error' }); return }

        const body = await res.json()
        setState({ kind: 'ok', report: body.report as Report })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()

    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-screen bg-background font-body text-brun-900">
      {/* Bandeau Aicoute */}
      <header className="bg-primary text-white">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-wide">Aicoute</h1>
          <p className="text-white/90 text-sm italic mt-1">La présence qui réchauffe</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {state.kind === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state.kind === 'expired' && (
          <Notice
            title="Ce lien a expiré"
            body="Pour des raisons de confidentialité, les liens de partage de compte-rendu ne sont valables que 48 heures. Demandez à l'aidant de renvoyer le compte-rendu pour obtenir un nouveau lien."
          />
        )}
        {state.kind === 'not_found' && (
          <Notice
            title="Compte-rendu introuvable"
            body="Ce lien n'est pas valide. Vérifiez que vous avez copié l'adresse complète depuis l'email."
          />
        )}
        {state.kind === 'error' && (
          <Notice
            title="Une erreur est survenue"
            body="Impossible d'afficher le compte-rendu pour le moment. Merci de réessayer dans quelques instants."
          />
        )}

        {state.kind === 'ok' && <ReportBody report={state.report} />}
      </main>

      <footer className="max-w-3xl mx-auto px-6 pb-12 pt-4 text-center">
        <p className="text-xs text-slate-400">© 2026 Aicoute</p>
      </footer>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
      <Clock3 size={32} className="text-slate-300 mx-auto mb-3" />
      <h2 className="font-serif text-xl font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">{body}</p>
    </div>
  )
}

function ReportBody({ report }: { report: Report }) {
  const mood       = report.mood_detected ? MOOD_LABELS[report.mood_detected] : null
  const transcript = report.transcript ?? []

  return (
    <>
      {/* En-tête rapport */}
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-bold text-slate-800">
          Compte-rendu — {report.beneficiary_first_name} {report.beneficiary_last_name}
        </h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar size={13} />
            {formatDate(report.scheduled_at, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
          {report.duration_seconds ? (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {formatDuration(report.duration_seconds)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        {/* Humeur */}
        {mood && (
          <div className={cn(
            'rounded-2xl p-5 flex items-center gap-4',
            report.mood_detected === 'positive'  && 'bg-green-50 border border-green-100',
            report.mood_detected === 'neutral'   && 'bg-slate-50 border border-slate-100',
            report.mood_detected === 'concerned' && 'bg-orange-50 border border-orange-100',
          )}>
            <span className="text-5xl">{mood.emoji}</span>
            <div>
              <p className="font-semibold text-slate-700 text-lg">Humeur générale</p>
              <p className={cn('text-base font-bold', mood.color)}>{mood.label}</p>
            </div>
          </div>
        )}

        {/* Signaux faibles */}
        {report.alerts && report.alerts.length > 0 && (
          <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-orange-800 mb-4">
              <AlertTriangle size={18} />
              Signaux faibles détectés
              <span className="text-xs text-slate-400 font-normal ml-1">({report.alerts.length})</span>
            </h3>
            <div className="space-y-3">
              {report.alerts.map((alert, i) => {
                const cat = CATEGORY_META[alert.category] ?? CATEGORY_META.other
                const sev = SEVERITY_META[alert.severity] ?? SEVERITY_META.low
                return (
                  <div key={i} className="flex gap-3 p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                    <div className={cn('w-1 rounded-full shrink-0', sev.barCls)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {cat.icon}{cat.label}
                        </span>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', sev.cls)}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed italic">« {alert.evidence} »</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Résumé */}
        {report.summary && (
          <Section icon={<Sparkles size={18} className="text-primary" />} title="Résumé de la conversation">
            <p className="text-slate-600 leading-relaxed text-base">{report.summary}</p>
          </Section>
        )}

        {/* Thèmes */}
        {report.key_topics && report.key_topics.length > 0 && (
          <Section title="Thèmes abordés">
            <div className="flex flex-wrap gap-2">
              {report.key_topics.map((topic, i) => (
                <span key={i} className="bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">{topic}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Moments mémorables */}
        {report.memorable_moments && report.memorable_moments.length > 0 && (
          <Section icon={<Heart size={18} className="text-accent" />} title="Moments mémorables">
            <ul className="space-y-2">
              {report.memorable_moments.map((moment, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                  <span className="text-accent mt-0.5">✦</span>{moment}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Transcript (déplié d'office sur la page publique) */}
        {transcript.length > 0 && (
          <Section title={`Transcript complet (${transcript.length} échanges)`}>
            <div className="space-y-3">
              {transcript.map((entry, i) => {
                const isAgent = entry.role === 'assistant'
                const name    = isAgent ? report.ai_persona_name : report.beneficiary_first_name
                return (
                  <div key={i} className={cn('flex gap-3', isAgent ? 'flex-row' : 'flex-row-reverse')}>
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                      isAgent ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600',
                    )}>
                      {(name || '?')[0]}
                    </div>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5',
                      isAgent ? 'bg-primary-50 text-slate-700 rounded-tl-none' : 'bg-slate-100 text-slate-700 rounded-tr-none',
                    )}>
                      <p className="text-xs font-semibold text-slate-400 mb-0.5">{name}</p>
                      <p className="text-sm leading-relaxed">{entry.text}</p>
                      {entry.timestamp && (
                        <p className="text-xs text-slate-400 mt-1 text-right">
                          {new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {!report.report_available && !report.summary && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center">
            <p className="text-slate-400 text-sm">Le compte-rendu est en cours de génération…</p>
          </div>
        )}

        {/* Mention durée de vie */}
        {report.expires_at && (
          <p className="text-xs text-slate-400 text-center pt-2 flex items-center justify-center gap-1.5">
            <Clock3 size={12} />
            Lien de partage valable jusqu'au {formatDate(report.expires_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
          </p>
        )}
      </div>
    </>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-base">{icon}{title}</h3>
      {children}
    </div>
  )
}
