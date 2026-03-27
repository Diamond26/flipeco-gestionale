'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { exportToPDF } from '@/lib/pdf-export'
import {
  Plus,
  FileDown,
  ShoppingBag,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  Search,
  Trash2,
  X,
  AlertTriangle,
  User,
  Phone,
  StickyNote,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled'

interface ProductRegistry {
  id: string
  name: string
  size: string
  color: string
  barcode: string
}

interface InventoryItem {
  id: string
  product_id: string
  sell_price: number
  quantity: number
  product_registry: ProductRegistry
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product_registry: ProductRegistry
}

interface CustomerOrder {
  id: string
  customer_name: string
  customer_phone: string | null
  notes: string | null
  status: OrderStatus
  total: number
  created_at: string
  customer_order_items: OrderItem[]
}

interface NewOrderItem {
  inventoryId: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  maxQuantity: number
  productId: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'pending', label: 'In attesa' },
  { value: 'confirmed', label: 'Confermato' },
  { value: 'delivered', label: 'Consegnato' },
  { value: 'cancelled', label: 'Annullato' },
]

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: 'In attesa',
      className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      icon: <Clock className="w-3 h-3" />,
    },
    confirmed: {
      label: 'Confermato',
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    delivered: {
      label: 'Consegnato',
      className: 'bg-success/10 text-success border border-success/20',
      icon: <Truck className="w-3 h-3" />,
    },
    cancelled: {
      label: 'Annullato',
      className: 'bg-danger/10 text-danger border border-danger/20',
      icon: <XCircle className="w-3 h-3" />,
    },
  }

  const { label, className, icon } = config[status] ?? config.pending

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        className
      )}
    >
      {icon}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CustomerOrdersPage() {
  const supabase = createClient()

  // --- Orders state ---
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [tableLoading, setTableLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // --- New order modal state ---
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [newOrderForm, setNewOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    notes: '',
  })
  const [newOrderErrors, setNewOrderErrors] = useState<Record<string, string>>({})
  const [newOrderItems, setNewOrderItems] = useState<NewOrderItem[]>([])
  const [createLoading, setCreateLoading] = useState(false)

  // --- Product selection state (inside new order modal) ---
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItem[]>([])
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [selectedQty, setSelectedQty] = useState('1')
  const [addItemError, setAddItemError] = useState('')

  // --- Detail modal state ---
  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // --- Toasts ---
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
      .from('customer_orders')
      .select('*, customer_order_items(*, product_registry(*))')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('Errore nel caricamento degli ordini', 'error')
    } else {
      setOrders((data as CustomerOrder[]) ?? [])
    }
    setTableLoading(false)
  }, [supabase, showToast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // ---------------------------------------------------------------------------
  // Fetch available inventory (for product select in new order modal)
  // ---------------------------------------------------------------------------

  const fetchInventoryOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*, product_registry(*)')
      .gt('quantity', 0)
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setInventoryOptions(data as InventoryItem[])
    }
  }, [supabase])

  // Load inventory options when new order modal opens
  useEffect(() => {
    if (newOrderOpen) {
      fetchInventoryOptions()
    }
  }, [newOrderOpen, fetchInventoryOptions])

  // ---------------------------------------------------------------------------
  // New order modal helpers
  // ---------------------------------------------------------------------------

  function openNewOrderModal() {
    setNewOrderForm({ customer_name: '', customer_phone: '', notes: '' })
    setNewOrderErrors({})
    setNewOrderItems([])
    setSelectedInventoryId('')
    setSelectedQty('1')
    setAddItemError('')
    setNewOrderOpen(true)
  }

  function closeNewOrderModal() {
    setNewOrderOpen(false)
  }

  // Derived: available select options formatted as {value, label}
  const productSelectOptions = inventoryOptions.map((inv) => ({
    value: inv.id,
    label: `${inv.product_registry.name} - ${inv.product_registry.size} ${inv.product_registry.color} (Disponibili: ${inv.quantity}) - ${formatCurrency(inv.sell_price)}`,
  }))

  // Current selection details (for max qty check)
  const selectedInventoryItem = inventoryOptions.find((i) => i.id === selectedInventoryId)

  // Already-added quantity for the selected item (to track remaining stock)
  const alreadyAddedQty = newOrderItems
    .filter((item) => item.inventoryId === selectedInventoryId)
    .reduce((sum, item) => sum + item.quantity, 0)

  function handleAddItemToOrder() {
    setAddItemError('')

    if (!selectedInventoryId) {
      setAddItemError('Seleziona un prodotto')
      return
    }

    const qty = parseInt(selectedQty, 10)
    if (!qty || qty <= 0) {
      setAddItemError('Inserisci una quantità valida')
      return
    }

    const inv = selectedInventoryItem
    if (!inv) {
      setAddItemError('Prodotto non trovato')
      return
    }

    const maxAvailable = inv.quantity - alreadyAddedQty
    if (qty > maxAvailable) {
      setAddItemError(`Quantità massima disponibile: ${maxAvailable}`)
      return
    }

    // Check if this exact inventory item is already in the list
    const existing = newOrderItems.find((item) => item.inventoryId === selectedInventoryId)
    if (existing) {
      // Increment quantity of existing line
      setNewOrderItems((prev) =>
        prev.map((item) =>
          item.inventoryId === selectedInventoryId
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      )
    } else {
      setNewOrderItems((prev) => [
        ...prev,
        {
          inventoryId: inv.id,
          productName: inv.product_registry.name,
          size: inv.product_registry.size,
          color: inv.product_registry.color,
          quantity: qty,
          unitPrice: inv.sell_price,
          maxQuantity: inv.quantity,
          productId: inv.product_id,
        },
      ])
    }

    // Reset selection
    setSelectedInventoryId('')
    setSelectedQty('1')
  }

  function removeOrderItem(inventoryId: string) {
    setNewOrderItems((prev) => prev.filter((item) => item.inventoryId !== inventoryId))
  }

  const orderTotal = newOrderItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )

  // ---------------------------------------------------------------------------
  // Create order submit
  // ---------------------------------------------------------------------------

  async function handleCreateOrder() {
    const errors: Record<string, string> = {}
    if (!newOrderForm.customer_name.trim()) {
      errors.customer_name = 'Il nome del cliente è obbligatorio'
    }
    if (newOrderItems.length === 0) {
      errors.items = 'Aggiungi almeno un prodotto all\'ordine'
    }
    if (Object.keys(errors).length > 0) {
      setNewOrderErrors(errors)
      return
    }

    setCreateLoading(true)

    // Insert the order header
    const { data: orderData, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        customer_name: newOrderForm.customer_name.trim(),
        customer_phone: newOrderForm.customer_phone.trim() || null,
        notes: newOrderForm.notes.trim() || null,
        status: 'pending' as OrderStatus,
        total: orderTotal,
      })
      .select()
      .single()

    if (orderError || !orderData) {
      showToast('Errore durante la creazione dell\'ordine', 'error')
      setCreateLoading(false)
      return
    }

    // Insert order items
    const itemsPayload = newOrderItems.map((item) => ({
      order_id: orderData.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))

    const { error: itemsError } = await supabase
      .from('customer_order_items')
      .insert(itemsPayload)

    if (itemsError) {
      showToast('Ordine creato ma errore nell\'inserimento degli articoli', 'error')
      setCreateLoading(false)
      fetchOrders()
      closeNewOrderModal()
      return
    }

    setCreateLoading(false)
    showToast(`Ordine per "${newOrderForm.customer_name.trim()}" creato`, 'success')
    closeNewOrderModal()
    fetchOrders()
  }

  // ---------------------------------------------------------------------------
  // Status update
  // ---------------------------------------------------------------------------

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setStatusLoading(true)

    // Find the current order to know its current status and items
    const currentOrder = orders.find((o) => o.id === orderId)
    if (!currentOrder) {
      showToast('Ordine non trovato', 'error')
      setStatusLoading(false)
      return
    }

    const prevStatus = currentOrder.status

    // Update order status
    const { error } = await supabase
      .from('customer_orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) {
      showToast('Errore durante l\'aggiornamento dello stato', 'error')
      setStatusLoading(false)
      return
    }

    // Decrement inventory when confirming (pending → confirmed)
    if (newStatus === 'confirmed' && prevStatus === 'pending') {
      const stockError = await updateInventoryStock(currentOrder.customer_order_items, 'decrement')
      if (stockError) {
        showToast('Stato aggiornato, ma errore nello scalare il magazzino', 'warning')
      }
    }

    // Restore inventory when cancelling a confirmed order
    if (newStatus === 'cancelled' && prevStatus === 'confirmed') {
      const stockError = await updateInventoryStock(currentOrder.customer_order_items, 'increment')
      if (stockError) {
        showToast('Stato aggiornato, ma errore nel ripristinare il magazzino', 'warning')
      }
    }

    setStatusLoading(false)

    const statusLabels: Record<OrderStatus, string> = {
      pending: 'In attesa',
      confirmed: 'Confermato',
      delivered: 'Consegnato',
      cancelled: 'Annullato',
    }

    showToast(`Stato aggiornato: ${statusLabels[newStatus]}`, 'success')

    // Refresh the detail order from updated list
    await fetchOrders()
    // Sync detail modal with fresh data
    setDetailOrder((prev) =>
      prev && prev.id === orderId ? { ...prev, status: newStatus } : prev
    )
  }

  /**
   * Update inventory stock for order items.
   * 'decrement' subtracts quantities, 'increment' restores them.
   */
  async function updateInventoryStock(
    items: OrderItem[],
    direction: 'decrement' | 'increment'
  ): Promise<boolean> {
    let hasError = false

    for (const item of items) {
      // Find the inventory row for this product
      const { data: invRows, error: fetchErr } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .order('quantity', { ascending: false })
        .limit(1)

      if (fetchErr || !invRows || invRows.length === 0) {
        hasError = true
        continue
      }

      const inv = invRows[0]
      const newQty =
        direction === 'decrement'
          ? Math.max(0, inv.quantity - item.quantity)
          : inv.quantity + item.quantity

      const { error: updateErr } = await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', inv.id)

      if (updateErr) {
        hasError = true
      }
    }

    return hasError
  }

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  function handleExportPDF() {
    exportToPDF({
      title: 'Ordini Clienti — Flip&Co',
      headers: ['ID', 'Cliente', 'Telefono', 'Stato', 'Totale', 'Data'],
      rows: filteredOrders.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        o.customer_name,
        o.customer_phone ?? '',
        o.status,
        formatCurrency(o.total),
        formatDate(o.created_at),
      ]),
      filename: `ordini_${new Date().toISOString().slice(0, 10)}`,
    })
  }

  // ---------------------------------------------------------------------------
  // Derived: filtered orders
  // ---------------------------------------------------------------------------

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery.trim() ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer_phone ?? '').includes(searchQuery)

    const matchesStatus = !statusFilter || o.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalOrders = orders.length
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (row: CustomerOrder) => (
        <span className="font-mono text-xs text-foreground/50 font-semibold">
          #{row.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Cliente',
      render: (row: CustomerOrder) => (
        <span className="font-semibold text-foreground">{row.customer_name}</span>
      ),
    },
    {
      key: 'customer_phone',
      header: 'Telefono',
      render: (row: CustomerOrder) =>
        row.customer_phone ? (
          <span className="text-foreground/70">{row.customer_phone}</span>
        ) : (
          <span className="text-foreground/30">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Stato',
      render: (row: CustomerOrder) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total',
      header: 'Totale',
      render: (row: CustomerOrder) => (
        <span className="font-bold text-brand">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (row: CustomerOrder) => (
        <span className="text-xs text-foreground/60">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'Articoli',
      render: (row: CustomerOrder) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-xs font-semibold text-foreground/60">
          {row.customer_order_items?.length ?? 0} pz
        </span>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell pageTitle="Ordini Clienti">
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
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
              'animate-in slide-in-from-right-4 fade-in duration-200',
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

      <div className="space-y-6 max-w-7xl mx-auto">
        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Totale Ordini
              </p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                In Attesa
              </p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Confermati
              </p>
              <p className="text-2xl font-bold text-blue-600">{confirmedCount}</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Consegnati
              </p>
              <p className="text-2xl font-bold text-success">{deliveredCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Orders table                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Card
          title="Ordini Clienti"
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
          {/* Filters row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Cerca per nome o telefono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border-2 border-surface bg-white',
                  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/20',
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

            {/* Status filter */}
            <div className="sm:w-52">
              <Select
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          {/* Result count */}
          {(searchQuery || statusFilter) && (
            <p className="text-xs text-foreground/50 mb-3">
              {filteredOrders.length}{' '}
              {filteredOrders.length === 1 ? 'ordine trovato' : 'ordini trovati'}
            </p>
          )}

          {tableLoading ? (
            <div className="flex items-center justify-center py-16 text-foreground/40">
              <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
              Caricamento ordini...
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredOrders}
              emptyMessage="Nessun ordine trovato. Crea il primo ordine con il pulsante 'Nuovo Ordine'."
              onRowClick={(row) => setDetailOrder(row)}
            />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* New Order Modal                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={newOrderOpen}
        onClose={closeNewOrderModal}
        title="Nuovo Ordine"
        size="xl"
      >
        <div className="space-y-6">
          {/* Customer info section */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-foreground/60 uppercase tracking-wide mb-3">
              <User className="w-4 h-4" />
              Dati Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome Cliente *"
                type="text"
                placeholder="es. Mario Rossi"
                value={newOrderForm.customer_name}
                error={newOrderErrors.customer_name}
                onChange={(e) => {
                  setNewOrderForm((f) => ({ ...f, customer_name: e.target.value }))
                  setNewOrderErrors((err) => ({ ...err, customer_name: '' }))
                }}
              />
              <div className="relative">
                <Input
                  label="Telefono (opzionale)"
                  type="tel"
                  placeholder="es. 333 1234567"
                  value={newOrderForm.customer_phone}
                  onChange={(e) =>
                    setNewOrderForm((f) => ({ ...f, customer_phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  Note (opzionale)
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Aggiungi note sull'ordine o preferenze del cliente..."
                value={newOrderForm.notes}
                onChange={(e) =>
                  setNewOrderForm((f) => ({ ...f, notes: e.target.value }))
                }
                className={cn(
                  'w-full px-4 py-3 text-sm rounded-xl border-2 border-surface bg-white resize-none',
                  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/20',
                  'placeholder:text-gray-400 transition-all duration-200'
                )}
              />
            </div>
          </div>

          {/* Product selection section */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-foreground/60 uppercase tracking-wide mb-3">
              <ShoppingBag className="w-4 h-4" />
              Aggiungi Prodotti
            </h4>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <Select
                  label="Prodotto"
                  options={productSelectOptions}
                  placeholder="— Seleziona un prodotto —"
                  value={selectedInventoryId}
                  onChange={(e) => {
                    setSelectedInventoryId(e.target.value)
                    setSelectedQty('1')
                    setAddItemError('')
                  }}
                />
              </div>
              <div className="w-28 shrink-0">
                <Input
                  label="Quantità"
                  type="number"
                  min="1"
                  max={
                    selectedInventoryItem
                      ? String(selectedInventoryItem.quantity - alreadyAddedQty)
                      : undefined
                  }
                  step="1"
                  value={selectedQty}
                  onChange={(e) => {
                    setSelectedQty(e.target.value)
                    setAddItemError('')
                  }}
                />
              </div>
              <div className="shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleAddItemToOrder}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Aggiungi
                </Button>
              </div>
            </div>

            {addItemError && (
              <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {addItemError}
              </p>
            )}
          </div>

          {/* Order items list */}
          {newOrderItems.length > 0 ? (
            <div>
              <h4 className="text-sm font-bold text-foreground/60 uppercase tracking-wide mb-3">
                Articoli nell&apos;Ordine
              </h4>
              <div className="rounded-xl border border-surface/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface/30">
                      <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                        Prodotto
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                        Taglia
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                        Colore
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                        Qtà
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                        Prezzo Unit.
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                        Totale
                      </th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {newOrderItems.map((item, i) => (
                      <tr
                        key={item.inventoryId}
                        className={cn(
                          'border-t border-surface/30',
                          i % 2 === 0 ? 'bg-white' : 'bg-surface/10'
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-surface text-xs font-semibold">
                            {item.size}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-foreground/70">{item.color}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground/70">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-brand">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => removeOrderItem(item.inventoryId)}
                            className="p-1 rounded-lg hover:bg-danger/10 text-foreground/40 hover:text-danger transition-colors"
                            aria-label="Rimuovi articolo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order total */}
              <div className="mt-3 flex items-center justify-end gap-3">
                <span className="text-sm font-semibold text-foreground/60">
                  Totale Ordine:
                </span>
                <span className="text-2xl font-bold text-brand">
                  {formatCurrency(orderTotal)}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-surface py-8 text-center text-foreground/40 text-sm">
              Nessun articolo aggiunto. Seleziona un prodotto e premi &quot;Aggiungi&quot;.
            </div>
          )}

          {/* Items error */}
          {newOrderErrors.items && (
            <p className="text-sm text-danger flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {newOrderErrors.items}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-surface/50">
            <Button
              variant="primary"
              size="md"
              loading={createLoading}
              onClick={handleCreateOrder}
              className="flex-1"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Crea Ordine
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={closeNewOrderModal}
              disabled={createLoading}
            >
              Annulla
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Order Detail Modal                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={`Ordine #${detailOrder?.id.slice(0, 8).toUpperCase() ?? ''}`}
        size="lg"
      >
        {detailOrder && (
          <div className="space-y-5">
            {/* Status + date header */}
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={detailOrder.status} />
              <span className="text-sm text-foreground/50">
                {formatDate(detailOrder.created_at)}
              </span>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-surface-light/50 border border-surface/40">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
                  <User className="w-3.5 h-3.5" />
                  Cliente
                </p>
                <p className="font-bold text-foreground text-base">
                  {detailOrder.customer_name}
                </p>
              </div>

              {detailOrder.customer_phone && (
                <div className="p-4 rounded-xl bg-surface-light/50 border border-surface/40">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
                    <Phone className="w-3.5 h-3.5" />
                    Telefono
                  </p>
                  <p className="font-semibold text-foreground">{detailOrder.customer_phone}</p>
                </div>
              )}

              {detailOrder.notes && (
                <div className="p-4 rounded-xl bg-surface-light/50 border border-surface/40 col-span-full">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
                    <StickyNote className="w-3.5 h-3.5" />
                    Note
                  </p>
                  <p className="text-foreground/80 text-sm">{detailOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Order items */}
            {detailOrder.customer_order_items && detailOrder.customer_order_items.length > 0 ? (
              <div>
                <h4 className="text-sm font-bold text-foreground/60 uppercase tracking-wide mb-3">
                  Articoli
                </h4>
                <div className="rounded-xl border border-surface/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface/30">
                        <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                          Prodotto
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                          Taglia
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-foreground/70">
                          Colore
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                          Qtà
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                          Prezzo Unit.
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground/70">
                          Totale
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.customer_order_items.map((item, i) => (
                        <tr
                          key={item.id}
                          className={cn(
                            'border-t border-surface/30',
                            i % 2 === 0 ? 'bg-white' : 'bg-surface/10'
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {item.product_registry?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-surface text-xs font-semibold">
                              {item.product_registry?.size ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-foreground/70">
                            {item.product_registry?.color ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right text-foreground/70">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-brand">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="mt-3 flex items-center justify-end gap-3">
                  <span className="text-sm font-semibold text-foreground/60">
                    Totale Ordine:
                  </span>
                  <span className="text-2xl font-bold text-brand">
                    {formatCurrency(detailOrder.total)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/50 text-center py-4">
                Nessun articolo in questo ordine.
              </p>
            )}

            {/* Status action buttons */}
            {detailOrder.status !== 'cancelled' && detailOrder.status !== 'delivered' && (
              <div className="border-t border-surface/50 pt-4">
                <p className="text-xs font-bold text-foreground/50 uppercase tracking-wide mb-3">
                  Aggiorna Stato
                </p>
                <div className="flex flex-wrap gap-2">
                  {detailOrder.status === 'pending' && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={statusLoading}
                      onClick={() => handleStatusChange(detailOrder.id, 'confirmed')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Conferma Ordine
                    </Button>
                  )}
                  {(detailOrder.status === 'pending' ||
                    detailOrder.status === 'confirmed') && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={statusLoading}
                      onClick={() => handleStatusChange(detailOrder.id, 'delivered')}
                      className="bg-success hover:bg-green-600"
                    >
                      <Truck className="w-4 h-4 mr-1.5" />
                      Segna come Consegnato
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    loading={statusLoading}
                    onClick={() => handleStatusChange(detailOrder.id, 'cancelled')}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Annulla Ordine
                  </Button>
                </div>
              </div>
            )}

            {/* Final/terminal status note */}
            {(detailOrder.status === 'delivered' || detailOrder.status === 'cancelled') && (
              <div
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border-t border-surface/50 pt-4',
                  detailOrder.status === 'delivered'
                    ? 'text-success'
                    : 'text-danger'
                )}
              >
                {detailOrder.status === 'delivered' ? (
                  <Truck className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {detailOrder.status === 'delivered'
                  ? 'Ordine consegnato. Nessuna azione disponibile.'
                  : 'Ordine annullato. Nessuna azione disponibile.'}
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
