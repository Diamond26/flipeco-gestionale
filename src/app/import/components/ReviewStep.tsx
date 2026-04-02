import React from 'react';
import { ProductRow, Supplier, Step } from '../types';
import { Trash2, AlertCircle, FileDown } from 'lucide-react';

interface ReviewStepProps {
  rows: ProductRow[];
  selectedSupplierId: string;
  suppliers: Supplier[];
  setSelectedSupplierId: (val: string) => void;
  updateCell: (id: string, field: keyof Omit<ProductRow, 'id' | 'hasError'>, value: string) => void;
  deleteRow: (id: string) => void;
  setStep: (step: Step) => void;
  handleExportPDF: () => void;
  setSaveConfirmOpen: (val: boolean) => void;
  saving: boolean;
  saveError: string;
}

export function ReviewStep({
  rows,
  selectedSupplierId,
  suppliers,
  setSelectedSupplierId,
  updateCell,
  deleteRow,
  setStep,
  handleExportPDF,
  setSaveConfirmOpen,
  saving,
  saveError,
}: ReviewStepProps) {
  const errorCount = rows.filter((r) => r.hasError).length;

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in max-w-6xl mx-auto pt-4">
      {/* Settings / Supplier Header */}
      <div className="bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-[16px] font-bold text-foreground tracking-wide mb-1">Associa Fornitore</h3>
          <p className="text-[13px] text-foreground/50">Necessario per concludere l&apos;importazione.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <select
            className={`
              w-full appearance-none bg-surface/50 dark:bg-white/[0.03] border rounded-xl px-4 py-2.5 text-foreground/90 text-[14px] transition-all cursor-pointer shadow-inner backdrop-blur-sm focus:outline-none
              ${!selectedSupplierId ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-surface dark:border-white/10 focus:ring-2 focus:ring-[#7BB35F]/50'}
            `}
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
          >
            <option value="" className="bg-[#0b0f19] text-foreground/50">Scegli un fornitore...</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id} className="bg-[#0b0f19] text-foreground">{s.name}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40">
            <svg width="12" height="7" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Editable Table */}
      <div className="bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-3">
               <h3 className="text-[17px] font-bold text-foreground tracking-wide">Revisione Dati Estesi</h3>
               <span className="text-[12px] font-bold bg-[#7BB35F]/20 text-[#7BB35F] px-2.5 py-0.5 rounded-full ring-1 ring-[#7BB35F]/30">{rows.length} prodotti</span>
             </div>
             {errorCount > 0 && (
               <div className="flex items-center gap-1.5 mt-0.5 animate-fadeIn">
                 <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                 <p className="text-[12.5px] text-red-400">Ci sono <strong>{errorCount}</strong> righe con nome mancante da risolvere.</p>
               </div>
             )}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-surface dark:border-white/5 bg-surface/30 dark:bg-black/20 pb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface/50 dark:bg-white/[0.03]">
                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/30 whitespace-nowrap border-b border-surface dark:border-white/5 w-8">#</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Barcode</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">SKU</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Nome *</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Taglia</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Colore</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Cod. Colore</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Brand</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap border-b border-surface dark:border-white/5">Categoria</th>
                <th className="px-4 py-3 border-b border-surface dark:border-white/5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-b border-surface dark:border-white/5 transition-colors group
                    ${row.hasError ? 'bg-red-500/[0.04]' : 'hover:bg-surface/50 dark:hover:bg-white/[0.03]'}
                  `}
                >
                  <td className="px-3 py-2 text-foreground/30 text-[11px] font-mono">{idx + 1}</td>
                  {(['barcode', 'sku', 'name', 'size', 'color', 'color_code', 'brand', 'category'] as const).map((field) => (
                    <td key={field} className="px-1 py-1">
                      <div className={`relative rounded-lg overflow-hidden transition-all ${
                         !row[field].trim() 
                          ? 'bg-surface/50 dark:bg-black/30 ring-1 ring-white/5' 
                          : field === 'name' && row.hasError
                            ? 'bg-red-500/10 ring-1 ring-red-500/40'
                            : 'bg-transparent ring-1 ring-transparent hover:ring-white/10 focus-within:ring-[#7BB35F]/50 focus-within:bg-[#7BB35F]/5'
                      }`}>
                         <input
                           type="text"
                           value={row[field]}
                           onChange={(e) => updateCell(row.id, field, e.target.value)}
                           className={`w-full px-3 py-2 text-[13px] bg-transparent outline-none transition-colors
                             ${field === 'name' && row.hasError ? 'text-foreground' : 'text-foreground/80 focus:text-foreground'}
                             focus:bg-surface/60 dark:focus:bg-white/5
                           `}
                           placeholder={field === 'name' ? 'Obbligatorio...' : ''}
                         />
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/20 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="Elimina riga"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center text-foreground/40 py-10 text-[14px]">
              Nessuna riga disponibile. Torna indietro per ricaricare.
            </p>
          )}
        </div>
      </div>

      {saveError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[14px] text-red-400 font-medium animate-fade-in flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{saveError}</p>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex justify-between items-center mt-2 px-2">
        <button 
          onClick={() => setStep('mapping')}
          className="text-[14px] text-foreground/50 hover:text-foreground transition-colors flex items-center gap-2 font-medium"
        >
          &larr; Torna alla Mappatura
        </button>
        
        <div className="flex items-center gap-4">
           <button
             onClick={handleExportPDF}
             className="px-5 py-2.5 rounded-full border border-surface dark:border-white/10 bg-surface/60 dark:bg-white/5 text-foreground/70 text-[14px] font-semibold tracking-wide transition-all hover:bg-surface/80 dark:hover:bg-white/10 hover:text-foreground flex items-center gap-2"
           >
             <FileDown className="w-4 h-4" /> PDF
           </button>

           <button
             onClick={() => setSaveConfirmOpen(true)}
             disabled={rows.length === 0 || !selectedSupplierId || saving || errorCount > 0}
             className={`
               px-7 py-3.5 rounded-full font-bold text-[15px] tracking-wide transition-all flex items-center gap-2 relative overflow-hidden shadow-lg
               ${(rows.length === 0 || !selectedSupplierId || saving || errorCount > 0)
                 ? 'bg-surface/60 dark:bg-white/5 text-foreground/30 border border-surface dark:border-white/5 cursor-not-allowed'
                 : 'bg-[#7BB35F] text-white border border-[#7BB35F] shadow-[0_0_20px_rgba(123,179,95,0.4)] hover:shadow-[0_0_30px_rgba(123,179,95,0.6)] hover:bg-[#8CE36B] hover:border-[#8CE36B]'
               }
             `}
           >
             {!(!selectedSupplierId || errorCount > 0) && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />}
             Salva in Anagrafica
           </button>
        </div>
      </div>

    </div>
  );
}
