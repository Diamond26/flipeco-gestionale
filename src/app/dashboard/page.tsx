'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package, Archive, CreditCard, ShoppingBag, Calendar, CheckCircle2, Clock } from 'lucide-react'
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
  customer_orders?: { customer_name?: string; status?: string } | null
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
// Stat card component — circular colored icon style
// ---------------------------------------------------------------------------

const STAT_STYLES = [
  { bg: 'bg-blue-100 dark:bg-blue-500/20', icon: 'text-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: 'text-emerald-500' },
  { bg: 'bg-violet-100 dark:bg-violet-500/20', icon: 'text-violet-500' },
  { bg: 'bg-orange-100 dark:bg-orange-500/20', icon: 'text-orange-500' },
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
  const style = STAT_STYLES[colorIndex % STAT_STYLES.length]
  return (
    <div
      className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.06] px-5 py-5 flex items-center gap-4 animate-fade-in"
      style={{ animationDelay: animDelay }}
    >
      <div className={cn('flex items-center justify-center h-[52px] w-[52px] rounded-full shrink-0', style.bg)}>
        <Icon size={24} className={style.icon} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-foreground/50 font-medium truncate">{label}</p>
        {loading ? (
          <div className="mt-1 h-9 w-20 skeleton-shimmer" />
        ) : (
          <p className="text-[32px] font-extrabold text-foreground leading-none mt-0.5">{value}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge for sales
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status?: string | null }) {
  if (status === 'completed' || status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-3 py-1 rounded-full">
        Completato
        <CheckCircle2 size={14} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 px-3 py-1 rounded-full">
      In attesa
      <Clock size={14} />
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
              ? 'bg-card shadow-sm text-foreground'
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

  // --- Fetch base stats ---
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
        supabase
          .from('sales')
          .select('total, created_at')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('sale_items')
          .select('quantity, sale_id, product_id, sales!inner(created_at), product_registry!inner(name)')
          .gte('sales.created_at', since.toISOString()),
        supabase
          .from('inventory')
          .select('quantity'),
      ])

      // --- Revenue by day ---
      const revenueMap = new Map<string, number>()
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
                    <th className="py-3 px-3 whitespace-nowrap">Cliente</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Totale</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Stato</th>
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
                      <td className="py-3.5 px-3 text-foreground font-medium whitespace-nowrap">
                        {sale.customer_orders?.customer_name || 'Cliente'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <StatusBadge status={sale.payment_method ? 'completed' : 'pending'} />
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
