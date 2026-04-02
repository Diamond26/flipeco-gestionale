import React from 'react'
import { Scan, Search } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { InventoryProduct } from '../types'
import { Button } from '@/components/ui/Button'

interface POSSearchProps {
  barcodeValue: string
  setBarcodeValue: (val: string) => void
  handleBarcodeScan: (e: React.FormEvent) => void
  scanLoading: boolean
  scannerOpen: boolean
  setScannerOpen: (v: boolean) => void
  scannerActiveIndex: number
  setScannerActiveIndex: React.Dispatch<React.SetStateAction<number>>
  scannerSuggestions: InventoryProduct[]
  selectScannerSuggestion: (p: InventoryProduct) => void
  scannerBoxRef: React.RefObject<HTMLDivElement | null>
  barcodeInputRef: React.RefObject<HTMLInputElement | null>
  setProductMenuOpen: (v: boolean) => void
}

export function POSSearch({
  barcodeValue, setBarcodeValue, handleBarcodeScan, scanLoading, scannerOpen, setScannerOpen,
  scannerActiveIndex, setScannerActiveIndex, scannerSuggestions, selectScannerSuggestion,
  scannerBoxRef, barcodeInputRef, setProductMenuOpen
}: POSSearchProps) {
  return (
    <div className="w-full h-full flex flex-col gap-4 relative z-10">
      <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl border border-black/[0.04] dark:border-white/[0.06] p-6 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col gap-6 transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 dark:bg-brand/10 blur-3xl pointer-events-none rounded-full" />
        
        {/* Search header info */}
        <div className="relative z-10">
           <h3 className="text-xl font-bold text-foreground drop-shadow-sm mb-1 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
             Ricerca Rapida
           </h3>
           <p className="text-xs text-foreground/60">Digita il nome o scansiona direttamente il codice a barre.</p>
        </div>

        {/* Barcode Form */}
        <form onSubmit={handleBarcodeScan} className="relative z-10 flex flex-col gap-3">
          <div ref={scannerBoxRef} className="relative w-full group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
              <div className="relative">
                <div className="absolute inset-0 bg-brand blur-md opacity-20 group-focus-within:opacity-50 transition-opacity" />
                <Scan className="w-6 h-6 text-brand relative z-10" />
              </div>
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
                  setScannerActiveIndex((prev) => prev < scannerSuggestions.length - 1 ? prev + 1 : 0)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setScannerActiveIndex((prev) => prev > 0 ? prev - 1 : scannerSuggestions.length - 1)
                } else if (e.key === 'Escape') {
                  setScannerOpen(false)
                }
              }}
              placeholder="Scansiona o digita..."
              className="w-full pl-14 pr-4 py-5 text-2xl font-mono text-foreground border border-black/[0.08] dark:border-white/[0.08] rounded-2xl bg-surface-light/50 dark:bg-black/40 focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand/40 shadow-inner transition-all placeholder:text-foreground/30 placeholder:font-sans placeholder:text-lg"
              autoComplete="off"
            />
            {scannerOpen && scannerSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-50 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <ul className="max-h-80 overflow-y-auto py-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {scannerSuggestions.map((product, index) => {
                    const pr = product.product_registry
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => selectScannerSuggestion(product)}
                          className={cn(
                            'w-full text-left px-5 py-4 transition-colors',
                            index === scannerActiveIndex ? 'bg-brand/15' : 'hover:bg-surface-light/60 dark:hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{pr.name}</p>
                              <p className="text-[11px] text-foreground/50 truncate mt-0.5 uppercase tracking-wider">
                                {pr.barcode} &middot; {pr.brand || 'N/D'} &middot; {pr.size}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[16px] font-bold text-brand drop-shadow-sm">{formatCurrency(product.sell_price)}</p>
                              <p className="text-[10px] uppercase font-semibold text-foreground/40">{product.quantity} disp.</p>
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
            className="w-full py-5 text-lg font-bold tracking-widest rounded-2xl h-auto shadow-xl shadow-brand/20 hover:scale-[1.01] active:scale-95 transition-all"
          >
            AGGIUNGI AL CARRELLO
          </Button>
        </form>

        <div className="relative py-2">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/[0.06] dark:border-white/[0.08]" /></div>
           <div className="relative flex justify-center"><span className="bg-card dark:bg-[#1a1f2e] px-4 text-[10px] font-bold text-foreground/50 tracking-[0.2em] bg-transparent">OPPURE</span></div>
        </div>

        <button
          type="button"
          onClick={() => setProductMenuOpen(true)}
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-3 font-bold text-[14px] uppercase tracking-widest border-2 border-black/[0.06] dark:border-white/[0.08] text-foreground/80 hover:text-foreground hover:bg-surface-light/60 dark:hover:bg-white/[0.04] transition-all group bg-surface-light/30 dark:bg-white/[0.01] overflow-hidden relative shadow-sm"
        >
          <div className="absolute inset-0 bg-brand/5 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
          <Search className="w-5 h-5 text-brand relative z-10" />
          <span className="relative z-10">Sfoglia Catalogo Completo</span>
        </button>

      </div>
    </div>
  )
}
