import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: authError } = await signIn(email.trim(), password)
    setSubmitting(false)

    if (authError) {
      setError(translateAuthError(authError))
      return
    }

    navigate('/leads', { replace: true })
  }

  return (
    <AuthShell
      title="Operações, leads e atendimento em uma plataforma só."
      subtitle="Entre com sua conta e continue de onde parou."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!supabaseConfigured && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Não foi possível conectar ao serviço. Verifique a configuração e tente novamente.
          </p>
        )}
        <div>
          <label htmlFor="email" className="sr-only">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border-2 border-liqui-orange/50 bg-liqui-input px-4 py-3.5 text-sm text-liqui-ink outline-none transition placeholder:text-zinc-400 focus:border-liqui-orange focus:bg-white"
          />
        </div>

        <div className="relative">
          <label htmlFor="password" className="sr-only">
            Senha
          </label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-zinc-200 bg-liqui-input px-4 py-3.5 pr-12 text-sm text-liqui-ink outline-none transition placeholder:text-zinc-400 focus:border-liqui-orange focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-liqui-ink"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-liqui-orange px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-liqui-orange-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Entrando...' : 'Entrar'}
          {!submitting && <Zap className="h-4 w-4 fill-white text-white" />}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Ainda não tem conta?{' '}
        <Link
          to="/cadastro"
          className="font-bold text-liqui-ink underline-offset-2 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </AuthShell>
  )
}

function translateAuthError(message: string) {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha inválidos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'Too many requests': 'Muitas tentativas. Aguarde um momento.',
  }
  return map[message] ?? message
}
