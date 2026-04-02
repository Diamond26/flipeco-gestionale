'use client'

interface StockAlertChartProps {
  totalProducts: number
  criticalCount: number
  loading?: boolean
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-3 flex-1 rounded-full bg-surface-light/80 dark:bg-surface/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function StockAlertChart({ totalProducts, criticalCount, loading }: StockAlertChartProps) {
  if (loading) {
    return (
      <div className="space-y-6 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 skeleton-shimmer rounded-lg" />
        ))}
      </div>
    )
  }

  if (totalProducts === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-sm text-foreground/40">Nessun prodotto in magazzino.</p>
      </div>
    )
  }

  const healthyCount = totalProducts - criticalCount
  const healthyPct = Math.round((healthyCount / totalProducts) * 100)

  const rows = [
    {
      label: 'Livello Scorte',
      value: `${healthyPct}%`,
      current: healthyCount,
      max: totalProducts,
      color: '#7BB35F',
    },
    {
      label: 'Prodotti Critici',
      value: criticalCount.toString(),
      current: criticalCount,
      max: totalProducts,
      color: criticalCount > 0 ? '#EF4444' : '#7BB35F',
    },
    {
      label: 'Prodotti Critici',
      value: criticalCount.toString(),
      current: criticalCount,
      max: totalProducts,
      color: criticalCount > 0 ? '#EF4444' : '#7BB35F',
    },
  ]

  return (
    <div className="space-y-5 py-1">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground/70 w-36 shrink-0">{row.label}</span>
          <ProgressBar value={row.current} max={row.max} color={row.color} />
          <span className="text-sm font-bold text-foreground w-14 text-right">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
