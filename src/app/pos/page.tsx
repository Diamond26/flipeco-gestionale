'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  name: string
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

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function timeOnly(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function POSPage() {
  const supabase = createClient()

  // --- Refs ---
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const toastCounter = useRef(0)

  // --- Barcode ---
  const [barcodeValue, setBarcodeValue] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [isReceivingScan, setIsReceivingScan] = useState(false)

  // --- Products grid ---
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stornoLoading, setStornoLoading] = useState<string | null>(null)

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

  const fetchTodaySales = useCallback(async () => {
    setHistoryLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, product_registry(*))')
      .gte('created_at', todayStart())
      .order('created_at', { ascending: false })

    if (!error) {
      setTodaySales((data as Sale[]) ?? [])
    }
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTodaySales()
  }, [fetchTodaySales])

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
            name: product.product_registry.name,
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

  // ---------------------------------------------------------------------------
  // Barcode scan → add to cart
  // ---------------------------------------------------------------------------

  const handleBarcodeScan = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = barcodeValue.trim()
      if (!trimmed) return

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
    [barcodeValue, supabase, showToast, focusBarcode, addToCart]
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
    fetchTodaySales()
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
        fetchTodaySales()
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
      fetchTodaySales()
      focusBarcode()
    },
    [returnBarcode, supabase, showToast, fetchProducts, fetchTodaySales, focusBarcode]
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
      fetchTodaySales()
      fetchProducts()
    }
  }, [supabase, showToast, fetchTodaySales, fetchProducts])

  // ---------------------------------------------------------------------------
  // Filtered products grid
  // ---------------------------------------------------------------------------

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const pr = p.product_registry
    return (
      pr.name?.toLowerCase().includes(q) ||
      pr.color?.toLowerCase().includes(q) ||
      pr.size?.toLowerCase().includes(q) ||
      pr.barcode?.toLowerCase().includes(q) ||
      pr.sku?.toLowerCase().includes(q)
    )
  })

  // ---------------------------------------------------------------------------
  // Daily total
  // ---------------------------------------------------------------------------

  const dailyTotal = todaySales.reduce((sum, s) => sum + s.total, 0)

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
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
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

      <div className="max-w-[1600px] mx-auto space-y-4">
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
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ============================================================== */}
          {/* LEFT — Product selection                                         */}
          {/* ============================================================== */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Barcode scanner input */}
            <div className="bg-card rounded-2xl border border-surface/50 shadow-sm p-4">
              <form onSubmit={handleBarcodeScan}>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand">
                      <Scan className="w-6 h-6" />
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value)}
                      placeholder="Scansiona barcode o digita..."
                      className={cn(
                        'w-full pl-14 pr-4 py-4 text-2xl font-mono rounded-xl border-2 bg-white',
                        'focus:outline-none focus:ring-4 transition-all duration-200',
                        'placeholder:text-gray-300 placeholder:font-sans placeholder:text-lg',
                        'border-surface focus:border-brand focus:ring-brand/20'
                      )}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Scanner barcode cassa"
                    />
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

            {/* Product grid header + search */}
            <div className="bg-card rounded-2xl border border-surface/50 shadow-sm">
              <div className="flex items-center gap-3 p-4 border-b border-surface/40">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Cerca prodotto per nome, taglia, colore..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-surface bg-white',
                      'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/20',
                      'placeholder:text-gray-400 transition-all duration-200'
                    )}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        focusBarcode()
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                      aria-label="Cancella ricerca"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <span className="text-sm text-foreground/50 shrink-0">
                  {filteredProducts.length} art.
                </span>
              </div>

              {/* Product cards grid */}
              <div className="p-4">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-16 text-foreground/40">
                    <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
                    Caricamento prodotti...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-foreground/40 gap-3">
                    <ShoppingCart className="w-12 h-12 opacity-30" />
                    <p className="text-sm">
                      {searchQuery
                        ? `Nessun prodotto trovato per "${searchQuery}"`
                        : 'Nessun prodotto disponibile in magazzino'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredProducts.map((product) => {
                      const inCart = cart.find((i) => i.inventoryId === product.id)
                      const pr = product.product_registry
                      return (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className={cn(
                            'relative text-left p-3 rounded-xl border-2 transition-all duration-150',
                            'hover:border-brand hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                            'focus:outline-none focus:ring-4 focus:ring-brand/30',
                            'cursor-pointer bg-white',
                            inCart
                              ? 'border-brand bg-brand/5 shadow-sm'
                              : 'border-surface/60'
                          )}
                          aria-label={`Aggiungi ${pr.name} taglia ${pr.size} al carrello`}
                        >
                          {/* In-cart badge */}
                          {inCart && (
                            <span className="absolute top-2 right-2 w-5 h-5 bg-brand text-white text-xs font-bold rounded-full flex items-center justify-center">
                              {inCart.qty}
                            </span>
                          )}

                          {/* Color swatch */}
                          <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center mb-2 shrink-0">
                            <span className="text-sm font-bold text-foreground/60">
                              {pr.size || '?'}
                            </span>
                          </div>

                          <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2 mb-1">
                            {pr.name}
                          </p>
                          <p className="text-xs text-foreground/50 mb-2">{pr.color}</p>

                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-brand">
                              {formatCurrency(product.sell_price)}
                            </span>
                            <span
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded-md font-medium',
                                product.quantity <= 3
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-surface text-foreground/60'
                              )}
                            >
                              {product.quantity} pz
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT — Cart + Payment                                           */}
          {/* ============================================================== */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 space-y-4 lg:sticky lg:top-4">

            {/* Cart panel */}
            <div className="bg-card rounded-2xl border border-surface/50 shadow-sm overflow-hidden">
              {/* Cart header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface/40 bg-surface-light/40">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-brand" />
                  <h2 className="font-bold text-lg">Carrello</h2>
                  {cartItemCount > 0 && (
                    <span className="bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Svuota
                  </button>
                )}
              </div>

              {/* Cart items */}
              <div className="divide-y divide-surface/30 max-h-[380px] overflow-y-auto">
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
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-foreground/50 mt-0.5">
                          {item.size} &middot; {item.color}
                        </p>
                        <p className="text-xs font-semibold text-brand mt-0.5">
                          {formatCurrency(item.price)} cad.
                        </p>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => decrementQty(item.inventoryId)}
                          className="w-8 h-8 rounded-lg bg-surface-light hover:bg-surface flex items-center justify-center transition-colors"
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
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            item.qty >= item.maxQty
                              ? 'bg-surface/40 text-foreground/20 cursor-not-allowed'
                              : 'bg-surface-light hover:bg-surface'
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
                        className="w-7 h-7 rounded-lg text-foreground/30 hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors shrink-0"
                        aria-label={`Rimuovi ${item.name} dal carrello`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              <div className="px-5 py-4 border-t border-surface/40 bg-surface-light/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground/60 uppercase tracking-wide">
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
                  'flex flex-col items-center justify-center gap-2 rounded-2xl py-7 px-4',
                  'font-bold text-xl transition-all duration-150 select-none min-h-[50px]',
                  'focus:outline-none focus:ring-4 focus:ring-brand/30',
                  cart.length === 0
                    ? 'bg-surface/40 text-foreground/25 cursor-not-allowed'
                    : 'bg-brand text-white hover:bg-brand-dark active:scale-[0.97] shadow-lg hover:shadow-xl cursor-pointer'
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
                  'flex flex-col items-center justify-center gap-2 rounded-2xl py-7 px-4',
                  'font-bold text-xl transition-all duration-150 select-none min-h-[50px]',
                  'focus:outline-none focus:ring-4 focus:ring-blue-300',
                  cart.length === 0
                    ? 'bg-surface/40 text-foreground/25 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97] shadow-lg hover:shadow-xl cursor-pointer'
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
                'font-bold text-base transition-all duration-150 select-none',
                'focus:outline-none focus:ring-4 focus:ring-yellow-300',
                'bg-yellow-500 text-white hover:bg-yellow-600 active:scale-[0.98] shadow-md hover:shadow-lg cursor-pointer'
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
        <div className="bg-card rounded-2xl border border-surface/50 shadow-sm overflow-hidden">
          <button
            onClick={() => {
              setHistoryOpen((v) => !v)
              if (!historyOpen) fetchTodaySales()
            }}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-light/40 transition-colors"
            aria-expanded={historyOpen}
          >
            <div className="flex items-center gap-3">
              <ReceiptText className="w-5 h-5 text-brand" />
              <span className="font-bold text-base">Vendite di oggi</span>
              {todaySales.length > 0 && (
                <span className="text-sm text-foreground/50">
                  ({todaySales.length} {todaySales.length === 1 ? 'vendita' : 'vendite'} &middot;{' '}
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
            <div className="border-t border-surface/40">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10 text-foreground/40">
                  <div className="w-6 h-6 border-3 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
                  Caricamento...
                </div>
              ) : todaySales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-foreground/40 gap-2">
                  <Clock className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Nessuna vendita registrata oggi</p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="grid grid-cols-3 divide-x divide-surface/40 border-b border-surface/40">
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
                        Vendite
                      </p>
                      <p className="text-2xl font-bold">{todaySales.length}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
                        Articoli venduti
                      </p>
                      <p className="text-2xl font-bold">
                        {todaySales.reduce(
                          (sum, s) => sum + s.sale_items.reduce((si, i) => si + i.quantity, 0),
                          0
                        )}
                      </p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-1">
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
                        <tr className="border-b border-surface/40 bg-surface-light/30">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                            Ora
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                            Metodo
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                            Articoli
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                            Totale
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface/20">
                        {todaySales.map((sale) => {
                          const itemCount = sale.sale_items.reduce(
                            (sum, i) => sum + i.quantity,
                            0
                          )
                          return (
                            <tr
                              key={sale.id}
                              className="hover:bg-surface-light/30 transition-colors"
                            >
                              <td className="px-5 py-3 font-mono text-foreground/70">
                                {timeOnly(sale.created_at)}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
                                    sale.payment_method === 'cash'
                                      ? 'bg-brand/10 text-brand'
                                      : 'bg-blue-100 text-blue-700'
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
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {sale.sale_items.map((si) => (
                                    <span
                                      key={si.id}
                                      className="text-xs bg-surface rounded-md px-1.5 py-0.5 text-foreground/60"
                                    >
                                      {si.product_registry?.name} ×{si.quantity}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right font-bold text-foreground">
                                {formatCurrency(sale.total)}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => handleStornoSale(sale)}
                                  disabled={stornoLoading === sale.id}
                                  className={cn(
                                    "text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ml-auto font-medium",
                                    stornoLoading === sale.id 
                                      ? "text-danger/50 bg-danger/5 cursor-not-allowed" 
                                      : "text-danger hover:bg-danger/10 cursor-pointer"
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
                  ? 'bg-brand/10'
                  : 'bg-blue-50'
              )}
            >
              {paymentMethod === 'cash' ? (
                <Banknote className="w-10 h-10 text-brand" />
              ) : (
                <CreditCard className="w-10 h-10 text-blue-600" />
              )}
              <span
                className={cn(
                  'text-3xl font-extrabold',
                  paymentMethod === 'cash' ? 'text-brand' : 'text-blue-600'
                )}
              >
                {paymentMethod === 'cash' ? 'CONTANTI' : 'POS / CARTA'}
              </span>
            </div>

            {/* Order summary */}
            <div className="bg-surface-light/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Articoli nel carrello</span>
                <span className="font-semibold">
                  {cartItemCount} {cartItemCount === 1 ? 'articolo' : 'articoli'}
                </span>
              </div>
              {cart.map((item) => (
                <div
                  key={item.inventoryId}
                  className="flex justify-between text-sm border-t border-surface/30 pt-2"
                >
                  <span className="text-foreground/70">
                    {item.name}{' '}
                    <span className="text-foreground/40">
                      {item.size} &middot; {item.color} ×{item.qty}
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
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-success" />
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

            <div className="bg-surface-light/50 rounded-xl p-4 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-foreground/60">Metodo</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold',
                    completedSale.method === 'cash' ? 'text-brand' : 'text-blue-600'
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
          <div className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-yellow-50">
            <RotateCcw className="w-10 h-10 text-yellow-600" />
            <span className="text-2xl font-extrabold text-yellow-700">RESO</span>
          </div>

          <p className="text-sm text-foreground/60 text-center">
            Scansiona o digita il barcode del prodotto da rendere.
            La giacenza verrà incrementata e un movimento di cassa negativo registrato.
          </p>

          <form onSubmit={handleReturn}>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-yellow-600">
                  <Scan className="w-5 h-5" />
                </div>
                <input
                  ref={returnBarcodeRef}
                  type="text"
                  value={returnBarcode}
                  onChange={(e) => setReturnBarcode(e.target.value)}
                  placeholder="Barcode prodotto..."
                  className={cn(
                    'w-full pl-12 pr-4 py-4 text-xl font-mono rounded-xl border-2 bg-white',
                    'focus:outline-none focus:ring-4 transition-all duration-200',
                    'placeholder:text-gray-300 placeholder:font-sans placeholder:text-base',
                    'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-200'
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
                className="flex-1 min-h-[50px] bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300"
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
