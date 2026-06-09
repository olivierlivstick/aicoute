import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Saisie de numéro de téléphone avec dropdown d'indicatif pays (France par défaut),
 * repris du pattern de la démo vitrine (DemoPhoneModal). Le numéro est saisi au
 * format national ; on reconstruit l'E.164 (+indicatif) pour le parent via onChange.
 *
 * `value` est l'E.164 stocké (ex. « +33612345678 ») ; vide → onChange('').
 */

type Country = { code: string; label: string; dial: string; flag: string }

// Aligné sur DemoPhoneModal. France par défaut.
const COUNTRIES: Country[] = [
  { code: 'FR', label: 'France',      dial: '33',  flag: '🇫🇷' },
  { code: 'BE', label: 'Belgique',    dial: '32',  flag: '🇧🇪' },
  { code: 'CH', label: 'Suisse',      dial: '41',  flag: '🇨🇭' },
  { code: 'LU', label: 'Luxembourg',  dial: '352', flag: '🇱🇺' },
  { code: 'DE', label: 'Allemagne',   dial: '49',  flag: '🇩🇪' },
  { code: 'ES', label: 'Espagne',     dial: '34',  flag: '🇪🇸' },
  { code: 'IT', label: 'Italie',      dial: '39',  flag: '🇮🇹' },
  { code: 'PT', label: 'Portugal',    dial: '351', flag: '🇵🇹' },
  { code: 'GB', label: 'Royaume-Uni', dial: '44',  flag: '🇬🇧' },
  { code: 'CA', label: 'Canada',      dial: '1',   flag: '🇨🇦' },
  { code: 'US', label: 'États-Unis',  dial: '1',   flag: '🇺🇸' },
]

function toE164(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '')
  return digits ? `+${dial}${digits}` : ''
}

/** Sépare un E.164 stocké en { indicatif pays, numéro national } pour pré-remplir. */
function parseE164(value: string | null | undefined): { code: string; national: string } {
  const v = (value ?? '').trim()
  if (v.startsWith('+')) {
    const digits = v.slice(1).replace(/\D/g, '')
    // Indicatif le plus long d'abord (ex. 352 avant 3) pour éviter les faux matchs.
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
    const match = sorted.find((c) => digits.startsWith(c.dial))
    if (match) return { code: match.code, national: digits.slice(match.dial.length) }
  }
  // Pas d'indicatif → on suppose la France, numéro national.
  return { code: 'FR', national: v.replace(/\D/g, '').replace(/^0+/, '') }
}

export function PhoneInput({
  value,
  onChange,
  id,
  className,
}: {
  value: string | null | undefined
  onChange: (e164: string) => void
  id?: string
  className?: string
}) {
  const initial = parseE164(value)
  const [code, setCode] = useState(initial.code)
  const [national, setNational] = useState(initial.national)

  const dialOf = (c: string) => COUNTRIES.find((x) => x.code === c)?.dial ?? '33'

  const update = (nextCode: string, nextNational: string) => {
    setCode(nextCode)
    setNational(nextNational)
    onChange(toE164(dialOf(nextCode), nextNational))
  }

  const fieldCls =
    'h-10 rounded-xl border border-slate-200 bg-white font-body text-base text-slate-800 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary'

  return (
    <div className={cn('flex gap-2', className)}>
      <select
        aria-label="Indicatif pays"
        value={code}
        onChange={(e) => update(e.target.value, national)}
        className={cn(fieldCls, 'shrink-0 px-2 cursor-pointer')}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="6 12 34 56 78"
        value={national}
        onChange={(e) => update(code, e.target.value)}
        className={cn(fieldCls, 'flex-1 min-w-0 px-4 placeholder:text-slate-400')}
      />
    </div>
  )
}
