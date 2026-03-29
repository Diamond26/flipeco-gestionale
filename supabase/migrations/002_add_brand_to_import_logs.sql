-- ============================================
-- Add brand column to import_logs
-- Allows users to assign a brand to an entire
-- import batch. When set, it propagates to all
-- product_registry rows linked to that import.
-- ============================================

ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS brand TEXT;
