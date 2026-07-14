/**
 * ErrorBoundary — named + default (evita “is not defined” em HMR/bundle).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = {
  children: ReactNode
  name?: string
  fallbackTitle?: string
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
      error,
      info.componentStack,
    )
  }

  private reset = () => {
    this.setState({ error: null })
  }

  private hardReload = () => {
    try {
      sessionStorage.removeItem('liqui.profile.cache')
    } catch {
      /* ignore */
    }
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-[#f3f4f6] px-6 py-12 text-center">
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-extrabold text-liqui-navy">
            {this.props.fallbackTitle || 'Algo falhou nesta tela'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            A sessão foi preservada. Você pode tentar de novo ou recarregar o
            app limpo (cache de perfil).
          </p>
          <p className="mt-3 break-all rounded-xl bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-500">
            {this.state.error.message}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-liqui-navy px-4 py-2.5 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4 text-liqui-orange" />
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={this.hardReload}
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-liqui-navy"
            >
              Recarregar app
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
