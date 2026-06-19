import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCampaign } from '@/hooks/useCampaign'
import { CampaignStatusBadge } from '@/pages/org/campaignStatus'
import { CampaignAdminTab } from '@/pages/org/tabs/CampaignAdminTab'
import { CampaignMembersTab } from '@/pages/org/tabs/CampaignMembersTab'
import { CampaignActivityTab } from '@/pages/org/tabs/CampaignActivityTab'

type Tab = 'admin' | 'members' | 'activity'

const TABS: { key: Tab; label: string }[] = [
  { key: 'admin',    label: 'Administratif' },
  { key: 'members',  label: 'Bénéficiaires' },
  { key: 'activity', label: 'Activité' },
]

export function OrgCampagneDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const c = useCampaign(id)
  const [tab, setTab] = useState<Tab>('admin')

  if (c.loading) {
    return <div className="max-w-[1400px] mx-auto px-4 py-8 text-sm text-slate-400">Chargement…</div>
  }
  if (!c.campaign) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <p className="text-sm text-slate-500">Campagne introuvable.</p>
        <Link to="/org/campagnes" className="mt-2 inline-block text-sm text-primary hover:underline">← Retour aux campagnes</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <button onClick={() => navigate('/org/campagnes')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Campagnes
      </button>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-serif font-semibold text-slate-800">{c.campaign.title}</h1>
        <CampaignStatusBadge status={c.campaign.status} />
      </div>

      {/* Onglets */}
      <div className="mt-6 flex gap-1 border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
            {t.key === 'members' && c.members.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">{c.members.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'admin' && <CampaignAdminTab c={c} />}
        {tab === 'members' && <CampaignMembersTab c={c} />}
        {tab === 'activity' && <CampaignActivityTab c={c} />}
      </div>
    </div>
  )
}
