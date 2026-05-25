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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
            {/* Onde sonore stylisée formant un cœur */}
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 18 Q7 10, 10 18 Q13 26, 16 18 Q19 10, 22 18 Q25 26, 28 18 Q31 10, 34 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M18 8 C14 8, 10 11, 10 15 C10 21, 18 27, 18 27 C18 27, 26 21, 26 15 C26 11, 22 8, 18 8Z" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>
            </svg>
          </div>
          <h1 className="font-title text-3xl font-bold text-primary">MODECT</h1>
          <p className="text-slate-500 text-sm mt-1">La présence qui réchauffe</p>
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
