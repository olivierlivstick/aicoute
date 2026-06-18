import { useEffect } from 'react'
import { usePrompts } from '@/hooks/usePrompts'
import { cn } from '@/lib/utils'
import type { Prompt, PromptKind } from '@modect/shared'

const selectCls =
  'w-full h-10 rounded-xl border border-creme-sable bg-white px-3.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-300'

interface Props {
  language: string
  kind: PromptKind
  value: string | null
  /** Reçoit le prompt complet (ou null) → le parent résout le corps + snapshot. */
  onChange: (prompt: Prompt | null) => void
  /** Si vrai : sélectionne automatiquement le défaut quand `value` n'est pas (ou plus)
   *  dans la liste (utile à l'onboarding et lors d'un changement de langue). */
  autoSelectDefault?: boolean
  className?: string
}

/**
 * Menu déroulant des prompts de la bibliothèque pour un couple (langue, type).
 * Le défaut est marqué « — défaut ». Le parent snapshotte le corps du prompt choisi.
 */
export function PromptSelect({ language, kind, value, onChange, autoSelectDefault, className }: Props) {
  const { prompts, loading } = usePrompts({ language, kind })

  useEffect(() => {
    if (!autoSelectDefault || loading) return
    const inList = value && prompts.some((p) => p.id === value)
    if (!inList) onChange(prompts.find((p) => p.is_default) ?? prompts[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, language, prompts])

  if (loading) {
    return (
      <select disabled className={cn(selectCls, className)}>
        <option>Chargement…</option>
      </select>
    )
  }

  if (prompts.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic bg-creme/60 rounded-lg px-3 py-2">
        Aucun prompt disponible pour cette langue — le prompt par défaut de la plateforme sera utilisé.
      </p>
    )
  }

  return (
    <select
      className={cn(selectCls, className)}
      value={value ?? ''}
      onChange={(e) => onChange(prompts.find((p) => p.id === e.target.value) ?? null)}
    >
      {!value && <option value="">— Choisir un prompt —</option>}
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}{p.is_default ? ' — défaut' : ''}
        </option>
      ))}
    </select>
  )
}
