import type { Profile } from './profiles'

const PROFILE_KEY = 'liqui.profile.cache'
const TAB_USER_KEY = 'liqui.tab.boundUser'

type ProfileCache = {
  userId: string
  profile: Profile
  savedAt: number
}

/** Cache muito curto — menu_access muda pelo owner em tempo real. */
const CACHE_TTL_MS = 20_000

export function readProfileCache(userId: string): Profile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProfileCache
    if (parsed.userId !== userId) return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.profile
  } catch {
    return null
  }
}

export function writeProfileCache(userId: string, profile: Profile) {
  try {
    const payload: ProfileCache = {
      userId,
      profile,
      savedAt: Date.now(),
    }
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearTenantCache() {
  try {
    sessionStorage.removeItem(PROFILE_KEY)
  } catch {
    /* ignore */
  }
}

/** Vincula esta aba a um userId (sessionStorage = por aba). */
export function bindTabUser(userId: string) {
  try {
    sessionStorage.setItem(TAB_USER_KEY, userId)
  } catch {
    /* ignore */
  }
}

export function readTabBoundUser(): string | null {
  try {
    return sessionStorage.getItem(TAB_USER_KEY)
  } catch {
    return null
  }
}

export function clearTabBoundUser() {
  try {
    sessionStorage.removeItem(TAB_USER_KEY)
  } catch {
    /* ignore */
  }
}
