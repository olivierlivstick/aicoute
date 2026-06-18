import { useMemo, useState } from 'react'
import { Plus, Trash2, Check, Info, X, Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, PhoneOutgoing, PhoneIncoming } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePrompts } from '@/hooks/usePrompts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type { Prompt } from '@modect/shared'

/**
 * Onglet « Prompts » de /admin/sante : CRUD de la bibliothèque de prompts.
 * Un prompt = une PAIRE (appel émis + appel entrant) dans une langue. Présenté en
 * LISTE (table) comme /admin/comptes & /admin/beneficiaires. Écriture via l'Edge Fn
 * admin-prompts (service-role, défaut atomique par langue).
 */

const LANGS: { value: string; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]
const langLabel = (code: string) => LANGS.find((l) => l.value === code)?.label ?? code
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const collator = new Intl.Collator('fr', { sensitivity: 'base' })

const PLACEHOLDERS: Array<{ token: string; desc: string }> = [
  { token: '{{persona}}', desc: 'prénom du compagnon IA' },
  { token: '{{prenom}}', desc: 'prénom du bénéficiaire' },
  { token: '{{langue}}', desc: 'la langue (ex : français)' },
  { token: '{{style}}', desc: 'le ton choisi' },
  { token: '{{il_elle}}', desc: 'pronom selon le genre' },
]

type SortKey = 'title' | 'language' | 'created'
type SortDir = 'asc' | 'desc'

type Draft = {
  id?: string
  title: string
  language: string
  outbound_body: string
  inbound_body: string
  is_default: boolean
}
const emptyDraft = (): Draft => ({ title: '', language: 'fr', outbound_body: '', inbound_body: '', is_default: false })

export function PromptsLibrarySection() {
  const { prompts, loading, refetch } = usePrompts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

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
    const ok = draft.id ? await call('update', { id: draft.id, ...payload }) : await call('create', payload)
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

  const openEdit = (p: Prompt) => setDraft({
    id: p.id,
    title: p.title ?? '',
    language: p.language ?? 'fr',
    outbound_body: p.outbound_body ?? '',
    inbound_body: p.inbound_body ?? '',
    is_default: !!p.is_default,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? prompts
      : prompts.filter((p) => p.title.toLowerCase().includes(q) || langLabel(p.language).toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      let c = 0
      if (sortKey === 'title')    c = collator.compare(a.title, b.title)
      if (sortKey === 'language') c = collator.compare(a.language, b.language)
      if (sortKey === 'created')  c = Date.parse(a.created_at) - Date.parse(b.created_at)
      if (c === 0) c = collator.compare(a.title, b.title)
      return c * dir
    })
  }, [prompts, query, sortKey, sortDir])

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 bg-accent-50 text-accent-800 rounded-xl px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <p>Chaque prompt est une <strong>paire</strong> : le texte des <strong>appels émis</strong> (AICOUTE appelle) et celui des <strong>appels entrants</strong> (le bénéficiaire appelle), dans une langue. La paire <strong>par défaut</strong> de chaque langue est présélectionnée et sert de filet de secours.</p>
          <p className="mt-1">Le <strong>contexte</strong> (profil, mémoire, dernier appel, durée) est ajouté automatiquement — inutile de l'écrire ici.</p>
        </div>
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

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par titre ou langue…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-creme-sable bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
          />
        </div>
        {!draft && (
          <Button onClick={() => setDraft(emptyDraft())}>
            <Plus size={14} className="mr-1" /> Nouveau prompt
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-creme-sable overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-creme text-brun-700 text-left text-xs uppercase tracking-wider">
              <tr>
                <SortHeader label="Titre"    col="title"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Langue"   col="language" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Créé le"  col="created"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3">Défaut</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-sable">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-creme/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-brun-900">{p.title}</td>
                  <td className="px-5 py-3 text-slate-600">{langLabel(p.language)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-3">
                    {p.is_default ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sauge bg-sauge/10 rounded-full px-2.5 py-0.5">
                        <Check size={11} /> Par défaut
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDefault(p)}
                        disabled={busyId === p.id}
                        className="text-xs text-slate-500 hover:text-sauge transition-colors disabled:opacity-50"
                      >
                        Définir par défaut
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                      >
                        Modifier <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        disabled={busyId === p.id}
                        title="Supprimer"
                        className="text-slate-400 hover:text-brique transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                    {query ? 'Aucun prompt ne correspond à ce filtre.' : 'Aucun prompt pour le moment.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, col, sortKey, sortDir, onSort }: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = sortKey === col
  return (
    <th className="px-5 py-3">
      <button
        onClick={() => onSort(col)}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-brun-900', active && 'text-brun-900')}
      >
        {label}
        {active ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-slate-300" />}
      </button>
    </th>
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
          rows={16}
          value={draft.outbound_body}
          onChange={(e) => setDraft({ ...draft, outbound_body: e.target.value })}
          className="font-mono text-sm leading-relaxed"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-1.5">
          <PhoneIncoming size={14} className="text-primary" /> Appel entrant — le bénéficiaire appelle AICOUTE (ouverture)
        </label>
        <Textarea
          rows={6}
          value={draft.inbound_body}
          onChange={(e) => setDraft({ ...draft, inbound_body: e.target.value })}
          className="font-mono text-sm leading-relaxed"
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
