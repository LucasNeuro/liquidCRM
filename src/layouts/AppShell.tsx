import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Columns3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Shield,
  Wrench,
} from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { CordAssistant } from '../components/cord/CordAssistant'
import ErrorBoundary from '../components/ErrorBoundary'
import { IconBubble } from '../components/ui/IconBubble'
import { useAuth } from '../contexts/AuthContext'
import { hasMenuAccess, type MenuAccessKey } from '../lib/menuAccess'
import { ShellProvider, useShellHeader } from './ShellContext'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  access: MenuAccessKey
}

type NavDrawer = {
  id: string
  label: string
  items: NavItem[]
}

function drawerHasActivePath(drawer: NavDrawer, pathname: string) {
  return drawer.items.some((item) => {
    if (item.end) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  })
}

const ALL_NAV_DRAWERS: NavDrawer[] = [
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard & Relatórios',
        icon: LayoutDashboard,
        end: true,
        access: 'dashboard',
      },
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    items: [
      { to: '/leads', label: 'Leads', icon: Columns3, access: 'leads' },
      {
        to: '/tentativas',
        label: 'Tentativas',
        icon: CreditCard,
        access: 'tentativas',
      },
      {
        to: '/pesquisas',
        label: 'Pesquisas',
        icon: ClipboardList,
        access: 'pesquisas',
      },
      {
        to: '/negocios',
        label: 'Negócios',
        icon: BriefcaseBusiness,
        access: 'negocios',
      },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      {
        to: '/operacao/distribuicao',
        label: 'Distribuição',
        icon: Wrench,
        access: 'distribuicao',
      },
    ],
  },
  {
    id: 'plataforma',
    label: 'Plataforma',
    items: [
      {
        to: '/plataforma',
        label: 'Acesso Owner',
        icon: Shield,
        access: 'plataforma',
      },
    ],
  },
]

function ShellChrome() {
  const { user, profile, isOwner, signOut } = useAuth()
  const { header } = useShellHeader()
  const { pathname } = useLocation()

  const navDrawers = useMemo(() => {
    const role = profile?.role
    const menu = profile?.menu_access
    return ALL_NAV_DRAWERS.map((drawer) => ({
      ...drawer,
      items: drawer.items.filter((item) =>
        hasMenuAccess(menu, item.access, role),
      ),
    })).filter((d) => d.items.length > 0)
  }, [profile?.menu_access, profile?.role])

  const initiallyOpen = useMemo(() => {
    const open = new Set<string>()
    for (const d of navDrawers) {
      if (drawerHasActivePath(d, pathname) || d.id === 'vendas') open.add(d.id)
    }
    return open
  }, [pathname, navDrawers])

  const [openDrawers, setOpenDrawers] = useState<Set<string>>(initiallyOpen)

  useEffect(() => {
    setOpenDrawers((prev) => {
      const next = new Set(prev)
      for (const d of navDrawers) {
        if (drawerHasActivePath(d, pathname)) next.add(d.id)
      }
      return next
    })
  }, [pathname, navDrawers])

  function toggleDrawer(id: string) {
    setOpenDrawers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const displayName =
    profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
  const roleBadge = isOwner
    ? 'PLATAFORMA'
    : profile?.role === 'consultor'
      ? 'CONSULTOR'
      : profile
        ? String(profile.role).toUpperCase()
        : null

  return (
    <div className="h-screen overflow-hidden bg-[#f3f4f6]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-zinc-200 bg-white">
        <div className="flex shrink-0 justify-center border-b border-zinc-100 px-3 py-4">
          <BrandLogo size="md" rounded={15} centered className="max-w-[168px]" />
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {navDrawers.map((drawer) => {
            const isOpen = openDrawers.has(drawer.id)
            const hasItems = drawer.items.length > 0

            return (
              <div key={drawer.id} className="rounded-xl">
                <button
                  type="button"
                  onClick={() => toggleDrawer(drawer.id)}
                  className="flex w-full items-center justify-between px-2 py-2.5 text-left"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-liqui-navy">
                    {drawer.label}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-liqui-navy/70 transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mb-1 space-y-0.5 pb-1 pl-1">
                    {hasItems ? (
                      drawer.items.map((item) => (
                        <NavLink
                          key={`${drawer.id}-${item.label}`}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              isActive
                                ? 'border-l-[3px] border-liqui-orange bg-liqui-orange-soft text-liqui-navy'
                                : 'border-l-[3px] border-transparent text-zinc-600 hover:bg-zinc-50'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <IconBubble
                                icon={item.icon}
                                size="sm"
                                tone={isActive ? 'orange' : 'zinc'}
                              />
                              {item.label}
                            </>
                          )}
                        </NavLink>
                      ))
                    ) : (
                      <p className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400">
                        <IconBubble icon={Wrench} size="sm" tone="zinc" />
                        Em breve
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-zinc-100 p-4">
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-liqui-navy text-[11px] font-bold text-white">
                {initials || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-liqui-navy">
                  {displayName}
                </p>
                <p className="truncate text-xs text-zinc-500">{user?.email}</p>
              </div>
            </div>
            {roleBadge && (
              <span className="mt-2 inline-flex rounded-full bg-liqui-orange-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-liqui-navy">
                {roleBadge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            <IconBubble icon={LogOut} size="sm" tone="danger" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex h-full flex-col pl-[248px]">
        <header className="z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div>
            <h1 className="text-xl font-extrabold text-liqui-navy">
              {header.title}
            </h1>
            {header.subtitle && (
              <p className="text-sm text-zinc-500">{header.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">{header.actions}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden bg-[#f3f4f6]">
          <ErrorBoundary name="shell-outlet" fallbackTitle="Erro nesta área">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <CordAssistant />
    </div>
  )
}

export function AppShell() {
  return (
    <ShellProvider>
      <ShellChrome />
    </ShellProvider>
  )
}
