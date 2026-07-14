/** Chaves de menu alinhadas às rotas do AppShell. */
export type MenuAccessKey =
  | 'dashboard'
  | 'leads'
  | 'tentativas'
  | 'pesquisas'
  | 'negocios'
  | 'distribuicao'
  | 'plataforma'

export type MenuAccess = Record<MenuAccessKey, boolean>

export const MENU_ACCESS_KEYS: MenuAccessKey[] = [
  'dashboard',
  'leads',
  'tentativas',
  'pesquisas',
  'negocios',
  'distribuicao',
  'plataforma',
]

/** Padrão para consultor recém-cadastrado (owner só aprova + ajusta). */
export const DEFAULT_CONSULTOR_MENU_ACCESS: MenuAccess = {
  dashboard: false,
  leads: true,
  tentativas: false,
  pesquisas: false,
  negocios: true,
  distribuicao: false,
  plataforma: false,
}

export const FULL_OWNER_MENU_ACCESS: MenuAccess = {
  dashboard: true,
  leads: true,
  tentativas: true,
  pesquisas: true,
  negocios: true,
  distribuicao: true,
  plataforma: true,
}

export type MenuAccessGroup = {
  id: string
  label: string
  items: { key: MenuAccessKey; label: string; path: string }[]
}

/** Modelo visual do menu (INSIGHTS / VENDAS / …) para toggles no sideover. */
export const MENU_ACCESS_GROUPS: MenuAccessGroup[] = [
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard & Relatórios',
        path: '/dashboard',
      },
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    items: [
      { key: 'leads', label: 'Leads', path: '/leads' },
      { key: 'tentativas', label: 'Tentativas', path: '/tentativas' },
      { key: 'pesquisas', label: 'Pesquisas', path: '/pesquisas' },
      { key: 'negocios', label: 'Negócios', path: '/negocios' },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      {
        key: 'distribuicao',
        label: 'Distribuição',
        path: '/operacao/distribuicao',
      },
    ],
  },
  {
    id: 'plataforma',
    label: 'Plataforma',
    items: [
      {
        key: 'plataforma',
        label: 'Acesso Owner',
        path: '/plataforma',
      },
    ],
  },
]

export function normalizeMenuAccess(
  raw: unknown,
  role: string = 'consultor',
): MenuAccess {
  const isOwner = String(role).toLowerCase() === 'owner'
  const base = isOwner
    ? { ...FULL_OWNER_MENU_ACCESS }
    : { ...DEFAULT_CONSULTOR_MENU_ACCESS }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    for (const key of MENU_ACCESS_KEYS) {
      if (typeof obj[key] === 'boolean') base[key] = obj[key] as boolean
    }
  }

  // Plataforma nunca para consultor
  if (!isOwner) base.plataforma = false

  return base
}

export function pathToMenuKey(pathname: string): MenuAccessKey | null {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return 'dashboard'
  }
  if (pathname === '/leads' || pathname.startsWith('/leads/')) return 'leads'
  if (pathname === '/tentativas' || pathname.startsWith('/tentativas/')) {
    return 'tentativas'
  }
  if (pathname === '/pesquisas' || pathname.startsWith('/pesquisas/')) {
    return 'pesquisas'
  }
  if (pathname === '/negocios' || pathname.startsWith('/negocios/')) {
    return 'negocios'
  }
  if (
    pathname === '/operacao/distribuicao' ||
    pathname.startsWith('/operacao/distribuicao/')
  ) {
    return 'distribuicao'
  }
  if (pathname === '/plataforma' || pathname.startsWith('/plataforma/')) {
    return 'plataforma'
  }
  return null
}

export function hasMenuAccess(
  menu: MenuAccess | undefined | null,
  key: MenuAccessKey,
  role?: string,
): boolean {
  if (String(role || '').toLowerCase() === 'owner') return true
  if (key === 'plataforma') return false
  return menu?.[key] === true
}

export function firstAllowedPath(
  menu: MenuAccess | undefined | null,
  role?: string,
): string {
  if (String(role || '').toLowerCase() === 'owner') return '/dashboard'
  const order: MenuAccessKey[] = [
    'leads',
    'negocios',
    'dashboard',
    'tentativas',
    'pesquisas',
    'distribuicao',
  ]
  const map: Record<MenuAccessKey, string> = {
    dashboard: '/dashboard',
    leads: '/leads',
    tentativas: '/tentativas',
    pesquisas: '/pesquisas',
    negocios: '/negocios',
    distribuicao: '/operacao/distribuicao',
    plataforma: '/plataforma',
  }
  for (const key of order) {
    if (hasMenuAccess(menu, key, role)) return map[key]
  }
  return '/leads'
}
