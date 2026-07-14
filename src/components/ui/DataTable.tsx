import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type DataColumn<T> = {
  key: string
  label: ReactNode
  render?: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  pageSize?: number
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  pageSize = 20,
  emptyMessage = 'Nenhum registro',
}: Props<T>) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [rows.length, pageSize])

  const pageRows = useMemo(() => {
    const safe = Math.min(page, totalPages)
    const start = (safe - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize, totalPages])

  const currentPage = Math.min(page, totalPages)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400 ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-zinc-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const custom = rowClassName?.(row)
                return (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-t border-zinc-100 ${custom || ''} ${
                    onRowClick
                      ? `cursor-pointer ${custom ? '' : 'hover:bg-liqui-orange-soft/40'}`
                      : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-3 py-2.5 text-zinc-700 ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String(
                            ((row as unknown as Record<string, unknown>)[
                              col.key
                            ] ?? '—') as string,
                          )}
                    </td>
                  ))}
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5">
        <p className="text-xs text-zinc-500">
          {rows.length} registro(s) · página {currentPage} de {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-zinc-200 p-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-zinc-200 p-1.5 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
