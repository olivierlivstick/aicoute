import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppLayout } from '@/components/AppLayout'
import { Home } from '@/marketing/Home'
import { TrackCallsPage } from '@/marketing/TrackCalls'

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
import { BeneficiaryWizard } from '@/pages/beneficiary/BeneficiaryWizard'
import { ContextePage } from '@/pages/contexte/ContextePage'
import { PlanningPage } from '@/pages/planning/PlanningPage'
import { HistoriquePage } from '@/pages/historique/HistoriquePage'
import { CallDetailPage } from '@/pages/historique/CallDetail'
import { VeillePage } from '@/pages/veille/VeillePage'
import { ComptePage } from '@/pages/compte/ComptePage'
import { SimulateCallPage } from '@/pages/call/SimulateCall'

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

        {/* Tracking admin des démos vitrine — protégé par ?key=<DEMO_TRACK_KEY> */}
        <Route path="/track_calls" element={<TrackCallsPage />} />

        {/* App (protégée) */}
        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          {/* Pages principales */}
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/contexte"        element={<ContextePage />} />
          <Route path="/planning"        element={<PlanningPage />} />
          <Route path="/historique"      element={<HistoriquePage />} />
          <Route path="/historique/:id"  element={<CallDetailPage />} />
          <Route path="/veille"          element={<VeillePage />} />
          <Route path="/compte"          element={<ComptePage />} />

          {/* Création d'un bénéficiaire (wizard onboarding) */}
          <Route path="/beneficiary/new" element={<BeneficiaryWizard />} />

          {/* Page d'appel (utilisée en simulation desktop ; mobile = app Expo) */}
          <Route path="/call" element={<SimulateCallPage />} />

          {/* --- Redirections legacy --- */}
          <Route path="/sessions"        element={<Navigate to="/planning"   replace />} />
          <Route path="/reports"         element={<Navigate to="/historique" replace />} />
          <Route path="/reports/:id"     element={<LegacyReportRedirect />} />
          <Route path="/settings"        element={<Navigate to="/compte"     replace />} />
          <Route path="/beneficiary"     element={<Navigate to="/contexte"   replace />} />
          <Route path="/beneficiary/:id" element={<LegacyBeneficiaryRedirect />} />
          <Route path="/memories"        element={<Navigate to="/dashboard"  replace />} />
          <Route path="/setup"           element={<Navigate to="/compte"     replace />} />
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

// Redirige /reports/:id → /historique/:id en préservant l'ID
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'

function LegacyReportRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/historique/${id ?? ''}`} replace />
}

// Redirige /beneficiary/:id → /contexte après avoir sélectionné le bénéficiaire
function LegacyBeneficiaryRedirect() {
  const { id } = useParams<{ id: string }>()
  const { beneficiaries, selectBeneficiary } = useSelectedBeneficiary()
  useEffect(() => {
    if (id && beneficiaries.some((b) => b.id === id)) {
      selectBeneficiary(id)
    }
  }, [id, beneficiaries, selectBeneficiary])
  return <Navigate to="/contexte" replace />
}
