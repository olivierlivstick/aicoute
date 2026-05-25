import { useState } from 'react'
import { Plus, Trash2, Pencil, Brain, Sparkles } from 'lucide-react'
import { useBeneficiaries } from '@/hooks/useBeneficiary'
import { useMemories } from '@/hooks/useMemories'
import { Button } from '@/components/ui/Button'
import { MemoryModal } from './MemoryModal'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ConversationMemory, MemoryType } from '@modect/shared'

// Configuration des types de mémoires
const MEMORY_TYPES: Record<MemoryType, { label: string; emoji: string; color: string; bg: string }> = {
  fact:       { label: 'Faits',        emoji: '📌', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100' },
  preference: { label: 'Préférences',  emoji: '❤️',  color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-100' },
  event:      { label: 'Événements',   emoji: '📅', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
  mood:       { label: 'Humeurs',      emoji: '😊', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
  topic:      { label: 'Sujets',       emoji: '💬', color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
}

const IMPORTANCE_COLORS = [
  '',
  'bg-slate-200', 'bg-slate-300', 'bg-blue-200', 'bg-blue-300',
  'bg-primary-200', 'bg-primary-300', 'bg-accent-200',
  'bg-accent-300', 'bg-orange-400', 'bg-orange-500',
]

export function MemoriesPage() {
  const { beneficiaries } = useBeneficiaries()
  const [selectedBenId, setSelectedBenId] = useState<string | undefined>(beneficiaries[0]?.id)
  const [filterType, setFilterType]       = useState<MemoryType | 'all'>('all')
  const [modalOpen,  setModalOpen]        = useState(false)
  const [editing,    setEditing]          = useState<ConversationMemory | null>(null)

  const selectedBen = beneficiaries.find((b) => b.id === selectedBenId)
    ?? beneficiaries[0]

  // Mettre à jour selectedBenId si pas encore défini
  if (!selectedBenId && beneficiaries.length > 0 && beneficiaries[0]?.id) {
    setSelectedBenId(beneficiaries[0].id)
  }

  const { memories, loading, addMemory, updateMemory, deleteMemory } = useMemories(
    selectedBen?.id
  )

  const filtered = filterType === 'all'
    ? memories
    : memories.filter((m) => m.memory_type === filterType)

  // Grouper par type pour la vue
  const grouped = Object.keys(MEMORY_TYPES).reduce((acc, type) => {
    acc[type as MemoryType] = memories.filter((m) => m.memory_type === type)
    return acc
  }, {} as Record<MemoryType, ConversationMemory[]>)

  const handleEdit = (memory: ConversationMemory) => {
    setEditing(memory)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async (
    data: { memory_type: MemoryType; content: string; importance: number }
  ) => {
    if (editing) {
      await updateMemory(editing.id, data)
    } else {
      await addMemory(data)
    }
    handleCloseModal()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce souvenir ?')) return
    await deleteMemory(id)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-title text-3xl font-bold text-slate-800">Mémoires</h1>
          <p className="text-slate-500 mt-1">
            Souvenirs et informations utilisés par l'IA pour personnaliser les appels
          </p>
        </div>
        {selectedBen && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Ajouter un souvenir
          </Button>
        )}
      </div>

      {beneficiaries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Sélecteur bénéficiaire */}
          {beneficiaries.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {beneficiaries.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBenId(b.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all',
                    b.id === selectedBen?.id
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  <span className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary text-xs font-bold">
                    {b.first_name[0]}
                  </span>
                  {b.first_name}
                </button>
              ))}
            </div>
          )}

          {/* Stats rapides */}
          {memories.length > 0 && (
            <div className="grid grid-cols-5 gap-3 mb-6">
              {(Object.entries(MEMORY_TYPES) as [MemoryType, typeof MEMORY_TYPES[MemoryType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? 'all' : type)}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-all',
                    filterType === type ? config.bg + ' ring-2 ring-primary/20' : 'bg-white border-slate-100 hover:border-slate-200'
                  )}
                >
                  <div className="text-xl mb-1">{config.emoji}</div>
                  <div className="text-xs font-semibold text-slate-600">{config.label}</div>
                  <div className={cn('text-lg font-bold mt-0.5', config.color)}>
                    {grouped[type].length}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Liste */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Brain size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 mb-4">
                {memories.length === 0
                  ? `Aucun souvenir enregistré pour ${selectedBen?.first_name ?? 'ce proche'}.`
                  : 'Aucun souvenir dans cette catégorie.'}
              </p>
              {memories.length === 0 && (
                <Button variant="ghost" onClick={() => setModalOpen(true)}>
                  <Plus size={15} /> Ajouter le premier souvenir
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Vue groupée (filtre = all) */}
              {filterType === 'all' ? (
                <div className="space-y-6">
                  {(Object.entries(MEMORY_TYPES) as [MemoryType, typeof MEMORY_TYPES[MemoryType]][]).map(([type, config]) => {
                    const group = grouped[type]
                    if (group.length === 0) return null
                    return (
                      <MemoryGroup
                        key={type}
                        type={type}
                        config={config}
                        memories={group}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onUpdateImportance={(id, imp) => updateMemory(id, { importance: imp })}
                      />
                    )
                  })}
                </div>
              ) : (
                /* Vue filtrée — liste plate */
                <div className="space-y-2">
                  {filtered.map((m) => (
                    <MemoryCard
                      key={m.id}
                      memory={m}
                      config={MEMORY_TYPES[m.memory_type]}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onUpdateImportance={(imp) => updateMemory(m.id, { importance: imp })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <MemoryModal
          memory={editing}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

// --- Sous-composants ---

function MemoryGroup({
  type, config, memories, onEdit, onDelete, onUpdateImportance,
}: {
  type:    MemoryType
  config:  typeof MEMORY_TYPES[MemoryType]
  memories: ConversationMemory[]
  onEdit:  (m: ConversationMemory) => void
  onDelete: (id: string) => void
  onUpdateImportance: (id: string, imp: number) => void
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold text-slate-700 mb-3 text-base">
        <span>{config.emoji}</span>
        {config.label}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', config.bg, config.color)}>
          {memories.length}
        </span>
      </h2>
      <div className="space-y-2">
        {memories.map((m) => (
          <MemoryCard
            key={m.id}
            memory={m}
            config={config}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateImportance={(imp) => onUpdateImportance(m.id, imp)}
          />
        ))}
      </div>
    </div>
  )
}

const IMPORTANCE_LABELS = ['', 'Très faible', 'Faible', 'Faible+', 'Modéré', 'Modéré+', 'Important', 'Important+', 'Très important', 'Critique', 'Essentiel']

function MemoryCard({
  memory, config, onEdit, onDelete, onUpdateImportance,
}: {
  memory: ConversationMemory
  config: typeof MEMORY_TYPES[MemoryType]
  onEdit: (m: ConversationMemory) => void
  onDelete: (id: string) => void
  onUpdateImportance: (imp: number) => void
}) {
  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 flex items-start gap-4 group hover:shadow-sm transition-all',
      memory.importance >= 8 ? 'border-accent/30' : 'border-slate-100'
    )}>
      {/* Importance visuelle */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <div className={cn(
          'w-3 h-3 rounded-full',
          IMPORTANCE_COLORS[memory.importance] ?? 'bg-slate-200'
        )} title={`Importance : ${memory.importance}/10`} />
        <span className="text-xs text-slate-400 font-mono">{memory.importance}</span>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-slate-700 text-sm leading-relaxed">{memory.content}</p>
        <div className="flex items-center gap-3 mt-2">
          {/* Badge type */}
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', config.bg, config.color)}>
            {config.emoji} {config.label}
          </span>
          {/* Date source */}
          <span className="text-xs text-slate-400">
            {formatDate(memory.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {/* Étoile si essentiel */}
          {memory.importance >= 9 && (
            <span className="text-xs text-accent font-semibold flex items-center gap-0.5">
              <Sparkles size={11} /> Essentiel
            </span>
          )}
        </div>

        {/* Slider importance */}
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">{IMPORTANCE_LABELS[memory.importance]}</span>
            <input
              type="range" min={1} max={10}
              value={memory.importance}
              onChange={(e) => onUpdateImportance(Number(e.target.value))}
              className="flex-1 h-1.5 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(memory)}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-primary-50 hover:text-primary flex items-center justify-center transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(memory.id)}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
      <Brain size={48} className="mx-auto text-slate-200 mb-4" />
      <h2 className="font-title text-xl font-semibold text-slate-600 mb-2">Aucun proche configuré</h2>
      <p className="text-slate-400">Ajoutez d'abord un proche pour gérer ses mémoires.</p>
    </div>
  )
}
