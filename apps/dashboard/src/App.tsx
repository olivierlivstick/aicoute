import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppLayout } from '@/components/AppLayout'

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
        {/* Redirection racine */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

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

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
