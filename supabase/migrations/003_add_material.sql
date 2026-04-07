-- ============================================
-- Add material column to product_registry
-- Stores the fabric/material type of a product.
-- Optional (nullable) for backward compatibility.
-- ============================================

ALTER TABLE product_registry ADD COLUMN IF NOT EXISTS material TEXT;
