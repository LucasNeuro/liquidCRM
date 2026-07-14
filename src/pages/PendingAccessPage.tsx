import { LogOut, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function PendingAccessPage() {
  const { profile, user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-liqui-orange-soft">
          <Shield className="h-6 w-6 text-liqui-navy" />
        </div>
        <h1 className="text-xl font-extrabold text-liqui-navy">
          Acesso pendente
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sua conta{' '}
          <strong className="text-liqui-navy">
            {profile?.email || user?.email}
          </strong>{' '}
          foi criada, mas ainda não está liberada. O{' '}
          <strong>owner</strong> precisa ativar o usuário e definir o cargo em{' '}
          <em>Plataforma → Usuários</em>.
        </p>
        <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          Status atual:{' '}
          <strong className="uppercase text-amber-700">aguardando ativação</strong>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-liqui-navy"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  )
}
