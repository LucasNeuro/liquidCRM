import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-liqui-orange border-t-transparent" />
    </div>
  )
}

/** Sessão ok, mas precisa de active=true definido pelo owner */
export function ProtectedRoute() {
  const { session, loading, profile } = useAuth()

  if (loading) return <AuthSpinner />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Sem profile ainda, ou desativado → aguarda liberação do owner
  if (!profile || profile.active === false) {
    return <Navigate to="/pendente" replace />
  }

  return <Outlet />
}

/** Página de espera — precisa estar logado */
export function PendingRoute() {
  const { session, loading, profile } = useAuth()

  if (loading) return <AuthSpinner />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profile && profile.active !== false) {
    return <Navigate to="/leads" replace />
  }

  return <Outlet />
}

/** Só profiles.role = owner vê /plataforma */
export function OwnerRoute() {
  const { loading, isOwner } = useAuth()

  if (loading) return <AuthSpinner />

  if (!isOwner) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { session, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-liqui-orange border-t-transparent" />
      </div>
    )
  }

  if (session) {
    if (!profile || profile.active === false) {
      return <Navigate to="/pendente" replace />
    }
    return <Navigate to="/leads" replace />
  }

  return <Outlet />
}
