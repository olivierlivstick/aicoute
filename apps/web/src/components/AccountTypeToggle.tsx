import { User, Building2 } from 'lucide-react'
import type { AccountType } from '@modect/shared'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ value: AccountType; label: string; hint: string; icon: React.ElementType }> = [
  { value: 'individual',   label: 'Personne physique', hint: 'Un particulier',          icon: User },
  { value: 'organization', label: 'Personne morale',   hint: 'Entreprise, association…', icon: Building2 },
]

/** Sélecteur segmenté du type de compte aidant (physique / morale). */
export function AccountTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: AccountType
  onChange: (v: AccountType) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map(({ value: v, label, hint, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-slate-200 hover:border-slate-300',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <Icon size={18} className={cn('mt-0.5 shrink-0', active ? 'text-primary' : 'text-slate-400')} />
            <span>
              <span className={cn('block text-sm font-medium', active ? 'text-primary' : 'text-slate-700')}>{label}</span>
              <span className="block text-xs text-slate-400">{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
