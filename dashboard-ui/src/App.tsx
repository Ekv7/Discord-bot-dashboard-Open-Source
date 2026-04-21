import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DashboardShell } from '@/DashboardShell'
import { LoginPage } from '@/pages/LoginPage'
import { InvitePage } from '@/pages/InvitePage'
import { DashboardPrivacyPage } from '@/pages/DashboardPrivacyPage'
import { DashboardImpressumPage } from '@/pages/DashboardImpressumPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/datenschutz" element={<DashboardPrivacyPage />} />
      <Route path="/impressum" element={<DashboardImpressumPage />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <DashboardShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
