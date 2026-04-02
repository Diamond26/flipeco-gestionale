export type Step = 'upload' | 'mapping' | 'review' | 'done';

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface MappingConfig {
  barcode: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  color_code: string;
  brand: string;
  category: string;
}

export interface ProductRow {
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
