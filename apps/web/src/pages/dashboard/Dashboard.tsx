import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Phone, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { formatDate, formatTime, MOOD_LABELS } from '@/lib/utils'
import type { Beneficiary, Call } from '@modect/shared'

interface BeneficiaryWithLastCall extends Beneficiary {
  last_call?: Call | null
  next_call?: Call | null
  unread_reports: number
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryWithLastCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: bens } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!bens) { setLoading(false); return }

      const enriched = await Promise.all(
        bens.map(async (b) => {
          const { data: lastCall } = await supabase
            .from('calls')
            .select('*')
            .eq('beneficiary_id', b.id)
            .eq('status', 'completed')
            .order('ended_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const { data: nextCall } = await supabase
            .from('calls')
            .select('*')
            .eq('beneficiary_id', b.id)
            .in('status', ['scheduled', 'notified'])
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          const { count } = await supabase
            .from('calls')
            .select('*', { count: 'exact', head: true })
            .eq('beneficiary_id', b.id)
            .eq('report_available', true)
            .is('report_read_at', null)

          return {
            ...b,
            last_call: lastCall,
            next_call: nextCall,
            unread_reports: count ?? 0,
          }
        })
      )

      setBeneficiaries(enriched)
      setLoading(false)
    }
    load()
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aidant'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-slate-500 mt-1">
            {formatDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link to="/beneficiary/new">
          <Button>
            <Plus size={18} />
            Ajouter un proche
          </Button>
        </Link>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-5xl mb-4">💛</div>
          <h2 className="font-title text-xl font-semibold text-slate-700 mb-2">
            Aucun proche configuré
          </h2>
          <p className="text-slate-500 mb-6">
            Ajoutez un proche pour commencer à planifier des appels IA.
          </p>
          <Link to="/beneficiary/new">
            <Button>
              <Plus size={18} />
              Ajouter mon premier proche
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {beneficiaries.map((b) => {
            const mood = b.last_call?.mood_detected
              ? MOOD_LABELS[b.last_call.mood_detected]
              : null

            return (
              <Link key={b.id} to={`/beneficiary/${b.id}`}>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer relative">
                  {/* Badge rapport non lu */}
                  {b.unread_reports > 0 && (
                    <span className="absolute top-4 right-4 bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {b.unread_reports} nouveau{b.unread_reports > 1 ? 'x' : ''}
                    </span>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary font-title font-bold text-xl flex-shrink-0">
                      {b.first_name[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-lg leading-tight">
                        {b.first_name} {b.last_name}
                      </h3>

                      {/* Dernier appel */}
                      {b.last_call ? (
                        <p className="text-sm text-slate-500 mt-0.5">
                          Dernier appel : {formatDate(b.last_call.ended_at ?? b.last_call.scheduled_at)}{' '}
                          {mood && <span>{mood.emoji}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 mt-0.5">Aucun appel pour l'instant</p>
                      )}

                      {/* Alertes */}
                      {b.last_call?.alerts && b.last_call.alerts.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-orange-600 text-xs font-medium">
                          <AlertTriangle size={12} />
                          {b.last_call.alerts[0]}
                        </div>
                      )}

                      {/* Prochain appel */}
                      {b.next_call ? (
                        <div className="flex items-center gap-1.5 mt-2 text-primary text-sm">
                          <Phone size={13} />
                          <span>
                            Prochain appel :{' '}
                            {formatDate(b.next_call.scheduled_at, {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            à {formatTime(new Date(b.next_call.scheduled_at).toTimeString())}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">Aucun appel planifié</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
