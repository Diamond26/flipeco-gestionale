'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
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
    if (!window.confirm('Confermi? L\'importazione e TUTTI i prodotti associati verranno eliminati definitivamente.')) return

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
              'pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-in',
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

      <div className="max-w-7xl mx-auto space-y-6">
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
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-surface-light bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
            />
          </div>
        </div>

        {/* ---- Table ---- */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface border-b border-surface-light">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70">Data</th>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70">Fornitore</th>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70">File</th>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70 text-center">Articoli</th>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70 text-center">Stato</th>
                  <th className="px-5 py-3.5 font-semibold text-foreground/70 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-light">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-foreground/40 text-base">
                      <span className="inline-block animate-spin w-5 h-5 border-2 border-t-brand border-brand/20 rounded-full mr-3 align-middle" />
                      Caricamento storico...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-foreground/40 text-base font-medium">
                      {searchQuery ? 'Nessun risultato per la ricerca.' : 'Nessuna importazione trovata.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/30 transition-colors">
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
                            onClick={() => handleDeleteImport(log.id)}
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
        </Card>
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
                    <th className="px-3 py-3 w-10" />
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
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => deleteEditRow(row.id)}
                            aria-label={`Elimina riga ${idx + 1}`}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors"
                            title="Elimina riga"
                          >
                            <X className="w-4 h-4" />
                          </button>
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
                onClick={saveProducts}
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
    </AppShell>
  )
}
