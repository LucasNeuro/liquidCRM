import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import {
  getPasswordChecks,
  isPasswordStrong,
  passwordStrengthLabel,
} from '../lib/password'

export function SignupPage() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const checks = useMemo(() => getPasswordChecks(password), [password])
  const strong = isPasswordStrong(password)
  const match = confirm.length > 0 && password === confirm
  const strength = passwordStrengthLabel(password)
  const canSubmit = strong && match && email.trim().length > 3 && !submitting && supabaseConfigured

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (!isPasswordStrong(password)) {
      setError('A senha não atende aos requisitos de segurança.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    const { error: authError } = await signUp(email.trim(), password)
    setSubmitting(false)

    if (authError) {
      setError(translateSignupError(authError))
      return
    }

    setInfo(
      'Conta criada. Confirme o e-mail se solicitado e faça login — o acesso só libera depois que o owner ativar sua conta e definir o cargo em Plataforma.',
    )
    setPassword('')
    setConfirm('')
  }

  return (
    <AuthShell
      title="Crie sua conta e centralize operações com IA."
      subtitle="Preencha seus dados e comece a usar o LIQUI em poucos minutos."
      showBack
      backTo="/login"
      backLabel="Voltar"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!supabaseConfigured && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Não foi possível conectar ao serviço. Verifique a configuração e tente novamente.
          </p>
        )}

        <div>
          <label htmlFor="signup-email" className="sr-only">
            E-mail
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border-2 border-liqui-orange/50 bg-liqui-input px-4 py-3.5 text-sm text-liqui-ink outline-none transition placeholder:text-zinc-400 focus:border-liqui-orange focus:bg-white"
          />
          <p className="mt-1.5 text-[11px] text-liqui-muted">
            Digite um e-mail válido — usaremos para acesso e avisos importantes.
          </p>
        </div>

        <div className="relative">
          <label htmlFor="signup-password" className="sr-only">
            Senha
          </label>
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-zinc-200 bg-liqui-input px-4 py-3.5 pr-12 text-sm text-liqui-ink outline-none transition placeholder:text-zinc-400 focus:border-liqui-orange focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-liqui-navy"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="relative">
          <label htmlFor="signup-confirm" className="sr-only">
            Confirmar senha
          </label>
          <input
            id="signup-confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar senha"
            className="w-full rounded-lg border border-zinc-200 bg-liqui-input px-4 py-3.5 pr-12 text-sm text-liqui-ink outline-none transition placeholder:text-zinc-400 focus:border-liqui-orange focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-liqui-navy"
            aria-label={
              showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'
            }
          >
            {showConfirm ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {confirm.length > 0 && !match && (
          <p className="text-xs text-red-600">As senhas não coincidem.</p>
        )}
        {confirm.length > 0 && match && (
          <p className="text-xs text-emerald-700">As senhas coincidem.</p>
        )}

        {/* Requisitos e dicas DEPOIS de todos os campos */}
        <div className="rounded-xl border border-liqui-orange/20 bg-liqui-orange-soft/70 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-liqui-navy">
              <ShieldCheck className="h-3.5 w-3.5 text-liqui-orange" />
              Requisitos da senha
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                strength.tone === 'good'
                  ? 'bg-emerald-100 text-emerald-700'
                  : strength.tone === 'mid'
                    ? 'bg-amber-100 text-amber-700'
                    : strength.tone === 'bad'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {strength.label}
            </span>
          </div>

          <ul className="space-y-1.5">
            {checks.map((check) => (
              <li
                key={check.id}
                className={`flex items-center gap-2 text-xs ${
                  check.ok ? 'text-emerald-700' : 'text-zinc-500'
                }`}
              >
                {check.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0" />
                )}
                {check.label}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-liqui-muted">
            Dica: não reutilize senhas de outros sites. Prefira uma frase longa
            com símbolos (ex.: Cont@2026!CRM). O botão só libera quando todos
            os requisitos forem atendidos e as senhas coincidirem.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {info && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-liqui-orange px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-liqui-orange-dark disabled:cursor-not-allowed disabled:opacity-55"
        >
          {submitting ? 'Criando...' : 'Criar conta'}
          {!submitting && <Zap className="h-4 w-4 fill-white text-white" />}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Já tem conta?{' '}
        <Link
          to="/login"
          className="font-bold text-liqui-ink underline-offset-2 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}

function translateSignupError(message: string) {
  const map: Record<string, string> = {
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters':
      'A senha deve atender aos requisitos de segurança.',
  }
  return map[message] ?? message
}
