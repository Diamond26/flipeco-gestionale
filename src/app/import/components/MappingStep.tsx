import React, { Dispatch, SetStateAction } from 'react';
import { MappingConfig, Step } from '../types';
import { AlertCircle } from 'lucide-react';

interface MappingStepProps {
  selectedFile: File | null;
  parsedHeaders: string[];
  parsedRows: Record<string, string>[];
  mapping: MappingConfig;
  setMapping: Dispatch<SetStateAction<MappingConfig>>;
  setStep: (step: Step) => void;
  goToReview: () => void;
}

export function MappingStep({
  selectedFile,
  parsedHeaders,
  parsedRows,
  mapping,
  setMapping,
  setStep,
  goToReview,
}: MappingStepProps) {

  const mappingFields: { key: keyof MappingConfig; label: string; required?: boolean }[] = [
    { key: 'name', label: 'Nome Prodotto', required: true },
    { key: 'barcode', label: 'Barcode / EAN' },
    { key: 'sku', label: 'SKU / Articolo' },
    { key: 'size', label: 'Taglia' },
    { key: 'color', label: 'Colore' },
    { key: 'color_code', label: 'Codice Colore' },
    { key: 'brand', label: 'Brand / Marca' },
    { key: 'category', label: 'Categoria' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-4xl mx-auto pt-4">
      {/* Mapping PANE */}
      <div className="relative bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-7 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden group">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
          <h3 className="text-[17px] font-bold text-foreground tracking-wide">Mappatura Colonne</h3>
          <span className="text-[13px] text-foreground/40">File: <span className="text-foreground/70">{selectedFile?.name}</span></span>
        </div>
        <p className="text-[13px] text-foreground/50 mb-8 leading-relaxed max-w-3xl">
          Il sistema ha tentato di abbinare automaticamente le colonne del file ai campi dell&apos;anagrafica. Verifica e correggi le associazioni se necessario.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
          {mappingFields.map(({ key, label, required }) => {
            const val = mapping[key];
            const isError = required && !val;
            const isSuccess = !!val;
            
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold tracking-wide flex items-center gap-1">
                  <span className={required && isError ? 'text-red-400' : 'text-foreground/80'}>{label}</span>
                  {required && <span className="text-red-400">*</span>}
                </label>
                
                <div className="relative z-10 w-full group/sel">
                  <select
                    className={`
                      w-full appearance-none bg-surface/50 dark:bg-white/[0.03] border rounded-xl px-4 py-2.5 text-[14px] transition-all cursor-pointer shadow-inner backdrop-blur-sm
                      focus:outline-none
                      ${isError 
                        ? 'border-red-500/50 text-foreground shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20' 
                        : isSuccess 
                          ? 'border-[#7BB35F]/50 text-foreground shadow-[0_0_15px_rgba(123,179,95,0.15)]' 
                          : 'border-surface dark:border-white/10 text-foreground/60 hover:border-surface dark:border-white/20 hover:bg-surface/50 dark:hover:bg-white/[0.03]'
                      }
                    `}
                    value={val}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="" className="bg-[#0b0f19] text-foreground/50">— non mappare —</option>
                    {parsedHeaders.map(h => (
                      <option key={h} value={h} className="bg-[#0b0f19] text-foreground">{h}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/30">
                    <svg width="12" height="7" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Subtext */}
                {isError && (
                  <div className="flex items-center gap-1.5 mt-0.5 animate-fade-in">
                     <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                     <p className="text-[12px] text-red-400">Il campo &apos;{label}&apos; è obbligatorio per procedere.</p>
                  </div>
                )}
                {isSuccess && (
                   <p className="text-[12px] text-[#7BB35F]/80 mt-0.5 tracking-wide">&mdash; colonna &apos;{val}&apos; trovata</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {parsedRows.length > 0 && (
        <div className="relative bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-7 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
          <h3 className="text-[16px] font-bold text-foreground mb-5 tracking-wide">Anteprima Dati (prime 3 righe)</h3>
          
          <div className="overflow-x-auto rounded-2xl border border-surface dark:border-white/5 bg-surface/30 dark:bg-black/20">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface/60 dark:bg-white/5">
                  {parsedHeaders.map((h, i) => (
                    <th key={i} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/40 whitespace-nowrap border-b border-surface dark:border-white/5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 3).map((row, idx) => (
                  <tr key={idx} className="border-b border-surface dark:border-white/5 last:border-0 hover:bg-surface/50 dark:hover:bg-white/[0.03] transition-colors">
                    {parsedHeaders.map((h, i) => (
                      <td key={i} className="px-4 py-3 text-[13px] text-foreground/70 whitespace-nowrap">
                        {row[h] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="flex justify-between items-center mt-2 px-2">
        <button 
          onClick={() => setStep('upload')}
          className="text-[14px] text-foreground/50 hover:text-foreground transition-colors flex items-center gap-2 font-medium"
        >
          &larr; Torna al Caricamento
        </button>
        
        <button
          onClick={goToReview}
          disabled={!mapping.name}
          className={`
            px-7 py-3.5 rounded-full font-bold text-[15px] tracking-wide transition-all flex items-center gap-2 relative overflow-hidden
            ${!mapping.name
              ? 'bg-surface/60 dark:bg-white/5 text-foreground/30 border border-surface dark:border-white/5 cursor-not-allowed'
              : 'bg-[#7BB35F]/20 text-[#8CE36B] border border-[#7BB35F]/50 shadow-[0_0_25px_rgba(123,179,95,0.25)] hover:shadow-[0_0_35px_rgba(123,179,95,0.4)] hover:bg-[#7BB35F]/30 hover:border-[#7BB35F]/70'
            }
          `}
        >
          {!mapping.name ? null : <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />}
          Continua &rarr; Revisiona Dati
        </button>
      </div>

    </div>
  );
}
