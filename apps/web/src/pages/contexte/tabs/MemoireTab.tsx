import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Lightbulb, Star, CalendarHeart, SmilePlus, MessageCircle, Link2,
} from 'lucide-react'
import { useMemories } from '@/hooks/useMemories'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn, formatDate } from '@/lib/utils'
import type { Beneficiary, ConversationMemory, MemoryType } from '@modect/shared'

const MEMORY_TYPE_META: Record<MemoryType, { label: string; icon: React.ReactNode; cls: string; barCls: string }> = {
  fact:       { label: 'Fait',       icon: <Lightbulb size={13} />,     cls: 'bg-primary-50 text-primary border-primary/20', barCls: 'bg-primary' },
  preference: { label: 'Préférence', icon: <Star size={13} />,          cls: 'bg-accent-50 text-accent-700 border-accent/30', barCls: 'bg-accent' },
  event:      { label: 'Événement',  icon: <CalendarHeart size={13} />, cls: 'bg-sauge/10 text-sauge border-sauge/25',       barCls: 'bg-sauge' },
  mood:       { label: 'Humeur',     icon: <SmilePlus size={13} />,     cls: 'bg-amber-50 text-amber-700 border-amber-200',  barCls: 'bg-amber-400' },
  topic:      { label: 'Sujet',      icon: <MessageCircle size={13} />, cls: 'bg-slate-100 text-slate-600 border-slate-200', barCls: 'bg-slate-300' },
}
const MEMORY_TYPES = Object.keys(MEMORY_TYPE_META) as MemoryType[]
const IMPORTANCE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const memSelectCls =
  'h-9 rounded-lg border border-creme-sable bg-white px-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

interface MemoryDraft { memory_type: MemoryType; content: string; importance: number }

export function MemoireTab({ beneficiary }: { beneficiary: Beneficiary }) {
  const { memories, loading, error, addMemory, updateMemory, deleteMemory, refetch } = useMemories(beneficiary.id)

  const [adding, setAdding]     = useState(false)
  const [addDraft, setAddDraft] = useState<MemoryDraft>({ memory_type: 'fact', content: '', importance: 5 })
  const [addBusy, setAddBusy]   = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MemoryDraft>({ memory_type: 'fact', content: '', importance: 5 })
  const [editBusy, setEditBusy]   = useState(false)

  function startEdit(m: ConversationMemory) {
    setEditingId(m.id)
    setEditDraft({ memory_type: m.memory_type, content: m.content, importance: m.importance })
  }

  async function saveEdit() {
    if (!editingId || !editDraft.content.trim()) return
    setEditBusy(true)
    const ok = await updateMemory(editingId, editDraft)
    setEditBusy(false)
    if (ok) { setEditingId(null); refetch() }
  }

  async function handleAdd() {
    if (!addDraft.content.trim()) return
    setAddBusy(true)
    const ok = await addMemory(addDraft)
    setAddBusy(false)
    if (ok) { setAddDraft({ memory_type: 'fact', content: '', importance: 5 }); setAdding(false) }
  }

  async function handleDelete(m: ConversationMemory) {
    if (!window.confirm('Supprimer ce souvenir ? Cette action est irréversible.')) return
    await deleteMemory(m.id)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="font-title text-lg font-semibold text-slate-800">Mémoire du compagnon</h2>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Ajouter un souvenir
          </Button>
        )}
      </div>
      <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
        Ce dont AICOUTE se souvient d'un appel à l'autre pour personnaliser ses conversations avec {beneficiary.first_name}.
        Extraits automatiquement après chaque appel — corrigez, supprimez ou ajoutez à la main.
      </p>

      {error && <p className="text-sm text-brique bg-brique/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {adding && (
        <div className="bg-primary-50/50 rounded-xl border border-primary/15 p-4 mb-5">
          <Textarea
            rows={2}
            autoFocus
            placeholder="Ex : a un nouveau chat nommé Félix dont elle parle souvent"
            value={addDraft.content}
            onChange={(e) => setAddDraft({ ...addDraft, content: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select className={memSelectCls} value={addDraft.memory_type} onChange={(e) => setAddDraft({ ...addDraft, memory_type: e.target.value as MemoryType })}>
              {MEMORY_TYPES.map((t) => <option key={t} value={t}>{MEMORY_TYPE_META[t].label}</option>)}
            </select>
            <select className={memSelectCls} value={addDraft.importance} onChange={(e) => setAddDraft({ ...addDraft, importance: Number(e.target.value) })}>
              {IMPORTANCE_OPTIONS.map((n) => <option key={n} value={n}>Importance {n}/10</option>)}
            </select>
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setAddDraft({ memory_type: 'fact', content: '', importance: 5 }) }}>Annuler</Button>
            <Button type="button" size="sm" loading={addBusy} disabled={!addDraft.content.trim()} onClick={handleAdd}>Ajouter</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-creme/60 rounded-2xl border border-creme-sable p-6 text-center">
          <p className="text-sm text-slate-500">
            Aucun souvenir pour le moment. Ils apparaîtront après les premiers appels et aident le compagnon
            à se rappeler ce qui compte pour {beneficiary.first_name}.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {memories.map((m) => {
            const meta = MEMORY_TYPE_META[m.memory_type] ?? MEMORY_TYPE_META.fact
            const isEditing = editingId === m.id
            return (
              <div key={m.id} className="flex gap-3 p-3.5 bg-surface rounded-xl border border-creme-sable group">
                <div className={cn('w-1 rounded-full shrink-0', meta.barCls)} />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <>
                      <Textarea rows={2} autoFocus value={editDraft.content} onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })} />
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <select className={memSelectCls} value={editDraft.memory_type} onChange={(e) => setEditDraft({ ...editDraft, memory_type: e.target.value as MemoryType })}>
                          {MEMORY_TYPES.map((t) => <option key={t} value={t}>{MEMORY_TYPE_META[t].label}</option>)}
                        </select>
                        <select className={memSelectCls} value={editDraft.importance} onChange={(e) => setEditDraft({ ...editDraft, importance: Number(e.target.value) })}>
                          {IMPORTANCE_OPTIONS.map((n) => <option key={n} value={n}>Importance {n}/10</option>)}
                        </select>
                        <div className="flex-1" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Annuler</Button>
                        <Button type="button" size="sm" loading={editBusy} disabled={!editDraft.content.trim()} onClick={saveEdit}>Enregistrer</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', meta.cls)}>
                          {meta.icon}{meta.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Star size={12} className={m.importance >= 7 ? 'text-accent fill-accent' : 'text-slate-300'} />
                          {m.importance}/10
                        </span>
                        <div className="flex-1" />
                        <button type="button" onClick={() => startEdit(m)} className="p-1 text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100" title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => handleDelete(m)} className="p-1 text-slate-400 hover:text-brique transition-colors opacity-0 group-hover:opacity-100" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{m.content}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                        {m.source_call_id ? (
                          <Link to={`/historique/${m.source_call_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Link2 size={12} /> Issu d'un appel
                          </Link>
                        ) : (
                          <span>Ajouté manuellement</span>
                        )}
                        <span>·</span>
                        <span>{formatDate(m.created_at)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
