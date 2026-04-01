'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

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
    <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg shadow-black/10 border border-white/60 px-4 py-3">
      <p className="text-xs text-foreground/50 font-medium mb-1">{label}</p>
      <p className="text-sm font-bold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
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
        <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#CCD0D5" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={{ stroke: '#CCD0D5' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#7BB35F"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#7BB35F', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#7BB35F', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
