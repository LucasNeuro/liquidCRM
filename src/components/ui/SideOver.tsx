import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

type SideOverProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  headerExtra?: ReactNode
  widthClass?: string
}

export function SideOver({
  title,
  subtitle,
  onClose,
  children,
  footer,
  headerExtra,
  widthClass = 'max-w-lg',
}: SideOverProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 transition-opacity"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className={`relative flex h-full w-full ${widthClass} sideover-panel flex-col border-l border-zinc-200 bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold text-liqui-navy">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-zinc-500">{subtitle}</p>
            )}
            {headerExtra}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-liqui-navy"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
