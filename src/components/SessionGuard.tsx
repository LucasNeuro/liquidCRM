import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  bindTabUser,
  clearTabBoundUser,
  readTabBoundUser,
} from '../lib/sessionCache'

/**
 * Mesmo domínio = uma sessão Supabase (localStorage).
 * Vale em localhost e em produção (Render). Duas contas no mesmo browser
 * se sobrepõem — avisamos em vez de “deslogar no silêncio”.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { session, user, signOut } = useAuth()
  const [conflict, setConflict] = useState<{
    previousId: string
    nextEmail: string
  } | null>(null)

  useEffect(() => {
    const uid = user?.id
    if (!uid) {
      clearTabBoundUser()
      setConflict(null)
      return
    }

    const bound = readTabBoundUser()
    if (!bound) {
      bindTabUser(uid)
      setConflict(null)
      return
    }

    if (bound !== uid) {
      setConflict({
        previousId: bound,
        nextEmail: user?.email || 'outra conta',
      })
      return
    }

    setConflict(null)
  }, [user?.id, user?.email, session])

  if (!conflict) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <p className="text-lg font-extrabold text-liqui-navy">
          Sessão trocada neste navegador
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          O LIQUI (como quase todo SaaS com Auth) guarda{' '}
          <strong>uma sessão por domínio</strong>. Ao logar como{' '}
          <strong>{conflict.nextEmail}</strong> em outra aba, esta aba deixou de
          ser a conta anterior.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Isso acontece no local <em>e</em> em produção. Para testar owner +
          consultor ao mesmo tempo, use janela anônima, outro perfil do Chrome
          ou outro navegador.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (user?.id) bindTabUser(user.id)
              setConflict(null)
              window.location.assign('/')
            }}
            className="rounded-xl bg-liqui-navy px-4 py-2.5 text-sm font-bold text-white"
          >
            Continuar como {conflict.nextEmail}
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                clearTabBoundUser()
                await signOut()
                window.location.assign('/login')
              })()
            }}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-liqui-navy"
          >
            Sair e escolher conta
          </button>
        </div>
      </div>
    </div>
  )
}
