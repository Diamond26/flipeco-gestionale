'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package, Archive, CreditCard, ShoppingBag, Calendar } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TopProductsChart } from '@/components/charts/TopProductsChart'
import { StockAlertChart } from '@/components/charts/StockAlertChart'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  productRegistryCount: number
  inventoryTotalQty: number
  salesTodayCount: number
  pendingOrdersCount: number
}

interface RecentSale {
  id: string
  created_at: string
  payment_method: string | null
  total: number
}

interface RevenueDataPoint {
  date: string
  total: number
}

interface TopProduct {
  name: string
  quantity: number
}

type TimePeriod = '7d' | '30d'

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------

const STAT_COLORS = [
  { bg: 'bg-brand/10', icon: 'text-brand', ring: 'ring-brand/20' },
  { bg: 'bg-blue-500/10', icon: 'text-blue-500', ring: 'ring-blue-500/20' },
  { bg: 'bg-violet-500/10', icon: 'text-violet-500', ring: 'ring-violet-500/20' },
  { bg: 'bg-amber-500/10', icon: 'text-amber-500', ring: 'ring-amber-500/20' },
]

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  loading?: boolean
  colorIndex: number
  animDelay: string
}

function StatCard({ label, value, icon: Icon, loading = false, colorIndex, animDelay }: StatCardProps) {
  const color = STAT_COLORS[colorIndex % STAT_COLORS.length]
  return (
    <div
      className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 p-6 flex items-center gap-5 animate-fade-in"
      style={{ animationDelay: animDelay }}
    >
      <div className={cn('flex items-center justify-center h-14 w-14 rounded-2xl ring-1 shrink-0', color.bg, color.ring)}>
        <Icon size={26} className={color.icon} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground/50 font-medium truncate">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-8 w-24 skeleton-shimmer" />
        ) : (
          <p className="text-3xl font-bold text-foreground leading-none mt-1">{value}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment method badge
// ---------------------------------------------------------------------------

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Contanti',
  card: 'Carta',
  transfer: 'Bonifico',
  mixed: 'Misto',
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200',
  card: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',
  transfer: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200',
  mixed: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
}

function PaymentBadge({ method }: { method: string | null }) {
  const label = method ? (PAYMENT_LABELS[method] ?? method) : '—'
  const color = method ? (PAYMENT_COLORS[method] ?? 'bg-surface-light text-foreground/60') : 'bg-surface-light text-foreground/40'
  return (
    <span className={cn('inline-block rounded-full px-3 py-0.5 text-xs font-semibold', color)}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Time period selector
// ---------------------------------------------------------------------------

function PeriodSelector({ value, onChange }: { value: TimePeriod; onChange: (v: TimePeriod) => void }) {
  return (
    <div className="flex items-center gap-1 bg-surface-light/60 rounded-xl p-1">
      {([
        { key: '7d' as TimePeriod, label: '7 giorni' },
        { key: '30d' as TimePeriod, label: '30 giorni' },
      ]).map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
            value === opt.key
              ? 'bg-white shadow-sm text-foreground'
              : 'text-foreground/50 hover:text-foreground/70'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateNDaysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const supabase = createClient()

  const [stats, setStats] = useState<DashboardStats>({
    productRegistryCount: 0,
    inventoryTotalQty: 0,
    salesTodayCount: 0,
    pendingOrdersCount: 0,
  })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Charts state ---
  const [period, setPeriod] = useState<TimePeriod>('7d')
  const [chartsLoading, setChartsLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [stockTotal, setStockTotal] = useState(0)
  const [stockCritical, setStockCritical] = useState(0)

  // --- Fetch base stats (unchanged) ---
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const [
          productRegistryRes,
          inventoryRes,
          salesTodayRes,
          pendingOrdersRes,
          recentSalesRes,
        ] = await Promise.all([
          supabase
            .from('product_registry')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('inventory')
            .select('quantity'),
          supabase
            .from('sales')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),
          supabase
            .from('customer_orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('sales')
            .select('id, created_at, payment_method, total')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const inventoryTotalQty =
          inventoryRes.data?.reduce(
            (sum: number, row: { quantity: number }) => sum + (row.quantity ?? 0),
            0
          ) ?? 0

        setStats({
          productRegistryCount: productRegistryRes.count ?? 0,
          inventoryTotalQty,
          salesTodayCount: salesTodayRes.count ?? 0,
          pendingOrdersCount: pendingOrdersRes.count ?? 0,
        })

        setRecentSales((recentSalesRes.data as RecentSale[]) ?? [])
      } catch (err) {
        console.error('Dashboard fetch error:', err)
        setError('Errore nel caricamento dei dati. Riprova.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // --- Fetch chart data (reacts to period) ---
  const fetchChartData = useCallback(async () => {
    setChartsLoading(true)
    try {
      const days = period === '7d' ? 7 : 30
      const since = getDateNDaysAgo(days)

      const [salesRes, saleItemsRes, inventoryRes] = await Promise.all([
        // All sales in the period for revenue chart
        supabase
          .from('sales')
          .select('total, created_at')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true }),

        // Sale items with product name for top products
        supabase
          .from('sale_items')
          .select('quantity, sale_id, product_id, sales!inner(created_at), product_registry!inner(name)')
          .gte('sales.created_at', since.toISOString()),

        // Inventory for stock alert
        supabase
          .from('inventory')
          .select('quantity'),
      ])

      // --- Revenue by day ---
      const revenueMap = new Map<string, number>()
      // Pre-fill all days so chart has no gaps
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        revenueMap.set(key, 0)
      }
      for (const row of salesRes.data ?? []) {
        const key = row.created_at.slice(0, 10)
        revenueMap.set(key, (revenueMap.get(key) ?? 0) + Number(row.total))
      }
      setRevenueData(
        Array.from(revenueMap.entries()).map(([date, total]) => ({
          date: formatShortDate(date),
          total: Math.round(total * 100) / 100,
        }))
      )

      // --- Top 5 products ---
      const productMap = new Map<string, number>()
      for (const row of saleItemsRes.data ?? []) {
        const name = (row as any).product_registry?.name ?? 'Sconosciuto'
        productMap.set(name, (productMap.get(name) ?? 0) + row.quantity)
      }
      const sorted = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, quantity]) => ({ name, quantity }))
      setTopProducts(sorted)

      // --- Stock alert ---
      const invRows = inventoryRes.data ?? []
      setStockTotal(invRows.length)
      setStockCritical(invRows.filter((r: { quantity: number }) => r.quantity < 3).length)
    } catch (err) {
      console.error('Charts fetch error:', err)
    } finally {
      setChartsLoading(false)
    }
  }, [period, supabase])

  useEffect(() => {
    fetchChartData()
  }, [fetchChartData])

  return (
    <AppShell pageTitle="Dashboard">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-2xl bg-danger/10 border border-danger/20 px-5 py-3.5 text-sm text-danger font-medium animate-slide-down"
        >
          {error}
        </div>
      )}

      {/* Stat cards grid */}
      <section aria-label="Statistiche principali">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Prodotti in Anagrafica"
            value={stats.productRegistryCount}
            icon={Package}
            loading={loading}
            colorIndex={0}
            animDelay="0s"
          />
          <StatCard
            label="Articoli in Magazzino"
            value={stats.inventoryTotalQty}
            icon={Archive}
            loading={loading}
            colorIndex={1}
            animDelay="0.05s"
          />
          <StatCard
            label="Vendite Oggi"
            value={stats.salesTodayCount}
            icon={CreditCard}
            loading={loading}
            colorIndex={2}
            animDelay="0.1s"
          />
          <StatCard
            label="Ordini in Corso"
            value={stats.pendingOrdersCount}
            icon={ShoppingBag}
            loading={loading}
            colorIndex={3}
            animDelay="0.15s"
          />
        </div>
      </section>

      {/* Period selector */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-foreground/50">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">Periodo</span>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Charts grid */}
      <section aria-label="Grafici analitici" className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {/* Revenue chart */}
        <Card title="Andamento Incassi" className="lg:col-span-2">
          <RevenueChart data={revenueData} loading={chartsLoading} />
        </Card>

        {/* Top products */}
        <Card title="Top 5 Prodotti Venduti">
          <TopProductsChart data={topProducts} loading={chartsLoading} />
        </Card>

        {/* Stock alert */}
        <Card title="Salute Magazzino">
          <StockAlertChart
            totalProducts={stockTotal}
            criticalCount={stockCritical}
            loading={chartsLoading}
          />
        </Card>
      </section>

      {/* Recent sales table */}
      <section aria-label="Ultime vendite">
        <Card title="Ultime Vendite">
          {loading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          ) : recentSales.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/40">
              Nessuna vendita registrata.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface/30 text-left text-xs uppercase tracking-wider text-foreground/40 font-semibold">
                    <th className="py-3 px-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-3 whitespace-nowrap">Metodo Pagamento</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, index) => (
                    <tr
                      key={sale.id}
                      className={cn(
                        'hover:bg-brand/[0.03] animate-fade-in',
                        index !== recentSales.length - 1 && 'border-b border-surface/20'
                      )}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <td className="py-3.5 px-3 text-foreground/70 whitespace-nowrap">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="py-3.5 px-3">
                        <PaymentBadge method={sale.payment_method} />
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  )
}
