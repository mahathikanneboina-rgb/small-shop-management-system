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

// Sync Types
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'local_only';

export type SyncEntityType =
  | 'products'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'stockHistory';

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string; // unique queue item id e.g. "sync-xxxxx"
  operationId: string; // idempotent entity id e.g. "SALE-xxxx"
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  payload: any;
  createdAt: string;
  retryCount: number;
  status: SyncStatus;
  errorMessage?: string;
  userId?: string;
}

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
  userId?: string;
  syncStatus?: SyncStatus;
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
  transactionId?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

// Transaction types
export interface Sale {
  id: string; // e.g. "SALE-xxxxx"
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // selling price at time of sale
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Credit';
  notes?: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

export interface Purchase {
  id: string; // e.g. "PURCHASE-xxxxx"
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // purchase price at time of purchase
  totalAmount: number;
  supplierName: string;
  notes?: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

// Entity types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  totalPurchases?: number;
  creditDue?: number;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  totalPurchases?: number;
  amountPayable?: number;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

export interface Expense {
  id: string; // e.g. "EXPENSE-xxxxx"
  category: 'Rent' | 'Electricity' | 'Transport' | 'Maintenance' | 'Other';
  amount: number;
  description?: string;
  date: string; // ISO string
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  syncStatus?: SyncStatus;
}

export type Transaction = Sale | Purchase;

export interface DashboardMetrics {
  estimatedProfit?: number;
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryCost: number;
  totalPotentialRevenue: number;
  totalSalesAmount: number;
  totalPurchasesAmount: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalExpenses: number;
}

// User profile stored in Firestore
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  createdAt: string;
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

/**
 * Generate a robust unique ID with a specified prefix.
 * e.g., generateTransactionId('SALE') -> 'SALE-a1b2c3d4-e5f6'
 */
export function generateTransactionId(prefix: string): string {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
  return `${prefix.toUpperCase()}-${randomPart}`;
}
