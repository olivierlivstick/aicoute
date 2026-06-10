import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Trash2, AlertTriangle, Check, Users, User, ScrollText, ShoppingBag, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn, formatDate } from '@/lib/utils'
import { useMinutesBalance } from '@/hooks/useMinutesBalance'
import { useMinuteLedger } from '@/hooks/useMinuteLedger'
import { MinutesBalanceCard, LedgerTable, PurchasesTable } from '@/pages/compte/MinutesViews'

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
  const [tab, setTab]           = useState<'profil' | 'solde' | 'achats'>('profil')

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

      {/* Onglets (miroir du « Mon compte » de l'aidant) */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {([
          { id: 'profil', label: 'Profil', icon: User },
          { id: 'solde',  label: 'Son solde', icon: ScrollText },
          { id: 'achats', label: 'Ses achats', icon: ShoppingBag },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
              tab === id ? 'text-primary' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={16} />
            {label}
            {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {tab === 'solde'  && <AdminSoldeTab caregiverId={profile.id} />}
      {tab === 'achats' && <AdminAchatsTab caregiverId={profile.id} />}

      {tab === 'profil' && (<>
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
      </>)}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Onglet « Son solde » (admin) : carte solde + CTA créditer + historique + relevé
// ────────────────────────────────────────────────────────────────────────────

function AdminSoldeTab({ caregiverId }: { caregiverId: string }) {
  const balance = useMinutesBalance(caregiverId)
  const ledger  = useMinuteLedger(caregiverId)

  const refresh = () => { balance.reload(); ledger.reload() }

  return (
    <div className="space-y-6">
      <MinutesBalanceCard balance={balance} />
      <CreditMinutesCard caregiverId={caregiverId} onCredited={refresh} />
      <LedgerTable entries={ledger.entries} loading={ledger.loading} />
    </div>
  )
}

// ── CTA : créditer des minutes (geste commercial) + historique des crédits ──
const CREDIT_PRESETS = ['Geste commercial', 'Cadeau', 'Test prolongé']

interface AdjustmentRow { id: string; minutes: number; reason: string; created_at: string }

function CreditMinutesCard({ caregiverId, onCredited }: { caregiverId: string; onCredited: () => void }) {
  const [minutes, setMinutes] = useState('')
  const [reason, setReason]   = useState(CREDIT_PRESETS[0])
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [history, setHistory] = useState<AdjustmentRow[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    supabase
      .from('minute_adjustments')
      .select('id, minutes, reason, created_at')
      .eq('caregiver_id', caregiverId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setHistory((data as AdjustmentRow[] | null) ?? []) })
    return () => { active = false }
  }, [caregiverId, reloadKey])

  const submit = async () => {
    const n = Number(minutes)
    if (!Number.isInteger(n) || n <= 0) { setError('Saisissez un nombre de minutes entier positif.'); return }
    if (!reason.trim()) { setError('Un motif est requis.'); return }
    setError(null); setMsg(null); setBusy(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-credit-minutes', {
        body: { caregiver_id: caregiverId, minutes: n, reason: reason.trim() },
      })
      if (invokeError) {
        const ctx = (invokeError as { context?: Response }).context
        let m = 'Le crédit a échoué.'
        try { m = (await ctx?.json())?.error ?? m } catch { /* défaut */ }
        throw new Error(m)
      }
      const res = data as { ok?: boolean; minutes?: number; error?: string }
      if (!res?.ok) throw new Error(res?.error ?? 'Le crédit a échoué.')
      setMsg(`${res.minutes} minutes créditées.`)
      setMinutes('')
      setReloadKey((k) => k + 1)  // recharge l'historique
      onCredited()                // recharge le solde + relevé
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-primary/30 shadow-sm p-6">
      <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-brun-900 mb-1">
        <Gift size={18} className="text-primary" /> Créditer des minutes
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Geste commercial, cadeau, test prolongé… Les minutes sont créditées aussitôt et apparaissent
        chez l'aidant comme « Minutes offertes » (le motif reste interne).
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="w-32">
          <Label htmlFor="credit_minutes">Minutes</Label>
          <Input
            id="credit_minutes"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="credit_reason">Motif (interne)</Label>
          <Input
            id="credit_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Geste commercial"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CREDIT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                  reason === p
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <Button type="button" onClick={submit} loading={busy} className="shrink-0">
          Créditer
        </Button>
      </div>

      {msg && <p className="mt-3 text-sm text-sauge bg-sauge/10 rounded-lg px-3 py-2">{msg}</p>}
      {error && <p className="mt-3 text-sm text-brique bg-brique/10 rounded-lg px-3 py-2">{error}</p>}

      {history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Crédits accordés</p>
          <ul className="space-y-1.5 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-slate-600">
                <span className="text-slate-400 w-20 shrink-0">
                  {formatDate(h.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-medium text-sauge w-14 shrink-0 tabular-nums">+{h.minutes} min</span>
                <span className="text-slate-500 truncate">{h.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── Onglet « Ses achats » (admin) ──
function AdminAchatsTab({ caregiverId }: { caregiverId: string }) {
  const balance = useMinutesBalance(caregiverId)
  return <PurchasesTable purchases={balance.purchases} loading={balance.loading} />
}
