// Types
// ---------------------------------------------------------------------------

export interface ProductRegistry {
  id: string
  barcode: string
  name: string
  brand: string
  size: string
  color: string
  sku?: string
}

export interface InventoryProduct {
  id: string               // inventory row id
  product_id: string
  sell_price: number
  quantity: number         // available stock
  product_registry: ProductRegistry
}

export interface CartItem {
  inventoryId: string
  productId: string
  barcode: string
  name: string
  brand: string
  size: string
  color: string
  price: number
  qty: number
  maxQty: number
}
export type PaymentMethod = 'cash' | 'pos'

export interface SaleItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  product_registry: ProductRegistry
}

export interface Sale {
  id: string
  created_at: string
  payment_method: string
  total: number
  sale_items: SaleItem[]
}

// ---------------------------------------------------------------------------
