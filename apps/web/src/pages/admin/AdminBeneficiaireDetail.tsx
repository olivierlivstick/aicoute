import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BeneficiaryContextEditor } from '@/pages/contexte/BeneficiaryContextEditor'
import type { Beneficiary } from '@modect/shared'

interface CaregiverInfo { id: string; full_name: string; email: string }

export function AdminBeneficiaireDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [caregiver, setCaregiver]     = useState<CaregiverInfo | null>(null)
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)

  // Zone danger
  const [busy, setBusy]               = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [dangerError, setDangerError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*, profiles:caregiver_id(id, full_name, email)')
      .eq('id', id)
      .single()
    if (error || !data) { setNotFound(true); setLoading(false); return }
    const { profiles, ...ben } = data as Beneficiary & { profiles: CaregiverInfo | null }
    setBeneficiary(ben as Beneficiary)
    setCaregiver(profiles ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function toggleArchive() {
    if (!beneficiary) return
    setBusy(true)
    setDangerError(null)
    const { error } = await supabase
      .from('beneficiaries')
      .update({ is_active: !beneficiary.is_active })
      .eq('id', beneficiary.id)
    setBusy(false)
    if (error) { setDangerError(error.message); return }
    setBeneficiary({ ...beneficiary, is_active: !beneficiary.is_active })
  }

  async function deletePermanently() {
    if (!beneficiary) return
    setBusy(true)
    setDangerError(null)
    const { error } = await supabase.from('beneficiaries').delete().eq('id', beneficiary.id)
    setBusy(false)
    if (error) { setDangerError(error.message); return }
    navigate('/admin/beneficiaires')
  }

  if (loading) {
    return <div className="max-w-[1400px] mx-auto px-4 py-12 text-slate-400 text-sm">Chargement…</div>
  }

  if (notFound || !beneficiary) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <p className="text-slate-500">Bénéficiaire introuvable.</p>
        <Link to="/admin/beneficiaires" className="text-primary text-sm mt-2 inline-block">← Retour à la liste</Link>
      </div>
    )
  }

  const fullName = `${beneficiary.first_name} ${beneficiary.last_name}`
  const confirmTarget = beneficiary.last_name.trim()
  const canDelete = confirmText.trim().toLowerCase() === confirmTarget.toLowerCase()

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <Link to="/admin/beneficiaires" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brun-700 mb-4">
        <ArrowLeft size={15} /> Tous les bénéficiaires
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration · Bénéficiaire</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">{fullName}</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Aidant : {caregiver ? <strong>{caregiver.full_name || caregiver.email}</strong> : '—'}
          {caregiver?.email && <span className="text-slate-400"> · {caregiver.email}</span>}
          {' · '}
          <span className={beneficiary.is_active ? 'text-sauge' : 'text-slate-400'}>
            {beneficiary.is_active ? '● Actif' : '○ Archivé'}
          </span>
        </p>
      </header>

      <BeneficiaryContextEditor beneficiary={beneficiary} onSaved={load} withSchedule />

      {/* Zone danger */}
      <section className="mt-10 rounded-2xl border border-brique/30 bg-brique/5 p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-brique mb-1">
          <AlertTriangle size={18} /> Zone danger
        </h2>
        <p className="text-sm text-slate-500 mb-5">Ces actions affectent durablement le compte du bénéficiaire.</p>

        {/* Archiver / réactiver */}
        <div className="flex items-center justify-between gap-4 py-4 border-t border-brique/20">
          <div>
            <p className="font-medium text-brun-900">
              {beneficiary.is_active ? 'Archiver le bénéficiaire' : 'Réactiver le bénéficiaire'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {beneficiary.is_active
                ? 'Masque le bénéficiaire et suspend ses appels. Réversible, l\'historique est conservé.'
                : 'Réactive le bénéficiaire et ses appels planifiés.'}
            </p>
          </div>
          <Button variant="ghost" onClick={toggleArchive} loading={busy} className="shrink-0">
            {beneficiary.is_active ? <><Archive size={15} /> Archiver</> : <><ArchiveRestore size={15} /> Réactiver</>}
          </Button>
        </div>

        {/* Suppression définitive */}
        <div className="py-4 border-t border-brique/20">
          <p className="font-medium text-brique">Effacer définitivement</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Supprime le bénéficiaire et <strong>tout son historique</strong> (appels, transcripts, rapports,
            alertes, plannings, mémoire). <strong>Action irréversible.</strong>
          </p>
          <p className="text-xs text-slate-500 mb-1.5">
            Pour confirmer, saisissez le nom de famille : <strong className="text-brun-900">{confirmTarget}</strong>
          </p>
          <div className="flex items-center gap-3 max-w-md">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmTarget}
            />
            <Button
              variant="destructive"
              disabled={!canDelete || busy}
              loading={busy}
              onClick={deletePermanently}
              className="shrink-0"
            >
              <Trash2 size={15} /> Effacer
            </Button>
          </div>
        </div>

        {dangerError && (
          <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2 mt-3">{dangerError}</p>
        )}
      </section>
    </div>
  )
}
