import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  firstAllowedPath,
  hasMenuAccess,
  type MenuAccessKey,
} from '../lib/menuAccess'

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
    return (
      <Navigate
        to={firstAllowedPath(profile.menu_access, profile.role)}
        replace
      />
    )
  }

  return <Outlet />
}

/** Só profiles.role = owner vê /plataforma */
export function OwnerRoute() {
  const { loading, isOwner } = useAuth()

  if (loading) return <AuthSpinner />

  if (!isOwner) {
    return <Navigate to="/leads" replace />
  }

  return <Outlet />
}

/** Exige flag de menu (owners passam sempre). */
export function RequireMenuAccess({ access }: { access: MenuAccessKey }) {
  const { loading, profile, isOwner } = useAuth()

  if (loading) return <AuthSpinner />

  if (isOwner || hasMenuAccess(profile?.menu_access, access, profile?.role)) {
    return <Outlet />
  }

  return (
    <Navigate
      to={firstAllowedPath(profile?.menu_access, profile?.role)}
      replace
    />
  )
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
    return (
      <Navigate
        to={firstAllowedPath(profile.menu_access, profile.role)}
        replace
      />
    )
  }

  return <Outlet />
}
