'use client';

import { useState, useCallback, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmBanner } from '@/components/ui/ConfirmBanner';
import { Select } from '@/components/ui/Select';
import { Upload, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { parseCSV } from '@/lib/parsers/csv-parser';
import { parseExcel } from '@/lib/parsers/excel-parser';
import { parsePDF } from '@/lib/parsers/pdf-parser';
import { exportToPDF } from '@/lib/pdf-export';
import { productRegistrySchema } from '@/lib/validators/schemas';

import { Step, Supplier, MappingConfig, ProductRow } from './types';
import { PremiumStepper } from './components/PremiumStepper';
import { UploadStep } from './components/UploadStep';
import { MappingStep } from './components/MappingStep';
import { ReviewStep } from './components/ReviewStep';

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
  const [hasHeader, setHasHeader] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- mapping state ---
  const [mapping, setMapping] = useState<MappingConfig>({
    barcode: '', sku: '', name: '', size: '', color: '', color_code: '', brand: '', category: '',
  });

  // --- review state ---
  const [rows, setRows] = useState<ProductRow[]>([]);

  // --- save state ---
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
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

  const handleFile = useCallback(async (file: File, isHeader: boolean) => {
    setSelectedFile(file);
    setParseError('');
    setParsing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      let result: { headers: string[]; rows: Record<string, string>[] };
      if (ext === 'csv') {
        result = await parseCSV(file, isHeader);
      } else if (ext === 'xlsx' || ext === 'xls') {
        result = await parseExcel(file, isHeader);
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
      if (file) handleFile(file, hasHeader);
    },
    [handleFile, hasHeader],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file, hasHeader);
    },
    [handleFile, hasHeader],
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
      {toast && (
        <div className={`fixed top-6 right-6 z-50 ${toastType === 'error' ? 'bg-red-500' : 'bg-[#7BB35F]'} text-white px-5 py-3 rounded-2xl shadow-lg shadow-black/20 font-bold text-sm animate-fade-in`}>
          {toast}
        </div>
      )}

      <div className="relative font-sans text-foreground">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#7BB35F]/5 blur-[120px] pointer-events-none rounded-[100%] z-[-1]" />

        {step !== 'done' && <PremiumStepper current={step} />}

        {step === 'upload' && (
          <UploadStep
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            setSelectedSupplierId={setSelectedSupplierId}
            loadSuppliers={loadSuppliers}
            openEditSupplier={openEditSupplier}
            setDeleteSupplierModal={setDeleteSupplierModal}
            setShowNewSupplierModal={setShowNewSupplierModal}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            selectedFile={selectedFile}
            hasHeader={hasHeader}
            setHasHeader={setHasHeader}
            onDrop={onDrop}
            onFileInput={onFileInput}
            fileInputRef={fileInputRef}
            parsing={parsing}
            parseError={parseError}
            parsedHeaders={parsedHeaders}
            parsedRows={parsedRows}
            goToMapping={goToMapping}
            handleFile={handleFile}
          />
        )}

        {step === 'mapping' && (
          <MappingStep
            selectedFile={selectedFile}
            parsedHeaders={parsedHeaders}
            parsedRows={parsedRows}
            mapping={mapping}
            setMapping={setMapping}
            setStep={setStep}
            goToReview={goToReview}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            rows={rows}
            selectedSupplierId={selectedSupplierId}
            suppliers={suppliers}
            setSelectedSupplierId={setSelectedSupplierId}
            updateCell={updateCell}
            deleteRow={deleteRow}
            setStep={setStep}
            handleExportPDF={handleExportPDF}
            setSaveConfirmOpen={setSaveConfirmOpen}
            saving={saving}
            saveError={saveError}
          />
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center animate-fade-in relative z-10">
            <div className="w-24 h-24 rounded-full bg-[#7BB35F]/10 flex items-center justify-center ring-4 ring-[#7BB35F]/20 shadow-[0_0_30px_rgba(123,179,95,0.2)]">
              <svg className="w-12 h-12 text-[#7BB35F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground tracking-wide mb-2 drop-shadow-md">Importazione completata!</h2>
              <p className="text-foreground/60 text-lg font-medium">
                {savedCount} prodott{savedCount === 1 ? 'o importato' : 'i importati'} con successo nell&apos;anagrafica.
              </p>
            </div>
            <div className="flex gap-4 flex-wrap justify-center mt-4">
              <button
                onClick={handleExportPDF}
                className="px-6 py-3 rounded-full border border-surface dark:border-white/10 bg-surface/60 dark:bg-white/5 text-foreground/80 font-bold hover:bg-surface/80 dark:hover:bg-white/10 hover:text-foreground transition-all flex items-center gap-2"
              >
                Scarica PDF Riepilogo
              </button>
              <button
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
                className="px-7 py-3 rounded-full font-bold tracking-wide transition-all bg-[#7BB35F]/20 text-[#8CE36B] border border-[#7BB35F]/50 shadow-[0_0_25px_rgba(123,179,95,0.25)] hover:shadow-[0_0_35px_rgba(123,179,95,0.4)] hover:bg-[#7BB35F]/30 hover:border-[#7BB35F]/70"
              >
                Importa Altro File
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={showNewSupplierModal} onClose={() => { setShowNewSupplierModal(false); setNewSupplierError(''); setNewSupplier({ name: '', email: '', phone: '', address: '' }); }} title="Nuovo Fornitore" size="md">
        <div className="space-y-4">
          <Input label="Nome fornitore *" placeholder="es. Zara Italia S.r.l." value={newSupplier.name} onChange={(e) => setNewSupplier((prev) => ({ ...prev, name: e.target.value }))} error={!newSupplier.name.trim() && newSupplierError ? 'Campo obbligatorio' : undefined} />
          <Input label="Email" type="email" placeholder="fornitore@esempio.it" value={newSupplier.email} onChange={(e) => setNewSupplier((prev) => ({ ...prev, email: e.target.value }))} />
          <Input label="Telefono" type="tel" placeholder="+39 02 1234567" value={newSupplier.phone} onChange={(e) => setNewSupplier((prev) => ({ ...prev, phone: e.target.value }))} />
          <Input label="Indirizzo" placeholder="Via Roma 1, Milano" value={newSupplier.address} onChange={(e) => setNewSupplier((prev) => ({ ...prev, address: e.target.value }))} />
          {newSupplierError && <p className="text-sm text-red-500 font-medium">{newSupplierError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => { setShowNewSupplierModal(false); setNewSupplierError(''); setNewSupplier({ name: '', email: '', phone: '', address: '' }); }}>Annulla</Button>
            <Button variant="primary" size="md" loading={creatingSupplier} onClick={createSupplier}>Crea Fornitore</Button>
          </div>
        </div>
      </Modal>

      <Modal open={editSupplierModal} onClose={() => { setEditSupplierModal(false); setEditSupplierError(''); }} title="Modifica Fornitore" size="md">
        <div className="space-y-4">
          <Input label="Nome fornitore *" placeholder="es. Zara Italia S.r.l." value={editSupplier.name} onChange={(e) => setEditSupplier((prev) => ({ ...prev, name: e.target.value }))} error={!editSupplier.name.trim() && editSupplierError ? 'Campo obbligatorio' : undefined} />
          <Input label="Email" type="email" placeholder="fornitore@esempio.it" value={editSupplier.email} onChange={(e) => setEditSupplier((prev) => ({ ...prev, email: e.target.value }))} />
          <Input label="Telefono" type="tel" placeholder="+39 02 1234567" value={editSupplier.phone} onChange={(e) => setEditSupplier((prev) => ({ ...prev, phone: e.target.value }))} />
          <Input label="Indirizzo" placeholder="Via Roma 1, Milano" value={editSupplier.address} onChange={(e) => setEditSupplier((prev) => ({ ...prev, address: e.target.value }))} />
          {editSupplierError && <p className="text-sm text-red-500 font-medium">{editSupplierError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => { setEditSupplierModal(false); setEditSupplierError(''); }}>Annulla</Button>
            <Button variant="primary" size="md" loading={editingSupplier} onClick={handleEditSupplier}>Salva Modifiche</Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteSupplierModal} onClose={() => setDeleteSupplierModal(false)} title="Elimina Fornitore" size="sm">
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-xl ring-1 ring-red-500/20">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Sei sicuro di voler eliminare il fornitore <span className="text-red-500">&quot;{suppliers.find((s) => s.id === selectedSupplierId)?.name}&quot;</span>?</p>
              <p className="text-xs text-foreground/50 mt-1">Questa azione è irreversibile. I prodotti e le importazioni collegate non verranno eliminati, ma perderanno il riferimento al fornitore.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setDeleteSupplierModal(false)}>Annulla</Button>
            <Button variant="danger" size="md" loading={deletingSupplier} onClick={handleDeleteSupplier}>Elimina Fornitore</Button>
          </div>
        </div>
      </Modal>

      <ConfirmBanner
        open={saveConfirmOpen}
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={async () => { setSaveConfirmOpen(false); await save(); }}
        message={`Stai per importare ${rows.length} prodotti nell'anagrafica. Vuoi procedere?`}
        confirmLabel="Importa"
        variant="warning"
        loading={saving}
      />
    </AppShell>
  );
}
