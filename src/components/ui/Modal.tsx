import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  footer?: ReactNode
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
  footer,
}: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-liqui-navy/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-liqui-navy">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
