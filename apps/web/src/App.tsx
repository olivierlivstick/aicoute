import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppLayout } from '@/components/AppLayout'
import { RequireAdmin } from '@/components/RequireAdmin'
import { AidantOnly } from '@/components/AidantOnly'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { Home } from '@/marketing/Home'
import { PublicReportPage } from '@/pages/public/PublicReport'
import { PurchaseSuccessPage } from '@/pages/public/PurchaseSuccess'
import { AboutPage } from '@/marketing/About'
import { MentionsLegalesPage } from '@/marketing/legal/MentionsLegales'
import { CGUPage } from '@/marketing/legal/CGU'
import { CGVPage } from '@/marketing/legal/CGV'
import { RGPDPage } from '@/marketing/legal/RGPD'
import { IAActPage } from '@/marketing/legal/IAAct'
import { CharteEthiquePage } from '@/marketing/legal/CharteEthique'
import { EtablissementsPage } from '@/marketing/Etablissements'

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
import { HistoriquePage } from '@/pages/historique/HistoriquePage'
import { CallDetailPage } from '@/pages/historique/CallDetail'
import { VeillePage } from '@/pages/veille/VeillePage'
import { ComptePage } from '@/pages/compte/ComptePage'
import { SimulateCallPage } from '@/pages/call/SimulateCall'

// Admin pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboard'
import { AdminComptesPage } from '@/pages/admin/AdminComptes'
import { AdminCompteDetailPage } from '@/pages/admin/AdminCompteDetail'
import { AdminAppelsPage } from '@/pages/admin/AdminAppels'
import { AdminQualitePage } from '@/pages/admin/AdminQualite'
import { AdminBeneficiairesPage } from '@/pages/admin/AdminBeneficiaires'
import { AdminBeneficiaireDetailPage } from '@/pages/admin/AdminBeneficiaireDetail'
import { AdminSantePage } from '@/pages/admin/AdminSante'
import { AdminPromptPage } from '@/pages/admin/AdminPrompt'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Racine : back-office sur app.*, vitrine sinon.
            En back-office, on dispatch selon le rôle : admin → /admin, sinon /dashboard. */}
        <Route
          path="/"
          element={isAppHost ? <AppHostRoot /> : <Home />}
        />

        {/* Auth (public) */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* (Démos vitrine : déplacées dans /admin/appels onglet « Démos vitrine ».
            L'ancienne page publique /track_calls a été retirée le 2026-06-07.) */}

        {/* Compte-rendu partageable (public, sans login) — jeton 48h dans l'URL.
            Servi sur les deux hôtes (www + app) ; data via Edge Fn get-report. */}
        <Route path="/r/:token" element={<PublicReportPage />} />

        {/* Achat de minutes : page de succès Stripe (publique, achat invité).
            Affiche le code d'activation à créditer ensuite dans /compte. */}
        <Route path="/achat/merci" element={<PurchaseSuccessPage />} />
        <Route path="/achat/annule" element={<Navigate to="/#tarifs" replace />} />

        {/* Pages de contenu (vitrine, publiques) */}
        <Route path="/etablissements" element={<EtablissementsPage />} />
        <Route path="/a-propos" element={<AboutPage />} />
        <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
        <Route path="/cgu" element={<CGUPage />} />
        <Route path="/cgv" element={<CGVPage />} />
        <Route path="/rgpd" element={<RGPDPage />} />
        <Route path="/ia-act" element={<IAActPage />} />
        <Route path="/charte-ethique" element={<CharteEthiquePage />} />

        {/* App (protégée) */}
        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          {/* Pages principales (aidant) — un admin atterrissant sur /dashboard
              est redirigé vers /admin par <AidantOnly>. */}
          <Route path="/dashboard"       element={<AidantOnly><DashboardPage /></AidantOnly>} />
          <Route path="/contexte"        element={<ContextePage />} />
          <Route path="/historique"      element={<HistoriquePage />} />
          <Route path="/historique/:id"  element={<CallDetailPage />} />
          <Route path="/veille"          element={<VeillePage />} />
          <Route path="/compte"          element={<ComptePage />} />

          {/* Création d'un bénéficiaire (wizard onboarding) */}
          <Route path="/beneficiary/new" element={<BeneficiaryWizard />} />

          {/* Page d'appel (utilisée en simulation desktop ; mobile = app Expo) */}
          <Route path="/call" element={<SimulateCallPage />} />

          {/* --- Module admin (visible uniquement si profile.role === 'admin') --- */}
          <Route path="/admin"               element={<RequireAdmin><AdminDashboardPage    /></RequireAdmin>} />
          <Route path="/admin/comptes"       element={<RequireAdmin><AdminComptesPage      /></RequireAdmin>} />
          <Route path="/admin/comptes/:id"   element={<RequireAdmin><AdminCompteDetailPage /></RequireAdmin>} />
          <Route path="/admin/beneficiaires" element={<RequireAdmin><AdminBeneficiairesPage /></RequireAdmin>} />
          <Route path="/admin/beneficiaires/:id" element={<RequireAdmin><AdminBeneficiaireDetailPage /></RequireAdmin>} />
          <Route path="/admin/appels"        element={<RequireAdmin><AdminAppelsPage       /></RequireAdmin>} />
          <Route path="/admin/qualite"       element={<RequireAdmin><AdminQualitePage      /></RequireAdmin>} />
          <Route path="/admin/sante"         element={<RequireAdmin><AdminSantePage        /></RequireAdmin>} />
          <Route path="/admin/prompt"        element={<RequireAdmin><AdminPromptPage       /></RequireAdmin>} />

          {/* --- Redirections legacy --- */}
          {/* Planning n'est plus une page : il vit dans un onglet de la fiche bénéficiaire. */}
          <Route path="/planning"        element={<Navigate to="/contexte?tab=planning" replace />} />
          <Route path="/sessions"        element={<Navigate to="/contexte?tab=planning" replace />} />
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

// Racine du back-office : dispatch selon le rôle (admin → /admin, aidant → /dashboard).
// Si non connecté, on tombe sur /dashboard qui passera par <AuthGuard> et renverra
// vers /auth/login. Pendant le chargement du profil, on ne rend rien pour éviter de
// flasher une mauvaise destination.
function AppHostRoot() {
  const { isAdmin, loading } = useIsAdmin()
  if (loading) return null
  return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
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
