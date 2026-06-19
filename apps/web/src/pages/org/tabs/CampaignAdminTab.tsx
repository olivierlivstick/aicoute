import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, FileDown } from 'lucide-react'
import type { useCampaign } from '@/hooks/useCampaign'
import { usePrompts } from '@/hooks/usePrompts'

type CampaignCtx = ReturnType<typeof useCampaign>

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'es', label: 'Espagnol' },
  { value: 'de', label: 'Allemand' },
  { value: 'it', label: 'Italien' },
]

const TIMEZONES = ['Europe/Paris', 'Europe/Brussels', 'Europe/Luxembourg', 'Europe/Zurich', 'Indian/Reunion', 'America/Guadeloupe']

const inputCls =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function CampaignAdminTab({ c }: { c: CampaignCtx }) {
  const navigate = useNavigate()
  const camp = c.campaign!
  const [title, setTitle] = useState(camp.title)
  const [comment, setComment] = useState(camp.comment ?? '')
  const [startsOn, setStartsOn] = useState(camp.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(camp.ends_on ?? '')
  const [personaName, setPersonaName] = useState(camp.ai_persona_name ?? 'Marie')
  const [language, setLanguage] = useState(camp.language)
  const [promptId, setPromptId] = useState<string | null>(camp.prompt_id)
  const [promptBody, setPromptBody] = useState(camp.custom_prompt ?? '')
  const [dailyStart, setDailyStart] = useState((camp.daily_start_time ?? '09:00').slice(0, 5))
  const [dailyEnd, setDailyEnd] = useState((camp.daily_end_time ?? '18:00').slice(0, 5))
  const [timezone, setTimezone] = useState(camp.timezone)
  const [maxConcurrent, setMaxConcurrent] = useState(camp.max_concurrent_calls)
  const [maxMinutes, setMaxMinutes] = useState(camp.max_call_minutes)
  const [retryCount, setRetryCount] = useState(camp.retry_count)
  const [retryInterval, setRetryInterval] = useState(camp.retry_interval_minutes)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { prompts } = usePrompts({ language })
  const selectedPrompt = prompts.find((p) => p.id === promptId) ?? null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true); setSaved(false); setErr(null)
    const ok = await c.update({
      title: title.trim(),
      comment: comment.trim() || null,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      ai_persona_name: personaName.trim() || 'Marie',
      language,
      prompt_id: promptId,
      custom_prompt: promptBody.trim() || null,
      daily_start_time: dailyStart,
      daily_end_time: dailyEnd,
      timezone,
      max_concurrent_calls: Math.max(1, Number(maxConcurrent) || 1),
      max_call_minutes: Math.max(1, Number(maxMinutes) || 1),
      retry_count: Math.max(0, Number(retryCount) || 0),
      retry_interval_minutes: Math.max(1, Number(retryInterval) || 1),
    })
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else setErr("Échec de l'enregistrement.")
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement la campagne « ${camp.title} » ?\nLes appels déjà passés sont conservés (détachés de la campagne).`)) return
    const ok = await c.remove()
    if (ok) navigate('/org/campagnes')
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6">
      <Field label="Titre de la campagne">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Commentaire">
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de début"><input type="date" className={inputCls} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></Field>
        <Field label="Date de fin"><input type="date" className={inputCls} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Prénom de l'appelant (IA)" hint="Le prénom que l'IA donne en se présentant aux bénéficiaires.">
          <input className={inputCls} value={personaName} onChange={(e) => setPersonaName(e.target.value)} placeholder="Ex. Marie" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Langue de conversation">
          <select className={inputCls} value={language} onChange={(e) => { setLanguage(e.target.value); setPromptId(null) }}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Modèle de prompt (bibliothèque)" hint="Base appliquée si l'éditeur ci-dessous est vide.">
          <select className={inputCls} value={promptId ?? ''} onChange={(e) => setPromptId(e.target.value || null)}>
            <option value="">— Défaut de la langue —</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>{p.title}{p.is_default ? ' — défaut' : ''}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Éditeur de prompt propre à la campagne */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Prompt de la campagne</label>
          <button
            type="button"
            onClick={() => selectedPrompt && setPromptBody(selectedPrompt.outbound_body)}
            disabled={!selectedPrompt}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:text-slate-300 disabled:no-underline"
            title={selectedPrompt ? 'Remplace l’éditeur par le texte du modèle sélectionné' : 'Choisissez un modèle'}
          >
            <FileDown size={13} /> Charger le modèle dans l'éditeur
          </button>
        </div>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
          rows={12}
          value={promptBody}
          onChange={(e) => setPromptBody(e.target.value)}
          placeholder="Laissez vide pour utiliser le modèle ci-dessus tel quel, ou écrivez/éditez votre version ici…"
        />
        <p className="mt-1 text-xs text-slate-400">
          Personnalité + règles appliquées à tous les appels. Variables disponibles :{' '}
          <code className="rounded bg-slate-100 px-1">{'{{persona}}'}</code>{' '}
          <code className="rounded bg-slate-100 px-1">{'{{prenom}}'}</code>{' '}
          <code className="rounded bg-slate-100 px-1">{'{{langue}}'}</code>{' '}
          <code className="rounded bg-slate-100 px-1">{'{{style}}'}</code>{' '}
          <code className="rounded bg-slate-100 px-1">{'{{il_elle}}'}</code> (remplacées à chaque appel).
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Appels à partir de" hint="Heure locale"><input type="time" className={inputCls} value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} /></Field>
        <Field label="Appels jusqu'à"><input type="time" className={inputCls} value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} /></Field>
        <Field label="Fuseau horaire">
          <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Appels simultanés autorisés" hint="Nombre maximal d'appels en même temps pour cette campagne.">
          <input type="number" min={1} className={inputCls} value={maxConcurrent} onChange={(e) => setMaxConcurrent(Number(e.target.value))} />
        </Field>
        <Field label="Durée maximale d'un appel (min)" hint="Coupure automatique au-delà.">
          <input type="number" min={1} className={inputCls} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} />
        </Field>
      </div>

      <div className="rounded-xl bg-slate-50 px-4 py-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Relances si pas de réponse</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre de relances" hint="0 = un seul essai, pas de rappel.">
            <input type="number" min={0} className={inputCls} value={retryCount} onChange={(e) => setRetryCount(Number(e.target.value))} />
          </Field>
          <Field label="Délai entre relances (min)">
            <input type="number" min={1} className={inputCls} value={retryInterval} onChange={(e) => setRetryInterval(Number(e.target.value))} />
          </Field>
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!title.trim() || saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-sm text-sauge">✓ Enregistré</span>}
      </div>

      {/* Zone danger */}
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50/50 px-4 py-4">
        <p className="text-sm font-semibold text-red-700">Zone danger</p>
        <p className="mt-1 text-xs text-red-600/80">La suppression est définitive. Les appels déjà passés sont conservés mais détachés de la campagne.</p>
        <button type="button" onClick={handleDelete} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
          <Trash2 size={15} /> Effacer cette campagne
        </button>
      </div>
    </form>
  )
}
