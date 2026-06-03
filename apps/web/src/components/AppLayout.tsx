import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookHeart,
  CalendarDays,
  History,
  Radar,
  UserCog,
  ShieldCheck,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { Logo } from '@/components/Logo'
import { AppHeader } from '@/components/AppHeader'
import { SelectedBeneficiaryProvider } from '@/hooks/useSelectedBeneficiary'

const mainNav = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/contexte',   icon: BookHeart,       label: 'Contexte' },
  { to: '/planning',   icon: CalendarDays,    label: 'Planning' },
  { to: '/historique', icon: History,         label: 'Historique' },
  { to: '/veille',     icon: Radar,           label: 'Veille' },
]

const accountNav = [
  { to: '/compte',     icon: UserCog,         label: 'Mon compte' },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const { isAdmin } = useIsAdmin()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <SelectedBeneficiaryProvider>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col shadow-sm">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-slate-100">
            <Logo variant="full" size={31} />
            <p className="text-[11px] uppercase tracking-widest text-slate-400 mt-2">
              {isAdmin ? 'Espace admin' : 'Espace aidant'}
            </p>
          </div>

          {/* Navigation principale */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {/* Nav aidant : masquée pour les admins (pas de bénéficiaire propre) */}
            {!isAdmin && mainNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}

            {/* Section admin (visible uniquement si role=admin) */}
            {isAdmin && (
              <div className="space-y-1">
                <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-accent-700 font-semibold">
                  Administration
                </p>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body font-medium transition-colors',
                      isActive
                        ? 'bg-accent-50 text-accent-700'
                        : 'text-slate-600 hover:bg-accent-50 hover:text-accent-700'
                    )
                  }
                >
                  <ShieldCheck size={18} />
                  Vue d'ensemble
                </NavLink>
                {[
                  { to: '/admin/comptes',       label: 'Aidants' },
                  { to: '/admin/beneficiaires', label: 'Bénéficiaires' },
                  { to: '/admin/appels',        label: 'Appels' },
                  { to: '/admin/prompt',        label: 'Prompt système' },
                  { to: '/admin/sante',         label: 'Santé système' },
                ].map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 pl-10 pr-3 py-2 rounded-xl text-sm font-body transition-colors',
                        isActive
                          ? 'bg-accent-50 text-accent-700 font-medium'
                          : 'text-slate-500 hover:bg-accent-50 hover:text-accent-700'
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Section compte (séparée visuellement) */}
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
              {accountNav.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Footer utilisateur */}
          <div className="px-3 pb-4 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {profile?.full_name ?? 'Aidant'}
                </p>
                <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 w-full text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </div>
        </aside>

        {/* Colonne droite : header sticky + contenu.
            Le header (dropdown bénéficiaire + bouton « Nouveau bénéficiaire ») n'a
            pas de sens pour un admin → masqué. */}
        <div className="flex-1 flex flex-col min-w-0">
          {!isAdmin && <AppHeader />}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SelectedBeneficiaryProvider>
  )
}
