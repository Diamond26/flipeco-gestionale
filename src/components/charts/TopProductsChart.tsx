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
      <div className="space-y-6 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30">Nessuna vendita</p>
      </div>
    )
  }

  const maxQty = Math.max(...data.map((d) => d.quantity), 1)

  return (
    <div className="space-y-6 py-2">
      {data.map((product, i) => {
        const pct = (product.quantity / maxQty) * 100
        return (
          <div key={i} className="group cursor-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-black text-foreground tracking-tight truncate pr-4">
                {product.name}
              </span>
              <span className="text-[11px] font-black text-brand tabular-nums">
                {product.quantity} pz
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-black/10 dark:bg-white/[0.03] overflow-hidden">
               {/* Progress bar with glow */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#7BB35F] transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(123,179,95,0.4)]"
                style={{ width: `${pct}%` }}
              />
              {/* Subtle light effect */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent w-full -translate-x-full animate-progress-glow"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
