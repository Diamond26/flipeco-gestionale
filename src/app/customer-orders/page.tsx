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
      label: 'In Attesa',
      className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    confirmed: {
      label: 'Confermato',
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    delivered: {
      label: 'Consegnato',
      className: 'bg-[#7BB35F]/20 text-[#7BB35F] border border-[#7BB35F]/30 shadow-[0_0_15px_rgba(123,179,95,0.2)]',
      icon: <Truck className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: 'Annullato',
      className: 'bg-red-500/10 text-red-400 border border-red-500/20',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  }

  const { label, className, icon } = config[status] ?? config.pending

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide',
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
  const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string; newStatus: OrderStatus } | null>(null)

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
          <span className="text-foreground/30">&mdash;</span>
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
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-light/20 text-xs font-semibold text-foreground/60">
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
              'flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-toast-in',
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

      <div className="space-y-8 max-w-7xl mx-auto animate-fade-in relative pt-2">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-[#7BB35F]/5 blur-[120px] pointer-events-none rounded-[100%] z-[-1]" />
        
        {/* ---------------------------------------------------------------- */}
        {/* Stats bar (Premium Glass)                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] bg-white/90 dark:bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-surface/50 dark:border-white/10 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-[1.25rem] bg-surface/40 dark:bg-white/5 border border-surface dark:border-white/10 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <ShoppingBag className="w-6 h-6 text-foreground/80 drop-shadow-md" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/60 mb-1">
                Totale Ordini
              </p>
              <p className="text-3xl font-extrabold text-foreground drop-shadow-sm">{totalOrders}</p>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] bg-surface/50 dark:bg-amber-500/[0.03] backdrop-blur-2xl rounded-2xl border border-surface dark:border-amber-500/20 p-5 shadow-[0_0_30px_rgba(245,158,11,0.05)] flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-[1.25rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)] group-hover:shadow-[inset_0_0_20px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-all duration-300">
              <Clock className="w-6 h-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
                In Attesa
              </p>
              <p className="text-3xl font-extrabold text-amber-500 drop-shadow-sm">{pendingCount}</p>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] bg-surface/50 dark:bg-blue-500/[0.03] backdrop-blur-2xl rounded-2xl border border-surface dark:border-blue-500/20 p-5 shadow-[0_0_30px_rgba(59,130,246,0.05)] flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-[1.25rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-all duration-300">
              <ClipboardList className="w-6 h-6 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
                Confermati
              </p>
              <p className="text-3xl font-extrabold text-blue-400 drop-shadow-sm">{confirmedCount}</p>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] bg-surface/50 dark:bg-[#7BB35F]/[0.05] backdrop-blur-2xl rounded-2xl border border-surface dark:border-[#7BB35F]/30 p-5 shadow-[0_0_30px_rgba(123,179,95,0.1)] flex items-center gap-4 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#7BB35F]/10 blur-3xl rounded-full" />
            <div className="w-14 h-14 rounded-[1.25rem] bg-[#7BB35F]/20 border border-[#7BB35F]/30 flex items-center justify-center shrink-0 shadow-[inset_0_0_20px_rgba(123,179,95,0.3)] group-hover:scale-105 transition-all duration-300 z-10">
              <Truck className="w-6 h-6 text-[#7BB35F] drop-shadow-[0_0_10px_rgba(123,179,95,0.6)]" strokeWidth={1.5} />
            </div>
            <div className="z-10">
              <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/40 mb-1 text-shadow-sm">
                Consegnati
              </p>
              <p className="text-3xl font-extrabold text-[#7BB35F] drop-shadow-md">{deliveredCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Orders List Container                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white/90 dark:bg-white/[0.03] backdrop-blur-2xl rounded-[2rem] border border-surface/50 dark:border-white/10 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          
          {/* Top Actions: Search and Buttons */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 relative z-10">
            <div className="relative w-full md:w-[350px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Cerca per nome o telefono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 text-[14px] rounded-full border border-surface/60 dark:border-white/10 bg-surface-base/50 dark:bg-black/20 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#7BB35F]/50 focus:border-[#7BB35F]/50 transition-all shadow-inner backdrop-blur-md"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                  aria-label="Cancella ricerca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleExportPDF}
                className="px-5 py-3 rounded-full border border-surface dark:border-white/10 bg-surface/60 dark:bg-white/5 text-foreground/80 text-[14px] font-semibold tracking-wide transition-all hover:bg-surface/80 dark:hover:bg-white/10 hover:text-foreground shadow-sm flex items-center gap-2 flex-1 md:flex-none justify-center"
              >
                <FileDown className="w-4 h-4" />
                Esporta PDF
              </button>
              <button
                onClick={openNewOrderModal}
                className="px-6 py-3 rounded-full font-bold text-[14px] tracking-wide transition-all bg-[#7BB35F]/20 text-[#8CE36B] border border-[#7BB35F]/40 shadow-[0_0_20px_rgba(123,179,95,0.2)] hover:shadow-[0_0_30px_rgba(123,179,95,0.35)] hover:bg-[#7BB35F]/30 hover:border-[#7BB35F]/60 flex items-center gap-2 flex-1 md:flex-none justify-center"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
                Nuovo Ordine
              </button>
            </div>
          </div>

          {/* Chip Filters */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide relative z-10">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`
                  px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border shadow-sm
                  ${statusFilter === opt.value 
                    ? 'bg-surface dark:bg-white/10 text-foreground border-surface dark:border-white/20' 
                    : 'bg-transparent text-foreground/50 border-transparent hover:bg-surface/50 dark:hover:bg-white/5 hover:text-foreground/80'}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto relative z-10 pb-4">
            {tableLoading ? (
               <div className="flex flex-col items-center justify-center py-24 gap-4">
                 <div className="w-12 h-12 rounded-full border-4 border-t-[#7BB35F] border-[#7BB35F]/20 animate-spin" />
                 <p className="text-foreground/40 text-[14px] font-medium tracking-wide">Caricamento ordini...</p>
               </div>
            ) : filteredOrders.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                 <div className="w-16 h-16 rounded-2xl bg-surface/40 dark:bg-white/5 flex items-center justify-center mb-2 shadow-none dark:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                   <ShoppingBag className="w-8 h-8 text-foreground/20" />
                 </div>
                 <p className="text-foreground font-bold text-[16px]">Nessun ordine trovato.</p>
                 <p className="text-foreground/40 text-[14px]">Crea il primo ordine con il pulsante &quot;Nuovo Ordine&quot;.</p>
               </div>
            ) : (
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">ID</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Cliente</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Telefono</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Stato</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Totale</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Data</th>
                     <th className="px-4 pb-4 text-[11px] font-bold uppercase tracking-widest text-foreground/60 border-b border-surface/40 dark:border-white/5 whitespace-nowrap">Articoli</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-surface dark:divide-white/5">
                   {filteredOrders.map((row) => (
                     <tr 
                       key={row.id} 
                       onClick={() => setDetailOrder(row)}
                       className="hover:bg-surface/50 dark:hover:bg-white/[0.02] cursor-pointer transition-all group"
                     >
                       <td className="px-4 py-5 whitespace-nowrap font-mono text-[11px] text-foreground/40 font-bold uppercase tracking-wider group-hover:text-foreground/60 transition-colors">
                         #{row.id.slice(0, 8)}
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap font-bold text-[14px] text-foreground drop-shadow-sm">
                         {row.customer_name}
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap text-[13px] text-foreground/60 font-medium">
                         {row.customer_phone || <span className="opacity-40">&mdash;</span>}
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap">
                         <StatusBadge status={row.status} />
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap font-extrabold text-[15px] text-foreground drop-shadow-sm">
                         {formatCurrency(row.total)}
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap text-[12px] text-foreground/50 font-medium tracking-wide">
                         {formatDate(row.created_at)}
                       </td>
                       <td className="px-4 py-5 whitespace-nowrap">
                         <span className="inline-flex items-center justify-center min-w-[28px] px-2.5 py-1 rounded-full bg-surface dark:bg-white/5 border border-surface dark:border-white/10 text-foreground/70 font-bold text-[11px] shadow-sm">
                           {row.customer_order_items?.length ?? 0} pz
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}
          </div>
        </div>
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
        <div className="space-y-5">
          {/* Customer info section */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
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
                  'w-full px-4 py-3 text-sm rounded-xl border border-surface/80 bg-card shadow-sm resize-none',
                  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15',
                  'placeholder:text-gray-400 transition-all duration-200'
                )}
              />
            </div>
          </div>

          {/* Product selection section */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
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
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                Articoli nell&apos;Ordine
              </h4>
              <div className="rounded-2xl border border-surface/20 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-light/20">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Prodotto
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Taglia
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Colore
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Qtà
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        Prezzo Unit.
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
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
                          'border-t border-surface/20 hover:bg-brand/[0.04] transition-colors',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20'
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-surface-light/20 text-xs font-semibold">
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
            <div className="rounded-2xl border-2 border-dashed border-surface/30 py-8 text-center text-foreground/40 text-sm">
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
          <div className="flex gap-3 pt-2 border-t border-surface/20">
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
              <div className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                  <User className="w-3.5 h-3.5" />
                  Cliente
                </p>
                <p className="font-bold text-foreground text-base">
                  {detailOrder.customer_name}
                </p>
              </div>

              {detailOrder.customer_phone && (
                <div className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04]">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                    <Phone className="w-3.5 h-3.5" />
                    Telefono
                  </p>
                  <p className="font-semibold text-foreground">{detailOrder.customer_phone}</p>
                </div>
              )}

              {detailOrder.notes && (
                <div className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-white/60 dark:border-white/[0.06] shadow-sm shadow-black/[0.04] col-span-full">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                  Articoli
                </h4>
                <div className="rounded-2xl border border-surface/20 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-light/20">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Prodotto
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Taglia
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Colore
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Qtà
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Prezzo Unit.
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Totale
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.customer_order_items.map((item, i) => (
                        <tr
                          key={item.id}
                          className={cn(
                            'border-t border-surface/20 hover:bg-brand/[0.04] transition-colors',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20'
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {item.product_registry?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-surface-light/20 text-xs font-semibold">
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
              <div className="border-t border-surface/20 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                  Aggiorna Stato
                </p>
                <div className="flex flex-wrap gap-2">
                  {detailOrder.status === 'pending' && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={statusLoading}
                      onClick={() => setPendingStatusChange({ orderId: detailOrder.id, newStatus: 'confirmed' })}
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
                      onClick={() => setPendingStatusChange({ orderId: detailOrder.id, newStatus: 'delivered' })}
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
                    onClick={() => setPendingStatusChange({ orderId: detailOrder.id, newStatus: 'cancelled' })}
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
                  'flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium border-t border-surface/20 pt-4',
                  detailOrder.status === 'delivered'
                    ? 'text-emerald-600'
                    : 'text-red-600'
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

      {/* Confirm banner — status change */}
      <ConfirmBanner
        open={!!pendingStatusChange}
        variant={pendingStatusChange?.newStatus === 'cancelled' ? 'danger' : 'default'}
        message={
          pendingStatusChange?.newStatus === 'confirmed'
            ? 'Confermare questo ordine? Le quantità verranno scalate dal magazzino.'
            : pendingStatusChange?.newStatus === 'delivered'
              ? 'Segnare questo ordine come consegnato?'
              : 'Annullare questo ordine? Se confermato, le quantità verranno ripristinate in magazzino.'
        }
        confirmLabel={
          pendingStatusChange?.newStatus === 'confirmed'
            ? 'Conferma'
            : pendingStatusChange?.newStatus === 'delivered'
              ? 'Consegnato'
              : 'Annulla Ordine'
        }
        loading={statusLoading}
        onConfirm={() => {
          if (pendingStatusChange) {
            handleStatusChange(pendingStatusChange.orderId, pendingStatusChange.newStatus)
            setPendingStatusChange(null)
          }
        }}
        onCancel={() => setPendingStatusChange(null)}
      />
    </AppShell>
  )
}
