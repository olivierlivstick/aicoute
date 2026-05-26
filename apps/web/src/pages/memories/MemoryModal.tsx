import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import type { ConversationMemory, MemoryType } from '@modect/shared'

const MEMORY_TYPES: Record<MemoryType, { label: string; emoji: string; bg: string; color: string }> = {
  fact:       { label: 'Fait',        emoji: '📌', bg: 'bg-blue-50 border-blue-200',   color: 'text-blue-700' },
  preference: { label: 'Préférence',  emoji: '❤️',  bg: 'bg-rose-50 border-rose-200',   color: 'text-rose-700' },
  event:      { label: 'Événement',   emoji: '📅', bg: 'bg-purple-50 border-purple-200', color: 'text-purple-700' },
  mood:       { label: 'Humeur',      emoji: '😊', bg: 'bg-amber-50 border-amber-200',  color: 'text-amber-700' },
  topic:      { label: 'Sujet',       emoji: '💬', bg: 'bg-green-50 border-green-200',  color: 'text-green-700' },
}

const IMPORTANCE_LABELS = ['', 'Très faible', 'Faible', 'Faible+', 'Modéré', 'Modéré+', 'Important', 'Important+', 'Très important', 'Critique', 'Essentiel']

interface Props {
  memory:  ConversationMemory | null
  onSave:  (data: { memory_type: MemoryType; content: string; importance: number }) => Promise<void>
  onClose: () => void
}

export function MemoryModal({ memory, onSave, onClose }: Props) {
  const [type,       setType]       = useState<MemoryType>(memory?.memory_type ?? 'fact')
  const [content,    setContent]    = useState(memory?.content ?? '')
  const [importance, setImportance] = useState(memory?.importance ?? 5)
  const [saving,     setSaving]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    await onSave({ memory_type: type, content: content.trim(), importance })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-title text-lg font-semibold text-slate-800">
            {memory ? 'Modifier le souvenir' : 'Nouveau souvenir'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Type selector */}
          <div>
            <Label>Type de souvenir</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {(Object.entries(MEMORY_TYPES) as [MemoryType, typeof MEMORY_TYPES[MemoryType]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all',
                    type === key ? cn(cfg.bg, 'ring-2 ring-primary/20') : 'border-slate-100 hover:border-slate-200'
                  )}
                >
                  <span className="text-lg">{cfg.emoji}</span>
                  <span className={cn('text-xs font-medium', type === key ? cfg.color : 'text-slate-500')}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Contenu */}
          <div>
            <Label htmlFor="content">Contenu</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ex : Aime les films de Charlie Chaplin, particulièrement Les Temps modernes…"
              rows={3}
              className="mt-1"
              required
            />
          </div>

          {/* Importance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Importance</Label>
              <span className="text-sm text-slate-500">
                {importance}/10 — <span className="font-medium text-slate-600">{IMPORTANCE_LABELS[importance]}</span>
              </span>
            </div>
            <input
              type="range" min={1} max={10}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-full h-2 accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-300 mt-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" loading={saving} disabled={!content.trim()} className="flex-1">
              {memory ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
