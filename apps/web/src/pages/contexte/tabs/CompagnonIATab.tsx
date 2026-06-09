import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, MessageCircle, Sparkles, Globe, Phone, DoorOpen,
  Play, Pause, Loader2, RotateCcw, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { resolvePromptPlaceholders, resolveGeminiVoice, voicesForEngine } from '@modect/shared'
import type { Beneficiary, ConversationStyle } from '@modect/shared'
import { VoicePicker } from '@/components/VoicePicker'
import { EditableCard, EditLabel, EditFooter, useSection, STYLES, LANGUAGES, langLabel } from '../cards'

// Champs inbound absents du type Beneficiary partagé (cf. preferred_engine).
type InboundFields = {
  inbound_enabled?: boolean
  inbound_max_minutes_per_day?: number
  inbound_cooldown_minutes?: number
  inbound_max_duration_seconds?: number
  inbound_custom_prompt?: string
  report_language?: string
  gemini_voice?: string
}
const inb = (b: Beneficiary) => b as unknown as InboundFields

const selectCls =
  'w-full h-10 rounded-xl border border-creme-sable bg-creme/40 px-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-300 focus:bg-white'

type CardProps = { beneficiary: Beneficiary; onSaved: () => void }
type EditProps = CardProps & { close: () => void }

export function CompagnonIATab({ beneficiary, onSaved }: CardProps) {
  return (
    <div className="grid lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-5">
        <IdentityCard beneficiary={beneficiary} onSaved={onSaved} />
        <StyleCard beneficiary={beneficiary} onSaved={onSaved} />
        <PromptCard beneficiary={beneficiary} onSaved={onSaved} />
        <InboundOpeningCard beneficiary={beneficiary} onSaved={onSaved} />
      </div>
      <div className="space-y-5">
        <LanguagesCard beneficiary={beneficiary} onSaved={onSaved} />
        <InboundCard beneficiary={beneficiary} onSaved={onSaved} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Lecteur d'échantillon de voix (lecture seule)
// ────────────────────────────────────────────────────────────────────────────

const WAVEFORM = [10, 18, 8, 24, 14, 20, 10, 16, 6, 22, 12]

function VoiceSamplePlayer({ voiceId }: { voiceId: string }) {
  const voice = voicesForEngine('gemini').find((v) => v.id === voiceId) ?? voicesForEngine('gemini')[0]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')

  const toggle = () => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audio.onended = () => setState('idle')
      audioRef.current = audio
    }
    if (state === 'playing') { audio.pause(); setState('idle'); return }
    audio.pause()
    audio.src = voice.sample
    audio.currentTime = 0
    setState('loading')
    void audio.play().then(() => setState('playing')).catch(() => setState('idle'))
  }

  return (
    <div className="rounded-xl border border-creme-sable bg-creme/40 p-3.5 flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={state === 'playing' ? 'Arrêter' : `Écouter ${voice.label}`}
        className="grid place-items-center w-11 h-11 rounded-full bg-primary text-white shrink-0 hover:bg-primary-600 transition-colors"
      >
        {state === 'loading' ? <Loader2 size={16} className="animate-spin" /> : state === 'playing' ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-slate-800">Voix « {voice.label} »</p>
        <p className="text-xs text-slate-500 truncate">{voice.description}</p>
      </div>
      <div className="flex items-end gap-0.5 h-7" aria-hidden>
        {WAVEFORM.map((h, i) => (
          <span key={i} className="w-1 rounded-full bg-primary/30" style={{ height: h }} />
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Identité du compagnon
// ────────────────────────────────────────────────────────────────────────────

const identitySchema = z.object({
  ai_persona_name: z.string().min(1, 'Prénom requis'),
  gemini_voice: z.string(),
})
type IdentityForm = z.infer<typeof identitySchema>

function IdentityCard({ beneficiary, onSaved }: CardProps) {
  const persona = beneficiary.ai_persona_name || 'Marie'
  const voiceId = resolveGeminiVoice(inb(beneficiary).gemini_voice)
  return (
    <EditableCard
      title="Identité du compagnon"
      icon={Bot}
      renderEdit={(close) => <IdentityEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="flex items-center gap-4 mb-5">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-300 to-primary text-white font-title text-2xl shadow-sm">
          {persona[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-title text-lg font-semibold text-brun-900">{persona}</p>
          <p className="text-[13.5px] text-slate-500">Le prénom que {beneficiary.first_name} entend à chaque appel</p>
        </div>
      </div>
      <VoiceSamplePlayer voiceId={voiceId} />
    </EditableCard>
  )
}

function IdentityEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    values: {
      ai_persona_name: beneficiary.ai_persona_name ?? 'Marie',
      gemini_voice: resolveGeminiVoice(inb(beneficiary).gemini_voice),
    },
  })
  const selectedVoice = watch('gemini_voice')
  const submit = handleSubmit(async (v) => {
    // Gemini-only : on force le moteur, ai_voice (OpenAI) est laissée intacte.
    const ok = await save({
      ai_persona_name: v.ai_persona_name,
      gemini_voice: v.gemini_voice,
      preferred_engine: 'gemini',
    } as unknown as Partial<Beneficiary>)
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <EditLabel>Prénom du compagnon</EditLabel>
        <Input placeholder="Marie" error={errors.ai_persona_name?.message} {...register('ai_persona_name')} />
      </div>
      <div>
        <EditLabel>Voix — écoutez puis choisissez</EditLabel>
        <VoicePicker engine="gemini" value={selectedVoice} onChange={(id) => setValue('gemini_voice', id, { shouldDirty: true })} />
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Style de conversation
// ────────────────────────────────────────────────────────────────────────────

function StyleCard({ beneficiary, onSaved }: CardProps) {
  const style = STYLES.find((s) => s.value === (beneficiary.conversation_style ?? 'warm')) ?? STYLES[0]
  return (
    <EditableCard
      title="Style de conversation"
      icon={MessageCircle}
      renderEdit={(close) => <StyleEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{style.emoji}</span>
        <div>
          <p className="text-[15px] font-semibold text-brun-900">{style.label}</p>
          <p className="text-[13px] text-slate-500">{style.description}</p>
        </div>
      </div>
    </EditableCard>
  )
}

function StyleEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const [style, setStyle] = useState<ConversationStyle>(beneficiary.conversation_style ?? 'warm')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await save({ conversation_style: style })
    if (ok) { onSaved(); close() }
  }
  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStyle(s.value)}
            className={cn(
              'text-left px-3 py-2.5 rounded-xl border transition-all',
              style === s.value ? 'border-primary bg-primary-50 text-primary' : 'border-creme-sable text-slate-600 hover:border-slate-300',
            )}
          >
            <span className="font-semibold block text-[13.5px]">{s.emoji} {s.label}</span>
            <span className="text-[11.5px] opacity-70 leading-tight block mt-0.5">{s.description}</span>
          </button>
        ))}
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt de personnalité
// ────────────────────────────────────────────────────────────────────────────

function PromptCard({ beneficiary, onSaved }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  const prompt = beneficiary.custom_prompt?.trim()
  return (
    <EditableCard
      title="Prompt de personnalité"
      icon={Sparkles}
      renderEdit={(close) => <PromptEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <p className="text-[13px] text-slate-500 mb-3 leading-relaxed">
        Règles propres à {beneficiary.first_name}. Le contexte (profil, mémoire, dernier appel) est ajouté
        automatiquement — inutile de le réécrire ici.
      </p>
      {prompt ? (
        <>
          <div className="relative">
            <pre className={cn(
              'font-mono text-[12.5px] leading-relaxed text-slate-700 bg-slate-50 rounded-xl border border-creme-sable p-4 whitespace-pre-wrap',
              !expanded && 'max-h-24 overflow-hidden',
            )}>{prompt}</pre>
            {!expanded && <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-50 to-transparent rounded-b-xl" />}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[13px] text-primary font-medium mt-2 hover:underline"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? 'Réduire' : 'Voir le prompt complet'}
          </button>
        </>
      ) : (
        <p className="text-[13px] text-slate-400 italic bg-creme/60 rounded-lg px-3 py-2">
          Aucun prompt personnalisé — le prompt par défaut de la plateforme est utilisé.
        </p>
      )}
    </EditableCard>
  )
}

function PromptEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit, setValue } = useForm({
    values: { custom_prompt: beneficiary.custom_prompt ?? '' },
  })
  const [resetting, setResetting] = useState(false)

  const resetFromDefault = async () => {
    setResetting(true)
    const { data } = await supabase.from('prompt_templates').select('template').eq('id', 1).maybeSingle()
    const tpl = (data as { template: string } | null)?.template
    if (tpl) {
      const resolved = resolvePromptPlaceholders(tpl, {
        first_name: beneficiary.first_name,
        ai_persona_name: beneficiary.ai_persona_name,
        conversation_style: beneficiary.conversation_style,
        language_preference: beneficiary.language_preference,
        gender: beneficiary.gender ?? null,
      })
      setValue('custom_prompt', resolved, { shouldDirty: true })
    }
    setResetting(false)
  }

  const submit = handleSubmit(async (v) => {
    const trimmed = v.custom_prompt?.trim()
    const ok = await save({ custom_prompt: trimmed ? trimmed : null })
    if (ok) { onSaved(); close() }
  })

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between mb-1.5">
        <EditLabel>Instructions propres à {beneficiary.first_name}</EditLabel>
        <button
          type="button"
          onClick={resetFromDefault}
          disabled={resetting}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
        >
          <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} /> Réinitialiser depuis le défaut
        </button>
      </div>
      <Textarea rows={12} className="font-mono text-sm leading-relaxed" {...register('custom_prompt')} />
      <p className="text-xs text-slate-400 mt-1.5">Laisser vide pour utiliser le prompt par défaut de la plateforme.</p>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Ouverture des appels entrants
// ────────────────────────────────────────────────────────────────────────────

function InboundOpeningCard({ beneficiary, onSaved }: CardProps) {
  const opening = inb(beneficiary).inbound_custom_prompt?.trim()
  return (
    <EditableCard
      title="Ouverture des appels entrants"
      icon={DoorOpen}
      renderEdit={(close) => <InboundOpeningEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <p className="text-[13px] text-slate-500 mb-3 leading-relaxed">
        Comment {beneficiary.first_name} est accueilli·e quand c'est lui/elle qui appelle AICOUTE. Remplace
        la salutation habituelle pour ces appels — la personnalité reste la même.
      </p>
      {opening ? (
        <pre className="font-mono text-[12.5px] leading-relaxed text-slate-700 bg-slate-50 rounded-xl border border-creme-sable p-4 whitespace-pre-wrap">{opening}</pre>
      ) : (
        <p className="text-[13px] text-slate-400 italic bg-creme/60 rounded-lg px-3 py-2">
          Ouverture par défaut de la plateforme.
        </p>
      )}
    </EditableCard>
  )
}

function InboundOpeningEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit, setValue } = useForm({
    values: { inbound_custom_prompt: inb(beneficiary).inbound_custom_prompt ?? '' },
  })
  const [resetting, setResetting] = useState(false)

  const resetFromDefault = async () => {
    setResetting(true)
    const { data } = await supabase.from('prompt_templates').select('inbound_opening').eq('id', 1).maybeSingle()
    const tpl = (data as { inbound_opening: string | null } | null)?.inbound_opening
    if (tpl) {
      const resolved = resolvePromptPlaceholders(tpl, {
        first_name: beneficiary.first_name,
        ai_persona_name: beneficiary.ai_persona_name,
        conversation_style: beneficiary.conversation_style,
        language_preference: beneficiary.language_preference,
        gender: beneficiary.gender ?? null,
      })
      setValue('inbound_custom_prompt', resolved, { shouldDirty: true })
    }
    setResetting(false)
  }

  const submit = handleSubmit(async (v) => {
    const trimmed = v.inbound_custom_prompt?.trim()
    const ok = await save({ inbound_custom_prompt: trimmed ? trimmed : null } as unknown as Partial<Beneficiary>)
    if (ok) { onSaved(); close() }
  })

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between mb-1.5">
        <EditLabel>Ouverture pour {beneficiary.first_name}</EditLabel>
        <button
          type="button"
          onClick={resetFromDefault}
          disabled={resetting}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
        >
          <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} /> Réinitialiser depuis le défaut
        </button>
      </div>
      <Textarea rows={5} className="font-mono text-sm leading-relaxed" {...register('inbound_custom_prompt')} />
      <p className="text-xs text-slate-400 mt-1.5">Laisser vide pour utiliser l'ouverture par défaut de la plateforme.</p>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Langues
// ────────────────────────────────────────────────────────────────────────────

function LanguagesCard({ beneficiary, onSaved }: CardProps) {
  return (
    <EditableCard
      title="Langues"
      icon={Globe}
      renderEdit={(close) => <LanguagesEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      <dl className="space-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Conversation</p>
          <p className="text-[14px] text-slate-800">{langLabel(beneficiary.language_preference)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Retours à l'aidant</p>
          <p className="text-[14px] text-slate-800">{langLabel(inb(beneficiary).report_language)}</p>
        </div>
      </dl>
    </EditableCard>
  )
}

function LanguagesEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const { register, handleSubmit } = useForm({
    values: {
      language_preference: beneficiary.language_preference ?? 'fr',
      report_language: inb(beneficiary).report_language ?? 'fr',
    },
  })
  const submit = handleSubmit(async (v) => {
    const ok = await save({
      language_preference: v.language_preference,
      report_language: v.report_language,
    } as unknown as Partial<Beneficiary>)
    if (ok) { onSaved(); close() }
  })
  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <EditLabel>Conversation</EditLabel>
        <p className="text-xs text-slate-400 mb-1.5 normal-case tracking-normal">La langue parlée pendant l'appel.</p>
        <select className={selectCls} {...register('language_preference')}>
          {LANGUAGES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <EditLabel>Retours à l'aidant</EditLabel>
        <p className="text-xs text-slate-400 mb-1.5 normal-case tracking-normal">Résumé, alertes et email.</p>
        <select className={selectCls} {...register('report_language')}>
          {LANGUAGES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Appels entrants (toggle + garde-fous de coût)
// ────────────────────────────────────────────────────────────────────────────

const inboundSchema = z.object({
  inbound_enabled: z.boolean(),
  inbound_max_minutes_per_day: z.coerce.number().int().min(1).max(240),
  inbound_cooldown_minutes: z.coerce.number().int().min(0).max(1440),
  inbound_max_duration_minutes: z.coerce.number().int().min(1).max(30),
})
type InboundForm = z.infer<typeof inboundSchema>

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13.5px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}

function InboundCard({ beneficiary, onSaved }: CardProps) {
  const f = inb(beneficiary)
  const enabled = f.inbound_enabled ?? false
  const maxDurationMin = Math.round((f.inbound_max_duration_seconds ?? 600) / 60)
  return (
    <EditableCard
      title="Appels entrants"
      icon={Phone}
      renderEdit={(close) => <InboundEdit beneficiary={beneficiary} onSaved={onSaved} close={close} />}
    >
      {enabled ? (
        <>
          <p className="flex items-center gap-1.5 text-[13.5px] text-slate-700 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-sauge" /> Autorisé — <strong className="text-brun-900">{beneficiary.first_name}</strong> peut appeler AICOUTE.
          </p>
          <dl className="space-y-2.5 border-t border-creme-sable pt-3">
            <MiniRow label="Budget / jour" value={`${f.inbound_max_minutes_per_day ?? 30} min`} />
            <MiniRow label="Délai entre appels" value={`${f.inbound_cooldown_minutes ?? 30} min`} />
            <MiniRow label="Durée max / appel" value={`${maxDurationMin} min`} />
          </dl>
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-[13.5px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Désactivé — seuls les appels sortants d'AICOUTE.
        </p>
      )}
    </EditableCard>
  )
}

function InboundEdit({ beneficiary, onSaved, close }: EditProps) {
  const { save, saving, error } = useSection(beneficiary)
  const f = inb(beneficiary)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<InboundForm>({
    resolver: zodResolver(inboundSchema),
    values: {
      inbound_enabled: f.inbound_enabled ?? false,
      inbound_max_minutes_per_day: f.inbound_max_minutes_per_day ?? 30,
      inbound_cooldown_minutes: f.inbound_cooldown_minutes ?? 30,
      inbound_max_duration_minutes: Math.round((f.inbound_max_duration_seconds ?? 600) / 60),
    },
  })
  const enabled = watch('inbound_enabled')
  const submit = handleSubmit(async (v) => {
    const ok = await save({
      inbound_enabled: v.inbound_enabled,
      inbound_max_minutes_per_day: v.inbound_max_minutes_per_day,
      inbound_cooldown_minutes: v.inbound_cooldown_minutes,
      inbound_max_duration_seconds: v.inbound_max_duration_minutes * 60,
    } as unknown as Partial<Beneficiary>)
    if (ok) { onSaved(); close() }
  })
  const numCls = 'w-20 h-9 rounded-lg border border-creme-sable bg-creme/40 px-2.5 text-[14px] text-right focus:outline-none focus:ring-2 focus:ring-accent-300'
  return (
    <form onSubmit={submit}>
      <label className="flex items-start gap-3 cursor-pointer mb-1">
        <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-primary" {...register('inbound_enabled')} />
        <span className="text-[13.5px] text-slate-600 leading-snug">
          Autoriser <strong className="text-brun-900">{beneficiary.first_name}</strong> à appeler AICOUTE depuis son téléphone.
        </span>
      </label>
      {enabled && (
        <div className="mt-4 space-y-3 border-t border-creme-sable pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] text-slate-500">Budget / jour (min)</span>
            <input type="number" min={1} max={240} className={numCls} {...register('inbound_max_minutes_per_day')} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] text-slate-500">Délai entre appels (min)</span>
            <input type="number" min={0} max={1440} className={numCls} {...register('inbound_cooldown_minutes')} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] text-slate-500">Durée max / appel (min)</span>
            <input type="number" min={1} max={30} className={numCls} {...register('inbound_max_duration_minutes')} />
          </div>
          {(errors.inbound_max_minutes_per_day || errors.inbound_cooldown_minutes || errors.inbound_max_duration_minutes) && (
            <p className="text-xs text-brique">Valeurs hors limites — vérifiez les champs.</p>
          )}
        </div>
      )}
      <EditFooter onCancel={close} saving={saving} error={error} />
    </form>
  )
}
