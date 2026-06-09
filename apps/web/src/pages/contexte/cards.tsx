import { useState } from 'react'
import { Check, Pencil, Plus } from 'lucide-react'
import { useBeneficiary } from '@/hooks/useBeneficiary'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Beneficiary, ConversationStyle } from '@modect/shared'

// ============================================================================
// Constantes domaine partagées entre onglets (Profil lit, Compagnon IA édite)
// ============================================================================

export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
]

export function langLabel(code: string | null | undefined): string {
  return LANGUAGES.find((l) => l.value === code)?.label ?? '🇫🇷 Français'
}

export const STYLES: { value: ConversationStyle; label: string; description: string; emoji: string }[] = [
  { value: 'warm', label: 'Chaleureux', description: 'Bienveillant et affectueux', emoji: '🤗' },
  { value: 'calm', label: 'Calme', description: 'Posé, serein et rassurant', emoji: '😌' },
  { value: 'playful', label: 'Enjoué', description: 'Léger, drôle et vivant', emoji: '😄' },
  { value: 'formal', label: 'Respectueux', description: 'Poli et traditionnel', emoji: '🎩' },
]

/** Âge à partir de la date de naissance (précis) avec repli sur l'année seule. */
export function computeAge(
  birthDate: string | null | undefined,
  birthYear: number | null | undefined,
): number | null {
  if (birthDate) {
    const d = new Date(birthDate)
    if (!Number.isNaN(d.getTime())) {
      const now = new Date()
      let age = now.getFullYear() - d.getFullYear()
      const m = now.getMonth() - d.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
      return age
    }
  }
  return birthYear ? new Date().getFullYear() - birthYear : null
}

/** Formate une date de naissance pour l'affichage (ex. « 14 mars 1942 »). */
export function formatBirthDate(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ============================================================================
// useSection — hook de persistance partagé par toutes les cartes éditables.
// Réutilise useBeneficiary(id).update (policies RLS caregiver/admin).
// ============================================================================

export function useSection(beneficiary: Beneficiary) {
  const { update } = useBeneficiary(beneficiary.id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: Partial<Beneficiary>): Promise<boolean> => {
    setSaving(true)
    setError(null)
    const ok = await update(patch)
    setSaving(false)
    if (!ok) setError("Impossible d'enregistrer les modifications.")
    return ok
  }

  return { save, saving, error, setError }
}

// ============================================================================
// EditableCard — carte de section avec bascule lecture ⇄ édition.
//   - children       : vue lecture
//   - renderEdit(close) : formulaire d'édition (qui appelle close() au succès)
// ============================================================================

type Accent = 'primary' | 'sauge' | 'brique'

const ACCENT_TEXT: Record<Accent, string> = {
  primary: 'text-primary',
  sauge: 'text-sauge',
  brique: 'text-brique',
}

export function EditableCard({
  title,
  icon: Icon,
  accent = 'primary',
  aside,
  children,
  renderEdit,
  className,
}: {
  title: string
  icon: React.ElementType
  accent?: Accent
  aside?: React.ReactNode
  children: React.ReactNode
  renderEdit?: (close: () => void) => React.ReactNode
  className?: string
}) {
  const [editing, setEditing] = useState(false)

  return (
    <section
      className={cn(
        'bg-surface rounded-2xl border border-creme-sable shadow-[0_1px_2px_rgba(61,40,23,0.04)]',
        className,
      )}
    >
      <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <span className={cn('grid place-items-center w-7 h-7 rounded-lg bg-creme', ACCENT_TEXT[accent])}>
          <Icon size={15} />
        </span>
        <h3 className="font-title text-[15px] font-semibold text-slate-800 flex-1">{title}</h3>
        {aside}
        {renderEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors rounded-lg px-2 py-1 hover:bg-creme"
          >
            <Pencil size={13} /> Modifier
          </button>
        )}
      </header>
      <div className="px-5 pb-5">
        {editing && renderEdit ? renderEdit(() => setEditing(false)) : children}
      </div>
    </section>
  )
}

// ============================================================================
// Primitives de lecture
// ============================================================================

/** Libellé + valeur (vue lecture). `empty` rendu en indice si pas de valeur. */
export function Field({
  label,
  children,
  empty,
}: {
  label: string
  children?: React.ReactNode
  empty?: string
}) {
  const hasValue = children !== null && children !== undefined && children !== ''
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
      {hasValue ? (
        <div className="text-[14.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{children}</div>
      ) : (
        <EmptyHint>{empty || 'Non renseigné'}</EmptyHint>
      )}
    </div>
  )
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 italic">
      <Plus size={13} /> {children}
    </span>
  )
}

/** Ligne icône + libellé + valeur (carte Identité & contact). */
export function InfoRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-creme text-slate-400 shrink-0 mt-0.5">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
        <p className="text-[14px] text-slate-800">
          {value}
          {sub && <span className="text-slate-400"> · {sub}</span>}
        </p>
      </div>
    </div>
  )
}

type ChipTone = 'neutral' | 'primary' | 'sauge' | 'brique' | 'accent'

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-creme text-brun-700 border-creme-sable',
  primary: 'bg-primary-50 text-primary border-primary/15',
  sauge: 'bg-sauge/10 text-sauge border-sauge/25',
  brique: 'bg-brique/10 text-brique border-brique/20',
  accent: 'bg-accent-50 text-accent-700 border-accent/25',
}

/** Puce / tag. */
export function Chip({
  children,
  tone = 'neutral',
  icon: Icon,
}: {
  children: React.ReactNode
  tone?: ChipTone
  icon?: React.ElementType
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1 rounded-full border',
        CHIP_TONES[tone],
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}

/** Rend une chaîne séparée par virgules/sauts de ligne en liste de puces. */
export function splitList(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ============================================================================
// Primitives d'édition
// ============================================================================

/** Libellé de champ d'édition (uppercase, fin). */
export function EditLabel({ children, tone }: { children: React.ReactNode; tone?: 'brique' }) {
  return (
    <p
      className={cn(
        'text-[11px] uppercase tracking-wider font-semibold mb-1.5',
        tone === 'brique' ? 'text-brique/80' : 'text-slate-400',
      )}
    >
      {children}
    </p>
  )
}

/** Pied d'édition : message d'erreur + Annuler / Enregistrer. À placer dans un <form>. */
export function EditFooter({
  onCancel,
  saving,
  error,
}: {
  onCancel: () => void
  saving?: boolean
  error?: string | null
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-3 mt-1">
      {error && (
        <p className="flex-1 text-[13px] text-brique bg-brique/10 rounded-lg px-3 py-1.5">{error}</p>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" size="sm" loading={saving}>
        <Check size={14} /> Enregistrer
      </Button>
    </div>
  )
}
