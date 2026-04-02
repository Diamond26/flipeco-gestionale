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
      <div className="bg-surface/50 dark:bg-white/[0.03] backdrop-blur-3xl rounded-3xl border border-surface dark:border-white/10 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.15)] relative overflow-hidden flex flex-col gap-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#7BB35F]/5 blur-3xl pointer-events-none rounded-full" />
        
        {/* Search header info */}
        <div>
           <h3 className="text-xl font-bold text-foreground drop-shadow-sm mb-1">Ricerca Rapida</h3>
           <p className="text-xs text-foreground/50">Digita il nome o scansiona direttamente il codice a barre.</p>
        </div>

        {/* Barcode Form */}
        <form onSubmit={handleBarcodeScan} className="relative z-10 flex flex-col gap-3">
          <div ref={scannerBoxRef} className="relative w-full">
            <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#7BB35F]/70" />
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
              className="w-full pl-12 pr-4 py-4 text-xl font-mono text-foreground border border-surface dark:border-white/10 rounded-2xl bg-surface/80 dark:bg-black/30 shadow-inner focus:outline-none focus:ring-4 focus:ring-[#7BB35F]/20 focus:border-[#7BB35F]/40 transition-all placeholder:text-foreground/30 placeholder:font-sans"
              autoComplete="off"
            />
            {scannerOpen && scannerSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-surface dark:border-white/10 bg-surface/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-[0_10px_40px_rgb(0,0,0,0.3)] overflow-hidden">
                <ul className="max-h-80 overflow-y-auto py-2">
                  {scannerSuggestions.map((product, index) => {
                    const pr = product.product_registry
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => selectScannerSuggestion(product)}
                          className={cn(
                            'w-full text-left px-5 py-3 border-b last:border-b-0 border-surface/20 dark:border-white/5 transition-colors',
                            index === scannerActiveIndex ? 'bg-[#7BB35F]/20' : 'hover:bg-surface/40 dark:hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{pr.name}</p>
                              <p className="text-xs text-foreground/50 truncate mt-0.5">
                                {pr.barcode} &middot; {pr.brand || 'N/D'} &middot; {pr.size}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[15px] font-bold text-[#7BB35F] drop-shadow-sm">{formatCurrency(product.sell_price)}</p>
                              <p className="text-[11px] text-foreground/40">{product.quantity} pz disp.</p>
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
            className="w-full py-4 text-lg bg-[#7BB35F] hover:bg-[#8CE36B] border border-[#8CE36B]/50 shadow-[0_0_20px_rgba(123,179,95,0.2)] rounded-2xl h-auto"
          >
            AGGIUNGI AL CARRELLO
          </Button>
        </form>

        <div className="relative pt-4">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface dark:border-white/10" /></div>
           <div className="relative flex justify-center"><span className="bg-white dark:bg-[#070b14] px-4 text-xs font-semibold text-foreground/40 tracking-wider">OPPURE</span></div>
        </div>

        <button
          type="button"
          onClick={() => setProductMenuOpen(true)}
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-[15px] tracking-wide border-2 border-surface dark:border-white/10 text-foreground hover:bg-surface/50 dark:hover:bg-white/5 transition-colors group shadow-sm bg-surface/30 dark:bg-black/20"
        >
          <Search className="w-5 h-5 text-foreground/60 group-hover:text-foreground transition-colors" />
          SFOGLIA CATALOGO COMPLETO
        </button>

      </div>
    </div>
  )
}
