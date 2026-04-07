import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const productRegistrySchema = z.object({
  barcode: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1, 'Nome prodotto obbligatorio'),
  size: z.string().optional(),
  color: z.string().optional(),
  color_code: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  material: z.string().optional(),
  supplier_id: z.string().uuid().optional().nullable(),
})

export const inventoryItemSchema = z.object({
  product_id: z.string().uuid('Prodotto non valido'),
  quantity: z.number().int().min(0, 'Quantità non valida'),
  purchase_price: z.number().min(0, 'Prezzo non valido'),
  sell_price: z.number().min(0, 'Prezzo non valido'),
  location: z.string().optional(),
})

export const customerOrderSchema = z.object({
  customer_name: z.string().min(1, 'Nome cliente obbligatorio'),
  customer_phone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
  })).min(1, 'Aggiungi almeno un articolo'),
})

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid('Seleziona un fornitore'),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
  })).min(1, 'Aggiungi almeno un articolo'),
})

export const saleSchema = z.object({
  payment_method: z.enum(['cash', 'pos']),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
  })).min(1, 'Aggiungi almeno un articolo'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SupplierInput = z.infer<typeof supplierSchema>
export type ProductRegistryInput = z.infer<typeof productRegistrySchema>
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>
export type CustomerOrderInput = z.infer<typeof customerOrderSchema>
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>
export type SaleInput = z.infer<typeof saleSchema>
