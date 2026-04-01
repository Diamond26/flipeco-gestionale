'use client'

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useChartColors } from '@/lib/useChartColors'

interface StockAlertChartProps {
  totalProducts: number
  criticalCount: number
  loading?: boolean
}

export function StockAlertChart({ totalProducts, criticalCount, loading }: StockAlertChartProps) {
  const c = useChartColors()
  if (loading) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <div className="h-full w-full skeleton-shimmer rounded-xl" />
      </div>
    )
  }

  if (totalProducts === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <p className="text-sm text-foreground/40">Nessun prodotto in magazzino.</p>
      </div>
    )
  }

  const healthyPct = Math.round(((totalProducts - criticalCount) / totalProducts) * 100)
  const isCritical = criticalCount > 0
  const fillColor = isCritical ? '#EF4444' : '#7BB35F'

  const chartData = [{ name: 'Salute', value: healthyPct, fill: fillColor }]

  return (
    <div className="h-[280px] flex flex-col items-center justify-center gap-3">
      <div className="relative w-[180px] h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="75%"
            outerRadius="100%"
            barSize={14}
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: c.grid, opacity: 0.3 }}
              dataKey="value"
              cornerRadius={10}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{healthyPct}%</span>
          <span className="text-[10px] text-foreground/40 font-medium uppercase tracking-wider">ok</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {isCritical ? (
          <>
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-foreground/70">
              <strong className="text-red-600">{criticalCount}</strong> prodott{criticalCount === 1 ? 'o' : 'i'} con scorta {'<'} 3
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-brand" />
            <span className="text-foreground/70">Tutte le scorte sono in ordine</span>
          </>
        )}
      </div>
    </div>
  )
}
