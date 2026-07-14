import { Archive, Trash2 } from 'lucide-react'
import { SideOver } from './SideOver'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  onSave: () => void
  onArchive?: () => void
  onDelete?: () => void
  saving?: boolean
  children: ReactNode
  isNew?: boolean
}

export function CrmEntitySideOver({
  title,
  subtitle,
  onClose,
  onSave,
  onArchive,
  onDelete,
  saving,
  children,
  isNew,
}: Props) {
  return (
    <SideOver
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      widthClass="max-w-md"
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Salvando…' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
          {!isNew && (onArchive || onDelete) && (
            <div className="flex gap-2">
              {onArchive && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={onArchive}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-600"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Arquivar
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={onDelete}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      {children}
    </SideOver>
  )
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block text-sm font-semibold text-liqui-navy">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
      />
    </label>
  )
}
