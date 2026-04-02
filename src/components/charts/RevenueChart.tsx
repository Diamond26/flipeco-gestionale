'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useChartColors } from '@/lib/useChartColors'

interface RevenueDataPoint {
  date: string
  total: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  loading?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card/95 backdrop-blur-xl rounded-xl shadow-lg shadow-black/10 border border-white/60 dark:border-white/[0.08] px-4 py-3">
      <p className="text-xs text-foreground/50 font-medium mb-1">{label}</p>
      <p className="text-sm font-bold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const c = useChartColors()

  if (loading) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <div className="h-full w-full skeleton-shimmer rounded-xl" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <p className="text-sm text-foreground/40">Nessun dato disponibile per il periodo selezionato.</p>
      </div>
    )
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7BB35F" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7BB35F" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: c.tick }}
            tickLine={false}
            axisLine={{ stroke: c.axis }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.tick }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#7BB35F"
            strokeWidth={2.5}
            fill="url(#revenueGradient)"
            dot={{ r: 4, fill: '#7BB35F', strokeWidth: 2, stroke: c.dotStroke }}
            activeDot={{ r: 6, fill: '#7BB35F', strokeWidth: 2, stroke: c.dotStroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
