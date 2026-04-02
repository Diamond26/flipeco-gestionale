'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { ConfirmBanner } from '@/components/ui/ConfirmBanner'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { exportToPDF } from '@/lib/pdf-export'
import {
  Plus,
  FileDown,
  Search,
  X,
  Truck,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Package,
  Trash2,
  ClipboardList,
  ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus = 'ordered' | 'shipped' | 'arrived'

interface Supplier {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

interface ProductRegistry {
  id: string
  barcode: string
  name: string
  size: string
  color: string
  sku?: string | null
}

interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product_registry: ProductRegistry
}

interface PurchaseOrder {
  id: string
  supplier_id: string
  status: OrderStatus
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  suppliers: Supplier
  purchase_order_items: PurchaseOrderItem[]
}

// Draft item when building a new order
interface DraftItem {
  id: string // temporary client-side key
  product: ProductRegistry
  quantity: number
  unit_price: number
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<OrderStatus, string> = {
  ordered: 'Ordinato',
  shipped: 'Spedito',
  arrived: 'Arrivato',
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  ordered: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
  shipped: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
  arrived: 'bg-[#7BB35F]/10 text-[#7BB35F] border-[#7BB35F]/20 shadow-[0_0_15px_rgba(123,179,95,0.1)]',
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border',
        STATUS_BADGE[status]
      )}
    >
      {status === 'ordered' && <ShoppingCart className="w-3 h-3" />}
      {status === 'shipped' && <Truck className="w-3 h-3" />}
      {status === 'arrived' && <CheckCircle2 className="w-3 h-3" />}
      {STATUS_LABELS[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PurchaseOrdersPage() {
  const supabase = createClient()

  // --- Orders list state ---
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [tableLoading, setTableLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')

  // --- Detail modal state ---
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [pendingAction, setPendingAction] = useState<'shipped' | 'arrived' | 'create' | null>(null)

  // --- New order modal state ---
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productRegistry, setProductRegistry] = useState<ProductRegistry[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)

  // New order form fields
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [draftQty, setDraftQty] = useState('1')
  const [draftPrice, setDraftPrice] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch orders
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setTableLoading(true)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(*), purchase_order_items(*, product_registry(*))')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('Errore nel caricamento degli ordini', 'error')
    } else {
      setOrders((data as PurchaseOrder[]) ?? [])
    }
    setTableLoading(false)
  }, [supabase, showToast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // ---------------------------------------------------------------------------
  // Fetch suppliers + products for new order modal
  // ---------------------------------------------------------------------------

  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true)
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (!error) setSuppliers((data as Supplier[]) ?? [])
    setSuppliersLoading(false)
  }, [supabase])

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    const { data, error } = await supabase
      .from('product_registry')
      .select('*')
      .order('name')
    if (!error) setProductRegistry((data as ProductRegistry[]) ?? [])
    setProductsLoading(false)
  }, [supabase])

  const openNewOrderModal = useCallback(() => {
    setNewOrderOpen(true)
    setSelectedSupplierId('')
    setDraftItems([])
    setSelectedProductId('')
    setDraftQty('1')
    setDraftPrice('')
    setOrderNotes('')
    fetchSuppliers()
    fetchProducts()
  }, [fetchSuppliers, fetchProducts])

  // ---------------------------------------------------------------------------
  // Draft item management
  // ---------------------------------------------------------------------------

  const handleAddDraftItem = useCallback(() => {
    if (!selectedProductId) {
      showToast('Seleziona un prodotto', 'warning')
      return
    }
    const qty = parseInt(draftQty, 10)
    if (!qty || qty <= 0) {
      showToast('Inserisci una quantità valida', 'warning')
      return
    }
    const product = productRegistry.find((p) => p.id === selectedProductId)
    if (!product) return

    const price = parseFloat(draftPrice) || 0

    // If the same product is already in the list, increment qty instead
    setDraftItems((prev) => {
      const existing = prev.find((i) => i.product.id === selectedProductId)
      if (existing) {
        return prev.map((i) =>
          i.product.id === selectedProductId
            ? { ...i, quantity: i.quantity + qty, unit_price: price || i.unit_price }
            : i
        )
      }
      return [
        ...prev,
        {
          id: `${selectedProductId}-${Date.now()}`,
          product,
          quantity: qty,
          unit_price: price,
        },
      ]
    })

    setSelectedProductId('')
    setDraftQty('1')
    setDraftPrice('')
  }, [selectedProductId, draftQty, draftPrice, productRegistry, showToast])

  const handleRemoveDraftItem = useCallback((itemId: string) => {
    setDraftItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const handleDraftQtyChange = useCallback((itemId: string, value: string) => {
    const qty = parseInt(value, 10)
    if (isNaN(qty) || qty <= 0) return
    setDraftItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i)))
  }, [])

  const handleDraftPriceChange = useCallback((itemId: string, value: string) => {
    const price = parseFloat(value)
    setDraftItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, unit_price: isNaN(price) ? 0 : price } : i))
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Derived: draft total
  // ---------------------------------------------------------------------------

  const draftTotal = draftItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  // ---------------------------------------------------------------------------
  // Create order
  // ---------------------------------------------------------------------------

  const handleCreateOrder = useCallback(async () => {
    if (!selectedSupplierId) {
      showToast('Seleziona un fornitore', 'warning')
      return
    }
    if (draftItems.length === 0) {
      showToast('Aggiungi almeno un prodotto', 'warning')
      return
    }

    setCreateLoading(true)

    // Insert purchase_orders row
    const { data: orderData, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: selectedSupplierId,
        status: 'ordered' as OrderStatus,
        total: draftTotal,
        notes: orderNotes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError || !orderData) {
      showToast('Errore durante la creazione dell\'ordine', 'error')
      setCreateLoading(false)
      return
    }

    const orderId = (orderData as { id: string }).id

    // Insert purchase_order_items rows
    const itemsPayload = draftItems.map((item) => ({
      purchase_order_id: orderId,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsPayload)

    setCreateLoading(false)

    if (itemsError) {
      showToast('Ordine creato ma errore nell\'inserimento degli articoli', 'error')
    } else {
      showToast('Ordine acquisto creato con successo', 'success')
      setNewOrderOpen(false)
      fetchOrders()
    }
  }, [selectedSupplierId, draftItems, draftTotal, orderNotes, supabase, showToast, fetchOrders])

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  const handleMarkShipped = useCallback(async () => {
    if (!selectedOrder) return
    setStatusUpdating(true)

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'shipped', updated_at: new Date().toISOString() })
      .eq('id', selectedOrder.id)

    setStatusUpdating(false)

    if (error) {
      showToast('Errore durante l\'aggiornamento dello stato', 'error')
      return
    }

    showToast('Ordine segnato come Spedito', 'success')
    setSelectedOrder(null)
    fetchOrders()
  }, [selectedOrder, supabase, showToast, fetchOrders])

  const handleMarkArrived = useCallback(async () => {
    if (!selectedOrder) return
    setStatusUpdating(true)

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'arrived', updated_at: new Date().toISOString() })
      .eq('id', selectedOrder.id)

    setStatusUpdating(false)

    if (error) {
      showToast('Errore durante l\'aggiornamento dello stato', 'error')
      return
    }

    showToast('Merce arrivata! Inventario aggiornato automaticamente.', 'success')
    setSelectedOrder(null)
    fetchOrders()
  }, [selectedOrder, supabase, showToast, fetchOrders])

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  const handleExportPDF = useCallback(() => {
    const snapshot = orders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter
      const matchesSearch =
        !searchQuery.trim() ||
        o.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
    exportToPDF({
      title: 'Ordini Acquisto — Flip&Co',
      headers: ['ID', 'Fornitore', 'Stato', 'Articoli', 'Totale', 'Data'],
      rows: snapshot.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        o.suppliers?.name ?? '—',
        STATUS_LABELS[o.status],
        o.purchase_order_items?.length ?? 0,
        formatCurrency(o.total),
        formatDate(o.created_at),
      ]),
      filename: `ordini_acquisto_${new Date().toISOString().slice(0, 10)}`,
    })
  }, [orders, statusFilter, searchQuery])

  // ---------------------------------------------------------------------------
  // Derived: filtered orders
  // ---------------------------------------------------------------------------

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    const matchesSearch =
      !searchQuery.trim() ||
      o.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalOrders = orders.length
  const orderedCount = orders.filter((o) => o.status === 'ordered').length
  const shippedCount = orders.filter((o) => o.status === 'shipped').length
  const arrivedCount = orders.filter((o) => o.status === 'arrived').length

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      key: 'id',
      header: 'ID',
      className: 'w-28',
      render: (row: PurchaseOrder) => (
        <span className="font-mono text-xs text-foreground/60 tracking-wide">
          #{row.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Fornitore',
      render: (row: PurchaseOrder) => (
        <span className="font-semibold text-foreground">{row.suppliers?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Stato',
      render: (row: PurchaseOrder) => <StatusBadge status={row.status} />,
    },
    {
      key: 'items',
      header: 'Articoli',
      className: 'w-24 text-center',
      render: (row: PurchaseOrder) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface text-xs font-bold text-foreground">
          {row.purchase_order_items?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Totale',
      render: (row: PurchaseOrder) => (
        <span className="font-bold text-brand">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (row: PurchaseOrder) => (
        <span className="text-foreground/60 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: () => (
        <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-brand transition-colors" />
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Product options for select
  // ---------------------------------------------------------------------------

  const productOptions = productRegistry.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.size} / ${p.color}${p.barcode ? ` (${p.barcode})` : ''}`,
  }))

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }))

  const statusFilterOptions = [
    { value: 'all', label: 'Tutti gli stati' },
    { value: 'ordered', label: 'Ordinato' },
    { value: 'shipped', label: 'Spedito' },
    { value: 'arrived', label: 'Arrivato' },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell pageTitle="Ordini Acquisto">
      {/* ------------------------------------------------------------------ */}
      {/* Toast notifications                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1] bg-slate-50 dark:bg-[#0c1222] transition-colors duration-500">
        <div className="absolute top-[-15%] right-[-5%] w-[800px] h-[800px] bg-[#7BB35F]/20 dark:bg-[#7BB35F]/10 rounded-full blur-[160px] opacity-40 dark:opacity-70" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#7BB35F]/15 dark:bg-[#7BB35F]/5 rounded-full blur-[140px] opacity-30 dark:opacity-50" />
      </div>

      <div className="space-y-8 max-w-[1400px] mx-auto animate-fade-in relative z-10 pt-2 lg:pt-6">
        {/* ------------------------------------------------------------------ */}
        {/* Header / Top Bar Premium                                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-wide">Flip&amp;Co</h1>
            <p className="text-[13px] text-foreground/40 tracking-widest uppercase mt-1">Purchase &amp; Supply Management</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
             <button
               onClick={handleExportPDF}
               className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/60 dark:bg-white/[0.03] border border-surface backdrop-blur-md text-foreground/70 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-sm"
             >
               <FileDown className="w-4 h-4 text-[#7BB35F]" />
               Esporta PDF
             </button>
             <button
               onClick={openNewOrderModal}
               className="flex items-center gap-2 bg-[#7BB35F] hover:bg-[#6CAE4A] hover:scale-[1.02] active:scale-95 transition-all text-white px-8 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(123,179,95,0.4)]"
             >
               <Plus className="w-5 h-5" />
               Nuovo Ordine Acquisto
             </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5 flex items-center gap-5 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/80 dark:from-white/[0.04] to-transparent group transition-all duration-300 hover:scale-[1.02]">
            <div className="relative w-12 h-12 rounded-full bg-brand/20 dark:bg-brand/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-brand animate-pulse blur-md opacity-20 group-hover:opacity-40 rounded-full" />
               <ClipboardList className="w-6 h-6 text-brand relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">Totale Ordini</p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5 flex items-center gap-5 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/80 dark:from-white/[0.04] to-transparent group transition-all duration-300 hover:scale-[1.02]">
            <div className="relative w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-blue-500 animate-pulse blur-md opacity-20 group-hover:opacity-40 rounded-full" />
               <ShoppingCart className="w-6 h-6 text-blue-500 relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">Ordinati</p>
              <p className="text-2xl font-bold text-blue-500">{orderedCount}</p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5 flex items-center gap-5 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/80 dark:from-white/[0.04] to-transparent group transition-all duration-300 hover:scale-[1.02]">
            <div className="relative w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-amber-500 animate-pulse blur-md opacity-20 group-hover:opacity-40 rounded-full" />
               <Truck className="w-6 h-6 text-amber-500 relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">In Transito</p>
              <p className="text-2xl font-bold text-amber-500">{shippedCount}</p>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5 flex items-center gap-5 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/80 dark:from-white/[0.04] to-transparent group transition-all duration-300 hover:scale-[1.02]">
            <div className="relative w-12 h-12 rounded-full bg-emerald-100 dark:bg-[#7BB35F]/20 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-[#7BB35F] animate-pulse blur-md opacity-20 group-hover:opacity-40 rounded-full" />
               <CheckCircle2 className="w-6 h-6 text-[#7BB35F] relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">Arrivati</p>
              <p className="text-2xl font-bold text-[#7BB35F]">{arrivedCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Orders table card                                                  */}
        {/* ---------------------------------------------------------------- */}
        {/* ---------------------------------------------------------------- */}
        {/* Orders table card                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-black/[0.04] dark:border-white/[0.06] overflow-hidden relative z-10 transition-all duration-500">
          <div className="px-6 py-5 border-b border-black/[0.04] dark:border-white/[0.06] bg-surface-light/30 dark:bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="relative">
                 <div className="absolute inset-0 bg-brand blur-md opacity-20 rounded-full animate-pulse" />
                 <ClipboardList className="w-6 h-6 text-brand relative z-10" />
               </div>
               <h2 className="text-xl font-bold text-foreground drop-shadow-sm">Elenco Ordini Acquisto</h2>
             </div>
          </div>

          <div className="p-6">
            {/* Search + filter bar */}
            <div className="flex flex-col xl:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/60 dark:bg-white/[0.03] rounded-full border border-surface backdrop-blur-md shadow-sm transition-colors group-hover:bg-white/80 dark:group-hover:bg-white/[0.05]" />
                  <div className="relative flex items-center p-1.5 pl-6">
                    <Search className="w-5 h-5 text-[#7BB35F] mr-3 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cerca fornitore o ID ordine..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none text-foreground focus:outline-none focus:ring-0 placeholder:text-foreground/30 text-[15px]"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="p-2 text-foreground/30 hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {statusFilterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value as OrderStatus | 'all')}
                    className={cn(
                      'px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border shadow-sm',
                      statusFilter === opt.value
                        ? 'bg-[#7BB35F] text-white border-[#7BB35F] shadow-[0_5px_15px_rgba(123,179,95,0.3)]'
                        : 'bg-white/60 dark:bg-white/[0.03] text-foreground/50 border-surface hover:border-[#7BB35F]/40'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {tableLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                <p className="text-sm font-medium text-foreground/40 animate-pulse uppercase tracking-widest text-[11px]">Caricamento in corso...</p>
              </div>
            ) : (
              <Table
                columns={columns}
                data={filteredOrders}
                emptyMessage={
                  searchQuery || statusFilter !== 'all'
                    ? 'Nessun ordine trovato con i filtri selezionati.'
                    : 'Nessun ordine di acquisto. Clicca "Nuovo Ordine" per iniziare.'
                }
                onRowClick={(row) => setSelectedOrder(row as unknown as PurchaseOrder)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* NEW ORDER MODAL                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        title="Nuovo Ordine Acquisto"
        size="xl"
      >
        <div className="space-y-5">
          {/* Supplier selection */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
              1. Fornitore
            </h4>
            {suppliersLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground/50 py-2">
                <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                Caricamento fornitori...
              </div>
            ) : (
              <Select
                label="Seleziona Fornitore"
                options={supplierOptions}
                placeholder="— Scegli un fornitore —"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              />
            )}
          </div>

          {/* Product selection row */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
              2. Aggiungi Prodotti
            </h4>

            {productsLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground/50 py-2">
                <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                Caricamento prodotti...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <Select
                    label="Prodotto"
                    options={productOptions}
                    placeholder="— Scegli un prodotto —"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <Input
                    label="Quantità"
                    type="number"
                    min="1"
                    step="1"
                    value={draftQty}
                    onChange={(e) => setDraftQty(e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    label="Prezzo unit. (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleAddDraftItem}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Aggiungi
                </Button>
              </div>
            )}
          </div>

          {/* Draft items table */}
          {draftItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                3. Riepilogo Articoli
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-surface/20">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface/20">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Prodotto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 w-20">
                        Taglia
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 w-24">
                        Colore
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 w-28">
                        Qtà
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 w-32">
                        Prezzo Unit.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50 w-28">
                        Totale
                      </th>
                      <th className="px-4 py-3 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((item, i) => (
                      <tr
                        key={item.id}
                        className={cn(
                          'border-t border-surface/20 hover:bg-brand/[0.04] transition-colors',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20'
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {item.product.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-xs font-semibold">
                            {item.product.size}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {item.product.color}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => handleDraftQtyChange(item.id, e.target.value)}
                            className={cn(
                              'w-20 px-2 py-1.5 text-sm rounded-lg border border-surface/80 bg-card shadow-sm',
                              'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15',
                              'text-center font-semibold transition-all duration-150'
                            )}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-foreground/40 text-sm">€</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price === 0 ? '' : item.unit_price}
                              placeholder="0.00"
                              onChange={(e) => handleDraftPriceChange(item.id, e.target.value)}
                              className={cn(
                                'w-24 px-2 py-1.5 text-sm rounded-lg border border-surface/80 bg-card shadow-sm',
                                'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15',
                                'transition-all duration-150'
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-brand text-sm">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveDraftItem(item.id)}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-foreground/40 hover:text-danger transition-colors"
                            aria-label="Rimuovi riga"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface/20 bg-surface/10">
                      <td
                        colSpan={5}
                        className="px-4 py-3 text-right text-sm font-bold text-foreground"
                      >
                        Totale Ordine
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-lg font-bold text-brand">
                          {formatCurrency(draftTotal)}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Note (opzionale)
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Istruzioni di consegna, riferimenti interni, ecc."
              rows={3}
              className={cn(
                'w-full px-4 py-3 text-sm rounded-xl border border-surface/80 bg-card shadow-sm',
                'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15',
                'placeholder:text-gray-400 transition-all duration-200 resize-none'
              )}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2 border-t border-surface/20">
            <Button
              variant="primary"
              size="lg"
              loading={createLoading}
              onClick={() => setPendingAction('create')}
              className="flex-1"
            >
              <ClipboardList className="w-5 h-5 mr-2" />
              Crea Ordine Acquisto
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setNewOrderOpen(false)}
              disabled={createLoading}
            >
              Annulla
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* ORDER DETAIL MODAL                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Ordine #${selectedOrder?.id.slice(0, 8).toUpperCase() ?? ''}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Header info strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2">
                  Fornitore
                </p>
                <p className="font-bold text-foreground text-lg">{selectedOrder.suppliers?.name ?? '—'}</p>
                {selectedOrder.suppliers?.email && (
                  <p className="text-xs text-brand font-medium mt-1">
                    {selectedOrder.suppliers.email}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2">
                  Stato Attuale
                </p>
                <div className="pt-1">
                   <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-2">
                  Data Ordine
                </p>
                <p className="font-bold text-foreground text-lg">
                  {formatDate(selectedOrder.created_at)}
                </p>
              </div>
            </div>

            {/* Status flow indicator */}
            <div className="flex items-center gap-2 py-6 px-4 bg-white/20 dark:bg-black/20 rounded-3xl border border-black/[0.04] dark:border-white/[0.06]">
              {(['ordered', 'shipped', 'arrived'] as OrderStatus[]).map((step, idx) => {
                const steps: OrderStatus[] = ['ordered', 'shipped', 'arrived']
                const currentIdx = steps.indexOf(selectedOrder.status)
                const isCompleted = idx < currentIdx
                const isCurrent = idx === currentIdx
                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 relative',
                          isCompleted && 'bg-brand border-brand text-white shadow-[0_0_15px_rgba(123,179,95,0.4)]',
                          isCurrent && 'bg-white dark:bg-gray-900 border-brand text-brand shadow-[0_0_15px_rgba(123,179,95,0.2)] scale-110',
                          !isCompleted && !isCurrent && 'bg-white/40 dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground/30'
                        )}
                      >
                        {isCurrent && <div className="absolute inset-0 bg-brand/20 animate-ping rounded-full" />}
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 relative z-10" />
                        ) : (
                          <span className="relative z-10">{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-widest',
                          isCurrent && 'text-brand',
                          isCompleted && 'text-brand/70',
                          !isCompleted && !isCurrent && 'text-foreground/30'
                        )}
                      >
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        className={cn(
                          'h-0.5 flex-1 max-w-[40px] rounded-full mb-6 transition-colors duration-500',
                          idx < currentIdx ? 'bg-brand shadow-[0_0_10px_rgba(123,179,95,0.4)]' : 'bg-black/10 dark:bg-white/10'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Items table */}
            <div className="bg-white/40 dark:bg-white/[0.01] rounded-3xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
              <div className="px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.06] bg-surface-light/30 dark:bg-black/20">
                 <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40">
                   Articoli Ordinati
                 </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                      <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/40">Prodotto</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/40 w-20">Taglia</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/40 w-24">Colore</th>
                      <th className="px-5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-foreground/40 w-20">Qtà</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-foreground/40 w-28">P. Unit</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-foreground/40 w-28">Totale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                    {selectedOrder.purchase_order_items?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-foreground/30 font-medium">Nessun articolo in questo ordine</td>
                      </tr>
                    ) : (
                      selectedOrder.purchase_order_items?.map((item, i) => (
                        <tr key={item.id} className="hover:bg-brand/[0.04] transition-colors">
                          <td className="px-5 py-4 font-bold text-foreground">{item.product_registry?.name ?? '—'}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface/40 border border-surface text-[11px] font-bold text-foreground/70 tracking-tighter">
                              {item.product_registry?.size ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-foreground/60">{item.product_registry?.color ?? '—'}</td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand font-bold">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-foreground/50">{formatCurrency(item.unit_price)}</td>
                          <td className="px-5 py-4 text-right font-bold text-brand">{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-surface-light/30 dark:bg-black/20">
                    <tr>
                      <td colSpan={5} className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-foreground/40">Totale Ordine</td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-xl font-black text-brand drop-shadow-sm">{formatCurrency(selectedOrder.total)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            {/* Action buttons — status flow */}
            <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.06] space-y-4">
              {/* CRITICAL: Merce Arrivata — visible when ordered or shipped */}
              {(selectedOrder.status === 'ordered' || selectedOrder.status === 'shipped') && (
                <button
                  onClick={() => setPendingAction('arrived')}
                  disabled={statusUpdating}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl',
                    'text-white text-lg font-extrabold tracking-widest uppercase',
                    'bg-gradient-to-r from-[#7BB35F] to-[#6CAE4A] hover:scale-[1.01] active:scale-95',
                    'shadow-[0_10px_30px_rgba(123,179,95,0.4)]',
                    'transition-all duration-300 transform',
                    'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
                  )}
                  aria-label="Conferma arrivo della merce e aggiorna inventario"
                >
                  {statusUpdating ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Package className="w-6 h-6 drop-shadow-md" />
                  )}
                  Merce Arrivata — Aggiorna Inventario
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Segna come Spedito — only when ordered */}
                {selectedOrder.status === 'ordered' && (
                  <button
                    onClick={() => setPendingAction('shipped')}
                    disabled={statusUpdating}
                    className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-black/[0.1] dark:border-white/[0.1] text-foreground/80 hover:bg-white/90 dark:hover:bg-white/10 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    {statusUpdating ? (
                      <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                    ) : (
                      <Truck className="w-4 h-4 text-brand" />
                    )}
                    Segna come Spedito
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrder(null)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl border border-transparent font-bold text-xs uppercase tracking-widest transition-all",
                    selectedOrder.status === 'ordered' ? 'bg-black/5 dark:bg-white/5 text-foreground/40 hover:text-foreground' : 'w-full bg-black/5 dark:bg-white/5 text-foreground/40 hover:text-foreground'
                  )}
                >
                  Chiudi Schermata
                </button>
              </div>

              {/* Arrived state — read-only info */}
              {selectedOrder.status === 'arrived' && (
                <div className="flex items-center gap-4 p-5 rounded-3xl bg-[#7BB35F]/10 border border-[#7BB35F]/20 shadow-inner">
                  <div className="w-10 h-10 rounded-full bg-[#7BB35F]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-[#7BB35F]" />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-[#7BB35F] tracking-wide uppercase text-xs">Merce Ricevuta Correttamente</p>
                    <p className="text-foreground/60 mt-1 leading-relaxed">
                      L'inventario è stato aggiornato. I prodotti di questo ordine sono ora disponibili per la vendita.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm banner — purchase order actions */}
      <ConfirmBanner
        open={!!pendingAction}
        variant={pendingAction === 'arrived' ? 'warning' : 'default'}
        message={
          pendingAction === 'create'
            ? 'Confermi la creazione di questo ordine di acquisto?'
            : pendingAction === 'shipped'
              ? 'Segnare questo ordine come spedito?'
              : 'Confermi l\'arrivo della merce? L\'inventario verrà aggiornato automaticamente.'
        }
        confirmLabel={
          pendingAction === 'create'
            ? 'Crea Ordine'
            : pendingAction === 'shipped'
              ? 'Segna Spedito'
              : 'Merce Arrivata'
        }
        loading={pendingAction === 'create' ? createLoading : statusUpdating}
        onConfirm={() => {
          const action = pendingAction
          setPendingAction(null)
          if (action === 'create') handleCreateOrder()
          else if (action === 'shipped') handleMarkShipped()
          else if (action === 'arrived') handleMarkArrived()
        }}
        onCancel={() => setPendingAction(null)}
      />
    </AppShell>
  )
}
