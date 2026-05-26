import { Button } from '@/components/ui/Button'

interface StepLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  onSubmit?: () => void
  nextLabel?: string
  saving?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function StepLayout({
  title,
  subtitle,
  children,
  onPrev,
  onNext,
  onSubmit,
  nextLabel,
  saving,
  isFirst,
  isLast,
}: StepLayoutProps) {
  return (
    <div>
      <h2 className="font-title text-xl font-semibold text-slate-800 mb-1">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mb-6">{subtitle}</p>}

      <div className="space-y-5">{children}</div>

      <div className="flex justify-between mt-8 pt-5 border-t border-slate-100">
        <Button
          type="button"
          variant="ghost"
          onClick={onPrev}
          disabled={isFirst}
          className={isFirst ? 'invisible' : ''}
        >
          ← Précédent
        </Button>
        {isLast ? (
          <Button type="button" onClick={onSubmit} loading={saving}>
            ✓ Créer le profil
          </Button>
        ) : (
          <Button type="button" onClick={onNext}>
            {nextLabel ?? 'Suivant'} →
          </Button>
        )}
      </div>
    </div>
  )
}
