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
import { fetchMyProfile, type Profile } from '../lib/profiles'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isOwner: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user: User | null | undefined) => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    try {
      const p = await fetchMyProfile(user.id, user.email)
      setProfile(p)
    } catch (err) {
      console.warn('[auth] falha ao carregar profiles', err)
      setProfile(null)
    }
  }, [])

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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      // Evita deadlock do supabase-js ao consultar o DB dentro do callback
      setTimeout(() => {
        void loadProfile(nextSession?.user ?? null).finally(() => {
          if (mounted) setLoading(false)
        })
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [loadProfile, session?.user])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const isOwner = isOwnerRole(profile)

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isOwner,
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
