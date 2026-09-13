export type ProductCategory =
  | 'Grocery'
  | 'Stationery'
  | 'Bakery'
  | 'Cosmetics'
  | 'Electronics'
  | 'Other';

export const CATEGORIES: ProductCategory[] = [
  'Grocery',
  'Stationery',
  'Bakery',
  'Cosmetics',
  'Electronics',
  'Other',
];

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export type StockChangeReason =
  | 'Initial Stock'
  | 'Stock Correction'
  | 'Sale'
  | 'Purchase';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockHistory {
  id: string;
  productId: string;
  productName: string;
  previousQuantity: number;
  quantityChanged: number;
  newQuantity: number;
  reason: StockChangeReason;
  timestamp: string;
  notes?: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryCost: number;
  totalPotentialRevenue: number;
}

export function calculateStockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) {
    return 'Out of Stock';
  }
  if (quantity <= minStock) {
    return 'Low Stock';
  }
  return 'In Stock';
}
