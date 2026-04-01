'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmBanner } from '@/components/ui/ConfirmBanner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { exportToPDF } from '@/lib/pdf-export'
import {
  Search,
  Trash2,
  FileDown,
  Eye,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
  X,
  PackagePlus,
  Package,
  Tag,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportLog {
  id: string
  supplier_id: string | null
  filename: string
  status: string
  items_count: number
  brand: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
}

interface ProductRow {
  id: string
  barcode: string
  sku: string
  name: string
  size: string
  color: string
  color_code: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportHistoryPage() {
  const supabase = createClient()

  // --- Data ---
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // --- Modal ---
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null)
  const [productsLoading, setProductsLoading] = useState(false)
  const [editRows, setEditRows] = useState<ProductRow[]>([])
  const [savingRows, setSavingRows] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // --- Brand modal ---
  const [brandModalLog, setBrandModalLog] = useState<ImportLog | null>(null)
  const [brandInput, setBrandInput] = useState('')
  const [savingBrand, setSavingBrand] = useState(false)

  // --- Move to inventory ---
  const [movingAll, setMovingAll] = useState<string | null>(null)
  const [movingRow, setMovingRow] = useState<string | null>(null)
  const [pendingMoveAllId, setPendingMoveAllId] = useState<string | null>(null)
  const [pendingMoveSingle, setPendingMoveSingle] = useState<{ id: string; name: string } | null>(null)
  const [confirmSaveProducts, setConfirmSaveProducts] = useState(false)
  const [confirmSaveBrand, setConfirmSaveBrand] = useState(false)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<string | null>(null)

  // --- Toast ---
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'warning' }[]>([])

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch logs
  // ---------------------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('import_logs')
      .select('*, suppliers(id, name)')
      .order('created_at', { ascending: false })

    if (error) {
      showToast(`Errore caricamento: ${error.message}`, 'error')
    } else {
      setLogs((data as ImportLog[]) ?? [])
    }
    setLoading(false)
  }, [supabase, showToast])

  // ---------------------------------------------------------------------------
  // Brand assignment
  // ---------------------------------------------------------------------------

  const openBrandModal = (log: ImportLog) => {
    setBrandModalLog(log)
    setBrandInput(log.brand ?? '')
  }

  const saveBrand = async () => {
    if (!brandModalLog) return
    const trimmed = brandInput.trim()

    setSavingBrand(true)

    // 1. Salva il brand sull'import_log
    const { error: logError } = await supabase
      .from('import_logs')
      .update({ brand: trimmed || null })
      .eq('id', brandModalLog.id)

    if (logError) {
      showToast(`Errore salvataggio brand: ${logError.message}`, 'error')
      setSavingBrand(false)
      return
    }

    // 2. Propaga il brand a TUTTI i prodotti di questa importazione
    const { error: prodError } = await supabase
      .from('product_registry')
      .update({ brand: trimmed || null })
      .eq('import_id', brandModalLog.id)

    setSavingBrand(false)

    if (prodError) {
      showToast(`Brand salvato sul log ma errore aggiornamento prodotti: ${prodError.message}`, 'warning')
    } else {
      showToast(trimmed ? `Brand "${trimmed}" assegnato a tutti i prodotti dell'importazione!` : 'Brand rimosso da tutti i prodotti.', 'success')
    }

    setBrandModalLog(null)
    fetchLogs()
  }

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // ---------------------------------------------------------------------------
  // View + Edit products
  // ---------------------------------------------------------------------------

  const openProducts = async (log: ImportLog) => {
    setSelectedLog(log)
    setProductsLoading(true)

    const { data, error } = await supabase
      .from('product_registry')
      .select('id, barcode, sku, name, size, color, color_code')
      .eq('import_id', log.id)
      .order('created_at', { ascending: true })

    setProductsLoading(false)

    if (error) {
      showToast(`Errore caricamento prodotti: ${error.message}`, 'error')
      setEditRows([])
      return
    }

    setEditRows(
      (data ?? []).map((d: any) => ({
        id: d.id,
        barcode: d.barcode ?? '',
        sku: d.sku ?? '',
        name: d.name ?? '',
        size: d.size ?? '',
        color: d.color ?? '',
        color_code: d.color_code ?? '',
      }))
    )
  }

  const updateCell = (id: string, field: keyof Omit<ProductRow, 'id'>, value: string) => {
    setEditRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const deleteEditRow = (id: string) => {
    setEditRows((prev) => prev.filter((r) => r.id !== id))
  }

  const saveProducts = async () => {
    if (!selectedLog) return

    const missing = editRows.find((r) => !r.name.trim())
    if (missing) {
      showToast('Tutti i prodotti devono avere un Nome.', 'error')
      return
    }

    setSavingRows(true)

    // Ottieni l'elenco attuale dal DB per capire se qualcuno è stato eliminato in UI
    const { data: currentIds } = await supabase
      .from('product_registry')
      .select('id')
      .eq('import_id', selectedLog.id)

    const editIds = new Set(editRows.map((r) => r.id))
    const toDelete = (currentIds ?? []).filter((r: any) => !editIds.has(r.id))

    // Elimina righe tolte dall'utente
    for (const d of toDelete) {
      await supabase.from('product_registry').delete().eq('id', d.id)
    }

    // Aggiorna le rimanenti
    const updates = editRows.map((row) =>
      supabase
        .from('product_registry')
        .update({
          barcode: row.barcode.trim() || null,
          sku: row.sku.trim() || null,
          name: row.name.trim(),
          size: row.size.trim() || null,
          color: row.color.trim() || null,
          color_code: row.color_code.trim() || null,
        })
        .eq('id', row.id)
    )

    const results = await Promise.all(updates)
    const fail = results.find((r) => r.error)

    // Aggiorna items_count nel log
    await supabase
      .from('import_logs')
      .update({ items_count: editRows.length })
      .eq('id', selectedLog.id)

    setSavingRows(false)

    if (fail) {
      showToast(`Errore salvataggio: ${fail.error?.message}`, 'error')
    } else {
      showToast('Prodotti aggiornati con successo!')
      setSelectedLog(null)
      fetchLogs()
    }
  }

  // ---------------------------------------------------------------------------
  // Delete import
  // ---------------------------------------------------------------------------

  const handleDeleteImport = async (id: string) => {
    setDeleteLoading(id)
    const { error } = await supabase.from('import_logs').delete().eq('id', id)
    setDeleteLoading(null)

    if (error) {
      showToast(`Errore: ${error.message}`, 'error')
    } else {
      showToast('Importazione eliminata con successo.')
      fetchLogs()
    }
  }

  // ---------------------------------------------------------------------------
  // Export PDF
  // ---------------------------------------------------------------------------

  const handleExportPdf = async (log: ImportLog) => {
    const { data } = await supabase
      .from('product_registry')
      .select('barcode, sku, name, size, color, color_code')
      .eq('import_id', log.id)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) {
      showToast('Nessun prodotto da esportare.', 'warning')
      return
    }

    exportToPDF({
      title: `Import ${log.filename} — ${new Date(log.created_at).toLocaleDateString('it-IT')}`,
      headers: ['Barcode', 'SKU', 'Nome', 'Taglia', 'Colore', 'Cod. Colore'],
      rows: data.map((r: any) => [r.barcode ?? '', r.sku ?? '', r.name ?? '', r.size ?? '', r.color ?? '', r.color_code ?? '']),
      filename: `storico_${log.filename.replace(/\.[^/.]+$/, '')}.pdf`,
    })
  }

  // ---------------------------------------------------------------------------
  // Move ALL products of an import to inventory
  // ---------------------------------------------------------------------------

  const moveAllToInventory = async (logId: string) => {
    setMovingAll(logId)

    const { data: products, error: fetchErr } = await supabase
      .from('product_registry')
      .select('id, barcode, name, sku, size, color, color_code, brand')
      .eq('import_id', logId)

    if (fetchErr || !products || products.length === 0) {
      showToast(fetchErr ? `Errore: ${fetchErr.message}` : 'Nessun prodotto trovato per questa importazione.', 'error')
      setMovingAll(null)
      return
    }

    let added = 0
    let updated = 0
    let errors = 0

    for (const product of products) {
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', product.id)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('inventory')
          .update({ quantity: existing.quantity + 1, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) errors++; else updated++
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert({
            product_id: product.id,
            quantity: 1,
            purchase_price: 0,
            sell_price: 0,
            location: null,
            updated_at: new Date().toISOString(),
          })
        if (error) errors++; else added++
      }
    }

    setMovingAll(null)

    if (errors > 0) {
      showToast(`Completato con ${errors} errori. Aggiunti: ${added}, aggiornati: ${updated}.`, 'warning')
    } else {
      showToast(`${added + updated} prodotti spostati in magazzino! (${added} nuovi, ${updated} aggiornati)`, 'success')
    }
  }

  // ---------------------------------------------------------------------------
  // Move SINGLE product to inventory
  // ---------------------------------------------------------------------------

  const moveSingleToInventory = async (productId: string, productName: string) => {
    setMovingRow(productId)

    const { data: existing } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .maybeSingle()

    let opError: { message: string } | null = null

    if (existing) {
      const { error } = await supabase
        .from('inventory')
        .update({ quantity: existing.quantity + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      opError = error
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert({
          product_id: productId,
          quantity: 1,
          purchase_price: 0,
          sell_price: 0,
          location: null,
          updated_at: new Date().toISOString(),
        })
      opError = error
    }

    setMovingRow(null)

    if (opError) {
      showToast(`Errore: ${opError.message}`, 'error')
    } else {
      showToast(`"${productName}" spostato in magazzino!`, 'success')
    }
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  const filtered = logs.filter((l) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      l.filename.toLowerCase().includes(q) ||
      (l.suppliers?.name ?? '').toLowerCase().includes(q)
    )
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell pageTitle="Storico Importazioni">
      {/* ---- Toasts ---- */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-toast-in backdrop-blur-sm',
              t.type === 'success' && 'bg-success text-white',
              t.type === 'error' && 'bg-danger text-white',
              t.type === 'warning' && 'bg-yellow-500 text-white',
            )}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.type === 'error' && <X className="w-4 h-4 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {t.msg}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* ---- Header ---- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
              <History className="w-8 h-8 text-brand" />
              Storico Importazioni
            </h1>
            <p className="text-foreground/60 mt-1">
              Controlla, modifica o elimina i caricamenti dai fornitori.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca per file o fornitore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-surface/80 bg-card shadow-sm',
                'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
                'placeholder:text-gray-400 transition-all duration-200'
              )}
            />
          </div>
        </div>

        {/* ---- Table ---- */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 dark:border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-surface/30">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50">Data</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50">Fornitore</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50">File</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50">Brand</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 text-center">Articoli</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 text-center">Stato</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-foreground/40 text-base">
                      <span className="inline-block animate-spin w-5 h-5 border-2 border-t-brand border-brand/20 rounded-full mr-3 align-middle" />
                      Caricamento storico...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-foreground/40 text-base font-medium">
                      {searchQuery ? 'Nessun risultato per la ricerca.' : 'Nessuna importazione trovata.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((log, index) => (
                    <tr key={log.id} className={cn('hover:bg-brand/[0.03] transition-colors', index !== filtered.length - 1 && 'border-b border-surface/20')}>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs">
                        {new Date(log.created_at).toLocaleString('it-IT', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-brand">
                        {log.suppliers?.name ?? <span className="text-foreground/30 italic">N/D</span>}
                      </td>
                      <td className="px-5 py-3.5 text-foreground/80 break-all max-w-[220px]">
                        {log.filename}
                      </td>
                      <td className="px-5 py-3.5">
                        {log.brand ? (
                          <button
                            onClick={() => openBrandModal(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 text-brand font-semibold text-xs hover:bg-brand/20 transition-colors cursor-pointer"
                            title="Modifica Brand"
                          >
                            <Tag className="w-3 h-3" />
                            {log.brand}
                          </button>
                        ) : (
                          <button
                            onClick={() => openBrandModal(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-foreground/20 text-foreground/40 text-xs hover:border-brand hover:text-brand transition-colors cursor-pointer"
                            title="Assegna Brand"
                          >
                            <Tag className="w-3 h-3" />
                            Assegna
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-bold text-xs">
                          {log.items_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                            log.status === 'success'
                              ? 'bg-success/15 text-success'
                              : 'bg-danger/15 text-danger'
                          )}
                        >
                          {log.status === 'success' ? 'OK' : 'Errore'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Assegna Brand"
                            onClick={() => openBrandModal(log)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              log.brand
                                ? 'text-brand hover:bg-brand/10'
                                : 'text-foreground/40 hover:bg-surface-light hover:text-foreground'
                            )}
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                            title="Sposta tutti in Magazzino"
                            onClick={() => setPendingMoveAllId(log.id)}
                            disabled={movingAll === log.id}
                            className="p-2 rounded-lg text-success hover:bg-success/10 transition-colors disabled:opacity-40"
                          >
                            {movingAll === log.id ? (
                              <span className="inline-block w-4 h-4 animate-spin border-2 border-t-success border-success/20 rounded-full" />
                            ) : (
                              <PackagePlus className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            title="Esporta PDF"
                            onClick={() => handleExportPdf(log)}
                            className="p-2 rounded-lg text-foreground/40 hover:bg-surface-light hover:text-foreground transition-colors"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            title="Vedi e Modifica Prodotti"
                            onClick={() => openProducts(log)}
                            className="p-2 rounded-lg text-brand hover:bg-brand/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Elimina Import"
                            onClick={() => setPendingDeleteId(log.id)}
                            disabled={deleteLoading === log.id}
                            className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                          >
                            {deleteLoading === log.id ? (
                              <span className="inline-block w-4 h-4 animate-spin border-2 border-t-danger border-danger/20 rounded-full" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODAL — View & Edit Products                                      */}
      {/* ================================================================ */}
      <Modal
        open={!!selectedLog}
        title={selectedLog ? `Prodotti — ${selectedLog.filename}` : ''}
        onClose={() => { if (!savingRows) setSelectedLog(null) }}
        size="xl"
      >
        <div className="flex flex-col" style={{ maxHeight: '65vh' }}>
          <p className="text-sm text-foreground/60 mb-3 shrink-0">
            Modifica direttamente i campi. Premi <strong className="text-brand">X</strong> sulla riga per
            eliminarla dal batch, poi <strong className="text-brand">Salva Modifiche</strong> per confermare.
            <span className="ml-1 font-medium">I campi vuoti sono evidenziati in <span className="px-1 py-0.5 rounded bg-[#CCD0D5] text-black text-xs font-bold">#CCD0D5</span></span>.
          </p>

          <div className="flex-1 overflow-y-auto min-h-0 border border-surface-light rounded-xl">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-foreground/40">
                <span className="inline-block animate-spin w-7 h-7 border-[3px] border-t-brand border-brand/20 rounded-full mb-3" />
                Caricamento prodotti...
              </div>
            ) : editRows.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-foreground/40 font-medium">
                Nessun prodotto collegato a questa importazione.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-surface shadow-sm border-b border-surface-light">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-8">#</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70">Barcode</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70">SKU</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70">Nome *</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-24">Taglia</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-28">Colore</th>
                    <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-24">Cod. Colore</th>
                    <th className="px-3 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-light">
                  {editRows.map((row, idx) => {
                    const nameEmpty = !row.name.trim()
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'transition-colors',
                          nameEmpty ? 'bg-yellow-50' : 'hover:bg-brand/5'
                        )}
                      >
                        <td className="px-3 py-2 text-xs text-foreground/40">{idx + 1}</td>
                        {(['barcode', 'sku', 'name', 'size', 'color', 'color_code'] as const).map((field) => (
                          <td key={field} className="px-1 py-1">
                            <input
                              type="text"
                              value={row[field]}
                              onChange={(e) => updateCell(row.id, field, e.target.value)}
                              aria-label={`${field} riga ${idx + 1}`}
                              className={cn(
                                'w-full px-2 py-1.5 rounded-lg border text-sm transition-colors',
                                'focus:outline-none focus:ring-2 focus:ring-brand',
                                !row[field].trim()
                                  ? 'bg-[#CCD0D5] text-black border-[#A0AAB5] shadow-inner'
                                  : field === 'name' && nameEmpty
                                    ? 'bg-background border-yellow-400 ring-1 ring-yellow-300 text-foreground'
                                    : 'bg-background text-foreground border-surface-light focus:border-brand'
                              )}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setPendingMoveSingle({ id: row.id, name: row.name })}
                              disabled={movingRow === row.id}
                              aria-label={`Sposta in magazzino riga ${idx + 1}`}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-success hover:bg-success/10 transition-colors disabled:opacity-40"
                              title="Sposta in Magazzino"
                            >
                              {movingRow === row.id ? (
                                <span className="inline-block w-3.5 h-3.5 animate-spin border-2 border-t-success border-success/20 rounded-full" />
                              ) : (
                                <Package className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteRow(row.id)}
                              aria-label={`Elimina riga ${idx + 1}`}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors"
                              title="Elimina riga"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-light shrink-0">
            <span className="text-xs text-foreground/40">
              {editRows.length} prodott{editRows.length === 1 ? 'o' : 'i'}
            </span>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedLog(null)}
                disabled={savingRows}
              >
                Annulla
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setConfirmSaveProducts(true)}
                loading={savingRows}
                disabled={editRows.length === 0 || savingRows}
              >
                <Save className="w-4 h-4 mr-2" />
                Salva Modifiche
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/* MODAL — Assign Brand                                             */}
      {/* ================================================================ */}
      <Modal
        open={!!brandModalLog}
        title={brandModalLog ? `Brand — ${brandModalLog.filename}` : ''}
        onClose={() => { if (!savingBrand) setBrandModalLog(null) }}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/60">
            Assegna un brand a <strong>tutti gli articoli</strong> di questa importazione.
            Il brand verrà salvato sia sull&apos;importazione che su ogni prodotto dell&apos;anagrafica collegato.
          </p>

          <div>
            <label className="block text-sm font-semibold text-foreground/70 mb-1.5">Brand / Marca</label>
            <input
              type="text"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setConfirmSaveBrand(true) } }}
              placeholder="Es. Nike, Adidas, Levi's..."
              className="w-full px-4 py-2.5 rounded-xl border border-surface-light bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              autoFocus
            />
          </div>

          {brandModalLog?.brand && brandInput.trim() === '' && (
            <p className="text-xs text-foreground/40 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
              Salvando vuoto rimuoverai il brand da tutti i prodotti.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setBrandModalLog(null)}
              disabled={savingBrand}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setConfirmSaveBrand(true)}
              loading={savingBrand}
              disabled={savingBrand}
            >
              <Tag className="w-4 h-4 mr-2" />
              Salva Brand
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmBanner
        open={pendingDeleteId !== null}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (pendingDeleteId) {
            await handleDeleteImport(pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
        message="L'importazione e TUTTI i prodotti associati verranno eliminati definitivamente."
        confirmLabel="Elimina"
        variant="danger"
        loading={deleteLoading !== null}
      />
      <ConfirmBanner
        open={pendingMoveAllId !== null}
        onCancel={() => setPendingMoveAllId(null)}
        onConfirm={async () => {
          if (pendingMoveAllId) {
            const id = pendingMoveAllId
            setPendingMoveAllId(null)
            await moveAllToInventory(id)
          }
        }}
        message="Tutti i prodotti di questa importazione verranno spostati in magazzino."
        confirmLabel="Sposta tutti"
        variant="warning"
        loading={movingAll !== null}
      />
      <ConfirmBanner
        open={pendingMoveSingle !== null}
        onCancel={() => setPendingMoveSingle(null)}
        onConfirm={async () => {
          if (pendingMoveSingle) {
            const { id, name } = pendingMoveSingle
            setPendingMoveSingle(null)
            await moveSingleToInventory(id, name)
          }
        }}
        message={pendingMoveSingle ? `Spostare "${pendingMoveSingle.name}" in magazzino?` : ''}
        confirmLabel="Sposta"
        variant="default"
        loading={movingRow !== null}
      />
      <ConfirmBanner
        open={confirmSaveProducts}
        onCancel={() => setConfirmSaveProducts(false)}
        onConfirm={async () => {
          setConfirmSaveProducts(false)
          await saveProducts()
        }}
        message="Le modifiche ai prodotti verranno salvate definitivamente."
        confirmLabel="Salva"
        variant="warning"
        loading={savingRows}
      />
      <ConfirmBanner
        open={confirmSaveBrand}
        onCancel={() => setConfirmSaveBrand(false)}
        onConfirm={async () => {
          setConfirmSaveBrand(false)
          await saveBrand()
        }}
        message={brandInput.trim() ? `Il brand "${brandInput.trim()}" verrà assegnato a tutti i prodotti dell'importazione.` : 'Il brand verrà rimosso da tutti i prodotti dell\'importazione.'}
        confirmLabel="Salva Brand"
        variant="warning"
        loading={savingBrand}
      />

      <ConfirmBanner
        open={pendingDeleteRow !== null}
        onCancel={() => setPendingDeleteRow(null)}
        onConfirm={() => {
          if (pendingDeleteRow) {
            deleteEditRow(pendingDeleteRow)
            setPendingDeleteRow(null)
          }
        }}
        message="Sei sicuro di voler eliminare questo prodotto dalla tabella?"
        confirmLabel="Elimina"
        variant="danger"
      />
    </AppShell>
  )
}
