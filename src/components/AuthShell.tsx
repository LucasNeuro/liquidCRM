import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BrandLogo } from './BrandLogo'

type AuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  backTo?: string
  backLabel?: string
}

export function AuthShell({
  title,
  subtitle,
  children,
  backTo = '/',
  backLabel = 'Voltar',
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col bg-white px-6 py-8 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <BrandLogo size="lg" />
          <Link
            to={backTo}
            className="text-sm font-medium text-liqui-muted transition hover:text-liqui-navy"
          >
            {backLabel}
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {children}
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-liqui-navy lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-liqui-orange/25 blur-3xl" />
          <div className="absolute bottom-10 left-6 h-80 w-80 rounded-full bg-liqui-orange/15 blur-3xl" />
          <div className="absolute right-20 top-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="max-w-lg pt-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-liqui-orange">
              Mini CRM · LIQUI
            </p>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
              {title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/70 xl:text-lg">
              {subtitle}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <img
              src="/logo-cf.png"
              alt="Contabilidade Facilitada"
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          </div>
        </div>
      </aside>
    </div>
  )
}
