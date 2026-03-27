-- ============================================
-- STORICO IMPORTAZIONI
-- ============================================

CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_logs_supplier ON import_logs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_created ON import_logs(created_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON import_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- Colonna import_id su product_registry, FK con cancellazione a cascata
ALTER TABLE product_registry
  ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES import_logs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_registry_import ON product_registry(import_id);
