'use client'

import { useEffect, useState } from 'react'
import { Package, Archive, CreditCard, ShoppingBag } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
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

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)

        // Today's date boundaries (ISO strings, local midnight → end of day)
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
          // 1. Count of product_registry rows
          supabase
            .from('product_registry')
            .select('id', { count: 'exact', head: true }),

          // 2. Sum of inventory quantities
          supabase
            .from('inventory')
            .select('quantity'),

          // 3. Count of sales created today
          supabase
            .from('sales')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),

          // 4. Count of pending customer orders
          supabase
            .from('customer_orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),

          // 5. Last 5 sales
          supabase
            .from('sales')
            .select('id, created_at, payment_method, total')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        // Compute total inventory quantity
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
