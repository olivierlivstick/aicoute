import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Trash2, AlertTriangle, Check, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

interface ProfileRow {
  id:         string
  full_name:  string
  email:      string
  phone:      string | null
  timezone:   string | null
  role:       string
  created_at: string
}

interface BenLite { id: string; first_name: string; last_name: string }

export function AdminCompteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile]   = useState<ProfileRow | null>(null)
  const [bens, setBens]         = useState<BenLite[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Form
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [timezone, setTimezone] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Danger
  const [busy, setBusy]               = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [dangerError, setDangerError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: prof, error }, { data: benRows }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, timezone, role, created_at').eq('id', id).single(),
      supabase.from('beneficiaries').select('id, first_name, last_name').eq('caregiver_id', id).order('first_name'),
    ])
    if (error || !prof) { setNotFound(true); setLoading(false); return }
    const p = prof as ProfileRow
    setProfile(p)
    setFullName(p.full_name ?? '')
    setEmail(p.email ?? '')
    setPhone(p.phone ?? '')
    setTimezone(p.timezone ?? 'Europe/Paris')
    setBens((benRows as BenLite[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function save() {
    if (!profile) return
    setSaving(true)
    setSaved(false)
    setFormError(null)
    const { data, error } = await supabase.functions.invoke('admin-update-caregiver', {
      body: { id: profile.id, full_name: fullName, email: email.trim(), phone, timezone },
    })
    setSaving(false)
    if (error || (data as { error?: string })?.error) {
      setFormError((data as { error?: string })?.error ?? error?.message ?? 'Échec de l\'enregistrement')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  async function deleteAccount() {
    if (!profile) return
    setBusy(true)
    setDangerError(null)
    const { data, error } = await supabase.functions.invoke('admin-delete-caregiver', {
      body: { id: profile.id },
    })
    setBusy(false)
    if (error || (data as { error?: string })?.error) {
      setDangerError((data as { error?: string })?.error ?? error?.message ?? 'Échec de la suppression')
      return
    }
    navigate('/admin/comptes')
  }

  if (loading) {
    return <div className="max-w-[1400px] mx-auto px-4 py-12 text-slate-400 text-sm">Chargement…</div>
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <p className="text-slate-500">Compte introuvable.</p>
        <Link to="/admin/comptes" className="text-primary text-sm mt-2 inline-block">← Retour à la liste</Link>
      </div>
    )
  }

  const hasBeneficiaries = bens.length > 0
  const confirmTarget = profile.email.trim()
  const canDelete = !hasBeneficiaries && confirmText.trim().toLowerCase() === confirmTarget.toLowerCase()

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <Link to="/admin/comptes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brun-700 mb-4">
        <ArrowLeft size={15} /> Tous les comptes
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-700 font-semibold mb-1">Administration · Compte</p>
        <h1 className="font-serif text-3xl font-semibold text-brun-900">{profile.full_name || profile.email}</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
          {' · '}
          {profile.role === 'admin'
            ? <span className="inline-flex items-center gap-1 text-accent-700 font-semibold"><ShieldCheck size={13} /> admin</span>
            : <span>{profile.role}</span>}
        </p>
      </header>

      {/* Formulaire d'édition */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-serif text-lg font-semibold text-brun-900 mb-4">Informations du compte</h2>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Nom complet</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 6 00 00 00 00" />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email (identifiant de connexion)</Label>
            <p className="text-xs text-slate-400 mb-1">
              Modifier cet email change aussi l'adresse de connexion du compte.
            </p>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone">Fuseau horaire</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Paris" />
            </div>
            <div>
              <Label>Rôle</Label>
              <div className="flex h-10 items-center px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                {profile.role} <span className="text-xs text-slate-400 ml-2">(non modifiable)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-100">
          <div className="flex-1">
            {saved && (
              <p className="text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <Check size={14} /> Modifications enregistrées
              </p>
            )}
            {formError && (
              <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-1.5">{formError}</p>
            )}
          </div>
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      </div>

      {/* Bénéficiaires rattachés */}
      <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-brun-900 mb-1">
          <Users size={18} className="text-slate-400" /> Bénéficiaires rattachés ({bens.length})
        </h2>
        {bens.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">Aucun bénéficiaire — ce compte peut être supprimé.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {bens.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/admin/beneficiaires/${b.id}`}
                  className="inline-block px-3 py-1.5 rounded-full bg-creme text-brun-700 text-sm hover:bg-creme-sable transition-colors"
                >
                  {b.first_name} {b.last_name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zone danger */}
      <section className="mt-10 rounded-2xl border border-brique/30 bg-brique/5 p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-brique mb-1">
          <AlertTriangle size={18} /> Zone danger
        </h2>
        <p className="text-sm text-slate-500 mb-5">La suppression d'un compte est irréversible.</p>

        <div className="py-4 border-t border-brique/20">
          <p className="font-medium text-brique">Supprimer définitivement le compte</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Supprime le compte aidant et son accès de connexion. <strong>Action irréversible.</strong>
          </p>

          {hasBeneficiaries ? (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Impossible de supprimer : ce compte a encore <strong>{bens.length} bénéficiaire(s)</strong>.
                Supprimez-les d'abord (depuis leur fiche) pour éviter des bénéficiaires orphelins.
              </span>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-1.5">
                Pour confirmer, saisissez l'email : <strong className="text-brun-900">{confirmTarget}</strong>
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
                  onClick={deleteAccount}
                  className="shrink-0"
                >
                  <Trash2 size={15} /> Supprimer
                </Button>
              </div>
            </>
          )}

          {dangerError && (
            <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2 mt-3">{dangerError}</p>
          )}
        </div>
      </section>
    </div>
  )
}
