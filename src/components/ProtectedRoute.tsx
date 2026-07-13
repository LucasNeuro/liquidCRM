import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-liqui-orange border-t-transparent" />
    </div>
  )
}

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <AuthSpinner />

  if (!session) {
    return <Navigate to="/login" replace />
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
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-liqui-orange border-t-transparent" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/leads" replace />
  }

  return <Outlet />
}
