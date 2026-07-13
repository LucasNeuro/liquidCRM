import { Navigate, Route, Routes } from 'react-router-dom'
import {
  OwnerRoute,
  ProtectedRoute,
  PublicOnlyRoute,
} from './components/ProtectedRoute'
import { AppShell } from './layouts/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { NegociosPage } from './pages/NegociosPage'
import { PlatformPage } from './pages/PlatformPage'
import { RespostasPage } from './pages/RespostasPage'
import { SignupPage } from './pages/SignupPage'
import { TentativasPage } from './pages/TentativasPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/tentativas" element={<TentativasPage />} />
          <Route path="/pesquisas" element={<RespostasPage />} />
          <Route path="/negocios" element={<NegociosPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route element={<OwnerRoute />}>
            <Route path="/plataforma" element={<PlatformPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/leads" replace />} />
      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  )
}
