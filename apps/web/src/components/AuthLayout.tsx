import { Logo } from '@/components/Logo'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Logo variant="full" size={28} />
          <p className="text-slate-500 text-sm mt-3">La présence qui réchauffe</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <h2 className="font-title text-2xl font-semibold text-slate-800 mb-1">{title}</h2>
          {subtitle && <p className="text-slate-500 text-sm mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}
