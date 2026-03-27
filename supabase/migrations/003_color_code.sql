-- ============================================
-- Aggiunta campo color_code a product_registry
-- ============================================
ALTER TABLE product_registry
  ADD COLUMN IF NOT EXISTS color_code TEXT;
