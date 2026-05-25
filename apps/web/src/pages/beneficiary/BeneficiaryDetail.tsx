import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Phone, CalendarDays } from 'lucide-react'
import { useBeneficiary } from '@/hooks/useBeneficiary'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import type { AIVoice, Beneficiary } from '@modect/shared'

// Genre de la voix ↔ voix Realtime GA (cedar = masculine, marin = féminine).
// Tolère les anciennes valeurs (nova, shimmer…) en les ramenant au bon genre.
const FEMININE_VOICES = ['marin', 'nova', 'shimmer', 'coral', 'sage']
const voiceToGenderValue = (v?: string | null): AIVoice =>
  v === 'cedar' ? 'cedar'
    : v === 'marin' ? 'marin'
    : FEMININE_VOICES.includes(v ?? '') ? 'marin' : 'cedar'
const voiceGenderLabel = (v?: string | null) =>
  voiceToGenderValue(v) === 'marin' ? 'Féminin' : 'Masculin'

type EditableFields = Pick<
  Beneficiary,
  | 'first_name' | 'last_name' | 'birth_year' | 'phone'
  | 'family_history' | 'life_story' | 'hobbies'
  | 'favorite_topics' | 'topics_to_avoid' | 'personality_notes' | 'health_notes'
  | 'ai_persona_name' | 'ai_voice' | 'conversation_style' | 'language_preference'
  | 'is_active'
>

export function BeneficiaryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { beneficiary, loading, update, deleteBeneficiary } = useBeneficiary(id)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  const simulateCall = async () => {
    if (!beneficiary) return
    setSimulating(true)
    setSimError(null)
    try {
      // Créer un call à la demande. Le system prompt et le token Realtime sont
      // construits par realtime-token au moment où la page d'appel se connecte.
      const { data: call, error: callErr } = await supabase
        .from('calls')
        .insert({ beneficiary_id: beneficiary.id, scheduled_at: new Date().toISOString(), status: 'scheduled' })
        .select('id')
        .single()
      if (callErr || !call) throw new Error('Impossible de créer l\'appel')

      const params = new URLSearchParams({
        call_id: call.id,
        persona: beneficiary.ai_persona_name ?? 'Marie',
      })
      navigate(`/call?${params.toString()}`)
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSimulating(false)
    }
  }

  const { register, handleSubmit, reset } = useForm<EditableFields>({
    values: beneficiary
      ? { ...beneficiary, ai_voice: voiceToGenderValue(beneficiary.ai_voice) }
      : undefined,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!beneficiary) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Bénéficiaire introuvable.</p>
        <Link to="/beneficiary" className="text-primary mt-2 inline-block hover:underline">
          ← Retour à la liste
        </Link>
      </div>
    )
  }

  const onSave = async (values: EditableFields) => {
    setSaving(true)
    await update(values)
    setSaving(false)
    setEditing(false)
  }

  const onDelete = async () => {
    const ok = await deleteBeneficiary()
    if (ok) navigate('/beneficiary', { replace: true })
  }

  const b = beneficiary

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/beneficiary" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="font-title text-3xl font-bold text-slate-800">
            {b.first_name} {b.last_name}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compagnon : <strong>{b.ai_persona_name}</strong> · Voix : {voiceGenderLabel(b.ai_voice)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/sessions?beneficiary=${b.id}`}>
            <Button variant="ghost" size="sm">
              <CalendarDays size={16} /> Planifier
            </Button>
          </Link>
          <Button variant="primary" size="sm" loading={simulating} onClick={simulateCall}>
            <Phone size={16} /> Simuler un appel
          </Button>
          {simError && <p className="text-xs text-red-500 self-center">{simError}</p>}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); reset() }}>
                Annuler
              </Button>
              <Button size="sm" loading={saving} onClick={handleSubmit(onSave)}>
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Modifier
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* Infos de base */}
        <Section title="Informations de base">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" editing={editing}>
              {editing
                ? <Input {...register('first_name')} />
                : <Value>{b.first_name}</Value>}
            </Field>
            <Field label="Nom" editing={editing}>
              {editing
                ? <Input {...register('last_name')} />
                : <Value>{b.last_name}</Value>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Année de naissance" editing={editing}>
              {editing
                ? <Input type="number" {...register('birth_year', { valueAsNumber: true })} />
                : <Value>{b.birth_year ?? '—'}</Value>}
            </Field>
            <Field label="Téléphone" editing={editing}>
              {editing
                ? <Input type="tel" {...register('phone')} />
                : <Value>{b.phone ?? '—'}</Value>}
            </Field>
          </div>
        </Section>

        {/* Histoire */}
        <Section title="Son histoire">
          <Field label="Histoire familiale" editing={editing}>
            {editing
              ? <Textarea rows={3} {...register('family_history')} />
              : <Value multiline>{b.family_history}</Value>}
          </Field>
          <Field label="Résumé de vie" editing={editing}>
            {editing
              ? <Textarea rows={4} {...register('life_story')} />
              : <Value multiline>{b.life_story}</Value>}
          </Field>
        </Section>

        {/* Goûts */}
        <Section title="Goûts et intérêts">
          <Field label="Loisirs" editing={editing}>
            {editing
              ? <Textarea rows={2} {...register('hobbies')} />
              : <Value multiline>{b.hobbies}</Value>}
          </Field>
          <Field label="Sujets préférés" editing={editing}>
            {editing
              ? <Textarea rows={2} {...register('favorite_topics')} />
              : <Value multiline>{b.favorite_topics}</Value>}
          </Field>
          <Field label="Sujets à éviter" editing={editing}>
            {editing
              ? <Textarea rows={2} {...register('topics_to_avoid')} />
              : <Value multiline>{b.topics_to_avoid}</Value>}
          </Field>
        </Section>

        {/* Personnalité */}
        <Section title="Personnalité">
          <Field label="Traits de caractère" editing={editing}>
            {editing
              ? <Textarea rows={3} {...register('personality_notes')} />
              : <Value multiline>{b.personality_notes}</Value>}
          </Field>
          <Field label="Notes de bien-être" editing={editing}>
            {editing
              ? <Textarea rows={2} {...register('health_notes')} />
              : <Value multiline>{b.health_notes}</Value>}
          </Field>
        </Section>

        {/* Config IA */}
        <Section title="Configuration IA">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom du compagnon" editing={editing}>
              {editing
                ? <Input {...register('ai_persona_name')} />
                : <Value>{b.ai_persona_name}</Value>}
            </Field>
            <Field label="Genre de la voix" editing={editing}>
              {editing ? (
                <select className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base" {...register('ai_voice')}>
                  <option value="marin">Féminin</option>
                  <option value="cedar">Masculin</option>
                </select>
              ) : <Value>{voiceGenderLabel(b.ai_voice)}</Value>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Style" editing={editing}>
              {editing ? (
                <select className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base" {...register('conversation_style')}>
                  {['warm','playful','calm','formal'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : <Value>{b.conversation_style}</Value>}
            </Field>
            <Field label="Langue" editing={editing}>
              {editing ? (
                <select className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base" {...register('language_preference')}>
                  {[['fr','Français'],['en','English'],['es','Español'],['de','Deutsch'],['it','Italiano']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              ) : <Value>{b.language_preference}</Value>}
            </Field>
          </div>
        </Section>
      </form>

      {/* Zone danger */}
      <div className="mt-10 pt-6 border-t border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3">Zone de danger</h3>
        {!confirmDelete ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} /> Supprimer ce profil
          </Button>
        ) : (
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-sm text-red-700 mb-3 font-medium">
              ⚠️ Cette action est irréversible. Tous les appels et souvenirs associés seront supprimés.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Confirmer la suppression
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sous-composants ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-4 text-base">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Value({ children, multiline }: { children: React.ReactNode; multiline?: boolean }) {
  if (!children) return <p className="text-slate-400 text-sm">—</p>
  return multiline
    ? <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{children}</p>
    : <p className="text-slate-700 text-sm">{children}</p>
}
