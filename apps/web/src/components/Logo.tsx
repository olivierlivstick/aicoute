// Logo AICOUTE — pictogramme (bulle de parole + ondes sonores) + wordmark « aicoute »
// `variant` : 'full' (picto + mot), 'mark' (picto seul), 'mono' (crème sur fond foncé)

type LogoProps = {
  variant?: 'full' | 'mark' | 'mono'
  size?: number
  className?: string
}

export function Logo({ variant = 'full', size = 28, className = '' }: LogoProps) {
  const isMono = variant === 'mono'
  // Normal : bulle terracotta, ondes crème. Mono (fond foncé) : bulle crème, ondes terracotta.
  const bubble = isMono ? '#FBF5EE' : '#C75D3A'
  const waves = isMono ? '#C75D3A' : '#FBF5EE'

  const Mark = (
    <svg
      viewBox="-6 6 96 92"
      height={size}
      width={size * (96 / 92)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M10 10 H70 a14 14 0 0 1 14 14 V64 a14 14 0 0 1 -14 14 H30 l-12 14 v-14 H10 a14 14 0 0 1 -14 -14 V24 a14 14 0 0 1 14 -14 Z"
        fill={bubble}
        stroke={bubble}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="20" y1="40" x2="20" y2="48" stroke={waves} strokeWidth="5" strokeLinecap="round" />
      <line x1="30" y1="30" x2="30" y2="58" stroke={waves} strokeWidth="5" strokeLinecap="round" />
      <line x1="40" y1="38" x2="40" y2="50" stroke={waves} strokeWidth="5" strokeLinecap="round" />
      <line x1="52" y1="24" x2="52" y2="64" stroke={waves} strokeWidth="5" strokeLinecap="round" />
      <line x1="62" y1="34" x2="62" y2="54" stroke={waves} strokeWidth="5" strokeLinecap="round" />
      <line x1="72" y1="40" x2="72" y2="48" stroke={waves} strokeWidth="5" strokeLinecap="round" />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span className={className} aria-label="aicoute">
        {Mark}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="aicoute">
      {Mark}
      <span className="font-serif leading-none" style={{ fontWeight: 500, fontSize: size }}>
        {isMono ? (
          <span className="text-creme">aicoute</span>
        ) : (
          <>
            <span className="text-terracotta">ai</span>
            <span className="text-brun-900">coute</span>
          </>
        )}
      </span>
    </span>
  )
}
