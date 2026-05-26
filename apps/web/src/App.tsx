import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppLayout } from '@/components/AppLayout'
import { Home } from '@/marketing/Home'

// Mono-site : la vitrine et le back-office sont la même app, servie sur deux
// sous-domaines. Sur app.modect.com on entre dans le back-office ; ailleurs
// (www.modect.com, apex, localhost) on affiche la vitrine à la racine.
const isAppHost =
  typeof window !== 'undefined' && window.location.hostname.startsWith('app.')

// Auth
import { LoginPage } from '@/pages/auth/Login'
import { RegisterPage } from '@/pages/auth/Register'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { ResetPasswordPage } from '@/pages/auth/ResetPassword'

// App pages
import { DashboardPage } from '@/pages/dashboard/Dashboard'
import { SettingsPage } from '@/pages/settings/Settings'
import { BeneficiaryListPage } from '@/pages/beneficiary/BeneficiaryList'
import { BeneficiaryWizard } from '@/pages/beneficiary/BeneficiaryWizard'
import { BeneficiaryDetailPage } from '@/pages/beneficiary/BeneficiaryDetail'
import { SessionsPage } from '@/pages/sessions/SessionsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { CallDetailPage } from '@/pages/reports/CallDetail'
import { MemoriesPage } from '@/pages/memories/MemoriesPage'
import { SimulateCallPage } from '@/pages/call/SimulateCall'
import { SetupPage } from '@/pages/setup/Setup'


export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Racine : back-office sur app.*, vitrine sinon */}
        <Route
          path="/"
          element={isAppHost ? <Navigate to="/dashboard" replace /> : <Home />}
        />

        {/* Auth (public) */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* App (protégée) */}
        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/beneficiary"     element={<BeneficiaryListPage />} />
          <Route path="/beneficiary/new" element={<BeneficiaryWizard />} />
          <Route path="/beneficiary/:id" element={<BeneficiaryDetailPage />} />
          <Route path="/sessions"    element={<SessionsPage />} />
          <Route path="/reports"      element={<ReportsPage />} />
          <Route path="/reports/:id"  element={<CallDetailPage />} />
          <Route path="/memories"    element={<MemoriesPage />} />
          <Route path="/call"        element={<SimulateCallPage />} />
          <Route path="/settings"    element={<SettingsPage />} />
          <Route path="/setup"       element={<SetupPage />} />
        </Route>

        {/* 404 : back-office → dashboard ; vitrine → accueil */}
        <Route
          path="*"
          element={<Navigate to={isAppHost ? '/dashboard' : '/'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
