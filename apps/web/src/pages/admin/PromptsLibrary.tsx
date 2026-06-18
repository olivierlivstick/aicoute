import { useEffect, useRef, useState } from 'react'
import { Plus, Star, Trash2, Check, Info, X, PhoneOutgoing, PhoneIncoming } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePrompts } from '@/hooks/usePrompts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type { Prompt } from '@modect/shared'

/**
 * Onglet « Prompts » de /admin/sante : CRUD de la bibliothèque de prompts.
 * Un prompt = une PAIRE (appel émis + appel entrant) dans une langue. La liste
 * montre titre / langue / date + 2 boutons pour éditer chaque texte de la paire.
 * Écriture via l'Edge Fn admin-prompts (service-role, défaut atomique par langue).
 */

const LANGS: { value: string; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]
const langLabel = (code: string) => LANGS.find((l) => l.value === code)?.label ?? code
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const PLACEHOLDERS: Array<{ token: string; desc: string }> = [
  { token: '{{persona}}', desc: 'prénom du compagnon IA' },
  { token: '{{prenom}}', desc: 'prénom du bénéficiaire' },
  { token: '{{langue}}', desc: 'la langue (ex : français)' },
  { token: '{{style}}', desc: 'le ton choisi' },
  { token: '{{il_elle}}', desc: 'pronom selon le genre' },
]

type FocusField = 'outbound' | 'inbound'
type Draft = {
  id?: string
  title: string
  language: string
  outbound_body: string
  inbound_body: string
  is_default: boolean
  focus: FocusField
}

const emptyDraft = (focus: FocusField = 'outbound'): Draft => ({
  title: '', language: 'fr', outbound_body: '', inbound_body: '', is_default: false, focus,
})

export function PromptsLibrarySection() {
  const { prompts, loading, refetch } = usePrompts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(action: string, payload: Record<string, unknown>) {
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('admin-prompts', {
      body: { action, ...payload },
    })
    if (err || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? err?.message ?? 'Erreur')
      return false
    }
    return true
  }

  async function saveDraft() {
    if (!draft) return
    setBusyId('draft')
    const payload = {
      title: draft.title,
      language: draft.language,
      outbound_body: draft.outbound_body,
      inbound_body: draft.inbound_body,
      is_default: draft.is_default,
    }
    const ok = draft.id
      ? await call('update', { id: draft.id, ...payload })
      : await call('create', payload)
    setBusyId(null)
    if (ok) { setDraft(null); await refetch() }
  }

  async function setDefault(p: Prompt) {
    setBusyId(p.id)
    const ok = await call('set-default', { id: p.id })
    setBusyId(null)
    if (ok) await refetch()
  }

  async function remove(p: Prompt) {
    if (!window.confirm(`Supprimer le prompt « ${p.title} » (appel émis + appel entrant) ?`)) return
    setBusyId(p.id)
    const ok = await call('delete', { id: p.id })
    setBusyId(null)
    if (ok) await refetch()
  }

  // Valeurs par défaut défensives : une ligne mal formée (ex. schéma DB non encore
  // migré) ne doit jamais faire planter l'éditeur (les champs alimentent des .trim()).
  const openEdit = (p: Prompt, focus: FocusField) => setDraft({
    id: p.id,
    title: p.title ?? '',
    language: p.language ?? 'fr',
    outbound_body: p.outbound_body ?? '',
    inbound_body: p.inbound_body ?? '',
    is_default: !!p.is_default,
    focus,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 bg-accent-50 text-accent-800 rounded-xl px-4 py-3 text-sm flex-1">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>Chaque prompt est une <strong>paire</strong> : le texte des <strong>appels émis</strong> (AICOUTE appelle) et celui des <strong>appels entrants</strong> (le bénéficiaire appelle), dans une langue. La paire <strong>par défaut</strong> de chaque langue est présélectionnée et sert de filet de secours.</p>
            <p className="mt-1">Le <strong>contexte</strong> (profil, mémoire, dernier appel, durée) est ajouté automatiquement — inutile de l'écrire ici.</p>
          </div>
        </div>
        {!draft && (
          <Button onClick={() => setDraft(emptyDraft())}>
            <Plus size={14} className="mr-1" /> Nouveau prompt
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2">{error}</p>}

      {draft && (
        <DraftEditor
          draft={draft}
          setDraft={setDraft}
          onSave={saveDraft}
          onCancel={() => { setDraft(null); setError(null) }}
          saving={busyId === 'draft'}
        />
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : prompts.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Aucun prompt pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={p.id} className="flex items-center gap-4 bg-white rounded-xl border border-creme-sable px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 text-[14.5px]">{p.title}</span>
                  {p.is_default && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sauge bg-sauge/10 rounded-full px-2 py-0.5">
                      <Star size={11} /> défaut
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {langLabel(p.language)} · créé le {formatDate(p.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(p, 'outbound')}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-primary border border-creme-sable rounded-lg px-2.5 py-1.5 hover:bg-creme transition-colors"
                >
                  <PhoneOutgoing size={13} /> Appel émis
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(p, 'inbound')}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-primary border border-creme-sable rounded-lg px-2.5 py-1.5 hover:bg-creme transition-colors"
                >
                  <PhoneIncoming size={13} /> Appel entrant
                </button>
                {!p.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefault(p)}
                    disabled={busyId === p.id}
                    title="Définir comme paire par défaut pour cette langue"
                    className="inline-flex items-center text-slate-400 hover:text-sauge transition-colors disabled:opacity-50 p-1.5"
                  >
                    <Star size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busyId === p.id}
                  className="inline-flex items-center text-slate-400 hover:text-brique transition-colors disabled:opacity-50 p-1.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DraftEditor({
  draft, setDraft, onSave, onCancel, saving,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const selectCls = 'h-10 w-full rounded-xl border border-creme-sable bg-white px-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-300'
  const outRef = useRef<HTMLTextAreaElement | null>(null)
  const inRef = useRef<HTMLTextAreaElement | null>(null)

  // Focalise le texte ciblé par le bouton ayant ouvert l'éditeur.
  useEffect(() => {
    const el = draft.focus === 'inbound' ? inRef.current : outRef.current
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-brun-900">
          {draft.id ? 'Modifier le prompt' : 'Nouveau prompt'}
        </h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Titre</label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Compagnon chaleureux" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Langue</label>
          <select className={selectCls} value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
            {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PLACEHOLDERS.map(({ token, desc }) => (
          <span key={token} className="inline-flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
            <code className="text-primary font-semibold">{token}</code>
            <span className="text-slate-500">{desc}</span>
          </span>
        ))}
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-1.5">
          <PhoneOutgoing size={14} className="text-primary" /> Appel émis — AICOUTE appelle le bénéficiaire (personnalité + règles)
        </label>
        <Textarea
          ref={outRef}
          rows={16}
          value={draft.outbound_body}
          onChange={(e) => setDraft({ ...draft, outbound_body: e.target.value })}
          className={cn('font-mono text-sm leading-relaxed', draft.focus === 'outbound' && 'ring-2 ring-accent-300')}
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-1.5">
          <PhoneIncoming size={14} className="text-primary" /> Appel entrant — le bénéficiaire appelle AICOUTE (ouverture)
        </label>
        <Textarea
          ref={inRef}
          rows={6}
          value={draft.inbound_body}
          onChange={(e) => setDraft({ ...draft, inbound_body: e.target.value })}
          className={cn('font-mono text-sm leading-relaxed', draft.focus === 'inbound' && 'ring-2 ring-accent-300')}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
        Paire par défaut pour {langLabel(draft.language)}
      </label>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-creme-sable">
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSave} loading={saving} disabled={!draft.title?.trim() || !draft.outbound_body?.trim() || !draft.inbound_body?.trim()}>
          <Check size={14} className="mr-1" /> Enregistrer
        </Button>
      </div>
    </div>
  )
}
