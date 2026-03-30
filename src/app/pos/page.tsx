'use client'

import { Fragment, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Scan,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  ReceiptText,
  Clock,
  RotateCcw,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductRegistry {
  id: string
  barcode: string
  name: string
  brand: string
  size: string
  color: string
  sku?: string
}

interface InventoryProduct {
  id: string               // inventory row id
  product_id: string
  sell_price: number
  quantity: number         // available stock
  product_registry: ProductRegistry
}

interface CartItem {
  inventoryId: string
  productId: string
  barcode: string
  name: string
  brand: string
  size: string
  color: string
  price: number
  qty: number
  maxQty: number
}
type PaymentMethod = 'cash' | 'pos'

interface SaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  product_registry: ProductRegistry
}

interface Sale {
  id: string
  created_at: string
  payment_method: string
  total: number
  sale_items: SaleItem[]
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayRange(dateInput: string): { start: string; end: string } {
  const [year, month, day] = dateInput.split('-').map(Number)
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
  const endDate = new Date(year, month - 1, day, 23, 59, 59, 999)
  return { start: startDate.toISOString(), end: endDate.toISOString() }
}

function timeOnly(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function dateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function POSPage() {
  const supabase = createClient()

  // --- Refs ---
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const toastCounter = useRef(0)

  // --- Barcode ---
  const [barcodeValue, setBarcodeValue] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [isReceivingScan, setIsReceivingScan] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerActiveIndex, setScannerActiveIndex] = useState(-1)
  const scannerBoxRef = useRef<HTMLDivElement>(null)

  // --- Products grid ---
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productMenuOpen, setProductMenuOpen] = useState(false)
  const [productMenuQuery, setProductMenuQuery] = useState('')
  const [productSortBy, setProductSortBy] = useState<'name' | 'brand' | 'size' | 'price' | 'quantity'>('name')

  // --- Cart ---
  const [cart, setCart] = useState<CartItem[]>([])

  // --- Payment modals ---
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // --- Receipt modal ---
  const [completedSale, setCompletedSale] = useState<{
    id: string
    total: number
    itemCount: number
    method: PaymentMethod
    createdAt: string
  } | null>(null)

  // --- Sales history ---
  const [todaySales, setTodaySales] = useState<Sale[]>([])
  const [historyDate, setHistoryDate] = useState(() => toLocalDateInputValue(new Date()))
  const [historyMonthAnchor, setHistoryMonthAnchor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stornoLoading, setStornoLoading] = useState<string | null>(null)
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({})

  // --- Return (reso) modal state ---
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)
  const returnBarcodeRef = useRef<HTMLInputElement>(null)

  // --- Toasts ---
  const [toasts, setToasts] = useState<Toast[]>([])

  // ---------------------------------------------------------------------------
  // Focus helpers
  // ---------------------------------------------------------------------------

  const focusBarcode = useCallback(() => {
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    focusBarcode()
  }, [focusBarcode])

  // ---------------------------------------------------------------------------
  // Global barcode scanner listener
  // Captures keystrokes from barcode scanners even when focus is elsewhere.
  // Scanners typically send characters rapidly ending with Enter.
  // ---------------------------------------------------------------------------

  const scanBufferRef = useRef('')
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea (other than the barcode input)
      const target = e.target as HTMLElement
      const isBarcode = target === barcodeInputRef.current
      const isInteractive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (isInteractive && !isBarcode) return

      // If already focused on barcode input, let normal flow handle it
      if (isBarcode) return

      // Ignore modifier keys and special keys (except Enter)
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Shift' || e.key === 'Tab' || e.key === 'Escape') return

      if (e.key === 'Enter' && scanBufferRef.current.length >= 4) {
        e.preventDefault()
        const code = scanBufferRef.current
        scanBufferRef.current = ''
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        setIsReceivingScan(false)
        // Trigger barcode lookup
        setBarcodeValue(code)
        setTimeout(() => {
          barcodeInputRef.current?.form?.requestSubmit()
        }, 10)
        return
      }

      if (e.key.length === 1) {
        e.preventDefault()
        if (scanBufferRef.current.length === 0) {
          setIsReceivingScan(true)
        }
        scanBufferRef.current += e.key
        // Reset buffer after 100ms of inactivity (scanner sends chars rapidly)
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = ''
          setIsReceivingScan(false)
        }, 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
  // Fetch products (inventory with stock > 0)
  // ---------------------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select('*, product_registry(*)')
      .gt('quantity', 0)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Supabase POS error:', error)
      showToast(`Errore caricamento: ${error.message}`, 'error')
    } else {
      setProducts((data as InventoryProduct[]) ?? [])
    }
    setProductsLoading(false)
  }, [supabase, showToast])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // ---------------------------------------------------------------------------
  // Fetch today's sales
  // ---------------------------------------------------------------------------

  const fetchTodaySales = useCallback(async (targetDate: string) => {
    const { start, end } = dayRange(targetDate)
    setHistoryLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, product_registry(*))')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })

    if (!error) {
      setTodaySales((data as Sale[]) ?? [])
    }
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTodaySales(historyDate)
  }, [fetchTodaySales, historyDate])

  useEffect(() => {
    const selected = new Date(`${historyDate}T00:00:00`)
    setHistoryMonthAnchor(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [historyDate])

  const scannerSuggestions = useMemo(() => {
    const q = barcodeValue.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => {
        const pr = p.product_registry
        return (
          pr.barcode?.toLowerCase().includes(q) ||
          pr.name?.toLowerCase().includes(q) ||
          pr.brand?.toLowerCase().includes(q) ||
          pr.size?.toLowerCase().includes(q) ||
          pr.color?.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [barcodeValue, products])

  const productMenuItems = useMemo(() => {
    const q = productMenuQuery.trim().toLowerCase()
    const base = products.filter((p) => {
      if (!q) return true
      const pr = p.product_registry
      return (
        pr.barcode?.toLowerCase().includes(q) ||
        pr.name?.toLowerCase().includes(q) ||
        pr.brand?.toLowerCase().includes(q) ||
        pr.size?.toLowerCase().includes(q) ||
        pr.color?.toLowerCase().includes(q) ||
        pr.sku?.toLowerCase().includes(q)
      )
    })

    return [...base].sort((a, b) => {
      if (productSortBy === 'price') return Number(a.sell_price) - Number(b.sell_price)
      if (productSortBy === 'quantity') return b.quantity - a.quantity
      if (productSortBy === 'brand') return (a.product_registry.brand || '').localeCompare(b.product_registry.brand || '', 'it')
      if (productSortBy === 'size') return (a.product_registry.size || '').localeCompare(b.product_registry.size || '', 'it')
      return (a.product_registry.name || '').localeCompare(b.product_registry.name || '', 'it')
    })
  }, [productMenuQuery, productSortBy, products])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (scannerBoxRef.current && !scannerBoxRef.current.contains(target)) {
        setScannerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ---------------------------------------------------------------------------
  // Cart helpers
  // ---------------------------------------------------------------------------

  const addToCart = useCallback(
    (product: InventoryProduct) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.inventoryId === product.id)
        if (existing) {
          if (existing.qty >= existing.maxQty) {
            showToast(`Disponibilità massima raggiunta per "${existing.name}"`, 'warning')
            return prev
          }
          return prev.map((i) =>
            i.inventoryId === product.id ? { ...i, qty: i.qty + 1 } : i
          )
        }
        return [
          ...prev,
          {
            inventoryId: product.id,
            productId: product.product_id,
            barcode: product.product_registry.barcode,
            name: product.product_registry.name,
            brand: product.product_registry.brand,
            size: product.product_registry.size,
            color: product.product_registry.color,
            price: product.sell_price,
            qty: 1,
            maxQty: product.quantity,
          },
        ]
      })
    },
    [showToast]
  )

  const incrementQty = useCallback(
    (inventoryId: string) => {
      setCart((prev) =>
        prev.map((i) => {
          if (i.inventoryId !== inventoryId) return i
          if (i.qty >= i.maxQty) {
            showToast(`Disponibilità massima raggiunta per "${i.name}"`, 'warning')
            return i
          }
          return { ...i, qty: i.qty + 1 }
        })
      )
    },
    [showToast]
  )

  const decrementQty = useCallback((inventoryId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.inventoryId === inventoryId ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    )
  }, [])

  const removeFromCart = useCallback((inventoryId: string) => {
    setCart((prev) => prev.filter((i) => i.inventoryId !== inventoryId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const selectScannerSuggestion = useCallback(
    (product: InventoryProduct) => {
      addToCart(product)
      setBarcodeValue('')
      setScannerOpen(false)
      setScannerActiveIndex(-1)
      focusBarcode()
    },
    [addToCart, focusBarcode]
  )

  const toggleSaleExpand = useCallback((saleId: string) => {
    setExpandedSales((prev) => ({ ...prev, [saleId]: !prev[saleId] }))
  }, [])

  // ---------------------------------------------------------------------------
  // Barcode scan → add to cart
  // ---------------------------------------------------------------------------

  const handleBarcodeScan = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = barcodeValue.trim()
      if (!trimmed) return

      if (scannerOpen && scannerActiveIndex >= 0 && scannerSuggestions[scannerActiveIndex]) {
        addToCart(scannerSuggestions[scannerActiveIndex])
        setBarcodeValue('')
        setScannerOpen(false)
        setScannerActiveIndex(-1)
        focusBarcode()
        return
      }

      setScanLoading(true)

      // Look up in inventory (joined) by barcode
      const { data, error } = await supabase
        .from('inventory')
        .select('*, product_registry(*)')
        .eq('product_registry.barcode', trimmed)
        .gt('quantity', 0)
        .maybeSingle()

      setScanLoading(false)
      setBarcodeValue('')
      setScannerOpen(false)
      setScannerActiveIndex(-1)

      if (error || !data) {
        // Try by barcode through product_registry join
        const { data: invData } = await supabase
          .from('inventory')
          .select('*, product_registry!inner(*)')
          .eq('product_registry.barcode', trimmed)
          .gt('quantity', 0)
          .maybeSingle()

        if (!invData) {
          showToast(`Prodotto non trovato o esaurito: "${trimmed}"`, 'error')
          focusBarcode()
          return
        }
        addToCart(invData as InventoryProduct)
        focusBarcode()
        return
      }

      addToCart(data as InventoryProduct)
      focusBarcode()
    },
    [barcodeValue, scannerOpen, scannerActiveIndex, scannerSuggestions, supabase, showToast, focusBarcode, addToCart]
  )

  // ---------------------------------------------------------------------------
  // Cart totals
  // ---------------------------------------------------------------------------

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartItemCount = cart.reduce((sum, i) => sum + i.qty, 0)

  // ---------------------------------------------------------------------------
  // Payment confirmation
  // ---------------------------------------------------------------------------

  const handleConfirmSale = useCallback(async () => {
    if (cart.length === 0 || !paymentMethod) return
    setConfirmLoading(true)

    // Insert sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        payment_method: paymentMethod,
        total: cartTotal,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saleError || !saleData) {
      showToast('Errore durante la creazione della vendita', 'error')
      setConfirmLoading(false)
      return
    }

    // Insert sale items
    const saleItems = cart.map((item) => ({
      sale_id: saleData.id,
      product_id: item.productId,
      quantity: item.qty,
      unit_price: item.price,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)

    if (itemsError) {
      showToast('Errore durante il salvataggio degli articoli', 'error')
      setConfirmLoading(false)
      return
    }

    // Success
    setConfirmLoading(false)
    setPaymentMethod(null)
    setCompletedSale({
      id: saleData.id,
      total: cartTotal,
      itemCount: cartItemCount,
      method: paymentMethod,
      createdAt: saleData.created_at,
    })
    clearCart()
    fetchTodaySales(historyDate)
    fetchProducts()
  }, [
    cart,
    paymentMethod,
    cartTotal,
    cartItemCount,
    supabase,
    showToast,
    clearCart,
    fetchTodaySales,
    fetchProducts,
    historyDate,
  ])

  // ---------------------------------------------------------------------------
  // Close receipt → refocus barcode
  // ---------------------------------------------------------------------------

  const handleCloseReceipt = useCallback(() => {
    setCompletedSale(null)
    focusBarcode()
  }, [focusBarcode])

  // ---------------------------------------------------------------------------
  // Return (Reso) logic
  // ---------------------------------------------------------------------------

  const openReturnModal = useCallback(() => {
    setReturnBarcode('')
    setReturnOpen(true)
    setTimeout(() => returnBarcodeRef.current?.focus(), 80)
  }, [])

  const handleReturn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = returnBarcode.trim()
      if (!trimmed) return

      setReturnLoading(true)

      // Find the product by barcode
      const { data: invData } = await supabase
        .from('inventory')
        .select('*, product_registry!inner(*)')
        .eq('product_registry.barcode', trimmed)
        .maybeSingle()

      if (!invData) {
        showToast(`Prodotto non trovato per barcode "${trimmed}"`, 'error')
        setReturnLoading(false)
        return
      }

      const product = invData as InventoryProduct

      // Increment inventory quantity
      const { error: invError } = await supabase
        .from('inventory')
        .update({ quantity: product.quantity + 1 })
        .eq('id', product.id)

      if (invError) {
        showToast('Errore durante il ripristino della giacenza', 'error')
        setReturnLoading(false)
        return
      }

      // Register a negative sale (reso) for cash tracking
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          payment_method: 'cash' as PaymentMethod,
          total: -product.sell_price,
        })
        .select()
        .single()

      if (saleError || !saleData) {
        showToast('Giacenza aggiornata, ma errore nella registrazione del movimento di cassa', 'warning')
        setReturnLoading(false)
        setReturnOpen(false)
        fetchProducts()
        fetchTodaySales(historyDate)
        return
      }

      // Register the negative sale item
      await supabase.from('sale_items').insert({
        sale_id: saleData.id,
        product_id: product.product_id,
        quantity: -1,
        unit_price: product.sell_price,
      })

      setReturnLoading(false)
      setReturnOpen(false)
      showToast(
        `Reso registrato: "${product.product_registry.name}" — ${formatCurrency(product.sell_price)} rimborsato`,
        'success'
      )
      fetchProducts()
      fetchTodaySales(historyDate)
      focusBarcode()
    },
    [returnBarcode, supabase, showToast, fetchProducts, fetchTodaySales, focusBarcode, historyDate]
  )

  // ---------------------------------------------------------------------------
  // Storno Sale
  // ---------------------------------------------------------------------------
  const handleStornoSale = useCallback(async (sale: Sale) => {
    if (!window.confirm(`Sei sicuro di voler stornare questa vendita da ${formatCurrency(sale.total)}?\nI prodotti verranno rimessi in giacenza.`)) {
      return
    }

    setStornoLoading(sale.id)

    // 1. Ripristina quantità giacenze (nessun trigger AFTER DELETE presente)
    for (const item of sale.sale_items) {
      if (!item.product_id) continue

      const { data: invData } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product_id)
        .maybeSingle()

      if (invData) {
        await supabase
          .from('inventory')
          .update({ quantity: invData.quantity + item.quantity })
          .eq('product_id', item.product_id)
      } else {
        // Nel caso in cui l'utente abbia cancellato la riga dal magazzino
        // Ricreiamo il record in giacenza
        await supabase
          .from('inventory')
          .insert({
            product_id: item.product_id,
            quantity: item.quantity,
            sell_price: item.unit_price,
            purchase_price: 0,
            updated_at: new Date().toISOString()
          })
      }
    }

    // 2. Elimina record vendita (cascade eliminerà sale_items)
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', sale.id)

    setStornoLoading(null)

    if (error) {
      showToast(`Errore durante lo storno: ${error.message}`, 'error')
    } else {
      showToast('Vendita stornata con successo', 'success')
      fetchTodaySales(historyDate)
      fetchProducts()
    }
  }, [supabase, showToast, fetchTodaySales, fetchProducts, historyDate])

  // ---------------------------------------------------------------------------
  // Daily total
  // ---------------------------------------------------------------------------

  const dailyTotal = todaySales.reduce((sum, s) => sum + s.total, 0)
  const soldItemsCount = todaySales.reduce(
    (sum, s) => sum + s.sale_items.reduce((inner, i) => inner + i.quantity, 0),
    0
  )

  const calendarDays = useMemo(() => {
    const year = historyMonthAnchor.getFullYear()
    const month = historyMonthAnchor.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const leadingEmpty = (firstDay.getDay() + 6) % 7
    const totalCells = Math.ceil((leadingEmpty + lastDay.getDate()) / 7) * 7
    const selectedDate = new Date(`${historyDate}T00:00:00`)

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - leadingEmpty + 1
      if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
        return { key: `empty-${index}`, date: null as Date | null, isCurrentMonth: false, isSelected: false, isToday: false }
      }
      const date = new Date(year, month, dayNumber)
      const now = new Date()
      const isSelected =
        date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate()
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()

      return {
        key: date.toISOString(),
        date,
        isCurrentMonth: true,
        isSelected,
        isToday,
      }
    })
  }, [historyMonthAnchor, historyDate])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell pageTitle="Cassa — POS">
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
              'animate-toast-in flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium backdrop-blur-sm',
              toast.type === 'success' && 'bg-success text-white',
              toast.type === 'error' && 'bg-danger text-white',
              toast.type === 'warning' && 'bg-warning text-white'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.type === 'error' && <X className="w-4 h-4 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-[1500px] mx-auto space-y-4 animate-fade-in">
        {/* ------------------------------------------------------------------ */}
        {/* Indicator Scanner                                                  */}
        {/* ------------------------------------------------------------------ */}
        {isReceivingScan && (
          <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-brand text-white px-5 py-3 rounded-full shadow-2xl animate-pulse">
            <Scan className="w-6 h-6" />
            <span className="font-bold">Scanner in ascolto...</span>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Main two-column POS layout                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-4 items-start">

          {/* ============================================================== */}
          {/* LEFT — Product selection                                         */}
          {/* ============================================================== */}
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-semibold">Disponibili</p>
                <p className="text-lg font-bold text-foreground">{products.length}</p>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-semibold">Transazioni giorno</p>
                <p className="text-lg font-bold text-foreground">{todaySales.length}</p>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-semibold">Articoli venduti</p>
                <p className="text-lg font-bold text-foreground">{soldItemsCount}</p>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/75 backdrop-blur-sm p-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-semibold">Incasso giorno</p>
                <p className="text-lg font-extrabold text-brand">{formatCurrency(dailyTotal)}</p>
              </div>
            </div>

            {/* Barcode scanner input */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 p-4">
              <form onSubmit={handleBarcodeScan}>
                <div className="flex gap-3 items-center">
                  <div ref={scannerBoxRef} className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand">
                      <Scan className="w-6 h-6" />
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeValue}
                      onChange={(e) => {
                        setBarcodeValue(e.target.value)
                        setScannerOpen(true)
                        setScannerActiveIndex(-1)
                      }}
                      onFocus={() => setScannerOpen(true)}
                      onKeyDown={(e) => {
                        if (!scannerOpen || scannerSuggestions.length === 0) return
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setScannerActiveIndex((prev) =>
                            prev < scannerSuggestions.length - 1 ? prev + 1 : 0
                          )
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setScannerActiveIndex((prev) =>
                            prev > 0 ? prev - 1 : scannerSuggestions.length - 1
                          )
                        } else if (e.key === 'Escape') {
                          setScannerOpen(false)
                        }
                      }}
                      placeholder="Scansiona barcode o digita..."
                      className={cn(
                        'w-full pl-14 pr-4 py-4 text-2xl font-mono',
                        'rounded-xl border border-surface/80 bg-white shadow-sm',
                        'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
                        'transition-all duration-200',
                        'placeholder:text-gray-300 placeholder:font-sans placeholder:text-lg'
                      )}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Scanner barcode cassa"
                    />
                    {scannerOpen && scannerSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-xl border border-surface/40 bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
                        <ul className="max-h-72 overflow-y-auto py-1">
                          {scannerSuggestions.map((product, index) => {
                            const pr = product.product_registry
                            return (
                              <li key={product.id}>
                                <button
                                  type="button"
                                  onClick={() => selectScannerSuggestion(product)}
                                  className={cn(
                                    'w-full text-left px-3 py-2.5 border-b last:border-b-0 border-surface/20 transition-colors',
                                    index === scannerActiveIndex ? 'bg-brand/10' : 'hover:bg-surface/20'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold truncate">{pr.name}</p>
                                      <p className="text-xs text-foreground/55 truncate">
                                        {pr.barcode} · {pr.brand || 'N/D'} · {pr.size} · {pr.color}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-sm font-bold text-brand">{formatCurrency(product.sell_price)}</p>
                                      <p className="text-xs text-foreground/50">{product.quantity} pz</p>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={scanLoading}
                    className="shrink-0 h-[64px] px-6"
                  >
                    <Scan className="w-5 h-5 mr-2" />
                    Aggiungi
                  </Button>
                </div>
              </form>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setProductMenuOpen(true)}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Lista Prodotti
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setHistoryOpen(true)
                    fetchTodaySales(historyDate)
                  }}
                >
                  <ReceiptText className="w-4 h-4 mr-2" />
                  Storico
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openReturnModal}
                  className="text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reso
                </Button>
                <div className="ml-auto text-xs text-foreground/50">
                  Modalita rapida: scanner + azioni
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT — Cart + Payment                                           */}
          {/* ============================================================== */}
          <div className="w-full space-y-4 xl:sticky xl:top-4">

            {/* Cart panel */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 overflow-hidden">
              {/* Cart header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface/20 bg-surface-light/20">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-brand" />
                  <h2 className="font-bold text-lg">Carrello</h2>
                  {cartItemCount > 0 && (
                    <span className="bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full ring-2 ring-white/60">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-danger transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Svuota
                  </button>
                )}
              </div>

              {/* Cart items */}
              <div className="divide-y divide-surface/20 max-h-[380px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-foreground/30 gap-3">
                    <ShoppingCart className="w-10 h-10 opacity-40" />
                    <p className="text-sm font-medium">Carrello vuoto</p>
                    <p className="text-xs text-center px-4">
                      Scansiona un barcode o clicca su un prodotto per aggiungerlo
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.inventoryId}
                      className="flex items-center gap-3 px-4 py-3 bg-white/40 hover:bg-brand/[0.04] transition-colors duration-200"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">
                          {item.name}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-xs text-foreground/55">
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Barcode:</span> {item.barcode}
                          </p>
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Brand:</span> {item.brand || 'N/D'}
                          </p>
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Taglia:</span> {item.size || '-'}
                          </p>
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Colore:</span> {item.color || '-'}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-brand mt-0.5">
                          Prezzo vendita: {formatCurrency(item.price)}
                        </p>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => decrementQty(item.inventoryId)}
                          className="w-8 h-8 rounded-lg bg-surface-light/50 hover:bg-surface/60 flex items-center justify-center transition-colors duration-200"
                          aria-label="Diminuisci quantità"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-base">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => incrementQty(item.inventoryId)}
                          disabled={item.qty >= item.maxQty}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200',
                            item.qty >= item.maxQty
                              ? 'bg-surface/20 text-foreground/20 cursor-not-allowed'
                              : 'bg-surface-light/50 hover:bg-surface/60'
                          )}
                          aria-label="Aumenta quantità"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="text-right shrink-0 w-20">
                        <p className="font-bold text-sm">
                          {formatCurrency(item.price * item.qty)}
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.inventoryId)}
                        className="w-7 h-7 rounded-lg text-foreground/30 hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors duration-200 shrink-0"
                        aria-label={`Rimuovi ${item.name} dal carrello`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              <div className="px-5 py-4 border-t border-surface/20 bg-surface-light/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                    Totale
                  </span>
                  <span
                    className={cn(
                      'font-extrabold text-3xl transition-all',
                      cart.length === 0 ? 'text-foreground/20' : 'text-foreground'
                    )}
                  >
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
                {cartItemCount > 0 && (
                  <p className="text-xs text-foreground/40 text-right mt-0.5">
                    {cartItemCount} {cartItemCount === 1 ? 'articolo' : 'articoli'}
                  </p>
                )}
              </div>
            </div>

            {/* Payment buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cart.length > 0 && setPaymentMethod('cash')}
                disabled={cart.length === 0}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-2xl py-5 px-4',
                  'font-bold text-lg transition-all duration-200 select-none min-h-[50px]',
                  'focus:outline-none focus:ring-4 focus:ring-brand/30',
                  cart.length === 0
                    ? 'bg-surface/30 text-foreground/25 cursor-not-allowed'
                    : 'bg-gradient-to-br from-brand to-brand-dark text-white hover:shadow-xl active:scale-[0.97] shadow-lg cursor-pointer'
                )}
                aria-label="Pagamento contanti"
              >
                <Banknote className="w-10 h-10" />
                <span>CONTANTI</span>
              </button>

              <button
                onClick={() => cart.length > 0 && setPaymentMethod('pos')}
                disabled={cart.length === 0}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-2xl py-5 px-4',
                  'font-bold text-lg transition-all duration-200 select-none min-h-[50px]',
                  'focus:outline-none focus:ring-4 focus:ring-blue-300/30',
                  cart.length === 0
                    ? 'bg-surface/30 text-foreground/25 cursor-not-allowed'
                    : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white hover:shadow-xl active:scale-[0.97] shadow-lg cursor-pointer'
                )}
                aria-label="Pagamento POS / Carta"
              >
                <CreditCard className="w-10 h-10" />
                <span>POS / CARTA</span>
              </button>
            </div>

            {/* Return (Reso) button */}
            <button
              onClick={openReturnModal}
              className={cn(
                'w-full flex items-center justify-center gap-3 rounded-2xl py-4 px-4 min-h-[50px]',
                'font-bold text-base transition-all duration-200 select-none',
                'focus:outline-none focus:ring-4 focus:ring-amber-300/30',
                'bg-gradient-to-br from-amber-400 to-amber-600 text-white hover:shadow-lg active:scale-[0.98] shadow-md cursor-pointer'
              )}
              aria-label="Effettua reso"
            >
              <RotateCcw className="w-6 h-6" />
              <span>EFFETTUA RESO</span>
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Sales history (collapsible)                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 overflow-hidden">
          <button
            onClick={() => {
              setHistoryOpen((v) => !v)
              if (!historyOpen) fetchTodaySales(historyDate)
            }}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-light/20 transition-colors duration-200"
            aria-expanded={historyOpen}
          >
            <div className="flex items-center gap-3">
              <ReceiptText className="w-5 h-5 text-brand" />
              <span className="font-bold text-base">Storico Transazioni</span>
              {todaySales.length > 0 && (
                <span className="text-sm text-foreground/50">
                  ({todaySales.length} {todaySales.length === 1 ? 'transazione' : 'transazioni'} &middot;{' '}
                  <span className="font-semibold text-foreground">{formatCurrency(dailyTotal)}</span>)
                </span>
              )}
            </div>
            {historyOpen ? (
              <ChevronUp className="w-5 h-5 text-foreground/40" />
            ) : (
              <ChevronDown className="w-5 h-5 text-foreground/40" />
            )}
          </button>

          {historyOpen && (
            <div className="border-t border-surface/20">
              <div className="px-5 py-4 border-b border-surface/20 bg-surface-light/10 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                    Calendario transazioni
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryMonthAnchor(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                        )
                      }
                      className="w-8 h-8 rounded-lg border border-surface/40 bg-white hover:bg-surface/20 text-foreground/60 flex items-center justify-center"
                      aria-label="Mese precedente"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <p className="text-sm font-semibold min-w-[140px] text-center capitalize">
                      {monthLabel(historyMonthAnchor)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryMonthAnchor(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                      }
                      className="w-8 h-8 rounded-lg border border-surface/40 bg-white hover:bg-surface/20 text-foreground/60 flex items-center justify-center"
                      aria-label="Mese successivo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-foreground/45">
                  <span>Lun</span>
                  <span>Mar</span>
                  <span>Mer</span>
                  <span>Gio</span>
                  <span>Ven</span>
                  <span>Sab</span>
                  <span>Dom</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) =>
                    day.date ? (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          const selected = toLocalDateInputValue(day.date!)
                          setHistoryDate(selected)
                        }}
                        className={cn(
                          'h-10 rounded-lg text-sm font-medium transition-all border',
                          day.isSelected
                            ? 'bg-brand text-white border-brand shadow'
                            : 'bg-white border-surface/30 hover:bg-brand/10 hover:border-brand/30 text-foreground/75',
                          day.isToday && !day.isSelected && 'ring-2 ring-brand/25'
                        )}
                      >
                        {day.date.getDate()}
                      </button>
                    ) : (
                      <div key={day.key} className="h-10 rounded-lg bg-transparent border border-transparent" />
                    )
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-foreground/50">
                    Giorno selezionato: <span className="font-semibold text-foreground/70">{historyDate}</span>
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchTodaySales(historyDate)}
                    className="shrink-0"
                  >
                    Aggiorna
                  </Button>
                </div>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-10 text-foreground/40">
                  <div className="w-6 h-6 border-3 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
                  Caricamento...
                </div>
              ) : todaySales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-foreground/40 gap-2">
                  <Clock className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Nessuna transazione per il giorno selezionato</p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="grid grid-cols-3 divide-x divide-surface/20 border-b border-surface/20">
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                        Vendite
                      </p>
                      <p className="text-2xl font-bold">{todaySales.length}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                        Articoli venduti
                      </p>
                      <p className="text-2xl font-bold">{soldItemsCount}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-1">
                        Incasso totale
                      </p>
                      <p className="text-2xl font-bold text-brand">
                        {formatCurrency(dailyTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Sales table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface/20 bg-surface-light/10">
                          <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Data / Ora
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Metodo
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Articoli
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Totale
                          </th>
                          <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Dettagli
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface/20">
                        {todaySales.map((sale, index) => {
                          const itemCount = sale.sale_items.reduce(
                            (sum, i) => sum + i.quantity,
                            0
                          )
                          const isExpanded = !!expandedSales[sale.id]
                          return (
                            <Fragment key={sale.id}>
                              <tr
                                className={cn(
                                  'hover:bg-brand/[0.04] transition-colors duration-200',
                                  index % 2 === 0 ? 'bg-transparent' : 'bg-surface-light/20'
                                )}
                              >
                                <td className="px-5 py-3 font-mono text-foreground/70">
                                  {dateTimeLabel(sale.created_at)}
                                </td>
                                <td className="px-5 py-3">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1',
                                      sale.payment_method === 'cash'
                                        ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                                        : 'bg-blue-50 text-blue-600 ring-blue-200'
                                    )}
                                  >
                                    {sale.payment_method === 'cash' ? (
                                      <>
                                        <Banknote className="w-3.5 h-3.5" />
                                        Contanti
                                      </>
                                    ) : (
                                      <>
                                        <CreditCard className="w-3.5 h-3.5" />
                                        POS / Carta
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-foreground/60">
                                  <span className="font-semibold text-foreground">
                                    {itemCount}
                                  </span>{' '}
                                  {itemCount === 1 ? 'articolo' : 'articoli'}
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-foreground">
                                  {formatCurrency(sale.total)}
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleSaleExpand(sale.id)}
                                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface/25 hover:bg-brand/10 text-foreground/70 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    {isExpanded ? 'Nascondi' : 'Apri'}
                                  </button>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => handleStornoSale(sale)}
                                    disabled={stornoLoading === sale.id}
                                    className={cn(
                                      'text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors duration-200 ml-auto font-medium',
                                      stornoLoading === sale.id
                                        ? 'text-danger/50 bg-danger/5 cursor-not-allowed'
                                        : 'text-danger hover:bg-danger/10 cursor-pointer'
                                    )}
                                    title="Storna Pagamento"
                                  >
                                    {stornoLoading === sale.id ? (
                                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    Storna
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-brand/[0.03]">
                                  <td colSpan={6} className="px-5 py-4">
                                    <div className="rounded-xl border border-brand/15 bg-white/85 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
                                        Dettaglio articoli transazione
                                      </p>
                                      <div className="space-y-2">
                                        {sale.sale_items.map((si) => (
                                          <div
                                            key={si.id}
                                            className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs rounded-lg bg-surface-light/20 px-3 py-2 border border-surface/20"
                                          >
                                            <p className="md:col-span-2 font-semibold text-foreground/85">
                                              {si.product_registry?.name || 'Prodotto'}
                                            </p>
                                            <p className="text-foreground/60">
                                              Barcode: {si.product_registry?.barcode || '-'}
                                            </p>
                                            <p className="text-foreground/60">
                                              Brand: {si.product_registry?.brand || 'N/D'}
                                            </p>
                                            <p className="text-foreground/60">
                                              Qta: <span className="font-semibold">{si.quantity}</span>
                                            </p>
                                            <p className="text-foreground/70 md:text-right">
                                              {formatCurrency(si.unit_price)}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Product menu modal                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={productMenuOpen}
        onClose={() => setProductMenuOpen(false)}
        title="Seleziona articolo dal catalogo"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              <input
                type="text"
                value={productMenuQuery}
                onChange={(e) => setProductMenuQuery(e.target.value)}
                placeholder="Cerca per barcode, nome, brand, taglia, colore..."
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 text-sm',
                  'rounded-xl border border-surface/80 bg-white shadow-sm',
                  'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
                  'placeholder:text-gray-400 transition-all duration-200'
                )}
              />
            </div>
            <select
              value={productSortBy}
              onChange={(e) => setProductSortBy(e.target.value as 'name' | 'brand' | 'size' | 'price' | 'quantity')}
              className={cn(
                'w-full rounded-xl border border-surface/80 bg-white px-3 py-2.5 text-sm shadow-sm',
                'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15'
              )}
            >
              <option value="name">Ordina: Nome</option>
              <option value="brand">Ordina: Brand</option>
              <option value="size">Ordina: Taglia</option>
              <option value="price">Ordina: Prezzo</option>
              <option value="quantity">Ordina: Giacenza</option>
            </select>
          </div>

          <div className="text-xs text-foreground/50">
            {productMenuItems.length} articoli disponibili
          </div>

          <div className="max-h-[58vh] overflow-y-auto rounded-xl border border-surface/20 divide-y divide-surface/20">
            {productsLoading ? (
              <div className="flex items-center justify-center py-12 text-foreground/40">
                <div className="w-7 h-7 border-4 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
                Caricamento prodotti...
              </div>
            ) : productMenuItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-foreground/50">
                Nessun articolo disponibile con i filtri selezionati.
              </div>
            ) : (
              productMenuItems.map((product) => {
                const pr = product.product_registry
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      addToCart(product)
                      focusBarcode()
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-brand/[0.06] transition-colors"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-2 text-sm">
                      <p className="lg:col-span-2 font-semibold truncate">{pr.name}</p>
                      <p className="text-foreground/60 truncate">{pr.brand || 'N/D'}</p>
                      <p className="text-foreground/60 truncate">Taglia {pr.size || '-'}</p>
                      <p className="font-semibold text-brand">{formatCurrency(product.sell_price)}</p>
                      <p className="text-foreground/60 text-right">{product.quantity} pz</p>
                    </div>
                    <p className="text-xs text-foreground/50 mt-1 truncate">
                      {pr.barcode} · {pr.color || '-'}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Payment confirmation modal                                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!paymentMethod}
        onClose={() => !confirmLoading && setPaymentMethod(null)}
        title={
          paymentMethod === 'cash'
            ? 'Conferma pagamento — Contanti'
            : 'Conferma pagamento — POS / Carta'
        }
        size="md"
      >
        {paymentMethod && (
          <div className="space-y-5">
            {/* Payment method badge */}
            <div
              className={cn(
                'flex items-center justify-center gap-3 p-5 rounded-2xl',
                paymentMethod === 'cash'
                  ? 'bg-emerald-50 ring-1 ring-emerald-200'
                  : 'bg-blue-50 ring-1 ring-blue-200'
              )}
            >
              {paymentMethod === 'cash' ? (
                <Banknote className="w-10 h-10 text-emerald-600" />
              ) : (
                <CreditCard className="w-10 h-10 text-blue-600" />
              )}
              <span
                className={cn(
                  'text-3xl font-extrabold',
                  paymentMethod === 'cash' ? 'text-emerald-600' : 'text-blue-600'
                )}
              >
                {paymentMethod === 'cash' ? 'CONTANTI' : 'POS / CARTA'}
              </span>
            </div>

            {/* Order summary */}
            <div className="bg-surface-light/30 rounded-xl p-4 space-y-2 border border-surface/20">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Articoli nel carrello</span>
                <span className="font-semibold">
                  {cartItemCount} {cartItemCount === 1 ? 'articolo' : 'articoli'}
                </span>
              </div>
              {cart.map((item) => (
                <div
                  key={item.inventoryId}
                  className="flex justify-between text-sm border-t border-surface/20 pt-2"
                >
                  <span className="text-foreground/70">
                    {item.name}{' '}
                    <span className="text-foreground/40">
                      {item.size} &middot; {item.color} x{item.qty}
                    </span>
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Big total */}
            <div className="flex items-center justify-between px-2">
              <span className="text-lg font-bold text-foreground/70">TOTALE</span>
              <span className="text-4xl font-extrabold text-foreground">
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="primary"
                size="lg"
                loading={confirmLoading}
                onClick={handleConfirmSale}
                className={cn(
                  'flex-1 text-xl py-5',
                  paymentMethod === 'pos' && 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300'
                )}
              >
                <CheckCircle2 className="w-6 h-6 mr-2" />
                Conferma Vendita
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setPaymentMethod(null)}
                disabled={confirmLoading}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Sale receipt / success modal                                         */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!completedSale}
        onClose={handleCloseReceipt}
        title="Vendita completata"
        size="sm"
      >
        {completedSale && (
          <div className="space-y-5 text-center">
            {/* Big success icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
            </div>

            <div>
              <p className="text-2xl font-extrabold text-foreground">
                {formatCurrency(completedSale.total)}
              </p>
              <p className="text-foreground/50 text-sm mt-1">
                {completedSale.itemCount}{' '}
                {completedSale.itemCount === 1 ? 'articolo venduto' : 'articoli venduti'}
              </p>
            </div>

            <div className="bg-surface-light/30 rounded-xl p-4 space-y-2 text-sm text-left border border-surface/20">
              <div className="flex justify-between">
                <span className="text-foreground/60">Metodo</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold',
                    completedSale.method === 'cash' ? 'text-emerald-600' : 'text-blue-600'
                  )}
                >
                  {completedSale.method === 'cash' ? (
                    <>
                      <Banknote className="w-4 h-4" />
                      Contanti
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      POS / Carta
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">Ora</span>
                <span className="font-mono font-medium">
                  {timeOnly(completedSale.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">ID Vendita</span>
                <span className="font-mono text-xs text-foreground/40 truncate max-w-[140px]">
                  {completedSale.id}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleCloseReceipt}
              className="w-full text-lg"
            >
              Nuova Vendita
            </Button>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Return (Reso) modal                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={returnOpen}
        onClose={() => !returnLoading && setReturnOpen(false)}
        title="Effettua Reso"
        size="md"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-amber-50 ring-1 ring-amber-200">
            <RotateCcw className="w-10 h-10 text-amber-600" />
            <span className="text-2xl font-extrabold text-amber-700">RESO</span>
          </div>

          <p className="text-sm text-foreground/60 text-center">
            Scansiona o digita il barcode del prodotto da rendere.
            La giacenza verra incrementata e un movimento di cassa negativo registrato.
          </p>

          <form onSubmit={handleReturn}>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600">
                  <Scan className="w-5 h-5" />
                </div>
                <input
                  ref={returnBarcodeRef}
                  type="text"
                  value={returnBarcode}
                  onChange={(e) => setReturnBarcode(e.target.value)}
                  placeholder="Barcode prodotto..."
                  className={cn(
                    'w-full pl-12 pr-4 py-4 text-xl font-mono',
                    'rounded-xl border border-amber-300/80 bg-white shadow-sm',
                    'focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-200/40 focus:shadow-md',
                    'transition-all duration-200',
                    'placeholder:text-gray-300 placeholder:font-sans placeholder:text-base'
                  )}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Barcode prodotto per reso"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={returnLoading}
                disabled={!returnBarcode.trim()}
                className="flex-1 min-h-[50px] bg-amber-500 hover:bg-amber-600 focus:ring-amber-300"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Conferma Reso
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setReturnOpen(false)}
                disabled={returnLoading}
                className="min-h-[50px]"
              >
                Annulla
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </AppShell>
  )
}
