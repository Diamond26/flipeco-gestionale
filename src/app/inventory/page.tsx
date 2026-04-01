'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { ConfirmBanner } from '@/components/ui/ConfirmBanner'
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

type SortField = 'barcode' | 'name' | 'brand' | 'size' | 'color' | 'quantity' | 'sell_price' | 'purchase_price' | 'location'
type SortDir = 'asc' | 'desc'

interface ScannedProduct {
  id: string
  barcode: string
  name: string
  sku: string | null
  size: string | null
  color: string | null
  color_code: string | null
  brand: string | null
}

interface EditForm {
  quantity: number
  purchase_price: number
  sell_price: number
  location: string
}

interface BulkEditForm {
  quantity: string
  purchase_price: string
  sell_price: string
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
  const [isReceivingScan, setIsReceivingScan] = useState(false)

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
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([])
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditLoading, setBulkEditLoading] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState<BulkEditForm>({
    quantity: '',
    purchase_price: '',
    sell_price: '',
    location: '',
  })

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
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  // --- Manual add modal state ---
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    barcode: '',
    name: '',
    sku: '',
    size: '',
    color: '',
    color_code: '',
    brand: '',
    category: '',
    purchase_price: '',
    sell_price: '',
    quantity: '1',
    location: '',
  })
  const [manualAddLoading, setManualAddLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupMatch, setLookupMatch] = useState<boolean | null>(null)
  const [lookupImportName, setLookupImportName] = useState<string | null>(null)
  const [matchedProductId, setMatchedProductId] = useState<string | null>(null)
  const purchasePriceRef = useRef<HTMLInputElement>(null)
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Autocomplete suggestions state ---
  interface ProductSuggestion {
    id: string
    barcode: string | null
    name: string
    sku: string | null
    size: string | null
    color: string | null
    color_code: string | null
    brand: string | null
    category: string | null
  }
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([])
  const [suggestField, setSuggestField] = useState('')
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        setIsReceivingScan(false)
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

      // Ricerca esatta prima
      const { data: exactData } = await supabase
        .from('product_registry')
        .select('id, barcode, name, sku, size, color, color_code, brand')
        .eq('barcode', trimmed)
        .limit(1)

      let found = exactData && exactData.length > 0 ? exactData[0] : null

      // Fallback: ricerca parziale ilike se non trovato
      if (!found) {
        const { data: partialData } = await supabase
          .from('product_registry')
          .select('id, barcode, name, sku, size, color, color_code, brand')
          .ilike('barcode', `%${trimmed}%`)
          .limit(1)

        found = partialData && partialData.length > 0 ? partialData[0] : null
      }

      setScanLoading(false)

      if (!found) {
        setScanError(trimmed)
        return
      }

      setScannedProduct(found as ScannedProduct)
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

  const toggleRowSelection = useCallback((inventoryId: string) => {
    setSelectedInventoryIds((prev) =>
      prev.includes(inventoryId) ? prev.filter((id) => id !== inventoryId) : [...prev, inventoryId]
    )
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (selectedInventoryIds.length === 0 || bulkEditLoading) return

    setBulkEditLoading(true)
    const { error } = await supabase.from('inventory').delete().in('id', selectedInventoryIds)
    setBulkEditLoading(false)

    if (error) {
      showToast(`Errore durante eliminazione multipla: ${error.message}`, 'error')
      return
    }

    showToast(`${selectedInventoryIds.length} articoli eliminati`, 'success')
    setSelectedInventoryIds([])
    fetchInventory()
  }, [selectedInventoryIds, bulkEditLoading, supabase, showToast, fetchInventory])

  const handleBulkEditSave = useCallback(async () => {
    if (selectedInventoryIds.length === 0 || bulkEditLoading) return
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (bulkEditForm.quantity.trim() !== '') {
      const quantity = parseInt(bulkEditForm.quantity, 10)
      if (Number.isNaN(quantity) || quantity < 0) {
        showToast('Quantità non valida', 'warning')
        return
      }
      payload.quantity = quantity
    }

    if (bulkEditForm.purchase_price.trim() !== '') {
      const purchase = parseFloat(bulkEditForm.purchase_price)
      if (Number.isNaN(purchase) || purchase < 0) {
        showToast('Prezzo acquisto non valido', 'warning')
        return
      }
      payload.purchase_price = purchase
    }

    if (bulkEditForm.sell_price.trim() !== '') {
      const sell = parseFloat(bulkEditForm.sell_price)
      if (Number.isNaN(sell) || sell < 0) {
        showToast('Prezzo vendita non valido', 'warning')
        return
      }
      payload.sell_price = sell
    }

    if (bulkEditForm.location.trim() !== '') {
      payload.location = bulkEditForm.location.trim()
    }

    if (Object.keys(payload).length <= 1) {
      showToast('Inserisci almeno un campo da modificare', 'warning')
      return
    }

    setBulkEditLoading(true)
    const { error } = await supabase
      .from('inventory')
      .update(payload)
      .in('id', selectedInventoryIds)
    setBulkEditLoading(false)

    if (error) {
      showToast(`Errore durante modifica multipla: ${error.message}`, 'error')
      return
    }

    showToast(`${selectedInventoryIds.length} articoli aggiornati`, 'success')
    setBulkEditOpen(false)
    setBulkEditForm({ quantity: '', purchase_price: '', sell_price: '', location: '' })
    setSelectedInventoryIds([])
    fetchInventory()
  }, [selectedInventoryIds, bulkEditLoading, bulkEditForm, supabase, showToast, fetchInventory])

  // ---------------------------------------------------------------------------
  // Autocomplete suggestions for text fields
  // ---------------------------------------------------------------------------

  const fetchSuggestions = useCallback(async (field: string, dbColumn: string, value: string) => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setProductSuggestions([])
      setSuggestField('')
      return
    }

    suggestTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('product_registry')
        .select('id, barcode, name, sku, size, color, color_code, brand, category')
        .ilike(dbColumn, `%${trimmed}%`)
        .limit(20)

      if (data && data.length > 0) {
        // Deduplica per combinazione name+size+color per evitare doppioni identici
        const seen = new Set<string>()
        const unique: ProductSuggestion[] = []
        for (const r of data) {
          const key = `${r.name}|${r.size}|${r.color}|${r.brand}`
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(r as ProductSuggestion)
          }
        }
        setProductSuggestions(unique.slice(0, 8))
        setSuggestField(field)
      } else {
        setProductSuggestions([])
        setSuggestField('')
      }
    }, 300)
  }, [supabase])

  const pickSuggestion = useCallback((product: ProductSuggestion) => {
    // Cancella eventuali timer di lookup in corso per evitare race condition
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)

    // SEMPRE sovrascrivere i campi dal prodotto scelto
    setMatchedProductId(product.id)
    setManualForm((f) => ({
      ...f,
      barcode: product.barcode ?? f.barcode,
      name: product.name ?? '',
      sku: product.sku ?? '',
      size: product.size ?? '',
      color: product.color ?? '',
      color_code: product.color_code ?? '',
      brand: product.brand ?? '',
      category: product.category ?? '',
    }))
    setProductSuggestions([])
    setSuggestField('')
    setLookupMatch(true)
    setLookupLoading(false)
    setLookupImportName(null)
    // Focus prezzo acquisto
    setTimeout(() => purchasePriceRef.current?.focus(), 100)
  }, [])

  // ---------------------------------------------------------------------------
  // Barcode lookup for manual add modal
  // ---------------------------------------------------------------------------

  const lookupProductByBarcode = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim()
    if (trimmed.length < 3) {
      setLookupMatch(null)
      setLookupImportName(null)
      setMatchedProductId(null)
      return
    }

    setLookupLoading(true)
    setLookupMatch(null)
    setLookupImportName(null)
    setMatchedProductId(null)

    // Ricerca esatta prima, poi fallback ilike per barcode parziali
    type LookupResult = { id: string; name: string; sku: string | null; size: string | null; color: string | null; color_code: string | null; brand: string | null; category: string | null; import_id: string | null }
    let data: LookupResult | null = null

    // Usa .limit(1) invece di .maybeSingle() per evitare errori con barcode duplicati
    const { data: exactMatches } = await supabase
      .from('product_registry')
      .select('id, name, sku, size, color, color_code, brand, category, import_id')
      .eq('barcode', trimmed)
      .limit(1)

    if (exactMatches && exactMatches.length > 0) {
      data = exactMatches[0]
    } else {
      // Fallback: ricerca parziale ilike
      const { data: partialMatches } = await supabase
        .from('product_registry')
        .select('id, name, sku, size, color, color_code, brand, category, import_id')
        .ilike('barcode', `%${trimmed}%`)
        .limit(1)

      if (partialMatches && partialMatches.length > 0) {
        data = partialMatches[0]
      }
    }

    setLookupLoading(false)

    if (!data) {
      setLookupMatch(false)
      return
    }

    // SEMPRE sovrascrivere i campi dal prodotto trovato nel DB
    // Usa i valori dal DB direttamente — NON il pattern `val || f.val` che salta stringhe vuote
    const foundId = data.id
    setMatchedProductId(foundId)
    setManualForm((f) => ({
      ...f,
      name: data!.name ?? '',
      sku: data!.sku ?? '',
      size: data!.size ?? '',
      color: data!.color ?? '',
      color_code: data!.color_code ?? '',
      brand: data!.brand ?? '',
      category: data!.category ?? '',
    }))
    setLookupMatch(true)
    // Chiudi suggerimenti se aperti
    setProductSuggestions([])
    setSuggestField('')

    // Check if it came from an import
    if (data.import_id) {
      const { data: logData } = await supabase
        .from('import_logs')
        .select('filename')
        .eq('id', data.import_id)
        .maybeSingle()

      if (logData?.filename) {
        setLookupImportName(logData.filename)
      }
    }

    // Auto-focus purchase price
    setTimeout(() => purchasePriceRef.current?.focus(), 100)
  }, [supabase])

  // Debounced barcode change handler — attiva suggerimenti typeahead E lookup auto-fill
  const handleBarcodeChange = useCallback((value: string) => {
    setManualForm((f) => ({ ...f, barcode: value }))
    setLookupMatch(null)
    setLookupImportName(null)
    setMatchedProductId(null)

    // Cancella timer precedenti
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)

    const trimmed = value.trim()

    if (trimmed.length < 2) {
      setProductSuggestions([])
      setSuggestField('')
      return
    }

    // Suggerimenti typeahead barcode con debounce 300ms
    suggestTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('product_registry')
        .select('id, barcode, name, sku, size, color, color_code, brand, category')
        .ilike('barcode', `%${trimmed}%`)
        .limit(10)

      if (data && data.length > 0) {
        setProductSuggestions(data as ProductSuggestion[])
        setSuggestField('barcode')
      } else {
        setProductSuggestions([])
        setSuggestField('')
      }
    }, 300)

    // Auto-lookup completo con debounce più lungo (600ms)
    // Così se l'utente digita/spara un barcode e smette, i campi si compilano automaticamente
    if (trimmed.length >= 4) {
      lookupTimerRef.current = setTimeout(() => {
        lookupProductByBarcode(trimmed)
      }, 600)
    }
  }, [supabase, lookupProductByBarcode])

  // Barcode Enter key handler (for scanner) — chiude suggerimenti e fa lookup diretto
  const handleBarcodeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
      setProductSuggestions([])
      setSuggestField('')
      lookupProductByBarcode(manualForm.barcode)
    }
  }, [lookupProductByBarcode, manualForm.barcode])

  const closeSuggestions = useCallback(() => {
    setTimeout(() => { setProductSuggestions([]); setSuggestField('') }, 150)
  }, [])

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

    const purchasePrice = parseFloat(manualForm.purchase_price)
    const sellPrice = parseFloat(manualForm.sell_price)
    let productId = matchedProductId

    if (productId) {
      // Prodotto esistente in anagrafica — verifica che esista ancora
      const { data: existing } = await supabase
        .from('product_registry')
        .select('id')
        .eq('id', productId)
        .maybeSingle()

      if (!existing) {
        // Il record è stato cancellato nel frattempo, crea uno nuovo
        productId = null
      }
    }

    if (!productId) {
      // 1. Crea nuovo product_registry entry
      const { data: product, error: productError } = await supabase
        .from('product_registry')
        .insert({
          barcode: manualForm.barcode.trim() || null,
          name,
          sku: manualForm.sku.trim() || null,
          size: manualForm.size.trim() || null,
          color: manualForm.color.trim() || null,
          color_code: manualForm.color_code.trim() || null,
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

      productId = product.id
    }

    // 2. Controlla se esiste già una riga inventory per questo prodotto
    const { data: existingInv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .maybeSingle()

    let invError: { message: string } | null = null

    if (existingInv) {
      // Somma quantità alla riga esistente
      const updatePayload: Record<string, unknown> = {
        quantity: existingInv.quantity + qty,
        updated_at: new Date().toISOString(),
      }
      if (!isNaN(purchasePrice)) updatePayload.purchase_price = purchasePrice
      if (!isNaN(sellPrice)) updatePayload.sell_price = sellPrice
      if (manualForm.location.trim()) updatePayload.location = manualForm.location.trim()

      const { error } = await supabase
        .from('inventory')
        .update(updatePayload)
        .eq('id', existingInv.id)
      invError = error
    } else {
      // Inserisci nuova riga inventory
      const { error } = await supabase.from('inventory').insert({
        product_id: productId,
        quantity: qty,
        purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
        sell_price: isNaN(sellPrice) ? 0 : sellPrice,
        location: manualForm.location.trim() || null,
        updated_at: new Date().toISOString(),
      })
      invError = error
    }

    setManualAddLoading(false)

    if (invError) {
      console.error('Error creating inventory:', invError)
      showToast(`Errore aggiunta a magazzino: ${invError.message}`, 'error')
      return
    }

    showToast(`"${name}" aggiunto al magazzino`, 'success')
    setManualAddOpen(false)
    setManualForm({
      barcode: '', name: '', sku: '', size: '', color: '', color_code: '',
      brand: '', category: '', purchase_price: '', sell_price: '',
      quantity: '1', location: '',
    })
    setLookupMatch(null)
    setLookupImportName(null)
    setMatchedProductId(null)
    fetchInventory()
  }, [manualForm, matchedProductId, supabase, showToast, fetchInventory])

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

  const selectedVisibleCount = useMemo(
    () => filteredInventory.filter((item) => selectedInventoryIds.includes(item.id)).length,
    [filteredInventory, selectedInventoryIds]
  )

  const sortedInventory = useMemo(() => {
    return [...filteredInventory].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'barcode':
          aVal = a.product_registry.barcode?.toLowerCase() ?? ''
          bVal = b.product_registry.barcode?.toLowerCase() ?? ''
          break
        case 'name':
          aVal = a.product_registry.name?.toLowerCase() ?? ''
          bVal = b.product_registry.name?.toLowerCase() ?? ''
          break
        case 'brand':
          aVal = (a.product_registry.brand ?? '').toLowerCase()
          bVal = (b.product_registry.brand ?? '').toLowerCase()
          break
        case 'size':
          aVal = (a.product_registry.size ?? '').toLowerCase()
          bVal = (b.product_registry.size ?? '').toLowerCase()
          break
        case 'color':
          aVal = (a.product_registry.color ?? '').toLowerCase()
          bVal = (b.product_registry.color ?? '').toLowerCase()
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
        case 'location':
          aVal = (a.location ?? '').toLowerCase()
          bVal = (b.location ?? '').toLowerCase()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredInventory, sortField, sortDir])

  const allVisibleSelected =
    filteredInventory.length > 0 && selectedVisibleCount === filteredInventory.length

  const toggleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedInventoryIds((prev) =>
        prev.filter((id) => !filteredInventory.some((item) => item.id === id))
      )
      return
    }
    setSelectedInventoryIds((prev) => {
      const next = new Set(prev)
      filteredInventory.forEach((item) => next.add(item.id))
      return Array.from(next)
    })
  }, [allVisibleSelected, filteredInventory])

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
      rows: sortedInventory.map((item) => [
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
  }, [sortedInventory])

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
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleSelectAllVisible}
          aria-label={allVisibleSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
          className="h-4 w-4 rounded border-surface/60 text-brand focus:ring-brand/30"
        />
      ) as unknown as string,
      className: 'w-10',
      render: (row: InventoryItem) => (
        <input
          type="checkbox"
          checked={selectedInventoryIds.includes(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          aria-label={`Seleziona ${row.product_registry.name}`}
          className="h-4 w-4 rounded border-surface/60 text-brand focus:ring-brand/30"
        />
      ),
    },
    {
      key: 'barcode',
      header: (
        <button
          onClick={() => handleSort('barcode')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Barcode <SortIcon field="barcode" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-mono text-xs text-foreground/50">
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
      header: (
        <button
          onClick={() => handleSort('brand')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Brand <SortIcon field="brand" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="text-sm font-medium text-foreground/70">
          {row.product_registry.brand || '\u2014'}
        </span>
      ),
    },
    {
      key: 'size',
      header: (
        <button
          onClick={() => handleSort('size')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Taglia <SortIcon field="size" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface/40 ring-1 ring-surface/60 text-xs font-semibold">
          {row.product_registry.size}
        </span>
      ),
    },
    {
      key: 'color',
      header: (
        <button
          onClick={() => handleSort('color')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Colore <SortIcon field="color" />
        </button>
      ) as unknown as string,
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
              isOut && 'bg-red-50 text-danger ring-1 ring-red-200',
              isLow && !isOut && 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200',
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
        <span className="text-foreground/60">{formatCurrency(row.purchase_price)}</span>
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
      header: (
        <button
          onClick={() => handleSort('location')}
          className="flex items-center gap-1 hover:text-brand transition-colors"
        >
          Ubicazione <SortIcon field="location" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) =>
        row.location ? (
          <span className="text-sm text-foreground/50">{row.location}</span>
        ) : (
          <span className="text-sm text-foreground/20">\u2014</span>
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
            className="p-1.5 rounded-lg hover:bg-brand/[0.08] text-foreground/40 hover:text-brand transition-colors"
            aria-label="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteItem(row)
            }}
            className="p-1.5 rounded-lg hover:bg-danger/[0.08] text-foreground/40 hover:text-danger transition-colors"
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
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-toast-in',
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

      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
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
        {/* Barcode scanner section                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-5">
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
                    'w-full pl-12 pr-4 py-4 text-xl font-mono rounded-xl border bg-card',
                    'focus:outline-none focus:ring-4 transition-all duration-200',
                    'placeholder:text-gray-300 placeholder:font-sans placeholder:text-base',
                    scanError
                      ? 'border-danger focus:border-danger focus:ring-danger/15'
                      : 'border-surface/80 focus:border-brand focus:ring-brand/15 focus:shadow-md'
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
            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200/60 ring-1 ring-yellow-200">
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
                  Vai alla pagina di importazione &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Add-to-inventory form, shown after successful scan */}
          {scannedProduct && (
            <div className="mt-5 pt-5 border-t border-surface/20">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <h3 className="text-base font-bold text-foreground">
                  Prodotto trovato &mdash; aggiungi al magazzino
                </h3>
              </div>

              {/* Read-only product info strip */}
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex-1 min-w-[160px] p-3 rounded-xl bg-surface-light/30 border border-surface/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                    Nome
                  </p>
                  <p className="font-bold text-foreground">{scannedProduct.name}</p>
                </div>
                {scannedProduct.sku && (
                  <div className="p-3 rounded-xl bg-surface-light/30 border border-surface/20 min-w-[80px]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                      SKU
                    </p>
                    <p className="font-mono text-sm text-foreground">{scannedProduct.sku}</p>
                  </div>
                )}
                {scannedProduct.brand && (
                  <div className="p-3 rounded-xl bg-surface-light/30 border border-surface/20 min-w-[80px]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                      Brand
                    </p>
                    <p className="font-bold text-foreground">{scannedProduct.brand}</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-surface-light/30 border border-surface/20 min-w-[80px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                    Taglia
                  </p>
                  <p className="font-bold text-foreground">{scannedProduct.size || '\u2014'}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-light/30 border border-surface/20 min-w-[100px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                    Colore
                  </p>
                  <p className="font-bold text-foreground">
                    {scannedProduct.color
                      ? <span className="inline-flex items-center gap-1.5">
                          {scannedProduct.color_code && (
                            <span className="inline-block w-3 h-3 rounded-full border border-foreground/20" style={{ backgroundColor: scannedProduct.color_code }} />
                          )}
                          {scannedProduct.color}
                        </span>
                      : '\u2014'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-light/30 border border-surface/20 min-w-[120px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-0.5">
                    Barcode
                  </p>
                  <p className="font-mono text-sm text-foreground/60">
                    {scannedProduct.barcode}
                  </p>
                </div>
              </div>

              {/* Editable fields */}
              <form onSubmit={handleAddToInventory}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Input
                    ref={firstFormFieldRef}
                    label="Prezzo Acquisto (&euro;)"
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
                    label="Prezzo Vendita (&euro;)"
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
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Stats bar                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3 shadow-sm shadow-black/[0.04]">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Articoli
              </p>
              <p className="text-2xl font-bold text-foreground">{totalArticoli}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3 shadow-sm shadow-black/[0.04]">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Valore Magazzino
              </p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(valoreInventario)}
              </p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3 shadow-sm shadow-black/[0.04]">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Scorte Basse
              </p>
              <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/[0.06] p-4 flex items-center gap-3 shadow-sm shadow-black/[0.04]">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Esauriti
              </p>
              <p className="text-2xl font-bold text-danger">{outOfStockCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Inventory table                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] p-5">
          {/* Card header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-foreground">Inventario</h2>
            <Button variant="secondary" size="sm" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4 mr-1.5" />
              Esporta PDF
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca per nome, barcode, SKU, colore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-surface/80 bg-card shadow-sm',
                'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
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

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button variant="secondary" size="sm" onClick={toggleSelectAllVisible}>
              {allVisibleSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </Button>
            <span className="text-xs text-foreground/50">
              {selectedVisibleCount} selezionati
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkEditOpen(true)}
              disabled={selectedVisibleCount === 0 || bulkEditLoading}
              className="ml-auto"
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              Modifica selezionati
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              disabled={selectedVisibleCount === 0 || bulkEditLoading}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Elimina selezionati
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            <span className="flex items-center gap-1.5 text-yellow-600">
              <span className="w-3 h-3 rounded-sm bg-yellow-50 ring-1 ring-yellow-200 inline-block" />
              Scorta bassa (&le;5)
            </span>
            <span className="flex items-center gap-1.5 text-danger">
              <span className="w-3 h-3 rounded-sm bg-red-50 ring-1 ring-red-200 inline-block" />
              Esaurito (&le;0)
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
              data={sortedInventory}
              emptyMessage={
                searchQuery
                  ? `Nessun articolo trovato per "${searchQuery}"`
                  : 'Il magazzino è vuoto. Scansiona un barcode per aggiungere il primo articolo.'
              }
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Edit modal                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Modifica \u2014 ${editItem?.product_registry.name ?? ''}`}
        size="md"
      >
        {editItem && (
          <div className="space-y-4">
            {/* Product info strip */}
            <div className="flex gap-2 text-sm mb-2">
              <span className="px-2.5 py-1 rounded-lg bg-surface/40 ring-1 ring-surface/60 font-mono text-xs">
                {editItem.product_registry.barcode}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface/40 ring-1 ring-surface/60 font-medium">
                {editItem.product_registry.size}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-surface/40 ring-1 ring-surface/60">
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
                label="Prezzo Acquisto (&euro;)"
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
                label="Prezzo Vendita (&euro;)"
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
            <p className="text-foreground/60">
              Sei sicuro di voler rimuovere{' '}
              <span className="font-bold text-foreground">
                {deleteItem.product_registry.name}
              </span>{' '}
              ({deleteItem.product_registry.size} &mdash;{' '}
              {deleteItem.product_registry.color}) dal magazzino?
            </p>
            <p className="text-sm text-danger font-medium">
              Quantità attuale: {deleteItem.quantity} pz &mdash; questa operazione è irreversibile.
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
      {/* Bulk edit modal                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={bulkEditOpen}
        onClose={() => !bulkEditLoading && setBulkEditOpen(false)}
        title="Modifica articoli selezionati"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/60">
            Articoli selezionati: <span className="font-bold text-foreground">{selectedVisibleCount}</span>
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantità (opzionale)"
              type="number"
              min="0"
              step="1"
              value={bulkEditForm.quantity}
              onChange={(e) =>
                setBulkEditForm((f) => ({ ...f, quantity: e.target.value }))
              }
              placeholder="Lascia vuoto per non modificare"
            />
            <Input
              label="Ubicazione (opzionale)"
              type="text"
              value={bulkEditForm.location}
              onChange={(e) =>
                setBulkEditForm((f) => ({ ...f, location: e.target.value }))
              }
              placeholder="Lascia vuoto per non modificare"
            />
            <Input
              label="Prezzo Acquisto (opzionale)"
              type="number"
              min="0"
              step="0.01"
              value={bulkEditForm.purchase_price}
              onChange={(e) =>
                setBulkEditForm((f) => ({ ...f, purchase_price: e.target.value }))
              }
              placeholder="Lascia vuoto per non modificare"
            />
            <Input
              label="Prezzo Vendita (opzionale)"
              type="number"
              min="0"
              step="0.01"
              value={bulkEditForm.sell_price}
              onChange={(e) =>
                setBulkEditForm((f) => ({ ...f, sell_price: e.target.value }))
              }
              placeholder="Lascia vuoto per non modificare"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="primary"
              size="md"
              loading={bulkEditLoading}
              onClick={handleBulkEditSave}
              className="flex-1"
            >
              Salva modifiche
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setBulkEditOpen(false)}
              disabled={bulkEditLoading}
            >
              Annulla
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Manual add product modal                                             */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={manualAddOpen}
        onClose={() => {
          setManualAddOpen(false)
          setLookupMatch(null)
          setLookupImportName(null)
          setMatchedProductId(null)
          setProductSuggestions([])
          setSuggestField('')
        }}
        title="Aggiungi Prodotto Manualmente"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/50">
            Spara il barcode o digitalo: i campi si compileranno dall&apos;anagrafica.
          </p>

          {/* ---- Barcode field (first, with lookup feedback + typeahead) ---- */}
          <div className="relative">
            <Input
              label="Barcode"
              type="text"
              placeholder="Spara o digita il barcode..."
              value={manualForm.barcode}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              onBlur={closeSuggestions}
              autoFocus
            />
            {/* Feedback icon */}
            <div className="absolute right-3 top-[34px]">
              {lookupLoading && (
                <span className="inline-block w-5 h-5 animate-spin border-2 border-t-brand border-brand/20 rounded-full" />
              )}
              {lookupMatch === true && !lookupLoading && (
                <CheckCircle2 className="w-5 h-5 text-[#7BB35F]" />
              )}
              {lookupMatch === false && !lookupLoading && (
                <span className="text-xs text-foreground/40 font-medium">nuovo</span>
              )}
            </div>
            {/* Barcode typeahead suggestions */}
            {suggestField === 'barcode' && productSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-surface/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                {productSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-brand/[0.06] transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-surface/20 last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }}
                  >
                    <span className="text-sm font-mono font-semibold text-foreground">{p.barcode}</span>
                    <span className="flex gap-2 mt-0.5 text-xs text-foreground/50">
                      <span>{p.name}</span>
                      {p.size && <span>Tg: {p.size}</span>}
                      {p.color && <span>Col: {p.color}</span>}
                      {p.brand && <span>Brand: {p.brand}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import badge */}
          {lookupImportName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground/60">
                Dati caricati da Import: <strong className="text-emerald-600">{lookupImportName}</strong>
              </span>
            </div>
          )}

          {lookupMatch === true && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground/60">
                Prodotto trovato in anagrafica &mdash; campi compilati automaticamente.
              </span>
            </div>
          )}

          {/* Product details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Nome con suggerimenti prodotto */}
            <div className="relative">
              <Input
                label="Nome *"
                type="text"
                placeholder="es. T-Shirt Basic"
                value={manualForm.name}
                onChange={(e) => {
                  setManualForm((f) => ({ ...f, name: e.target.value }))
                  fetchSuggestions('name', 'name', e.target.value)
                }}
                onBlur={closeSuggestions}
                required
              />
              {suggestField === 'name' && productSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-surface/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {productSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-brand/[0.06] transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-surface/20 last:border-0"
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }}
                    >
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="flex gap-2 mt-0.5 text-xs text-foreground/50">
                        {p.size && <span>Tg: {p.size}</span>}
                        {p.color && <span>Col: {p.color}</span>}
                        {p.brand && <span>Brand: {p.brand}</span>}
                        {p.sku && <span>SKU: {p.sku}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              label="SKU"
              type="text"
              placeholder="es. TSH-BAS-M-BLU"
              value={manualForm.sku}
              onChange={(e) => setManualForm((f) => ({ ...f, sku: e.target.value }))}
            />
            {/* Taglia con suggerimenti prodotto */}
            <div className="relative">
              <Input
                label="Taglia"
                type="text"
                placeholder="es. M, L, 42"
                value={manualForm.size}
                onChange={(e) => {
                  setManualForm((f) => ({ ...f, size: e.target.value }))
                  fetchSuggestions('size', 'size', e.target.value)
                }}
                onBlur={closeSuggestions}
              />
              {suggestField === 'size' && productSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-surface/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {productSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-brand/[0.06] transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-surface/20 last:border-0"
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }}
                    >
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="flex gap-2 mt-0.5 text-xs text-foreground/50">
                        {p.size && <span className="text-brand font-bold">Tg: {p.size}</span>}
                        {p.color && <span>Col: {p.color}</span>}
                        {p.brand && <span>Brand: {p.brand}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Colore con suggerimenti prodotto */}
            <div className="relative">
              <Input
                label="Colore"
                type="text"
                placeholder="es. Blu"
                value={manualForm.color}
                onChange={(e) => {
                  setManualForm((f) => ({ ...f, color: e.target.value }))
                  fetchSuggestions('color', 'color', e.target.value)
                }}
                onBlur={closeSuggestions}
              />
              {suggestField === 'color' && productSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-surface/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {productSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-brand/[0.06] transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-surface/20 last:border-0"
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }}
                    >
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="flex gap-2 mt-0.5 text-xs text-foreground/50">
                        {p.size && <span>Tg: {p.size}</span>}
                        {p.color && <span className="text-brand font-bold">Col: {p.color}</span>}
                        {p.color_code && <span>Cod: {p.color_code}</span>}
                        {p.brand && <span>Brand: {p.brand}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              label="Codice Colore"
              type="text"
              placeholder="es. 001"
              value={manualForm.color_code}
              onChange={(e) => setManualForm((f) => ({ ...f, color_code: e.target.value }))}
            />
            {/* Brand con suggerimenti prodotto */}
            <div className="relative">
              <Input
                label="Brand"
                type="text"
                placeholder="es. Nike"
                value={manualForm.brand}
                onChange={(e) => {
                  setManualForm((f) => ({ ...f, brand: e.target.value }))
                  fetchSuggestions('brand', 'brand', e.target.value)
                }}
                onBlur={closeSuggestions}
              />
              {suggestField === 'brand' && productSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-surface/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {productSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-brand/[0.06] transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-surface/20 last:border-0"
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }}
                    >
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="flex gap-2 mt-0.5 text-xs text-foreground/50">
                        {p.size && <span>Tg: {p.size}</span>}
                        {p.color && <span>Col: {p.color}</span>}
                        {p.brand && <span className="text-brand font-bold">Brand: {p.brand}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              label="Categoria"
              type="text"
              placeholder="es. Magliette"
              value={manualForm.category}
              onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>

          {/* Inventory details */}
          <div className="pt-2 border-t border-surface/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-3">
              Dettagli Magazzino
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input
                ref={purchasePriceRef}
                label="Prezzo Acquisto (&euro;)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={manualForm.purchase_price}
                onChange={(e) => setManualForm((f) => ({ ...f, purchase_price: e.target.value }))}
              />
              <Input
                label="Prezzo Vendita (&euro;)"
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
      {/* Confirm banner — bulk delete */}
      <ConfirmBanner
        open={bulkDeleteConfirmOpen}
        variant="danger"
        message={`Sei sicuro di voler eliminare ${selectedInventoryIds.length} articoli selezionati? Questa azione è irreversibile.`}
        confirmLabel="Elimina"
        loading={bulkEditLoading}
        onConfirm={() => {
          setBulkDeleteConfirmOpen(false)
          handleBulkDelete()
        }}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
      />
    </AppShell>
  )
}
