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
    <div className="bg-black/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#7BB35F] shadow-[0_0_8px_#7BB35F]" />
        <p className="text-lg font-black text-foreground drop-shadow-sm">{formatCurrency(payload[0].value)}</p>
      </div>
    </div>
  )
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const c = useChartColors()

  if (loading) {
    return (
      <div className="h-[320px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30">Nessun dato disponibile</p>
      </div>
    )
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7BB35F" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7BB35F" stopOpacity={0} />
            </linearGradient>
            
            {/* Legend glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <CartesianGrid
            strokeDasharray="4 4"
            stroke={c.grid}
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fontWeight: 700, fill: c.tick }}
            tickLine={false}
            axisLine={false}
            dy={15}
          />
          <YAxis
            tick={{ fontSize: 10, fontWeight: 700, fill: c.tick }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${v}`}
            dx={-10}
          />
          
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: 'rgba(123, 179, 95, 0.2)', strokeWidth: 2 }} 
          />
          
          <Area
            type="monotone"
            dataKey="total"
            stroke="#7BB35F"
            strokeWidth={4}
            fill="url(#revenueGradient)"
            filter="url(#glow)"
            animationDuration={2000}
            dot={false}
            activeDot={{
              r: 6,
              fill: '#7BB35F',
              stroke: c.dotStroke,
              strokeWidth: 2,
              className: "shadow-2xl"
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
