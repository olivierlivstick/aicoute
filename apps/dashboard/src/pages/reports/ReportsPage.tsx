import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, Clock, CheckCircle, XCircle, Phone } from 'lucide-react'
import { useCalls } from '@/hooks/useCalls'
import { useBeneficiaries } from '@/hooks/useBeneficiary'
import { formatDate, formatDuration, MOOD_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { CallWithBeneficiary } from '@/hooks/useCalls'
import type { CallStatus } from '@modect/shared'

type Filter = 'all' | 'unread' | 'completed' | 'missed'

const STATUS_CONFIG: Record<CallStatus, { label: string; icon: React.ElementType; color: string }> = {
  completed:   { label: 'Terminé',      icon: CheckCircle,  color: 'text-green-600' },
  missed:      { label: 'Manqué',       icon: XCircle,      color: 'text-red-500' },
  failed:      { label: 'Échoué',       icon: XCircle,      color: 'text-red-500' },
  in_progress: { label: 'En cours',     icon: Phone,        color: 'text-blue-500' },
  notified:    { label: 'Notifié',      icon: Phone,        color: 'text-blue-400' },
  scheduled:   { label: 'Planifié',     icon: Clock,        color: 'text-slate-400' },
}

export function ReportsPage() {
  const { beneficiaries } = useBeneficiaries()
  const [selectedBenId, setSelectedBenId] = useState<string | undefined>()
  const [filter, setFilter] = useState<Filter>('all')
  const { calls, loading, unreadCount } = useCalls(selectedBenId)

  const filtered = calls.filter((c) => {
    if (filter === 'unread')    return c.report_available && !c.report_read_at
    if (filter === 'completed') return c.status === 'completed'
    if (filter === 'missed')    return c.status === 'missed' || c.status === 'failed'
    return true
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Rapports</h1>
          <p className="text-slate-500 mt-1">Historique et comptes-rendus des appels</p>
        </div>
        {unreadCount > 0 && (
          <div className="bg-accent text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <FileText size={14} />
            {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
          </div>
        )}
      </div>

      {/* Filtre bénéficiaire */}
      {beneficiaries.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedBenId(undefined)}
            className={cn(
              'px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all',
              !selectedBenId
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            Tous
          </button>
          {beneficiaries.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBenId(b.id)}
              className={cn(
                'px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all',
                selectedBenId === b.id
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              )}
            >
              {b.first_name} {b.last_name}
            </button>
          ))}
        </div>
      )}

      {/* Filtres de statut */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'all',       label: 'Tous' },
          { key: 'unread',    label: `Non lus${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          { key: 'completed', label: 'Terminés' },
          { key: 'missed',    label: 'Manqués' },
        ] as { key: Filter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === key
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <FileText size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">Aucun appel pour ce filtre.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}

function CallRow({ call }: { call: CallWithBeneficiary }) {
  const mood       = call.mood_detected ? MOOD_LABELS[call.mood_detected] : null
  const statusConf = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.scheduled
  const StatusIcon = statusConf.icon
  const isUnread   = call.report_available && !call.report_read_at
  const hasAlert   = call.alerts && call.alerts.length > 0

  return (
    <Link to={`/reports/${call.id}`}>
      <div className={cn(
        'bg-white rounded-2xl border p-5 hover:shadow-md transition-all cursor-pointer flex gap-4 items-start',
        isUnread ? 'border-accent/40 ring-1 ring-accent/20' : 'border-slate-100 shadow-sm',
        hasAlert && 'border-orange-200'
      )}>
        {/* Indicateur humeur */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
          mood ? 'bg-slate-50' : 'bg-slate-100'
        )}>
          {mood ? mood.emoji : <FileText size={20} className="text-slate-300" />}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nom bénéficiaire */}
            <span className="font-semibold text-slate-800">
              {call.beneficiary_first_name} {call.beneficiary_last_name}
            </span>

            {/* Badge Nouveau */}
            {isUnread && (
              <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                Nouveau
              </span>
            )}

            {/* Alerte */}
            {hasAlert && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> Alerte
              </span>
            )}
          </div>

          {/* Date + durée */}
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span>{formatDate(call.scheduled_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {call.duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(call.duration_seconds)}
              </span>
            )}
          </div>

          {/* Aperçu résumé */}
          {call.summary && (
            <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
              {call.summary}
            </p>
          )}

          {/* Tags thèmes */}
          {call.key_topics && call.key_topics.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {call.key_topics.slice(0, 4).map((t, i) => (
                <span key={i} className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Statut */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusIcon size={16} className={statusConf.color} />
          <span className={cn('text-xs font-medium', statusConf.color)}>
            {statusConf.label}
          </span>
        </div>
      </div>
    </Link>
  )
}
