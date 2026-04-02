import React, { Dispatch, SetStateAction, RefObject } from 'react';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { Supplier } from '../types';

interface UploadStepProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  setSelectedSupplierId: (val: string) => void;
  loadSuppliers: () => Promise<void>;
  openEditSupplier: () => void;
  setDeleteSupplierModal: (val: boolean) => void;
  setShowNewSupplierModal: (val: boolean) => void;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  selectedFile: File | null;
  hasHeader: boolean;
  setHasHeader: (val: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  parsing: boolean;
  parseError: string;
  parsedHeaders: string[];
  parsedRows: Record<string, string>[];
  goToMapping: () => void;
  handleFile: (file: File, hasHeader: boolean) => void;
}

export function UploadStep({
  suppliers,
  selectedSupplierId,
  setSelectedSupplierId,
  loadSuppliers,
  openEditSupplier,
  setDeleteSupplierModal,
  setShowNewSupplierModal,
  isDragging,
  setIsDragging,
  selectedFile,
  hasHeader,
  setHasHeader,
  onDrop,
  onFileInput,
  fileInputRef,
  parsing,
  parseError,
  parsedHeaders,
  parsedRows,
  goToMapping,
  handleFile,
}: UploadStepProps) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-5xl mx-auto pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fornitore PANE */}
        <div className="relative bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-7 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-surface/50 dark:bg-white/[0.03] rounded-full blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-150" />
          
          <h3 className="text-lg font-bold text-foreground mb-6 tracking-wide drop-shadow-sm">Fornitore</h3>
          
          <div className="relative z-10 w-full mb-8">
            <select
              className="w-full appearance-none bg-surface/50 dark:bg-white/[0.03] border border-surface dark:border-white/10 rounded-xl px-5 py-3.5 text-foreground/80 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#7BB35F]/50 focus:bg-surface/50 dark:focus:bg-white/[0.03] transition-all cursor-pointer shadow-inner backdrop-blur-sm"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              onClick={() => { if(suppliers.length===0) loadSuppliers() }}
            >
              <option value="" className="bg-[#0b0f19] text-foreground">Scegli un fornitore...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id} className="bg-[#0b0f19] text-foreground">{s.name}</option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40">
              <svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {selectedSupplierId && (
             <div className="flex gap-3 mt-4 justify-end mb-4">
                <button
                  type="button"
                  title="Modifica fornitore"
                  onClick={openEditSupplier}
                  className="p-2.5 rounded-lg border border-surface dark:border-white/10 bg-surface/60 dark:bg-white/5 text-[#7BB35F] hover:bg-[#7BB35F]/10 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Elimina fornitore"
                  onClick={() => setDeleteSupplierModal(true)}
                  className="p-2.5 rounded-lg border border-surface dark:border-white/10 bg-surface/60 dark:bg-white/5 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={() => { loadSuppliers(); setShowNewSupplierModal(true); }}
              className="relative overflow-hidden px-5 py-2.5 rounded-full border border-[#7BB35F]/40 bg-[#7BB35F]/10 text-[#7BB35F] text-[14px] font-semibold tracking-wide transition-all hover:bg-[#7BB35F]/20 hover:shadow-[0_0_20px_rgba(123,179,95,0.3)] shadow-[0_0_15px_rgba(123,179,95,0.15)] flex items-center gap-2"
            >
              <span>+ Nuovo Fornitore</span>
            </button>
          </div>
        </div>

        {/* Carica File PANE */}
        <div className="relative bg-surface/50 dark:bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-surface dark:border-white/10 p-7 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col group">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-white/[0.04] to-transparent pointer-events-none" />
          <h3 className="text-lg font-bold text-foreground mb-6 tracking-wide drop-shadow-sm">Carica File</h3>

          <div
            role="button"
            tabIndex={0}
            aria-label="Zona di caricamento file."
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className={`
              relative flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all duration-300 overflow-hidden cursor-pointer
              ${isDragging ? 'border-[#7BB35F] bg-[#7BB35F]/5 scale-[0.99]' : selectedFile ? 'border-[#7BB35F]/40 bg-[#7BB35F]/[0.02]' : 'border-surface dark:border-white/20 bg-surface/50 dark:bg-white/[0.03] hover:border-surface dark:border-white/40 hover:bg-surface/50 dark:hover:bg-white/[0.03]'}
            `}
          >
            {isDragging && <div className="absolute inset-0 bg-[#7BB35F]/10 backdrop-blur-[2px] z-0" />}

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={`w-[52px] h-[52px] rounded-full border border-surface dark:border-white/10 flex items-center justify-center mb-5 transition-all shadow-lg ${isDragging ? 'bg-[#7BB35F] text-white shadow-[#7BB35F]/40' : 'bg-surface/60 dark:bg-white/5 text-foreground/80'}`}>
                <Upload strokeWidth={2} className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <>
                  <p className="text-lg font-semibold text-foreground drop-shadow-sm">{selectedFile.name}</p>
                  <p className="text-[13px] text-foreground/40 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB &mdash; clicca per cambiare</p>
                </>
              ) : (
                <>
                  <p className="text-[17px] font-semibold text-foreground drop-shadow-sm">Trascina il file qui</p>
                  <p className="text-[14px] text-foreground/60 mt-1">oppure clicca per sfogliare</p>
                  <p className="text-[12px] text-foreground/30 mt-4 tracking-wide">Formati accettati: .csv, .xlsx, .xls, .pdf</p>
                </>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={onFileInput}
            />
          </div>

          <div className="mt-6 flex items-center gap-3 px-2">
            <input
              type="checkbox"
              id="hasHeaderCheckbox"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                if (selectedFile) handleFile(selectedFile, e.target.checked);
              }}
              className="w-4 h-4 rounded border-surface dark:border-white/20 bg-surface/60 dark:bg-white/5 text-[#7BB35F] focus:ring-[#7BB35F]/30 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-[#7BB35F] checked:border-[#7BB35F] transition-colors relative after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:w-[6px] checked:after:h-[10px] checked:after:border-r-2 checked:after:border-b-2 checked:after:border-[#0f1219] checked:after:rotate-45"
            />
            <label htmlFor="hasHeaderCheckbox" className="text-[13.5px] text-foreground/60 hover:text-foreground/90 font-medium cursor-pointer transition-colors">
              Il file contiene una riga di intestazione (nomi delle colonne)
            </label>
          </div>

          {parsing && (
            <p className="mt-4 text-center text-[13px] text-[#7BB35F] font-medium animate-pulse">Analisi in corso...</p>
          )}

          {parseError && (
            <p className="mt-4 text-center text-[13px] text-red-400 font-medium">{parseError}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={goToMapping}
          disabled={!selectedFile || parsedHeaders.length === 0 || parsing}
          className={`
            px-7 py-3.5 rounded-full font-bold text-[15px] tracking-wide transition-all flex items-center gap-2 relative overflow-hidden
            ${(!selectedFile || parsedHeaders.length === 0 || parsing)
              ? 'bg-surface/60 dark:bg-white/5 text-foreground/30 border border-surface dark:border-white/5 cursor-not-allowed'
              : 'bg-[#7BB35F]/20 text-[#8CE36B] border border-[#7BB35F]/50 shadow-[0_0_25px_rgba(123,179,95,0.25)] hover:shadow-[0_0_35px_rgba(123,179,95,0.4)] hover:bg-[#7BB35F]/30 hover:border-[#7BB35F]/70'
            }
          `}
        >
          {(!selectedFile || parsedHeaders.length === 0 || parsing) ? null : <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />}
          Continua &rarr; Mappa Colonne
        </button>
      </div>

    </div>
  );
}
