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
  return (
    <div
      className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-surface/50 dark:border-white/[0.06] p-6 flex flex-col gap-4 relative overflow-hidden group transition-all duration-500 hover:scale-[1.02] animate-fade-in"
      style={{ animationDelay: animDelay }}
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand/5 rounded-full blur-2xl group-hover:bg-brand/10 transition-colors" />

      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="absolute inset-0 bg-brand blur-md opacity-20 rounded-full animate-pulse" />
          <div className="relative bg-brand/10 p-3 rounded-2xl border border-brand/20">
            <Icon size={24} className="text-brand relative z-10" />
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40 mb-1">{label}</p>
        {loading ? (
          <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight drop-shadow-sm">{value}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge for sales
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status?: string | null }) {
  const isCompleted = status === 'completed' || status === 'paid'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all duration-300',
        isCompleted
          ? 'bg-[#7BB35F]/10 text-[#7BB35F] border-[#7BB35F]/20 shadow-[0_0_15px_rgba(123,179,95,0.1)]'
          : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
      )}
    >
      {isCompleted ? 'Completato' : 'In attesa'}
      {isCompleted ? <CheckCircle2 size={12} className="opacity-70" /> : <Clock size={12} className="opacity-70" />}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Time period selector
// ---------------------------------------------------------------------------

function PeriodSelector({ value, onChange }: { value: TimePeriod; onChange: (v: TimePeriod) => void }) {
  return (
    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/[0.03] backdrop-blur-md rounded-2xl p-1.5 border border-black/[0.04] dark:border-white/[0.06]">
      {(['7d', '30d'] as const).map((periodKey) => (
        <button
          key={periodKey}
          onClick={() => onChange(periodKey)}
          className={cn(
            'px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300',
            value === periodKey
              ? 'bg-[#7BB35F] text-white shadow-[0_5px_15px_rgba(123,179,95,0.3)]'
              : 'text-foreground/60 dark:text-foreground/40 hover:text-foreground'
          )}
        >
          {periodKey === '7d' ? '7 giorni' : '30 giorni'}
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
      {/* Background Aurora Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-100">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[160px] animate-pulse [animation-delay:2s]" />
      </div>

      <div className="relative z-10 space-y-8">
        {/* Error banner */}
        {error && (
          <div role="alert" className="mb-6 rounded-3xl bg-danger/10 border border-danger/20 px-6 py-4 text-sm text-danger font-bold uppercase tracking-widest animate-slide-down">
            {error}
          </div>
        )}

        {/* Stat cards grid */}
        <section aria-label="Statistiche principali">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard label="Prodotti Anagrafica" value={stats.productRegistryCount} icon={Package} loading={loading} colorIndex={0} animDelay="0s" />
            <StatCard label="Articoli Magazzino" value={stats.inventoryTotalQty} icon={Archive} loading={loading} colorIndex={1} animDelay="0.05s" />
            <StatCard label="Vendite Oggi" value={stats.salesTodayCount} icon={CreditCard} loading={loading} colorIndex={2} animDelay="0.1s" />
            <StatCard label="Ordini in Corso" value={stats.pendingOrdersCount} icon={ShoppingBag} loading={loading} colorIndex={3} animDelay="0.15s" />
          </div>
        </section>

        {/* Charts Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="bg-brand/10 p-2 rounded-xl">
              <Calendar className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Analisi Performance</h2>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30">Dati aggiornati in tempo reale</p>
            </div>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {/* Charts grid */}
        <section aria-label="Grafici analitici" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue chart - larger span */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-surface/50 dark:border-white/[0.06] overflow-hidden">
            <div className="px-6 py-5 border-b border-surface/40 dark:border-white/[0.06] flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">Andamento Incassi</h3>
            </div>
            <div className="p-6">
              <RevenueChart data={revenueData} loading={chartsLoading} />
            </div>
          </div>

          <div className="space-y-6">
            {/* Top products */}
            <div className="bg-white/90 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-surface/50 dark:border-white/[0.06] overflow-hidden">
              <div className="px-6 py-5 border-b border-surface/40 dark:border-white/[0.06]">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">Top 5 Prodotti</h3>
              </div>
              <div className="p-6">
                <TopProductsChart data={topProducts} loading={chartsLoading} />
              </div>
            </div>

            {/* Stock alert */}
            <div className="bg-white/90 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-surface/50 dark:border-white/[0.06] overflow-hidden">
              <div className="px-6 py-5 border-b border-surface/40 dark:border-white/[0.06]">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">Stato Magazzino</h3>
              </div>
              <div className="p-6">
                <StockAlertChart totalProducts={stockTotal} criticalCount={stockCritical} loading={chartsLoading} />
              </div>
            </div>
          </div>
        </section>

        {/* Recent sales table */}
        <section aria-label="Ultime vendite">
          <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-surface/50 dark:border-white/[0.06] overflow-hidden">
            <div className="px-6 py-5 border-b border-surface/40 dark:border-white/[0.06] bg-surface-light/40 dark:bg-black/20 flex items-center gap-3">
              <Clock className="w-5 h-5 text-brand" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40 text-left">Ultime Operazioni</h3>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="space-y-4 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 skeleton-shimmer rounded-xl" style={{ animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              ) : recentSales.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm font-medium text-foreground/30 uppercase tracking-[0.2em]">Nessuna vendita registrata</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface/40 dark:border-white/[0.06]">
                        <th className="py-4 px-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Data Operazione</th>
                        <th className="py-4 px-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Anagrafica Cliente</th>
                        <th className="py-4 px-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Importo Totale</th>
                        <th className="py-4 px-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                      {recentSales.map((sale, index) => (
                        <tr
                          key={sale.id}
                          className="group hover:bg-brand/[0.04] transition-all duration-300 animate-fade-in cursor-default"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <td className="py-4 px-3">
                             <div className="flex flex-col">
                               <span className="font-bold text-foreground">{formatDate(sale.created_at).split(' ')[0]}</span>
                               <span className="text-[10px] font-bold text-foreground/30">{formatDate(sale.created_at).split(' ').slice(1).join(' ')}</span>
                             </div>
                          </td>
                          <td className="py-4 px-3">
                            <span className="font-extrabold text-foreground tracking-tight capitalize">
                              {sale.customer_orders?.customer_name || 'Vendita Diretta'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                             <span className="text-base font-black text-brand drop-shadow-sm">
                              {formatCurrency(sale.total)}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <StatusBadge status={sale.payment_method ? 'completed' : 'pending'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
