import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { fetchMyProfile, normalizeProfileRow, type Profile } from '../lib/profiles'
import {
  clearTenantCache,
  readProfileCache,
  writeProfileCache,
} from '../lib/sessionCache'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isOwner: boolean
  isConsultor: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function isOwnerRole(profile: Profile | null) {
  if (!profile) return false
  if (profile.active === false) return false
  return String(profile.role || '')
    .trim()
    .toLowerCase() === 'owner'
}

function isConsultorRole(profile: Profile | null) {
  if (!profile) return false
  if (profile.active === false) return false
  return String(profile.role || '')
    .trim()
    .toLowerCase() === 'consultor'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(
    async (user: User | null | undefined, opts?: { bypassCache?: boolean }) => {
      if (!user?.id) {
        setProfile(null)
        clearTenantCache()
        return
      }

      if (!opts?.bypassCache) {
        const cached = readProfileCache(user.id)
        if (cached) setProfile(cached)
      }

      try {
        const p = await fetchMyProfile(user.id, user.email)
        setProfile(p)
        if (p) writeProfileCache(user.id, p)
        else clearTenantCache()
      } catch (err) {
        console.warn('[auth] falha ao carregar profiles', err)
        if (opts?.bypassCache) {
          /* keep current */
        } else {
          const cached = readProfileCache(user.id)
          if (!cached) setProfile(null)
        }
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user ?? null)
      if (mounted) setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_OUT') {
        clearTenantCache()
        setProfile(null)
      }
      setTimeout(() => {
        void loadProfile(nextSession?.user ?? null, {
          bypassCache: true,
        }).finally(() => {
          if (mounted) setLoading(false)
        })
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // Perfil em tempo real: owner altera menu_access → consultor atualiza já
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    const channel = supabase
      .channel(`profile-self-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          clearTenantCache()
          const next = normalizeProfileRow(
            payload.new as Record<string, unknown>,
          )
          if (next) {
            setProfile(next)
            writeProfileCache(uid, next)
          } else {
            void loadProfile(session?.user, { bypassCache: true })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user, loadProfile])

  // Ao focar a aba, revalida acessos (depois do owner salvar)
  useEffect(() => {
    function onFocus() {
      if (!session?.user) return
      clearTenantCache()
      void loadProfile(session.user, { bypassCache: true })
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session?.user, loadProfile])

  const refreshProfile = useCallback(async () => {
    clearTenantCache()
    await loadProfile(session?.user ?? null, { bypassCache: true })
  }, [loadProfile, session?.user])

  const signIn = useCallback(async (email: string, password: string) => {
    clearTenantCache()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    clearTenantCache()
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    clearTenantCache()
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const isOwner = isOwnerRole(profile)
  const isConsultor = isConsultorRole(profile)

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isOwner,
      isConsultor,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    }),
    [
      session,
      profile,
      isOwner,
      isConsultor,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
