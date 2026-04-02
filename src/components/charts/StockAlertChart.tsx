'use client'

interface StockAlertChartProps {
  totalProducts: number
  criticalCount: number
  loading?: boolean
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="relative h-2.5 flex-1 rounded-full bg-black/10 dark:bg-white/[0.03] overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(123,179,95,0.2)]"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function StockAlertChart({ totalProducts, criticalCount, loading }: StockAlertChartProps) {
  if (loading) {
    return (
      <div className="space-y-6 py-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    )
  }

  if (totalProducts === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30">Nessun dato magazzino</p>
      </div>
    )
  }

  const healthyCount = totalProducts - criticalCount
  const healthyPct = Math.round((healthyCount / totalProducts) * 100)

  const rows = [
    {
      label: 'Salute Magazzino',
      value: `${healthyPct}%`,
      current: healthyCount,
      max: totalProducts,
      color: '#7BB35F',
      sub: `${healthyCount} su ${totalProducts} prodotti OK`
    },
    {
      label: 'Articoli Critici',
      value: criticalCount.toString(),
      current: criticalCount,
      max: totalProducts,
      color: criticalCount > 0 ? '#EF4444' : '#7BB35F',
      sub: criticalCount > 0 ? `${criticalCount} prodotti sotto soglia` : 'Scorte ottimali'
    },
  ]

  return (
    <div className="space-y-8 py-2">
      {rows.map((row, i) => (
        <div key={i} className="group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-foreground tracking-tight">{row.label}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30">{row.sub}</span>
            </div>
            <span className="text-[14px] font-black text-foreground tabular-nums">{row.value}</span>
          </div>
          <ProgressBar value={row.current} max={row.max} color={row.color} />
        </div>
      ))}
    </div>
  )
}
