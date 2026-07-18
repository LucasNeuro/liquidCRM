import { Navigate, Route, Routes } from 'react-router-dom'
import {
  OwnerRoute,
  PendingRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  RequireMenuAccess,
} from './components/ProtectedRoute'
import { AppShell } from './layouts/AppShell'

import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { DashboardPage } from './pages/DashboardPage'
import { DistribuicaoPage } from './pages/DistribuicaoPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { NegociosPage } from './pages/NegociosPage'
import { PendingAccessPage } from './pages/PendingAccessPage'
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
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>

      <Route element={<PendingRoute />}>
        <Route path="/pendente" element={<PendingAccessPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<RequireMenuAccess access="leads" />}>
            <Route path="/leads" element={<LeadsPage />} />
          </Route>
          <Route element={<RequireMenuAccess access="negocios" />}>
            <Route path="/negocios" element={<NegociosPage />} />
          </Route>
          <Route element={<RequireMenuAccess access="tentativas" />}>
            <Route path="/tentativas" element={<TentativasPage />} />
          </Route>
          <Route element={<RequireMenuAccess access="pesquisas" />}>
            <Route path="/pesquisas" element={<RespostasPage />} />
          </Route>
          <Route element={<RequireMenuAccess access="dashboard" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RequireMenuAccess access="distribuicao" />}>
            <Route
              path="/operacao/distribuicao"
              element={<DistribuicaoPage />}
            />
          </Route>
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
