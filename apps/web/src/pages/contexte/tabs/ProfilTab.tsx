import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  BookOpen, Heart, Sparkles, IdCard, Mail, Notebook, ChevronRight,
  AlertTriangle, Lock, Cake, Users, Phone, Globe, Shield, X, Plus, Trash2,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { PhoneInput } from '@/components/PhoneInput'
import { useBeneficiary } from '@/hooks/useBeneficiary'
import { cn } from '@/lib/utils'
import type { Beneficiary } from '@modect/shared'
import {
  EditableCard, Field, Chip, InfoRow, EditLabel, EditFooter, useSection,
  splitList, computeAge, formatBirthDate, langLabel,
} from '../cards'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * NOTE Rules-of-Hooks : chaque formulaire d'édition est un composant dédié
 * (monté uniquement quand la carte passe en édition), jamais des hooks appelés
 * directement dans le render-prop `renderEdit`.
 */

export function ProfilTab({
  beneficiary,
  onSaved,
  onGoToMemory,
  memoryCount,
  onDeleted,
}: {
  beneficiary: Beneficiary
  onSaved: () => void
  onGoToMemory: () => void
  memoryCount: number | null
  /** Si fourni, affiche une zone danger « Effacer » en bas (vue aidant). */
  onDeleted?: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Colonne principale — portrait narratif */}
        <div className="lg:col-span-2 space-y-5">
          <HistoryCard beneficiary={beneficiary} onSaved={onSaved} />
          <TastesCard beneficiary={beneficiary} onSaved={onSaved} />
          <PersonalityCard beneficiary={beneficiary} onSaved={onSaved} />
        </div>

        {/* Colonne latérale — identité & contact */}
        <div className="space-y-5">
          <IdentityCard beneficiary={beneficiary} onSaved={onSaved} />
          <RecipientsCard beneficiary={beneficiary} onSaved={onSaved} />
          <MemoryGateway onGoToMemory={onGoToMemory} memoryCount={memoryCount} />
        </div>
      </div>

      {onDeleted && <DangerZone beneficiary={beneficiary} onDeleted={onDeleted} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Zone danger (vue aidant) — suppression définitive du bénéficiaire
// ────────────────────────────────────────────────────────────────────────────

function DangerZone({ beneficiary, onDeleted }: { beneficiary: Beneficiary; onDeleted: () => void }) {
  const { deleteBeneficiary } = useBeneficiary(beneficiary.id)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = beneficiary.last_name.trim()
  const canDelete = confirm.trim().toLowerCase() === target.toLowerCase()

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const ok = await deleteBeneficiary()
    setBusy(false)
    if (!ok) { setError('Impossible de supprimer ce bénéficiaire. Réessayez.'); return }
    onDeleted()
  }

  return (
    <section className="rounded-2xl border border-brique/25 bg-brique/[0.04] p-6">
      <h2 className="flex items-center gap-2 font-title text-[16px] font-semibold text-brique mb-1">
        <AlertTriangle size={17} /> Zone danger
      </h2>
      <p className="text-[13px] text-slate-500 mb-3">
        Supprime <strong className="text-brun-900">{beneficiary.first_name} {beneficiary.last_name}</strong> et
        <strong> tout son historique</strong> (appels, comptes-rendus, planning, mémoire). Action irréversible.
      </p>
      <p className="text-xs text-slate-500 mb-1.5">
        Pour confirmer, saisissez le nom de famille : <strong className="text-brun-900">{target}</strong>
      </p>
      <div className="flex items-center gap-3 max-w-md">
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={target} />
        <Button
          variant="destructive"
          disabled={!canDelete || busy}
          loading={busy}
          onClick={handleDelete}
          className="shrink-0"
        >
          <Trash2 size={15} /> Effacer
        </Button>
      </div>
      {error && <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2 mt-3">{error}</p>}
    </section>
  )
}

type CardProps = { beneficiary: Beneficiary; onSaved: () => void }
type EditProps = CardProps & { close: () => void }

// ────────────────────────────────────────────────────────────────────────────
// Son histoire
// ────────────────────────────────────────────────────────────────────────────

function HistoryCard({ beneficiary, onSaved }: CardProps) {
  return (
    <EditableCard
      title="Son histoire"
      icon={BookOpen}
      renderEdit={(close) => <HistoryEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="space-y-4">
        <Field label="Histoire familiale" empty="Aucune histoire familiale renseignée">
          {beneficiary.family_history}
        </Field>
        <Field label="Résumé de vie" empty="Aucun résumé de vie renseigné">
          {beneficiary.life_story}
        </Field>
      </div>
    </EditableCard>
  )
}

function HistoryEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm({
    values: {
      family_history: beneficiary.family_history ?? '',
      life_story: beneficiary.life_story ?? '',
    },
  })
  const submit = handleSubmit(async (v) => {
    const ok = await save({
      family_history: v.family_history || null,
      life_story: v.life_story || null,
    })
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <EditLabel>Histoire familiale</EditLabel>
        <Textarea rows={4} placeholder="Enfants, petits-enfants, conjoint·e, personnes importantes…" {...register('family_history')} />
      </div>
      <div>
        <EditLabel>Résumé de vie</EditLabel>
        <Textarea rows={4} placeholder="Métier exercé, lieux de vie, moments marquants…" {...register('life_story')} />
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Goûts & centres d'intérêt
// ────────────────────────────────────────────────────────────────────────────

function TastesCard({ beneficiary, onSaved }: CardProps) {
  const hobbies = splitList(beneficiary.hobbies)
  const favorites = splitList(beneficiary.favorite_topics)
  const avoid = splitList(beneficiary.topics_to_avoid)

  return (
    <EditableCard
      title="Goûts & centres d'intérêt"
      icon={Heart}
      renderEdit={(close) => <TastesEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Activités et loisirs</p>
          {hobbies.length ? (
            <div className="flex flex-wrap gap-2">
              {hobbies.map((h) => <Chip key={h} tone="neutral">{h}</Chip>)}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400 italic">Aucune activité renseignée.</p>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Sujets de conversation préférés</p>
          {favorites.length ? (
            <div className="flex flex-wrap gap-2">
              {favorites.map((t) => <Chip key={t} tone="sauge" icon={Heart}>{t}</Chip>)}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400 italic">Aucun sujet préféré renseigné.</p>
          )}
        </div>
        {/* Sujets à éviter — encadré de sécurité, toujours saillant */}
        <div className="rounded-xl border border-brique/20 bg-brique/[0.04] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brique font-semibold mb-2">
            <AlertTriangle size={13} /> Sujets à éviter absolument
          </p>
          {avoid.length ? (
            <div className="flex flex-wrap gap-2">
              {avoid.map((t) => <Chip key={t} tone="brique">{t}</Chip>)}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400 italic">Aucun sujet sensible signalé.</p>
          )}
        </div>
      </div>
    </EditableCard>
  )
}

function TastesEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm({
    values: {
      hobbies: beneficiary.hobbies ?? '',
      favorite_topics: beneficiary.favorite_topics ?? '',
      topics_to_avoid: beneficiary.topics_to_avoid ?? '',
    },
  })
  const submit = handleSubmit(async (v) => {
    const ok = await save({
      hobbies: v.hobbies || null,
      favorite_topics: v.favorite_topics || null,
      topics_to_avoid: v.topics_to_avoid || null,
    })
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <EditLabel>Activités et loisirs</EditLabel>
        <Textarea rows={2} placeholder="Jardinage, tricot, mots croisés…" {...register('hobbies')} />
      </div>
      <div>
        <EditLabel>Sujets de conversation préférés</EditLabel>
        <Textarea rows={2} placeholder="Ses petits-enfants, son jardin…" {...register('favorite_topics')} />
      </div>
      <div>
        <EditLabel tone="brique">Sujets à éviter absolument</EditLabel>
        <Textarea rows={2} placeholder="La politique, les nouvelles anxiogènes…" {...register('topics_to_avoid')} />
      </div>
      <p className="text-xs text-slate-400 -mt-1">Séparez les éléments par une virgule ou un retour à la ligne.</p>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Personnalité & bien-être
// ────────────────────────────────────────────────────────────────────────────

function PersonalityCard({ beneficiary, onSaved }: CardProps) {
  return (
    <EditableCard
      title="Personnalité & bien-être"
      icon={Sparkles}
      renderEdit={(close) => <PersonalityEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="space-y-4">
        <Field label="Traits de caractère" empty="Aucun trait de caractère renseigné">
          {beneficiary.personality_notes}
        </Field>
        <Field label="Notes de bien-être" empty="Aucune note de bien-être">
          {beneficiary.health_notes}
        </Field>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 bg-creme/60 rounded-lg px-3 py-2">
          <Lock size={12} /> Informations confidentielles, jamais partagées avec des tiers.
        </p>
      </div>
    </EditableCard>
  )
}

function PersonalityEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm({
    values: {
      personality_notes: beneficiary.personality_notes ?? '',
      health_notes: beneficiary.health_notes ?? '',
    },
  })
  const submit = handleSubmit(async (v) => {
    const ok = await save({
      personality_notes: v.personality_notes || null,
      health_notes: v.health_notes || null,
    })
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <EditLabel>Traits de caractère</EditLabel>
        <Textarea rows={3} placeholder="Humeur générale, façon d'être, ce qui le/la fait rire…" {...register('personality_notes')} />
      </div>
      <div>
        <EditLabel>Notes de bien-être</EditLabel>
        <Textarea rows={3} placeholder="Infos utiles (sans détails médicaux) pour adapter les échanges…" {...register('health_notes')} />
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Identité & contact
// ────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

const identitySchema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name: z.string().min(1, 'Nom requis'),
  birth_date: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
})
type IdentityForm = z.infer<typeof identitySchema>

const GENDERS = [
  { value: 'female', label: 'Femme' },
  { value: 'male', label: 'Homme' },
] as const

function genderLabel(g: Beneficiary['gender']): string {
  return g === 'female' ? 'Femme' : g === 'male' ? 'Homme' : g === 'other' ? 'Autre' : '—'
}

function IdentityCard({ beneficiary, onSaved }: CardProps) {
  const age = computeAge(beneficiary.birth_date, beneficiary.birth_year)
  const born = formatBirthDate(beneficiary.birth_date)
  return (
    <EditableCard
      title="Identité & contact"
      icon={IdCard}
      renderEdit={(close) => <IdentityEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <dl className="space-y-3">
        <InfoRow
          icon={Cake}
          label="Âge"
          value={age ? `${age} ans` : 'Non renseigné'}
          sub={born ? `né·e le ${born}` : beneficiary.birth_year ? `né·e en ${beneficiary.birth_year}` : undefined}
        />
        <InfoRow icon={Users} label="Genre" value={genderLabel(beneficiary.gender)} />
        <InfoRow
          icon={Phone}
          label="Téléphone"
          value={beneficiary.phone ? <span className="font-mono text-[13.5px]">{beneficiary.phone}</span> : 'Non renseigné'}
        />
        <InfoRow
          icon={Globe}
          label="Langues"
          value={`Conversation : ${langLabel(beneficiary.language_preference)} · Retours : ${langLabel(beneficiary.report_language)}`}
        />
      </dl>
    </EditableCard>
  )
}

function IdentityEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    values: {
      first_name: beneficiary.first_name,
      last_name: beneficiary.last_name,
      birth_date: beneficiary.birth_date ?? '',
      gender: (beneficiary.gender === 'male' || beneficiary.gender === 'female') ? beneficiary.gender : undefined,
    },
  })
  const [phone, setPhone] = useState(beneficiary.phone ?? '')
  const selectedGender = watch('gender')
  const submit = handleSubmit(async (v) => {
    const birthDate = v.birth_date || null
    const ok = await save({
      first_name: v.first_name,
      last_name: v.last_name,
      birth_date: birthDate,
      // birth_year synchronisé à partir de la date (prompt edge + repli âge).
      birth_year: birthDate ? Number(birthDate.slice(0, 4)) : null,
      gender: v.gender ?? null,
      phone: phone || null,
    })
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <EditLabel>Prénom</EditLabel>
          <Input error={errors.first_name?.message} {...register('first_name')} />
        </div>
        <div>
          <EditLabel>Nom</EditLabel>
          <Input error={errors.last_name?.message} {...register('last_name')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <EditLabel>Date de naissance</EditLabel>
          <Input type="date" min="1900-01-01" max={TODAY} error={errors.birth_date?.message} {...register('birth_date')} />
        </div>
        <div>
          <EditLabel>Genre</EditLabel>
          <div className="flex gap-2">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('gender', value, { shouldDirty: true })}
                className={cn(
                  'flex-1 h-10 rounded-xl border text-sm font-medium transition-all',
                  selectedGender === value
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-creme-sable text-slate-600 hover:border-slate-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <EditLabel>Téléphone</EditLabel>
        <PhoneInput value={phone} onChange={setPhone} />
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Comptes-rendus envoyés à
// ────────────────────────────────────────────────────────────────────────────

function RecipientsCard({ beneficiary, onSaved }: CardProps) {
  const recipients = beneficiary.report_recipients ?? []
  return (
    <EditableCard
      title="Comptes-rendus envoyés à"
      icon={Mail}
      renderEdit={(close) => <RecipientsEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 text-[13.5px] text-slate-700">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-primary-50 text-primary shrink-0">
            <Shield size={13} />
          </span>
          <span>L'aidant référent reçoit toujours le compte-rendu.</span>
        </div>
        {recipients.map((e) => (
          <div key={e} className="flex items-center gap-2.5 text-[13.5px] text-slate-600">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-creme text-slate-400 shrink-0">
              <Mail size={13} />
            </span>
            <span className="truncate">{e}</span>
          </div>
        ))}
        <p className="text-xs text-slate-400 pt-1">
          {recipients.length
            ? 'Ces proches reçoivent un résumé après chaque appel.'
            : 'Ajoutez des proches pour qu’ils reçoivent aussi les comptes-rendus.'}
        </p>
      </div>
    </EditableCard>
  )
}

function RecipientsEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const [recipients, setRecipients] = useState<string[]>(beneficiary.report_recipients ?? [])
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const add = () => {
    const email = draft.trim()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setLocalError('Adresse email invalide.'); return }
    if (recipients.some((r) => r.toLowerCase() === email.toLowerCase())) {
      setLocalError('Cette adresse est déjà dans la liste.'); return
    }
    setRecipients([...recipients, email])
    setDraft('')
    setLocalError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await save({ report_recipients: recipients })
    if (ok) { onSaved(); close() }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {recipients.length > 0 && (
        <div className="space-y-2">
          {recipients.map((email) => (
            <div key={email} className="flex items-center gap-2">
              <span className="flex-1 inline-flex items-center gap-1.5 bg-primary-50 text-primary border border-primary/15 rounded-lg px-3 py-1.5 text-sm font-medium truncate">
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{email}</span>
              </span>
              <button
                type="button"
                onClick={() => setRecipients(recipients.filter((r) => r !== email))}
                className="shrink-0 p-2 text-slate-400 hover:text-brique rounded-lg hover:bg-creme transition-colors"
                aria-label={`Retirer ${email}`}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="frere@exemple.fr"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setLocalError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={add} className="shrink-0">
          <Plus size={14} /> Ajouter
        </Button>
      </div>
      {localError && <p className="text-xs text-brique">{localError}</p>}
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Passerelle vers l'onglet Mémoire
// ────────────────────────────────────────────────────────────────────────────

function MemoryGateway({ onGoToMemory, memoryCount }: { onGoToMemory: () => void; memoryCount: number | null }) {
  return (
    <button
      type="button"
      onClick={onGoToMemory}
      className="w-full text-left bg-gradient-to-br from-primary-50 to-creme rounded-2xl border border-primary/15 p-5 hover:shadow-sm transition-shadow group"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="grid place-items-center w-7 h-7 rounded-lg bg-white text-primary">
          <Notebook size={15} />
        </span>
        <h3 className="font-title text-[15px] font-semibold text-slate-800 flex-1">Mémoire du compagnon</h3>
        <ChevronRight size={16} className="text-primary group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="text-[13.5px] text-slate-600 leading-relaxed">
        {memoryCount === null ? (
          'Ce dont le compagnon se souvient pour personnaliser ses échanges.'
        ) : memoryCount > 0 ? (
          <>
            <strong className="text-brun-900">{memoryCount} souvenir{memoryCount > 1 ? 's' : ''}</strong> retenu
            {memoryCount > 1 ? 's' : ''} d'un appel à l'autre. Cliquez pour consulter et éditer.
          </>
        ) : (
          'Aucun souvenir encore. Ils apparaîtront après les premiers appels.'
        )}
      </p>
    </button>
  )
}
