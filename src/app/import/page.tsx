'use client';

import { useState, useCallback, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { parseCSV } from '@/lib/parsers/csv-parser';
import { parseExcel } from '@/lib/parsers/excel-parser';
import { parsePDF } from '@/lib/parsers/pdf-parser';
import { exportToPDF } from '@/lib/pdf-export';
import { productRegistrySchema } from '@/lib/validators/schemas';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'mapping' | 'review' | 'done';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface MappingConfig {
  barcode: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  color_code: string;
  brand: string;
  category: string;
}

interface ProductRow {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  color_code: string;
  brand: string;
  category: string;
  hasError: boolean;
}

// ---------------------------------------------------------------------------
// Auto-mapping helper
// ---------------------------------------------------------------------------

function autoDetectMapping(headers: string[]): MappingConfig {
  const find = (patterns: RegExp[]): string => {
    for (const h of headers) {
      const lower = h.toLowerCase();
      if (patterns.some((p) => p.test(lower))) return h;
    }
    return '';
  };

  return {
    barcode: find([/barcode/, /bar\s*code/, /\bean\b/, /ean13/, /upc/, /cod.*bar/, /codice/]),
    sku: find([/sku/, /art/, /codice.*art/, /cod.*art/, /riferimento/, /rif/]),
    name: find([/nome/, /desc/, /name/, /prodotto/, /modello/, /articolo/]),
    size: find([/tagl/, /size/, /misura/, /tg\.?$/, /numero/]),
    color: find([/colore/, /^color$/, /variante.*col/, /col\.?$/]),
    color_code: find([/cod\.?\s*col/, /color.?cod/, /codice.?col/, /cod\.?\s*var/]),
    brand: find([/brand/, /marca/, /marchio/, /griffe/]),
    category: find([/categ/, /category/, /tipo/, /reparto/, /classe/]),
  };
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Carica File' },
    { n: 2, label: 'Mappa Colonne' },
    { n: 3, label: 'Revisiona e Salva' },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, idx) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={[
                'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors',
                s.n < current
                  ? 'bg-brand border-brand text-white'
                  : s.n === current
                    ? 'bg-brand border-brand text-white shadow-lg ring-4 ring-brand/20'
                    : 'bg-surface border-surface-light text-foreground/40',
              ].join(' ')}
            >
              {s.n < current ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.n
              )}
            </div>
            <span
              className={[
                'mt-1 text-xs font-medium whitespace-nowrap',
                s.n === current ? 'text-brand' : 'text-foreground/40',
              ].join(' ')}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={[
                'h-0.5 w-16 mx-2 mt-[-14px] transition-colors',
                s.n < current ? 'bg-brand' : 'bg-surface-light',
              ].join(' ')}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const supabase = createClient();

  // --- global state ---
  const [step, setStep] = useState<Step>('upload');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);

  // --- file upload state ---
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- mapping state ---
  const [mapping, setMapping] = useState<MappingConfig>({
    barcode: '', sku: '', name: '', size: '', color: '', color_code: '', brand: '', category: '',
  });

  // --- review state ---
  const [rows, setRows] = useState<ProductRow[]>([]);

  // --- save state ---
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  // --- new supplier modal ---
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', email: '', phone: '', address: '' });
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [newSupplierError, setNewSupplierError] = useState('');

  // --- edit supplier modal ---
  const [editSupplierModal, setEditSupplierModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState({ id: '', name: '', email: '', phone: '', address: '' });
  const [editingSupplier, setEditingSupplier] = useState(false);
  const [editSupplierError, setEditSupplierError] = useState('');

  // --- delete supplier confirm ---
  const [deleteSupplierModal, setDeleteSupplierModal] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // --- success toast ---
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // ---------------------------------------------------------------------------
  // Load suppliers on mount (lazy)
  // ---------------------------------------------------------------------------

  const loadSuppliers = useCallback(async () => {
    if (suppliersLoaded) return;
    const { data, error } = await supabase.from('suppliers').select('id,name,email,phone,address').order('name');
    if (!error && data) {
      setSuppliers(data as Supplier[]);
      setSuppliersLoaded(true);
    }
  }, [suppliersLoaded, supabase]);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const acceptedTypes = ['.csv', '.xlsx', '.xls', '.pdf'];

  const handleFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setParseError('');
    setParsing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      let result: { headers: string[]; rows: Record<string, string>[] };
      if (ext === 'csv') {
        result = await parseCSV(file);
      } else if (ext === 'xlsx' || ext === 'xls') {
        result = await parseExcel(file);
      } else if (ext === 'pdf') {
        result = await parsePDF(file);
      } else {
        throw new Error('Formato file non supportato.');
      }
      setParsedHeaders(result.headers);
      setParsedRows(result.rows);
      const detected = autoDetectMapping(result.headers);
      setMapping(detected);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Errore durante il parsing del file.');
      setSelectedFile(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const goToMapping = async () => {
    await loadSuppliers();
    if (!selectedFile || parsedHeaders.length === 0) return;
    setStep('mapping');
  };

  const goToReview = () => {
    // Build product rows from parsed data using current mapping
    const built: ProductRow[] = parsedRows.map((raw, idx) => {
      const name = mapping.name ? (raw[mapping.name] ?? '') : '';
      return {
        id: String(idx),
        barcode: mapping.barcode ? (raw[mapping.barcode] ?? '') : '',
        sku: mapping.sku ? (raw[mapping.sku] ?? '') : '',
        name,
        size: mapping.size ? (raw[mapping.size] ?? '') : '',
        color: mapping.color ? (raw[mapping.color] ?? '') : '',
        color_code: mapping.color_code ? (raw[mapping.color_code] ?? '') : '',
        brand: mapping.brand ? (raw[mapping.brand] ?? '') : '',
        category: mapping.category ? (raw[mapping.category] ?? '') : '',
        hasError: !name.trim(),
      };
    });
    setRows(built);
    setStep('review');
  };

  // ---------------------------------------------------------------------------
  // Row editing
  // ---------------------------------------------------------------------------

  const updateCell = (id: string, field: keyof Omit<ProductRow, 'id' | 'hasError'>, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        updated.hasError = !updated.name.trim();
        return updated;
      }),
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // ---------------------------------------------------------------------------
  // New supplier
  // ---------------------------------------------------------------------------

  const createSupplier = async () => {
    if (!newSupplier.name.trim()) {
      setNewSupplierError('Il nome del fornitore è obbligatorio.');
      return;
    }
    setCreatingSupplier(true);
    setNewSupplierError('');
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: newSupplier.name.trim(), email: newSupplier.email || null, phone: newSupplier.phone || null, address: newSupplier.address || null })
      .select('id,name,email,phone,address')
      .single();
    setCreatingSupplier(false);
    if (error) {
      setNewSupplierError(error.message);
      return;
    }
    if (data) {
      setSuppliers((prev) => [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSupplierId(data.id);
    }
    setNewSupplier({ name: '', email: '', phone: '', address: '' });
    setShowNewSupplierModal(false);
    showToast('Fornitore creato con successo!');
  };

  // ---------------------------------------------------------------------------
  // Edit supplier
  // ---------------------------------------------------------------------------

  const openEditSupplier = () => {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return;
    setEditSupplier({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
    });
    setEditSupplierError('');
    setEditSupplierModal(true);
  };

  const handleEditSupplier = async () => {
    if (!editSupplier.name.trim()) {
      setEditSupplierError('Il nome del fornitore è obbligatorio.');
      return;
    }
    setEditingSupplier(true);
    setEditSupplierError('');
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        name: editSupplier.name.trim(),
        email: editSupplier.email.trim() || null,
        phone: editSupplier.phone.trim() || null,
        address: editSupplier.address.trim() || null,
      })
      .eq('id', editSupplier.id)
      .select('id,name,email,phone,address')
      .single();
    setEditingSupplier(false);
    if (error) {
      setEditSupplierError(error.message);
      return;
    }
    if (data) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === data.id ? (data as Supplier) : s)).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    setEditSupplierModal(false);
    showToast('Fornitore aggiornato con successo!');
  };

  // ---------------------------------------------------------------------------
  // Delete supplier
  // ---------------------------------------------------------------------------

  const handleDeleteSupplier = async () => {
    if (!selectedSupplierId) return;
    setDeletingSupplier(true);
    const { error } = await supabase.from('suppliers').delete().eq('id', selectedSupplierId);
    setDeletingSupplier(false);
    if (error) {
      setDeleteSupplierModal(false);
      showToast(`Errore eliminazione: ${error.message}`, 'error');
      return;
    }
    setSuppliers((prev) => prev.filter((s) => s.id !== selectedSupplierId));
    setSelectedSupplierId('');
    setDeleteSupplierModal(false);
    showToast('Fornitore eliminato con successo!');
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const save = async () => {
    if (!selectedSupplierId) {
      setSaveError('Seleziona un fornitore prima di salvare.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const validRows: Record<string, unknown>[] = [];
    const validationErrors: string[] = [];

    for (const row of rows) {
      const result = productRegistrySchema.safeParse({
        barcode: row.barcode || undefined,
        sku: row.sku || undefined,
        name: row.name,
        size: row.size || undefined,
        color: row.color || undefined,
        color_code: row.color_code || undefined,
        brand: row.brand || undefined,
        category: row.category || undefined,
        supplier_id: selectedSupplierId,
      });
      if (result.success) {
        validRows.push({ ...result.data, supplier_id: selectedSupplierId });
      } else {
        validationErrors.push(`Riga "${row.name || '(senza nome)'}": ${result.error.issues.map((e) => e.message).join(', ')}`);
      }
    }

    if (validRows.length === 0) {
      setSaveError('Nessuna riga valida da salvare. ' + validationErrors.slice(0, 3).join(' | '));
      setSaving(false);
      return;
    }

    // 1. Registra import log
    const { data: logData, error: logError } = await supabase
      .from('import_logs')
      .insert({
        supplier_id: selectedSupplierId,
        filename: selectedFile?.name || 'unknown',
        items_count: validRows.length,
        status: 'success',
      })
      .select('id')
      .single();

    if (logError || !logData) {
      setSaveError(`Errore creazione log importazione: ${logError?.message}`);
      setSaving(false);
      return;
    }

    // 2. Collega tutti i prodotti al log
    const rowsWithImport = validRows.map((r) => ({ ...r, import_id: logData.id }));

    const { error } = await supabase.from('product_registry').insert(rowsWithImport);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      // Puliamo il log orfano
      await supabase.from('import_logs').delete().eq('id', logData.id);
      return;
    }
    setSavedCount(validRows.length);
    setStep('done');
    showToast(`${validRows.length} prodotti importati con successo!`);
  };

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Anagrafica Prodotti Importati',
      headers: ['Barcode', 'SKU', 'Nome', 'Taglia', 'Colore', 'Cod. Colore', 'Brand', 'Categoria'],
      rows: rows.map((r) => [r.barcode, r.sku, r.name, r.size, r.color, r.color_code, r.brand, r.category]),
      filename: 'prodotti-importati.pdf',
    });
  };

  // ---------------------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------------------

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const stepNumber: 1 | 2 | 3 = step === 'upload' ? 1 : step === 'mapping' ? 2 : 3;
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const headerOptions = [
    { value: '', label: '— non mappare —' },
    ...parsedHeaders.map((h) => ({ value: h, label: h })),
  ];
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 ${toastType === 'error' ? 'bg-danger' : 'bg-success'} text-white px-5 py-3 rounded-xl shadow-xl font-medium text-sm animate-fade-in`}>
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Importazione Prodotti</h1>
          <p className="text-foreground/60 mt-1">
            Carica un file CSV, Excel o PDF per importare prodotti nell&apos;anagrafica.
          </p>
        </div>

        {/* Step indicator — hidden on done */}
        {step !== 'done' && <StepIndicator current={stepNumber} />}

        {/* ================================================================ */}
        {/* STEP 1 — UPLOAD                                                  */}
        {/* ================================================================ */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Supplier selector */}
            <Card title="Fornitore">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1" onClick={loadSuppliers}>
                  <Select
                    label="Seleziona fornitore"
                    placeholder="Scegli un fornitore..."
                    options={supplierOptions}
                    value={selectedSupplierId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSupplierId(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {selectedSupplierId && (
                    <>
                      <button
                        type="button"
                        title="Modifica fornitore"
                        onClick={openEditSupplier}
                        className="p-3 rounded-xl border border-surface bg-surface text-brand hover:bg-brand/10 transition-colors"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        title="Elimina fornitore"
                        onClick={() => setDeleteSupplierModal(true)}
                        className="p-3 rounded-xl border border-surface bg-surface text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      loadSuppliers();
                      setShowNewSupplierModal(true);
                    }}
                  >
                    + Nuovo Fornitore
                  </Button>
                </div>
              </div>
            </Card>

            {/* File upload zone */}
            <Card title="Carica File">
              <div
                role="button"
                tabIndex={0}
                aria-label="Zona di caricamento file. Trascina un file o clicca per selezionarne uno."
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200',
                  isDragging
                    ? 'border-brand bg-brand/10 scale-[1.01]'
                    : selectedFile
                      ? 'border-brand bg-brand/5'
                      : 'border-surface-light bg-surface hover:border-brand hover:bg-brand/5',
                ].join(' ')}
              >
                <div className={['w-16 h-16 rounded-full flex items-center justify-center transition-colors', isDragging ? 'bg-brand text-white' : 'bg-surface-light text-brand'].join(' ')}>
                  <Upload size={32} />
                </div>

                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-foreground/50 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB &mdash; clicca per cambiare
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xl font-semibold text-foreground">
                      Trascina il file qui
                    </p>
                    <p className="text-foreground/50 mt-1">oppure clicca per sfogliare</p>
                    <p className="text-xs text-foreground/40 mt-3">
                      Formati accettati: .csv, .xlsx, .xls, .pdf
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedTypes.join(',')}
                  className="hidden"
                  onChange={onFileInput}
                  aria-hidden="true"
                />
              </div>

              {parsing && (
                <p className="mt-4 text-center text-sm text-brand font-medium animate-pulse">
                  Analisi del file in corso...
                </p>
              )}

              {parseError && (
                <p className="mt-4 text-center text-sm text-danger font-medium" role="alert">
                  {parseError}
                </p>
              )}

              {selectedFile && parsedHeaders.length > 0 && (
                <div className="mt-4 p-4 bg-success/10 rounded-xl text-sm text-foreground">
                  <span className="font-semibold text-success">File analizzato con successo.</span>
                  <span className="ml-2 text-foreground/60">
                    {parsedHeaders.length} colonne rilevate, {parsedRows.length} righe trovate.
                  </span>
                </div>
              )}
            </Card>

            {/* CTA */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="lg"
                loading={parsing}
                onClick={goToMapping}
                disabled={!selectedFile || parsedHeaders.length === 0 || parsing}
              >
                Continua &rarr; Mappa Colonne
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2 — COLUMN MAPPING                                          */}
        {/* ================================================================ */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <Card
              title="Mappatura Colonne"
              action={
                <span className="text-xs text-foreground/50 font-normal">
                  File: <strong>{selectedFile?.name}</strong>
                </span>
              }
            >
              <p className="text-sm text-foreground/60 mb-6">
                Il sistema ha tentato di abbinare automaticamente le colonne del file ai campi
                dell&apos;anagrafica. Verifica e correggi le associazioni se necessario.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {mappingFields.map(({ key, label, required }) => (
                  <div key={key}>
                    <Select
                      label={required ? `${label} *` : label}
                      options={headerOptions}
                      value={mapping[key]}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setMapping((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="— non mappare —"
                    />
                    {mapping[key] && (
                      <p className="mt-1 text-xs text-brand font-medium">
                        &larr; colonna &quot;{mapping[key]}&quot; nel file
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!mapping.name && (
                <p className="mt-5 text-sm text-danger font-medium" role="alert">
                  Il campo &quot;Nome Prodotto&quot; è obbligatorio per procedere.
                </p>
              )}
            </Card>

            {/* Preview */}
            {parsedRows.length > 0 && (
              <Card title={`Anteprima Dati (prime 3 righe)`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-surface">
                        {parsedHeaders.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-foreground/70 border border-surface-light whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 3).map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface/50">
                          {parsedHeaders.map((h) => (
                            <td key={h} className="px-3 py-2 border border-surface-light text-foreground/80 whitespace-nowrap">
                              {row[h] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="ghost" size="md" onClick={() => setStep('upload')}>
                &larr; Torna al Caricamento
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={goToReview}
                disabled={!mapping.name}
              >
                Continua &rarr; Revisiona Dati
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3 — REVIEW & SAVE                                           */}
        {/* ================================================================ */}
        {step === 'review' && (
          <div className="space-y-6">
            {/* Supplier confirm */}
            <Card title="Fornitore Selezionato">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Select
                    label="Fornitore"
                    options={supplierOptions}
                    value={selectedSupplierId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSupplierId(e.target.value)}
                    placeholder="Scegli un fornitore..."
                  />
                </div>
                <div className="flex gap-2">
                  {selectedSupplierId && (
                    <>
                      <button
                        type="button"
                        title="Modifica fornitore"
                        onClick={openEditSupplier}
                        className="p-3 rounded-xl border border-surface bg-surface text-brand hover:bg-brand/10 transition-colors"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        title="Elimina fornitore"
                        onClick={() => setDeleteSupplierModal(true)}
                        className="p-3 rounded-xl border border-surface bg-surface text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <Button variant="secondary" size="md" onClick={() => setShowNewSupplierModal(true)}>
                    + Nuovo Fornitore
                  </Button>
                </div>
              </div>
              {!selectedSupplierId && (
                <p className="mt-3 text-sm text-danger font-medium" role="alert">
                  Seleziona un fornitore per abilitare il salvataggio.
                </p>
              )}
            </Card>

            {/* Editable table */}
            <Card
              title={`Revisione Prodotti — ${rows.length} righe`}
              action={
                <span className="text-xs text-foreground/50">
                  {rows.filter((r) => r.hasError).length} righe con problemi
                </span>
              }
            >
              <p className="text-sm text-foreground/60 mb-4">
                Modifica direttamente le celle per correggere eventuali errori prima di salvare.
                Le righe che presentano problemi critici sul Nome sono evidenziate.
                <strong> I campi evidenziati in #CCD0D5 indicano dati incerti o non riconosciuti.</strong>
              </p>

              <div className="overflow-x-auto rounded-xl border border-surface-light">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-surface-light">
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-8">#</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Barcode</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">SKU</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Nome *</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Taglia</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Colore</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Cod. Colore</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Brand</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70">Categoria</th>
                      <th className="px-3 py-3 text-left font-semibold text-foreground/70 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={[
                          'border-b border-surface-light transition-colors',
                          row.hasError ? 'bg-yellow-50' : 'hover:bg-surface/40',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2 text-foreground/40 text-xs">{idx + 1}</td>
                        {(['barcode', 'sku', 'name', 'size', 'color', 'color_code', 'brand', 'category'] as const).map((field) => (
                          <td key={field} className="px-1 py-1">
                            <input
                              type="text"
                              value={row[field]}
                              onChange={(e) => updateCell(row.id, field, e.target.value)}
                              aria-label={`${field} riga ${idx + 1}`}
                              className={[
                                'w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand transition-colors',
                                !row[field].trim()
                                  ? 'bg-[#CCD0D5] text-black border-[#A0AAB5] placeholder-black/60 shadow-inner' // Campi incerti
                                  : field === 'name' && row.hasError
                                    ? 'bg-background border-yellow-400 ring-1 ring-yellow-300 text-foreground'
                                    : 'bg-background text-foreground border-surface-light focus:border-brand',
                              ].join(' ')}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            aria-label={`Elimina riga ${idx + 1}`}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors"
                            title="Elimina riga"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length === 0 && (
                <p className="mt-4 text-center text-foreground/50 py-8">
                  Nessuna riga da visualizzare. Torna al passo precedente.
                </p>
              )}
            </Card>

            {/* Errors */}
            {saveError && (
              <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger font-medium" role="alert">
                {saveError}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="md" onClick={() => setStep('mapping')}>
                &larr; Torna alla Mappatura
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" size="lg" onClick={handleExportPDF}>
                  Scarica PDF
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  loading={saving}
                  onClick={save}
                  disabled={rows.length === 0 || !selectedSupplierId || saving}
                >
                  Salva in Anagrafica
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP DONE                                                         */}
        {/* ================================================================ */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center">
              <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">Importazione completata!</h2>
              <p className="text-foreground/60 mt-2 text-lg">
                {savedCount} prodott{savedCount === 1 ? 'o importato' : 'i importati'} con successo nell&apos;anagrafica.
              </p>
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
              <Button variant="secondary" size="lg" onClick={handleExportPDF}>
                Scarica PDF Riepilogo
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setParsedHeaders([]);
                  setParsedRows([]);
                  setRows([]);
                  setSavedCount(0);
                  setSaveError('');
                  setMapping({ barcode: '', sku: '', name: '', size: '', color: '', color_code: '', brand: '', category: '' });
                }}
              >
                Importa Altro File
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* MODAL — Nuovo Fornitore                                             */}
      {/* ================================================================== */}
      <Modal
        open={showNewSupplierModal}
        onClose={() => {
          setShowNewSupplierModal(false);
          setNewSupplierError('');
          setNewSupplier({ name: '', email: '', phone: '', address: '' });
        }}
        title="Nuovo Fornitore"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nome fornitore *"
            placeholder="es. Zara Italia S.r.l."
            value={newSupplier.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSupplier((prev) => ({ ...prev, name: e.target.value }))
            }
            error={!newSupplier.name.trim() && newSupplierError ? 'Campo obbligatorio' : undefined}
          />
          <Input
            label="Email"
            type="email"
            placeholder="fornitore@esempio.it"
            value={newSupplier.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSupplier((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <Input
            label="Telefono"
            type="tel"
            placeholder="+39 02 1234567"
            value={newSupplier.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSupplier((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
          <Input
            label="Indirizzo"
            placeholder="Via Roma 1, Milano"
            value={newSupplier.address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSupplier((prev) => ({ ...prev, address: e.target.value }))
            }
          />

          {newSupplierError && (
            <p className="text-sm text-danger font-medium" role="alert">
              {newSupplierError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowNewSupplierModal(false);
                setNewSupplierError('');
                setNewSupplier({ name: '', email: '', phone: '', address: '' });
              }}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={creatingSupplier}
              onClick={createSupplier}
            >
              Crea Fornitore
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL — Modifica Fornitore                                          */}
      {/* ================================================================== */}
      <Modal
        open={editSupplierModal}
        onClose={() => {
          setEditSupplierModal(false);
          setEditSupplierError('');
        }}
        title="Modifica Fornitore"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nome fornitore *"
            placeholder="es. Zara Italia S.r.l."
            value={editSupplier.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditSupplier((prev) => ({ ...prev, name: e.target.value }))
            }
            error={!editSupplier.name.trim() && editSupplierError ? 'Campo obbligatorio' : undefined}
          />
          <Input
            label="Email"
            type="email"
            placeholder="fornitore@esempio.it"
            value={editSupplier.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditSupplier((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <Input
            label="Telefono"
            type="tel"
            placeholder="+39 02 1234567"
            value={editSupplier.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditSupplier((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
          <Input
            label="Indirizzo"
            placeholder="Via Roma 1, Milano"
            value={editSupplier.address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditSupplier((prev) => ({ ...prev, address: e.target.value }))
            }
          />

          {editSupplierError && (
            <p className="text-sm text-danger font-medium" role="alert">
              {editSupplierError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setEditSupplierModal(false);
                setEditSupplierError('');
              }}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={editingSupplier}
              onClick={handleEditSupplier}
            >
              Salva Modifiche
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL — Conferma Eliminazione Fornitore                             */}
      {/* ================================================================== */}
      <Modal
        open={deleteSupplierModal}
        onClose={() => setDeleteSupplierModal(false)}
        title="Elimina Fornitore"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-danger/10 rounded-xl">
            <Trash2 className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sei sicuro di voler eliminare il fornitore{' '}
                <span className="text-danger">
                  &quot;{suppliers.find((s) => s.id === selectedSupplierId)?.name}&quot;
                </span>?
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                Questa azione è irreversibile. I prodotti e le importazioni collegate non verranno eliminati,
                ma perderanno il riferimento al fornitore.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setDeleteSupplierModal(false)}
            >
              Annulla
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={deletingSupplier}
              onClick={handleDeleteSupplier}
            >
              Elimina Fornitore
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
