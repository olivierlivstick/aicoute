import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Calendar, AlertTriangle,
  ChevronDown, ChevronUp, Sparkles, Heart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { markReportRead } from '@/hooks/useCalls'
import { formatDate, formatDuration, MOOD_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Call, TranscriptEntry } from '@modect/shared'

interface CallWithBeneficiary extends Call {
  beneficiaries: {
    first_name:    string
    last_name:     string
    ai_persona_name: string
  } | null
}

export function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [call,      setCall]      = useState<CallWithBeneficiary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('calls')
      .select('*, beneficiaries(first_name, last_name, ai_persona_name)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setCall(data as CallWithBeneficiary)
        setLoading(false)
        // Marquer comme lu
        markReportRead(id)
      })
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!call) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Appel introuvable.</p>
        <Link to="/reports" className="text-primary mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    )
  }

  const beneficiary = call.beneficiaries
  const mood        = call.mood_detected ? MOOD_LABELS[call.mood_detected] : null
  const transcript  = (call.transcript ?? []) as TranscriptEntry[]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/reports" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-title text-2xl font-bold text-slate-800">
            Compte-rendu — {beneficiary?.first_name} {beneficiary?.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {formatDate(call.scheduled_at, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
            {call.duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {formatDuration(call.duration_seconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Carte humeur */}
        {mood && (
          <div className={cn(
            'rounded-2xl p-5 flex items-center gap-4',
            call.mood_detected === 'positive'  && 'bg-green-50 border border-green-100',
            call.mood_detected === 'neutral'   && 'bg-slate-50 border border-slate-100',
            call.mood_detected === 'concerned' && 'bg-orange-50 border border-orange-100',
          )}>
            <span className="text-5xl">{mood.emoji}</span>
            <div>
              <p className="font-semibold text-slate-700 text-lg">Humeur générale</p>
              <p className={cn('text-base font-bold', mood.color)}>{mood.label}</p>
            </div>
          </div>
        )}

        {/* Alertes */}
        {call.alerts && call.alerts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-semibold text-orange-800 mb-3">
              <AlertTriangle size={18} />
              Points d'attention
            </h2>
            <ul className="space-y-2">
              {call.alerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-2 text-orange-700 text-sm">
                  <span className="mt-0.5">•</span>
                  {alert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Résumé narratif */}
        {call.summary && (
          <Section icon={<Sparkles size={18} className="text-primary" />} title="Résumé de la conversation">
            <p className="text-slate-600 leading-relaxed text-base">{call.summary}</p>
          </Section>
        )}

        {/* Thèmes abordés */}
        {call.key_topics && call.key_topics.length > 0 && (
          <Section title="Thèmes abordés">
            <div className="flex flex-wrap gap-2">
              {call.key_topics.map((topic, i) => (
                <span key={i} className="bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {topic}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Moments mémorables */}
        {call.memorable_moments && call.memorable_moments.length > 0 && (
          <Section icon={<Heart size={18} className="text-accent" />} title="Moments mémorables">
            <ul className="space-y-2">
              {call.memorable_moments.map((moment, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                  <span className="text-accent mt-0.5">✦</span>
                  {moment}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Transcript complet */}
        {transcript.length > 0 && (
          <Section title={`Transcript complet (${transcript.length} échanges)`}>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary-600 font-medium mb-3 transition-colors"
            >
              {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showTranscript ? 'Masquer le transcript' : 'Afficher le transcript'}
            </button>

            {showTranscript && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {transcript.map((entry, i) => {
                  const isAgent = entry.role === 'assistant'
                  const name    = isAgent
                    ? (beneficiary?.ai_persona_name ?? 'IA')
                    : (beneficiary?.first_name ?? 'Bénéficiaire')

                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex gap-3',
                        isAgent ? 'flex-row' : 'flex-row-reverse'
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                        isAgent
                          ? 'bg-primary text-white'
                          : 'bg-slate-200 text-slate-600'
                      )}>
                        {name[0]}
                      </div>

                      {/* Bulle */}
                      <div className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5',
                        isAgent
                          ? 'bg-primary-50 text-slate-700 rounded-tl-none'
                          : 'bg-slate-100 text-slate-700 rounded-tr-none'
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
            )}
          </Section>
        )}

        {/* Call sans rapport */}
        {!call.report_available && call.status === 'completed' && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center">
            <p className="text-slate-400 text-sm">
              Le compte-rendu est en cours de génération…
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title:    string
  icon?:    React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-base">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}
