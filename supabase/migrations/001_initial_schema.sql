-- ============================================
-- Flip&Co Gestionale - Schema Database
-- ============================================

-- Enum per stati ordine cliente
CREATE TYPE customer_order_status AS ENUM ('pending', 'confirmed', 'delivered', 'cancelled');

-- Enum per stati ordine acquisto
CREATE TYPE purchase_order_status AS ENUM ('ordered', 'shipped', 'arrived');

-- Enum per metodo pagamento
CREATE TYPE payment_method AS ENUM ('cash', 'pos');

-- ============================================
-- 1. FORNITORI
-- ============================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON suppliers
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 2. STORICO IMPORTAZIONI
-- ============================================
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_import_logs_supplier ON import_logs(supplier_id);
CREATE INDEX idx_import_logs_created ON import_logs(created_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON import_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 3. ANAGRAFICA PRODOTTI (da import fornitori)
-- ============================================
CREATE TABLE product_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT UNIQUE,
  sku TEXT,
  name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  color_code TEXT,
  brand TEXT,
  category TEXT,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  import_id UUID REFERENCES import_logs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_product_registry_barcode ON product_registry(barcode);
CREATE INDEX idx_product_registry_sku ON product_registry(sku);
CREATE INDEX idx_product_registry_import ON product_registry(import_id);

ALTER TABLE product_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON product_registry
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 4. MAGAZZINO / GIACENZE
-- ============================================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product_registry(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10,2) DEFAULT 0,
  sell_price NUMERIC(10,2) DEFAULT 0,
  location TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_inventory_product ON inventory(product_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON inventory
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 5. ORDINI CLIENTI
-- ============================================
CREATE TABLE customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status customer_order_status DEFAULT 'pending' NOT NULL,
  total NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON customer_orders
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 6. RIGHE ORDINE CLIENTE
-- ============================================
CREATE TABLE customer_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product_registry(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE customer_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON customer_order_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 7. ORDINI ACQUISTO (DAL FORNITORE)
-- ============================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status purchase_order_status DEFAULT 'ordered' NOT NULL,
  total NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON purchase_orders
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 8. RIGHE ORDINE ACQUISTO
-- ============================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product_registry(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON purchase_order_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 9. VENDITE / CASSA
-- ============================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method payment_method NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON sales
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 10. RIGHE VENDITA
-- ============================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product_registry(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON sale_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- FUNCTION: Decrementa stock dopo vendita
-- ============================================
CREATE OR REPLACE FUNCTION decrement_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_item_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_inventory_on_sale();

-- ============================================
-- FUNCTION: Incrementa stock su "Merce Arrivata"
-- ============================================
CREATE OR REPLACE FUNCTION increment_inventory_on_arrival()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'arrived' AND OLD.status != 'arrived' THEN
    INSERT INTO inventory (product_id, quantity, purchase_price)
    SELECT poi.product_id, poi.quantity, poi.unit_price
    FROM purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id
    ON CONFLICT DO NOTHING;

    UPDATE inventory i
    SET quantity = i.quantity + poi.quantity,
        purchase_price = poi.unit_price,
        updated_at = now()
    FROM purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id
      AND i.product_id = poi.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_purchase_order_arrived
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_inventory_on_arrival();
