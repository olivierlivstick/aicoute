import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Phone, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
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
  const { selectBeneficiary } = useSelectedBeneficiary()
  const navigate = useNavigate()
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryWithLastCall[]>([])
  const [loading, setLoading] = useState(true)

  const goToBeneficiary = (id: string) => {
    selectBeneficiary(id)
    navigate('/contexte')
  }

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
    <div className="p-8 max-w-7xl mx-auto">
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
        <Button disabled title="Bientôt disponible — un bénéficiaire par compte pour le moment">
          <Plus size={18} />
          Ajouter un bénéficiaire
        </Button>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="py-14 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="max-w-xl mx-auto text-center">
            <div className="text-5xl mb-4">💛</div>
            <h2 className="font-title text-2xl font-semibold text-slate-800 mb-2">
              Créons le profil de votre bénéficiaire
            </h2>
            <p className="text-slate-500 mb-8">
              En quelques minutes, vous mettez en place un compagnon d'appel sur
              mesure. Le formulaire vous guide en trois temps :
            </p>
          </div>

          <ol className="max-w-xl mx-auto space-y-4 mb-9 text-left">
            {[
              {
                title: 'Les données de base',
                desc: 'Prénom, nom, année de naissance et numéro de téléphone du bénéficiaire.',
              },
              {
                title: 'Mieux le connaître',
                desc: 'Son histoire, ses goûts et sa personnalité — pour des conversations naturelles et personnalisées.',
              },
              {
                title: 'La voix qui l\'appellera',
                desc: 'Le prénom du compagnon, sa voix, son style et la langue des appels.',
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="text-center">
            <Link to="/beneficiary/new">
              <Button>
                <Plus size={18} />
                Créer le profil de mon bénéficiaire
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {beneficiaries.map((b) => {
            const mood = b.last_call?.mood_detected
              ? MOOD_LABELS[b.last_call.mood_detected]
              : null

            return (
              <div
                key={b.id}
                onClick={() => goToBeneficiary(b.id)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer relative"
              >
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

                    {/* Alertes (signaux faibles structurés) */}
                    {b.last_call?.alerts && b.last_call.alerts.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-orange-600 text-xs font-medium">
                        <AlertTriangle size={12} />
                        <span className="truncate">
                          {b.last_call.alerts.length} signal{b.last_call.alerts.length > 1 ? 'aux' : ''} faible{b.last_call.alerts.length > 1 ? 's' : ''}
                          {b.last_call.alerts[0]?.evidence ? ` — ${b.last_call.alerts[0].evidence}` : ''}
                        </span>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
