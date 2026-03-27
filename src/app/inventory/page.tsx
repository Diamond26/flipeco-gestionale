'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { exportToPDF } from '@/lib/pdf-export'
import {
  Scan,
  FileDown,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  Plus,
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
  brand?: string | null
}

interface InventoryItem {
  id: string
  product_id: string
  purchase_price: number
  sell_price: number
  quantity: number
  location: string | null
  updated_at: string
  product_registry: ProductRegistry
}

type SortField = 'name' | 'quantity' | 'sell_price' | 'purchase_price'
type SortDir = 'asc' | 'desc'

interface ScannedProduct {
  id: string
  barcode: string
  name: string
  size: string
  color: string
}

interface EditForm {
  quantity: number
  purchase_price: number
  sell_price: number
  location: string
}

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const supabase = createClient()

  // --- Refs ---
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // --- Barcode scanner state ---
  const [barcodeValue, setBarcodeValue] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null)

  // --- Add-to-inventory form state ---
  const [addForm, setAddForm] = useState({
    purchase_price: '',
    sell_price: '',
    quantity: '1',
    location: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const firstFormFieldRef = useRef<HTMLInputElement>(null)

  // --- Inventory table state ---
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [tableLoading, setTableLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // --- Edit modal state ---
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    quantity: 0,
    purchase_price: 0,
    sell_price: 0,
    location: '',
  })
  const [editLoading, setEditLoading] = useState(false)

  // --- Delete confirm state ---
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // --- Manual add modal state ---
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    barcode: '',
    name: '',
    sku: '',
    size: '',
    color: '',
    brand: '',
    category: '',
    purchase_price: '',
    sell_price: '',
    quantity: '1',
    location: '',
  })
  const [manualAddLoading, setManualAddLoading] = useState(false)

  // --- Toasts ---
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  // ---------------------------------------------------------------------------
  // Focus helpers
  // ---------------------------------------------------------------------------

  const focusBarcode = useCallback(() => {
    // Small defer to ensure DOM state has settled after re-renders
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    focusBarcode()
  }, [focusBarcode])

  // ---------------------------------------------------------------------------
  // Global barcode scanner listener
  // Captures keystrokes from barcode scanners even when focus is elsewhere.
  // ---------------------------------------------------------------------------

  const scanBufferRef = useRef('')
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isBarcode = target === barcodeInputRef.current
      const isInteractive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (isInteractive && !isBarcode) return
      if (isBarcode) return

      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Shift' || e.key === 'Tab' || e.key === 'Escape') return

      if (e.key === 'Enter' && scanBufferRef.current.length >= 4) {
        e.preventDefault()
        const code = scanBufferRef.current
        scanBufferRef.current = ''
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        setBarcodeValue(code)
        setTimeout(() => {
          barcodeInputRef.current?.form?.requestSubmit()
        }, 10)
        return
      }

      if (e.key.length === 1) {
        e.preventDefault()
        scanBufferRef.current += e.key
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = ''
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
  // Fetch inventory
  // ---------------------------------------------------------------------------

  const fetchInventory = useCallback(async () => {
    setTableLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select('*, product_registry(*)')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Supabase inventory error:', error)
      showToast(`Errore magazzino: ${error.message}`, 'error')
    } else {
      setInventory((data as InventoryItem[]) ?? [])
    }
    setTableLoading(false)
  }, [supabase, showToast])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // ---------------------------------------------------------------------------
  // Barcode scan handler
  // ---------------------------------------------------------------------------

  const handleBarcodeScan = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = barcodeValue.trim()
      if (!trimmed) return

      setScanLoading(true)
      setScanError(null)
      setScannedProduct(null)

      const { data, error } = await supabase
        .from('product_registry')
        .select('id, barcode, name, size, color')
        .eq('barcode', trimmed)
        .single()

      setScanLoading(false)

      if (error || !data) {
        setScanError(trimmed)
        return
      }

      setScannedProduct(data as ScannedProduct)
      setAddForm({ purchase_price: '', sell_price: '', quantity: '1', location: '' })

      // Shift focus to the first editable field in the add-form
      setTimeout(() => firstFormFieldRef.current?.focus(), 80)
    },
    [barcodeValue, supabase]
  )

  // ---------------------------------------------------------------------------
  // Add to inventory handler
  // ---------------------------------------------------------------------------

  const handleAddToInventory = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!scannedProduct) return

      const qty = parseInt(addForm.quantity, 10)
      const purchasePrice = parseFloat(addForm.purchase_price)
      const sellPrice = parseFloat(addForm.sell_price)

      if (!qty || qty <= 0) {
        showToast('Inserisci una quantità valida', 'error')
        return
      }

      setAddLoading(true)

      // Check if inventory row for this product_id already exists
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', scannedProduct.id)
        .maybeSingle()

      let opError: { message: string } | null = null

      if (existing) {
        // ADD quantity to existing row; update prices if provided
        const updatePayload: Record<string, unknown> = {
          quantity: existing.quantity + qty,
          updated_at: new Date().toISOString(),
        }
        if (!isNaN(purchasePrice)) updatePayload.purchase_price = purchasePrice
        if (!isNaN(sellPrice)) updatePayload.sell_price = sellPrice
        if (addForm.location.trim()) updatePayload.location = addForm.location.trim()

        const { error } = await supabase
          .from('inventory')
          .update(updatePayload)
          .eq('id', existing.id)
        opError = error
      } else {
        // Insert new row
        const { error } = await supabase.from('inventory').insert({
          product_id: scannedProduct.id,
          quantity: qty,
          purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
          sell_price: isNaN(sellPrice) ? 0 : sellPrice,
          location: addForm.location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        opError = error
      }

      setAddLoading(false)

      if (opError) {
        showToast('Errore durante il salvataggio', 'error')
        return
      }

      showToast(`"${scannedProduct.name}" aggiunto al magazzino`, 'success')
      setScannedProduct(null)
      setBarcodeValue('')
      setScanError(null)
      setAddForm({ purchase_price: '', sell_price: '', quantity: '1', location: '' })
      fetchInventory()
      focusBarcode()
    },
    [scannedProduct, addForm, supabase, showToast, fetchInventory, focusBarcode]
  )

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  const openEdit = useCallback((item: InventoryItem) => {
    setEditItem(item)
    setEditForm({
      quantity: item.quantity,
      purchase_price: item.purchase_price,
      sell_price: item.sell_price,
      location: item.location ?? '',
    })
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editItem) return
    setEditLoading(true)

    const { error } = await supabase
      .from('inventory')
      .update({
        quantity: editForm.quantity,
        purchase_price: editForm.purchase_price,
        sell_price: editForm.sell_price,
        location: editForm.location.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editItem.id)

    setEditLoading(false)

    if (error) {
      showToast('Errore durante il salvataggio', 'error')
      return
    }

    showToast('Articolo aggiornato', 'success')
    setEditItem(null)
    fetchInventory()
  }, [editItem, editForm, supabase, showToast, fetchInventory])

  // ---------------------------------------------------------------------------
  // Delete handlers
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return
    setDeleteLoading(true)

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', deleteItem.id)

    setDeleteLoading(false)

    if (error) {
      showToast('Errore durante la cancellazione', 'error')
      return
    }

    showToast(`"${deleteItem.product_registry.name}" rimosso dal magazzino`, 'success')
    setDeleteItem(null)
    fetchInventory()
  }, [deleteItem, supabase, showToast, fetchInventory])

  // ---------------------------------------------------------------------------
  // Manual add product handler
  // ---------------------------------------------------------------------------

  const handleManualAdd = useCallback(async () => {
    const name = manualForm.name.trim()
    if (!name) {
      showToast('Il nome del prodotto è obbligatorio', 'error')
      return
    }

    const qty = parseInt(manualForm.quantity, 10)
    if (!qty || qty <= 0) {
      showToast('Inserisci una quantità valida', 'error')
      return
    }

    setManualAddLoading(true)

    // 1. Create product_registry entry
    const { data: product, error: productError } = await supabase
      .from('product_registry')
      .insert({
        barcode: manualForm.barcode.trim() || null,
        name,
        sku: manualForm.sku.trim() || null,
        size: manualForm.size.trim() || null,
        color: manualForm.color.trim() || null,
        brand: manualForm.brand.trim() || null,
        category: manualForm.category.trim() || null,
      })
      .select('id')
      .single()

    if (productError || !product) {
      console.error('Error creating product:', productError)
      setManualAddLoading(false)
      showToast(`Errore creazione prodotto: ${productError?.message ?? 'sconosciuto'}`, 'error')
      return
    }

    // 2. Create inventory entry
    const purchasePrice = parseFloat(manualForm.purchase_price)
    const sellPrice = parseFloat(manualForm.sell_price)

    const { error: invError } = await supabase.from('inventory').insert({
      product_id: product.id,
      quantity: qty,
      purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
      sell_price: isNaN(sellPrice) ? 0 : sellPrice,
      location: manualForm.location.trim() || null,
      updated_at: new Date().toISOString(),
    })

    setManualAddLoading(false)

    if (invError) {
      console.error('Error creating inventory:', invError)
      showToast(`Errore aggiunta a magazzino: ${invError.message}`, 'error')
      return
    }

    showToast(`"${name}" aggiunto al magazzino`, 'success')
    setManualAddOpen(false)
    setManualForm({
      barcode: '', name: '', sku: '', size: '', color: '',
      brand: '', category: '', purchase_price: '', sell_price: '',
      quantity: '1', location: '',
    })
    fetchInventory()
  }, [manualForm, supabase, showToast, fetchInventory])

  // ---------------------------------------------------------------------------
  // Sort handler
  // ---------------------------------------------------------------------------

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('asc')
      }
    },
    [sortField]
  )

  // ---------------------------------------------------------------------------
  // Derived: filtered + sorted data
  // ---------------------------------------------------------------------------

  const filteredInventory = inventory
    .filter((item) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const pr = item.product_registry
      return (
        pr.name?.toLowerCase().includes(q) ||
        pr.barcode?.toLowerCase().includes(q) ||
        pr.sku?.toLowerCase().includes(q) ||
        pr.color?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'name':
          aVal = a.product_registry.name?.toLowerCase() ?? ''
          bVal = b.product_registry.name?.toLowerCase() ?? ''
          break
        case 'quantity':
          aVal = a.quantity
          bVal = b.quantity
          break
        case 'sell_price':
          aVal = a.sell_price
          bVal = b.sell_price
          break
        case 'purchase_price':
          aVal = a.purchase_price
          bVal = b.purchase_price
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalArticoli = inventory.reduce((sum, i) => sum + i.quantity, 0)
  const valoreInventario = inventory.reduce(
    (sum, i) => sum + i.quantity * i.sell_price,
    0
  )
  const lowStockCount = inventory.filter((i) => i.quantity > 0 && i.quantity <= 5).length
  const outOfStockCount = inventory.filter((i) => i.quantity <= 0).length

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  const handleExportPDF = useCallback(() => {
    exportToPDF({
      title: 'Inventario Magazzino',
      headers: [
        'Barcode',
        'Nome',
        'Brand',
        'Taglia',
        'Colore',
        'Quantità',
        'P. Acquisto',
        'P. Vendita',
        'Ubicazione',
      ],
      rows: filteredInventory.map((item) => [
        item.product_registry.barcode ?? '',
        item.product_registry.name ?? '',
        item.product_registry.brand ?? '',
        item.product_registry.size ?? '',
        item.product_registry.color ?? '',
        item.quantity,
        formatCurrency(item.purchase_price),
        formatCurrency(item.sell_price),
        item.location ?? '',
      ]),
      filename: `magazzino_${new Date().toISOString().slice(0, 10)}`,
    })
  }, [filteredInventory])

  // ---------------------------------------------------------------------------
  // Sort icon helper
  // ---------------------------------------------------------------------------

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-brand" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-brand" />
    )
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      key: 'barcode',
      header: 'Barcode',
      render: (row: InventoryItem) => (
        <span className="font-mono text-xs text-foreground/60">
          {row.product_registry.barcode}
        </span>
      ),
    },
    {
      key: 'name',
      header: (
        <button
          onClick={() => handleSort('name')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Nome <SortIcon field="name" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-medium">{row.product_registry.name}</span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (row: InventoryItem) => (
        <span className="text-sm font-medium text-foreground/80">
          {row.product_registry.brand || '—'}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Taglia',
      render: (row: InventoryItem) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-xs font-semibold">
          {row.product_registry.size}
        </span>
      ),
    },
    {
      key: 'color',
      header: 'Colore',
      render: (row: InventoryItem) => (
        <span className="text-sm">{row.product_registry.color}</span>
      ),
    },
    {
      key: 'quantity',
      header: (
        <button
          onClick={() => handleSort('quantity')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Quantità <SortIcon field="quantity" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => {
        const isOut = row.quantity <= 0
        const isLow = row.quantity > 0 && row.quantity <= 5
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-lg text-sm',
              isOut && 'bg-danger/10 text-danger',
              isLow && !isOut && 'bg-yellow-100 text-yellow-700',
              !isOut && !isLow && 'text-foreground'
            )}
          >
            {isOut && <AlertTriangle className="w-3.5 h-3.5" />}
            {isLow && !isOut && <AlertTriangle className="w-3.5 h-3.5" />}
            {row.quantity}
          </span>
        )
      },
    },
    {
      key: 'purchase_price',
      header: (
        <button
          onClick={() => handleSort('purchase_price')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          P. Acquisto <SortIcon field="purchase_price" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="text-foreground/70">{formatCurrency(row.purchase_price)}</span>
      ),
    },
    {
      key: 'sell_price',
      header: (
        <button
          onClick={() => handleSort('sell_price')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          P. Vendita <SortIcon field="sell_price" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-semibold text-brand">{formatCurrency(row.sell_price)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Ubicazione',
      render: (row: InventoryItem) =>
        row.location ? (
          <span className="text-sm text-foreground/60">{row.location}</span>
        ) : (
          <span className="text-sm text-foreground/30">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row: InventoryItem) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(row)
            }}
            className="p-1.5 rounded-lg hover:bg-brand/10 text-foreground/50 hover:text-brand transition-colors"
            aria-label="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteItem(row)
            }}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-foreground/50 hover:text-danger transition-colors"
            aria-label="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell pageTitle="Magazzino">
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
        {/* Barcode scanner section                                           */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <form onSubmit={handleBarcodeScan}>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 relative">
                {/* Scan icon inside input */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand">
                  <Scan className="w-5 h-5" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => {
                    setBarcodeValue(e.target.value)
                    setScanError(null)
                  }}
                  placeholder="Spara il barcode o digita..."
                  className={cn(
                    'w-full pl-12 pr-4 py-4 text-xl font-mono rounded-xl border-2 bg-white',
                    'focus:outline-none focus:ring-4 transition-all duration-200',
                    'placeholder:text-gray-300 placeholder:font-sans placeholder:text-base',
                    scanError
                      ? 'border-danger focus:border-danger focus:ring-danger/20'
                      : 'border-surface focus:border-brand focus:ring-brand/20'
                  )}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Campo barcode scanner"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={scanLoading}
                className="whitespace-nowrap shrink-0"
              >
                <Scan className="w-4 h-4 mr-2" />
                Cerca
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setManualAddOpen(true)}
                className="whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Manualmente
              </Button>
            </div>
          </form>

          {/* Scan error: product not found */}
          {scanError && (
            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-800">
                  Prodotto non trovato in anagrafica
                </p>
                <p className="text-yellow-700 mt-0.5">
                  Barcode:{' '}
                  <span className="font-mono font-bold">{scanError}</span>
                </p>
                <a
                  href="/import"
                  className="inline-block mt-2 text-brand font-semibold hover:underline"
                >
                  Vai alla pagina di importazione →
                </a>
              </div>
            </div>
          )}

          {/* Add-to-inventory form, shown after successful scan */}
          {scannedProduct && (
            <div className="mt-5 pt-5 border-t border-surface/50">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <h3 className="text-base font-bold text-foreground">
                  Prodotto trovato — aggiungi al magazzino
                </h3>
              </div>

              {/* Read-only product info strip */}
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex-1 min-w-[160px] p-3 rounded-xl bg-surface-light/50 border border-surface/40">
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-0.5">
                    Nome
                  </p>
                  <p className="font-bold text-foreground">{scannedProduct.name}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-light/50 border border-surface/40 min-w-[80px]">
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-0.5">
                    Taglia
                  </p>
                  <p className="font-bold text-foreground">{scannedProduct.size}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-light/50 border border-surface/40 min-w-[100px]">
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-0.5">
                    Colore
                  </p>
                  <p className="font-bold text-foreground">{scannedProduct.color}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-light/50 border border-surface/40 min-w-[120px]">
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-0.5">
                    Barcode
                  </p>
                  <p className="font-mono text-sm text-foreground/70">
                    {scannedProduct.barcode}
                  </p>
                </div>
              </div>

              {/* Editable fields */}
              <form onSubmit={handleAddToInventory}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Input
                    ref={firstFormFieldRef}
                    label="Prezzo Acquisto (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={addForm.purchase_price}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, purchase_price: e.target.value }))
                    }
                  />
                  <Input
                    label="Prezzo Vendita (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={addForm.sell_price}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, sell_price: e.target.value }))
                    }
                  />
                  <Input
                    label="Quantità"
                    type="number"
                    min="1"
                    step="1"
                    value={addForm.quantity}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    required
                  />
                  <Input
                    label="Ubicazione (opz.)"
                    type="text"
                    placeholder="es. Scaffale A2"
                    value={addForm.location}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, location: e.target.value }))
                    }
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={addLoading}
                    className="bg-success hover:bg-green-600"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Aggiungi al Magazzino
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setScannedProduct(null)
                      setBarcodeValue('')
                      setScanError(null)
                      focusBarcode()
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Articoli
              </p>
              <p className="text-2xl font-bold text-foreground">{totalArticoli}</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Valore Magazzino
              </p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(valoreInventario)}
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Scorte Basse
              </p>
              <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-surface/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                Esauriti
              </p>
              <p className="text-2xl font-bold text-danger">{outOfStockCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Inventory table                                                    */}
        {/* ---------------------------------------------------------------- */}
        <Card
          title="Inventario"
          action={
            <Button variant="secondary" size="sm" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 mr-1.5" />
              Esporta PDF
            </Button>
          }
        >
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca per nome, barcode, SKU, colore..."
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
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                aria-label="Cancella ricerca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Result count */}
          {searchQuery && (
            <p className="text-xs text-foreground/50 mb-3">
              {filteredInventory.length}{' '}
              {filteredInventory.length === 1 ? 'risultato' : 'risultati'} per &ldquo;
              {searchQuery}&rdquo;
            </p>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            <span className="flex items-center gap-1.5 text-yellow-700">
              <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" />
              Scorta bassa (≤5)
            </span>
            <span className="flex items-center gap-1.5 text-danger">
              <span className="w-3 h-3 rounded-sm bg-danger/10 border border-danger/30 inline-block" />
              Esaurito (≤0)
            </span>
          </div>

          {tableLoading ? (
            <div className="flex items-center justify-center py-16 text-foreground/40">
              <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin mr-3" />
              Caricamento magazzino...
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredInventory}
              emptyMessage={
                searchQuery
                  ? `Nessun articolo trovato per "${searchQuery}"`
                  : 'Il magazzino è vuoto. Scansiona un barcode per aggiungere il primo articolo.'
              }
            />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Edit modal                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Modifica — ${editItem?.product_registry.name ?? ''}`}
        size="md"
      >
        {editItem && (
          <div className="space-y-4">
            {/* Product info strip */}
            <div className="flex gap-2 text-sm mb-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface font-mono text-xs">
                {editItem.product_registry.barcode}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface font-medium">
                {editItem.product_registry.size}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface">
                {editItem.product_registry.color}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quantità"
                type="number"
                min="0"
                step="1"
                value={editForm.quantity}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <Input
                label="Ubicazione"
                type="text"
                placeholder="es. Scaffale A2"
                value={editForm.location}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, location: e.target.value }))
                }
              />
              <Input
                label="Prezzo Acquisto (€)"
                type="number"
                min="0"
                step="0.01"
                value={editForm.purchase_price}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    purchase_price: parseFloat(e.target.value) || 0,
                  }))
                }
              />
              <Input
                label="Prezzo Vendita (€)"
                type="number"
                min="0"
                step="0.01"
                value={editForm.sell_price}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    sell_price: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                loading={editLoading}
                onClick={handleEditSave}
                className="flex-1"
              >
                Salva modifiche
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setEditItem(null)}
                disabled={editLoading}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete confirmation modal                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Conferma eliminazione"
        size="sm"
      >
        {deleteItem && (
          <div className="space-y-4">
            <p className="text-foreground/70">
              Sei sicuro di voler rimuovere{' '}
              <span className="font-bold text-foreground">
                {deleteItem.product_registry.name}
              </span>{' '}
              ({deleteItem.product_registry.size} —{' '}
              {deleteItem.product_registry.color}) dal magazzino?
            </p>
            <p className="text-sm text-danger font-medium">
              Quantità attuale: {deleteItem.quantity} pz — questa operazione è irreversibile.
            </p>
            <div className="flex gap-3 pt-1">
              <Button
                variant="danger"
                size="md"
                loading={deleteLoading}
                onClick={handleDelete}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Elimina
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setDeleteItem(null)}
                disabled={deleteLoading}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Manual add product modal                                             */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
        title="Aggiungi Prodotto Manualmente"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/60">
            Inserisci i dati del prodotto. Verrà creato sia in anagrafica che in magazzino.
          </p>

          {/* Product details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nome *"
              type="text"
              placeholder="es. T-Shirt Basic"
              value={manualForm.name}
              onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Barcode"
              type="text"
              placeholder="es. 8001234567890"
              value={manualForm.barcode}
              onChange={(e) => setManualForm((f) => ({ ...f, barcode: e.target.value }))}
            />
            <Input
              label="SKU"
              type="text"
              placeholder="es. TSH-BAS-M-BLU"
              value={manualForm.sku}
              onChange={(e) => setManualForm((f) => ({ ...f, sku: e.target.value }))}
            />
            <Input
              label="Taglia"
              type="text"
              placeholder="es. M, L, 42"
              value={manualForm.size}
              onChange={(e) => setManualForm((f) => ({ ...f, size: e.target.value }))}
            />
            <Input
              label="Colore"
              type="text"
              placeholder="es. Blu"
              value={manualForm.color}
              onChange={(e) => setManualForm((f) => ({ ...f, color: e.target.value }))}
            />
            <Input
              label="Brand"
              type="text"
              placeholder="es. Nike"
              value={manualForm.brand}
              onChange={(e) => setManualForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <Input
              label="Categoria"
              type="text"
              placeholder="es. Magliette"
              value={manualForm.category}
              onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>

          {/* Inventory details */}
          <div className="pt-2 border-t border-surface/50">
            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
              Dettagli Magazzino
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input
                label="Prezzo Acquisto (€)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={manualForm.purchase_price}
                onChange={(e) => setManualForm((f) => ({ ...f, purchase_price: e.target.value }))}
              />
              <Input
                label="Prezzo Vendita (€)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={manualForm.sell_price}
                onChange={(e) => setManualForm((f) => ({ ...f, sell_price: e.target.value }))}
              />
              <Input
                label="Quantità *"
                type="number"
                min="1"
                step="1"
                value={manualForm.quantity}
                onChange={(e) => setManualForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
              <Input
                label="Ubicazione"
                type="text"
                placeholder="es. Scaffale A2"
                value={manualForm.location}
                onChange={(e) => setManualForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              loading={manualAddLoading}
              onClick={handleManualAdd}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Prodotto
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setManualAddOpen(false)}
              disabled={manualAddLoading}
            >
              Annulla
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
