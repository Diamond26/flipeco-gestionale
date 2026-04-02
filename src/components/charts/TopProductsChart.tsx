'use client'

interface TopProduct {
  name: string
  quantity: number
}

interface TopProductsChartProps {
  data: TopProduct[]
  loading?: boolean
}

export function TopProductsChart({ data, loading }: TopProductsChartProps) {
  if (loading) {
    return (
      <div className="space-y-5 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 skeleton-shimmer rounded-lg" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-sm text-foreground/40">Nessuna vendita nel periodo selezionato.</p>
      </div>
    )
  }

  const maxQty = Math.max(...data.map((d) => d.quantity), 1)

  return (
    <div className="space-y-4 py-1">
      {data.map((product, i) => {
        const pct = (product.quantity / maxQty) * 100
        return (
          <div key={i} className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground/70 w-36 shrink-0 truncate">
              {product.name}
            </span>
            <div className="flex-1 h-3 rounded-full bg-surface-light/80 dark:bg-surface/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
