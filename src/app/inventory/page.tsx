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
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30 ml-2 inline-block" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#7BB35F] ml-2 inline-block" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#7BB35F] ml-2 inline-block" />
    )
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      key: 'select',
      header: '' as unknown as string,
      className: 'w-10 opacity-0',
      render: (row: InventoryItem) => (
        <input
          type="checkbox"
          checked={selectedInventoryIds.includes(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          aria-label={`Seleziona ${row.product_registry.name}`}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#7BB35F] focus:ring-[#7BB35F]/30 cursor-pointer"
        />
      ),
    },
    {
      key: 'barcode',
      header: (
        <button
          onClick={() => handleSort('barcode')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Barcode <SortIcon field="barcode" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-mono text-sm text-white/60">
          {row.product_registry.barcode}
        </span>
      ),
    },
    {
      key: 'name',
      header: (
        <button
          onClick={() => handleSort('name')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Nome <SortIcon field="name" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-semibold text-white/90">{row.product_registry.name}</span>
      ),
    },
    {
      key: 'brand',
      header: (
        <button
          onClick={() => handleSort('brand')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Brand <SortIcon field="brand" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="text-sm font-medium text-white/50">
          {row.product_registry.brand || '\u2014'}
        </span>
      ),
    },
    {
      key: 'size',
      header: (
        <button
          onClick={() => handleSort('size')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Taglia <SortIcon field="size" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs font-semibold text-white/80">
          {row.product_registry.size}
        </span>
      ),
    },
    {
      key: 'color',
      header: (
        <button
          onClick={() => handleSort('color')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Colore <SortIcon field="color" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="text-sm text-white/70">{row.product_registry.color}</span>
      ),
    },
    {
      key: 'quantity',
      header: (
        <button
          onClick={() => handleSort('quantity')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
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
              'inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg text-sm border',
              isOut && 'bg-red-500/10 text-red-400 border-red-500/20',
              isLow && !isOut && 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
              !isOut && !isLow && 'text-white/90 border-transparent'
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
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          P. Acq <SortIcon field="purchase_price" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="text-white/40">{formatCurrency(row.purchase_price)}</span>
      ),
    },
    {
      key: 'sell_price',
      header: (
        <button
          onClick={() => handleSort('sell_price')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          P. Ven <SortIcon field="sell_price" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) => (
        <span className="font-semibold text-[#7BB35F]">{formatCurrency(row.sell_price)}</span>
      ),
    },
    {
      key: 'location',
      header: (
        <button
          onClick={() => handleSort('location')}
          className="flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          Ubicazione <SortIcon field="location" />
        </button>
      ) as unknown as string,
      render: (row: InventoryItem) =>
        row.location ? (
          <span className="text-sm text-white/50">{row.location}</span>
        ) : (
          <span className="text-sm text-white/20">\u2014</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row: InventoryItem) => (
        <div className="flex items-center justify-end gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(row)
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteItem(row)
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
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

      {/* ---------------- Sfondo Globale Glassmorphism Aurora ---------------- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1] bg-[#0c1222]">
        <div className="absolute top-[-15%] right-[-5%] w-[800px] h-[800px] bg-[#7BB35F]/10 rounded-full blur-[160px] opacity-70" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#7BB35F]/5 rounded-full blur-[140px] opacity-50" />
      </div>

      <div className="space-y-8 max-w-[1400px] mx-auto animate-fade-in relative z-10 pt-2 lg:pt-6">
        {/* ------------------------------------------------------------------ */}
        {/* Indicator Scanner                                                  */}
        {/* ------------------------------------------------------------------ */}
        {isReceivingScan && (
          <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-[#7BB35F] text-white px-5 py-3 rounded-full shadow-2xl animate-pulse">
            <Scan className="w-6 h-6" />
            <span className="font-bold">Scanner in ascolto...</span>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Header / Top Bar Premium                                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-2">
          {/* Logo & Subtitle */}
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">Flip&amp;Co</h1>
            <p className="text-[13px] text-white/40 tracking-widest uppercase mt-1">Premium Inventory Management</p>
          </div>

          {/* Search Bar Center */}
          <form onSubmit={handleBarcodeScan} className="flex-1 max-w-2xl mx-auto xl:mx-0 w-full">
            <div className="relative group">
              <div className="absolute inset-0 bg-white/[0.03] rounded-full border border-white/10 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-colors group-hover:bg-white/[0.05]" />
              
              <div className="relative flex items-center p-1.5 pl-6">
                <Scan className="w-5 h-5 text-[#7BB35F] mr-3 shrink-0" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => {
                    setBarcodeValue(e.target.value)
                    setScanError(null)
                  }}
                  placeholder="Spara il barcode o digita..."
                  className="w-full bg-transparent border-none text-white focus:outline-none focus:ring-0 placeholder:text-white/30 text-[15px]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={scanLoading}
                  className="flex items-center gap-2 bg-[#7BB35F] hover:bg-[#6CAE4A] hover:scale-[1.02] active:scale-95 transition-all text-white px-6 py-2.5 rounded-full font-medium shadow-[0_0_15px_rgba(123,179,95,0.4)] ml-3 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  Cerca
                </button>
              </div>
            </div>
          </form>

          {/* Add Manual Button */}
          <button
             type="button"
             onClick={() => setManualAddOpen(true)}
             className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md text-white/70 hover:bg-white/10 hover:text-white transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] shrink-0"
          >
             <Plus className="w-4 h-4 text-[#7BB35F]" />
             Aggiungi Manualmente
          </button>
        </div>
        
        {/* Scan Feedback / Add Form */}
        {scanError && (
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-md shadow-xl mt-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-400">Prodotto non trovato in anagrafica</p>
              <p className="text-yellow-500 mt-0.5">Barcode: <span className="font-mono font-bold">{scanError}</span></p>
              <a href="/import" className="inline-block mt-2 text-white font-semibold hover:underline">Vai alla pagina di importazione &rarr;</a>
            </div>
          </div>
        )}

        {scannedProduct && (
          <div className="bg-white/[0.02] backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/10 p-6 lg:p-8 mt-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#7BB35F]/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#7BB35F]" />
              </div>
              <h3 className="text-lg font-bold text-white">Prodotto trovato &mdash; aggiungi al magazzino</h3>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[160px] p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Nome</p>
                <p className="font-bold text-white text-lg">{scannedProduct.name}</p>
              </div>
              {scannedProduct.sku && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 min-w-[100px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">SKU</p>
                  <p className="font-mono text-sm text-white/90">{scannedProduct.sku}</p>
                </div>
              )}
              {scannedProduct.brand && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 min-w-[100px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Brand</p>
                  <p className="font-bold text-white">{scannedProduct.brand}</p>
                </div>
              )}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 min-w-[100px]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Taglia</p>
                <p className="font-bold text-white">{scannedProduct.size || '\u2014'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 min-w-[120px]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Colore</p>
                <p className="font-bold text-white">
                  {scannedProduct.color ? (
                    <span className="inline-flex items-center gap-2">
                       {scannedProduct.color_code && <span className="inline-block w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: scannedProduct.color_code }} />}
                       {scannedProduct.color}
                    </span>
                  ) : '\u2014'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 min-w-[140px]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Barcode</p>
                <p className="font-mono text-sm text-white/60">{scannedProduct.barcode}</p>
              </div>
            </div>

            <form onSubmit={handleAddToInventory} className="bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <Input
                  ref={firstFormFieldRef}
                  label="Prezzo Acquisto (&euro;)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={addForm.purchase_price}
                  onChange={(e) => setAddForm((f) => ({ ...f, purchase_price: e.target.value }))}
                />
                <Input
                  label="Prezzo Vendita (&euro;)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={addForm.sell_price}
                  onChange={(e) => setAddForm((f) => ({ ...f, sell_price: e.target.value }))}
                />
                <Input
                  label="Quantità"
                  type="number"
                  min="1"
                  step="1"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                  required
                />
                <Input
                  label="Ubicazione (opz.)"
                  type="text"
                  placeholder="es. Scaffale A2"
                  value={addForm.location}
                  onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex items-center justify-center gap-2 bg-[#7BB35F] hover:bg-[#6CAE4A] transition-colors text-white px-6 py-3 rounded-xl font-medium shadow-lg"
                >
                  <Package className="w-5 h-5" />
                  Aggiungi al Magazzino
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannedProduct(null)
                    setBarcodeValue('')
                    setScanError(null)
                    focusBarcode()
                  }}
                  className="px-6 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Stats bar Frosted Glass                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-4">
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 p-5 flex items-center gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/[0.04] to-transparent">
            <div className="relative w-12 h-12 rounded-full bg-[#7BB35F]/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-[#7BB35F] animate-pulse blur-md opacity-20 rounded-full" />
               <Package className="w-6 h-6 text-[#7BB35F] relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-0.5">Articoli</p>
              <p className="text-2xl font-bold text-white">{totalArticoli}</p>
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 p-5 flex items-center gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/[0.04] to-transparent">
            <div className="relative w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-white animate-pulse blur-md opacity-10 rounded-full" />
               <TrendingUp className="w-6 h-6 text-white/80 relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-0.5">Valore Magazzino</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(valoreInventario)}</p>
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 p-5 flex items-center gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/[0.04] to-transparent">
            <div className="relative w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-yellow-500 animate-pulse blur-md opacity-20 rounded-full" />
               <AlertTriangle className="w-6 h-6 text-yellow-500 relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-0.5">Scorte Basse</p>
              <p className="text-2xl font-bold text-white">{lowStockCount}</p>
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 p-5 flex items-center gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-br from-white/[0.04] to-transparent">
            <div className="relative w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-red-500 animate-pulse blur-md opacity-20 rounded-full" />
               <AlertTriangle className="w-6 h-6 text-red-500 relative z-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-0.5">Esauriti</p>
              <p className="text-2xl font-bold text-white">{outOfStockCount}</p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Inventory table Glass Container                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-8 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/10 p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 border-b border-white/5 pb-6">
            <h2 className="text-2xl font-semibold text-white tracking-wide">Inventario</h2>
            
            <div className="relative flex-1 max-w-md mx-auto sm:mx-0 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Cerca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-full text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7BB35F]/50 focus:ring-1 focus:ring-[#7BB35F]/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button onClick={handleExportPDF} className="flex items-center gap-2 bg-[#7BB35F]/10 hover:bg-[#7BB35F]/20 transition-colors border border-[#7BB35F]/20 text-[#7BB35F] px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
              <FileDown className="w-4 h-4" />
              Esporta PDF
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer hover:text-white transition-colors">
               <input 
                 type="checkbox" 
                 checked={allVisibleSelected} 
                 onChange={toggleSelectAllVisible} 
                 className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7BB35F] focus:ring-[#7BB35F]/30" 
               />
               Seleziona tutti
            </label>
            <span className="text-xs text-white/30 px-2">|</span>
            <span className="text-sm font-medium text-white/50">
              {selectedVisibleCount} selezionati
            </span>
            <button
              onClick={() => setBulkEditOpen(true)}
              disabled={selectedVisibleCount === 0 || bulkEditLoading}
              className="ml-auto bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-white/10 text-white/80 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Modifica selezionati
            </button>
            <button
              onClick={() => setBulkDeleteConfirmOpen(true)}
              disabled={selectedVisibleCount === 0 || bulkEditLoading}
              className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Elimina selezionati
            </button>
          </div>

          {tableLoading ? (
             <div className="flex items-center justify-center py-20 text-white/40">
               <div className="w-8 h-8 border-4 border-[#7BB35F]/20 border-t-[#7BB35F] rounded-full animate-spin mr-3" />
               Caricamento magazzino...
             </div>
          ) : sortedInventory.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="relative mb-8">
                   <div className="absolute inset-0 bg-[#7BB35F] blur-[60px] opacity-10 rounded-full animate-pulse" />
                   <svg width="140" height="140" viewBox="0 0 200 200" fill="none" className="relative z-10 drop-shadow-[0_0_20px_rgba(123,179,95,0.4)]">
                      <path d="M40 90 L100 50 L160 90 L160 160 L40 160 Z" stroke="#7BB35F" strokeWidth="2.5" fill="rgba(123,179,95,0.03)" strokeLinejoin="round" />
                      <path d="M40 90 L100 50 L160 90" stroke="#7BB35F" strokeWidth="2.5" strokeLinejoin="round" />
                      <path d="M80 160 L80 110 L120 110 L120 160" stroke="#7BB35F" strokeWidth="2.5" fill="none" />
                      <path d="M80 120 L120 120 M80 130 L120 130 M80 140 L120 140 M80 150 L120 150" stroke="#7BB35F" strokeWidth="1.5" />
                      <path d="M125 150 L145 140 L165 150 L165 170 L145 180 L125 170 Z" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.05)" strokeLinejoin="round"/>
                      <path d="M145 140 L145 180 M125 150 L145 160 L165 150" stroke="#fff" strokeWidth="1.5" />
                      <path d="M50 140 L65 132 L80 140 L80 155 L65 163 L50 155 Z" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.05)" strokeLinejoin="round"/>
                      <path d="M65 132 L65 163 M50 140 L65 148 L80 140" stroke="#fff" strokeWidth="1.5" />
                   </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Il magazzino è vuoto.</h3>
                <p className="text-white/40 text-sm max-w-sm mx-auto">Scansiona un barcode per aggiungere il primo articolo al tuo inventario.</p>
             </div>
          ) : (
             <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/10">
               <Table columns={columns} data={sortedInventory} />
             </div>
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
