'use client'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'Nessun dato disponibile',
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface/30 bg-card/60 backdrop-blur-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface/30">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 whitespace-nowrap',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-14 text-center text-foreground/40 text-base"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-t border-surface/20',
                  i % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20',
                  onRowClick && 'hover:bg-brand/[0.04] cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-5 py-3.5 text-sm', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
