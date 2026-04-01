'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

interface TopProduct {
  name: string
  quantity: number
}

interface TopProductsChartProps {
  data: TopProduct[]
  loading?: boolean
}

const BAR_COLORS = ['#7BB35F', '#8DC46F', '#9FD080', '#B1DC91', '#C3E8A2']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg shadow-black/10 border border-white/60 px-4 py-3">
      <p className="text-xs text-foreground/50 font-medium mb-1 max-w-[200px] truncate">
        {payload[0].payload.name}
      </p>
      <p className="text-sm font-bold text-foreground">
        {payload[0].value} vendut{payload[0].value === 1 ? 'o' : 'i'}
      </p>
    </div>
  )
}

export function TopProductsChart({ data, loading }: TopProductsChartProps) {
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
        <p className="text-sm text-foreground/40">Nessuna vendita nel periodo selezionato.</p>
      </div>
    )
  }

  const truncatedData = data.map((d) => ({
    ...d,
    shortName: d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name,
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={truncatedData}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#CCD0D5" strokeOpacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={{ stroke: '#CCD0D5' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#CCD0D5', fillOpacity: 0.2 }} />
          <Bar dataKey="quantity" radius={[0, 6, 6, 0]} barSize={24}>
            {truncatedData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
