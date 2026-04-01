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
  ordered: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',
  shipped: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  arrived: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200',
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
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
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto',
              'animate-toast-in',
              toast.type === 'success' && 'bg-success text-white',
              toast.type === 'error' && 'bg-danger text-white',
              toast.type === 'warning' && 'bg-yellow-500 text-white'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.type === 'error' && <X className="w-4 h-4 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="animate-fade-in space-y-5 max-w-7xl mx-auto">
        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Totale Ordini
              </p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Ordinati
              </p>
              <p className="text-2xl font-bold text-blue-600">{orderedCount}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                In Transito
              </p>
              <p className="text-2xl font-bold text-amber-600">{shippedCount}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Arrivati
              </p>
              <p className="text-2xl font-bold text-emerald-600">{arrivedCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Orders table card                                                  */}
        {/* ---------------------------------------------------------------- */}
        <Card
          title="Ordini Acquisto"
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-1.5" />
                Esporta PDF
              </Button>
              <Button variant="primary" size="sm" onClick={openNewOrderModal}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nuovo Ordine
              </Button>
            </div>
          }
        >
          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Cerca per fornitore o ID ordine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-surface/80 bg-card shadow-sm',
                  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15',
                  'placeholder:text-gray-400 transition-all duration-200'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                  aria-label="Cancella ricerca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value as OrderStatus | 'all')}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 border',
                    statusFilter === opt.value
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-card text-foreground/60 border-surface/30 hover:border-brand/40 hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          {(searchQuery || statusFilter !== 'all') && (
            <p className="text-xs text-foreground/50 mb-3">
              {filteredOrders.length}{' '}
              {filteredOrders.length === 1 ? 'ordine trovato' : 'ordini trovati'}
            </p>
          )}

          {tableLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-full max-w-2xl space-y-3">
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
              </div>
              <p className="text-sm text-foreground/40">Caricamento ordini...</p>
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
        </Card>
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
          <div className="space-y-5">
            {/* Header info strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                  Fornitore
                </p>
                <p className="font-bold text-foreground">{selectedOrder.suppliers?.name ?? '—'}</p>
                {selectedOrder.suppliers?.email && (
                  <p className="text-xs text-foreground/50 mt-0.5">
                    {selectedOrder.suppliers.email}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                  Stato
                </p>
                <StatusBadge status={selectedOrder.status} />
              </div>

              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                  Data Ordine
                </p>
                <p className="font-medium text-foreground text-sm">
                  {formatDate(selectedOrder.created_at)}
                </p>
              </div>
            </div>

            {/* Status flow indicator */}
            <div className="flex items-center gap-2 py-2">
              {(['ordered', 'shipped', 'arrived'] as OrderStatus[]).map((step, idx) => {
                const steps: OrderStatus[] = ['ordered', 'shipped', 'arrived']
                const currentIdx = steps.indexOf(selectedOrder.status)
                const isCompleted = idx < currentIdx
                const isCurrent = idx === currentIdx
                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1',
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                          isCompleted && 'bg-brand border-brand text-white',
                          isCurrent && 'bg-card border-brand text-brand shadow-md',
                          !isCompleted && !isCurrent && 'bg-surface border-surface/30 text-foreground/30'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold whitespace-nowrap',
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
                          'h-0.5 w-8 rounded-full mb-5',
                          idx < currentIdx ? 'bg-brand' : 'bg-surface/30'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Items table */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                Articoli Ordinati
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
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground/50 w-20">
                        Qtà
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50 w-28">
                        Prezzo Unit.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50 w-28">
                        Totale
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.purchase_order_items?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-foreground/40 text-sm">
                          Nessun articolo in questo ordine
                        </td>
                      </tr>
                    ) : (
                      selectedOrder.purchase_order_items?.map((item, i) => (
                        <tr
                          key={item.id}
                          className={cn(
                            'border-t border-surface/20 hover:bg-brand/[0.04] transition-colors',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20'
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {item.product_registry?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-xs font-semibold">
                              {item.product_registry?.size ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {item.product_registry?.color ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand text-sm font-bold">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-foreground/70">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-brand text-sm">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
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
                          {formatCurrency(selectedOrder.total)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1.5">
                  Note
                </p>
                <p className="text-sm text-foreground/80">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Action buttons — status flow */}
            <div className="pt-2 border-t border-surface/20 space-y-3">
              {/* CRITICAL: Merce Arrivata — visible when ordered or shipped */}
              {(selectedOrder.status === 'ordered' || selectedOrder.status === 'shipped') && (
                <button
                  onClick={() => setPendingAction('arrived')}
                  disabled={statusUpdating}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl',
                    'text-white text-lg font-bold tracking-wide',
                    'bg-success hover:bg-green-600 active:bg-green-700',
                    'shadow-lg shadow-green-200/50 hover:shadow-green-300/50',
                    'transition-all duration-200 transform hover:-translate-y-0.5',
                    'focus:outline-none focus:ring-4 focus:ring-green-300',
                    'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
                  )}
                  aria-label="Conferma arrivo della merce e aggiorna inventario"
                >
                  {statusUpdating ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Package className="w-6 h-6" />
                  )}
                  Merce Arrivata — Aggiorna Inventario
                </button>
              )}

              {/* Segna come Spedito — only when ordered */}
              {selectedOrder.status === 'ordered' && (
                <Button
                  variant="secondary"
                  size="md"
                  loading={statusUpdating}
                  onClick={() => setPendingAction('shipped')}
                  className="w-full"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Segna come Spedito
                </Button>
              )}

              {/* Arrived state — read-only info */}
              {selectedOrder.status === 'arrived' && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-emerald-700">Merce ricevuta</p>
                    <p className="text-emerald-600 mt-0.5">
                      Le quantità in inventario sono state aggiornate automaticamente dal database.
                    </p>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrder(null)}
                className="w-full"
              >
                Chiudi
              </Button>
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
