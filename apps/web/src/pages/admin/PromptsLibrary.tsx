import { useState } from 'react'
import { Plus, Star, Pencil, Trash2, Check, Info, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePrompts } from '@/hooks/usePrompts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type { Prompt, PromptKind } from '@modect/shared'

/**
 * Onglet « Prompts » de /admin/sante : CRUD de la bibliothèque de prompts.
 * Écriture via l'Edge Fn admin-prompts (service-role, gestion atomique du défaut).
 * Lecture directe (RLS lecture authentifiée).
 */

const LANGS: { value: string; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]
const langLabel = (code: string) => LANGS.find((l) => l.value === code)?.label ?? code

const KINDS: { value: PromptKind; label: string; hint: string }[] = [
  { value: 'outbound', label: 'Appel sortant', hint: 'AICOUTE appelle le bénéficiaire (personnalité + règles)' },
  { value: 'inbound', label: 'Appel entrant', hint: 'Le bénéficiaire appelle AICOUTE (ouverture)' },
]
const kindLabel = (k: PromptKind) => KINDS.find((x) => x.value === k)?.label ?? k

const PLACEHOLDERS: Array<{ token: string; desc: string }> = [
  { token: '{{persona}}', desc: 'prénom du compagnon IA' },
  { token: '{{prenom}}', desc: 'prénom du bénéficiaire' },
  { token: '{{langue}}', desc: 'la langue (ex : français)' },
  { token: '{{style}}', desc: 'le ton choisi' },
  { token: '{{il_elle}}', desc: 'pronom selon le genre' },
]

type Draft = {
  id?: string
  title: string
  language: string
  kind: PromptKind
  body: string
  is_default: boolean
}

const EMPTY_DRAFT: Draft = { title: '', language: 'fr', kind: 'outbound', body: '', is_default: false }

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
    const ok = draft.id
      ? await call('update', {
          id: draft.id,
          title: draft.title,
          language: draft.language,
          kind: draft.kind,
          body: draft.body,
          is_default: draft.is_default,
        })
      : await call('create', {
          title: draft.title,
          language: draft.language,
          kind: draft.kind,
          body: draft.body,
          is_default: draft.is_default,
        })
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
    if (!window.confirm(`Supprimer le prompt « ${p.title} » ?`)) return
    setBusyId(p.id)
    const ok = await call('delete', { id: p.id })
    setBusyId(null)
    if (ok) await refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 bg-accent-50 text-accent-800 rounded-xl px-4 py-3 text-sm flex-1">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>Bibliothèque de prompts proposés à l'aidant (onboarding + fiche bénéficiaire) selon la <strong>langue</strong> et le <strong>type d'appel</strong>. Le prompt <strong>par défaut</strong> de chaque couple (langue, type) est présélectionné et sert de filet de secours.</p>
            <p className="mt-1">Le <strong>contexte</strong> (profil, mémoire, dernier appel, durée) est ajouté automatiquement — inutile de l'écrire ici.</p>
          </div>
        </div>
        {!draft && (
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
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
      ) : (
        KINDS.map(({ value: kind, label, hint }) => {
          const rows = prompts.filter((p) => p.kind === kind)
          return (
            <section key={kind}>
              <h3 className="font-serif text-lg font-semibold text-brun-900">{label}</h3>
              <p className="text-xs text-slate-500 mb-3">{hint}</p>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun prompt.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 bg-white rounded-xl border border-creme-sable px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 text-[14.5px]">{p.title}</span>
                          <span className="text-xs text-slate-500">{langLabel(p.language)}</span>
                          {p.is_default && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sauge bg-sauge/10 rounded-full px-2 py-0.5">
                              <Star size={11} /> défaut
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{p.body.slice(0, 110)}…</p>
                      </div>
                      {!p.is_default && (
                        <button
                          type="button"
                          onClick={() => setDefault(p)}
                          disabled={busyId === p.id}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sauge transition-colors disabled:opacity-50 shrink-0"
                          title="Définir comme défaut pour cette langue + ce type"
                        >
                          <Star size={13} /> Par défaut
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDraft({ id: p.id, title: p.title, language: p.language, kind: p.kind, body: p.body, is_default: p.is_default })}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors shrink-0"
                      >
                        <Pencil size={13} /> Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        disabled={busyId === p.id}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brique transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })
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
  const selectCls = 'h-10 rounded-xl border border-creme-sable bg-white px-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-300'
  return (
    <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-brun-900">
          {draft.id ? 'Modifier le prompt' : 'Nouveau prompt'}
        </h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Titre</label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Compagnon chaleureux" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Langue</label>
            <select className={cn(selectCls, 'w-full')} value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">Type</label>
            <select className={cn(selectCls, 'w-full')} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PromptKind })}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{kindLabel(k.value)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLACEHOLDERS.map(({ token, desc }) => (
            <span key={token} className="inline-flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              <code className="text-primary font-semibold">{token}</code>
              <span className="text-slate-500">{desc}</span>
            </span>
          ))}
        </div>
        <Textarea
          rows={draft.kind === 'inbound' ? 6 : 18}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          className="font-mono text-sm leading-relaxed"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
        Prompt par défaut pour {langLabel(draft.language)} · {kindLabel(draft.kind)}
      </label>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-creme-sable">
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSave} loading={saving} disabled={!draft.title.trim() || !draft.body.trim()}>
          <Check size={14} className="mr-1" /> Enregistrer
        </Button>
      </div>
    </div>
  )
}
