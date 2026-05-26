// Logo MODECT — pictogramme (deux arcs entrelacés) + wordmark Fraunces
// `variant` : 'full' (picto + mot), 'mark' (picto seul), 'mono' (crème sur fond foncé)

type LogoProps = {
  variant?: 'full' | 'mark' | 'mono'
  size?: number
  className?: string
}

export function Logo({ variant = 'full', size = 28, className = '' }: LogoProps) {
  const isMono = variant === 'mono'
  const arc1 = isMono ? '#FBF5EE' : '#C75D3A'
  const arc2 = isMono ? '#F5EBDC' : '#D9943E'
  const dot = isMono ? '#FBF5EE' : '#8B4A2B'
  const wordColor = isMono ? 'text-creme' : 'text-brun-900'

  const Mark = (
    <svg
      viewBox="0 0 90 40"
      width={size * (90 / 40)}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M 0 20 Q 30 -20 60 20" fill="none" stroke={arc1} strokeWidth="8" strokeLinecap="round" />
      <path d="M 30 20 Q 60 60 90 20" fill="none" stroke={arc2} strokeWidth="8" strokeLinecap="round" />
      <circle cx="45" cy="20" r="6" fill={dot} />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span className={className} aria-label="MODECT">
        {Mark}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="MODECT">
      {Mark}
      <span className={`font-serif text-2xl leading-none ${wordColor}`} style={{ fontWeight: 400 }}>
        modect
      </span>
    </span>
  )
}
