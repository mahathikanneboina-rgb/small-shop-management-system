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
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'local_only';

export type SyncEntityType =
  | 'products'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'stockHistory'
  | 'auditLogs'
  | 'settings';

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
  userName?: string;
  conflictDetails?: string;
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
  userName?: string;
  syncStatus?: SyncStatus;
  version?: number;
  conflict?: boolean;
  conflictDetails?: string;
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
  userName?: string;
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
  userName?: string;
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
  userName?: string;
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
  userName?: string;
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
  userName?: string;
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
  userName?: string;
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

// User Profile & Roles
export type UserRole = 'owner' | 'staff';
export type UserStatus = 'active' | 'disabled';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

// Audit Log Types
export type AuditLogAction =
  | 'SALE_CREATED'
  | 'PURCHASE_CREATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'EXPENSE_CREATED'
  | 'STAFF_DISABLED'
  | 'STAFF_REACTIVATED'
  | 'STAFF_ROLE_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'STOCK_CONFLICT_DETECTED'
  | 'LOGIN'
  | 'LOGOUT';

export interface AuditLog {
  id: string; // e.g. "AUDIT-xxxxx"
  userId: string;
  userName: string;
  userEmail?: string;
  action: AuditLogAction;
  entityType: string;
  entityId: string;
  description: string;
  timestamp: string;
  syncStatus?: SyncStatus;
}

// Shop Settings
export interface ShopSettings {
  id: string; // "shop_settings"
  shopName: string;
  shopPhone: string;
  shopEmail: string;
  shopAddress: string;
  currencySymbol: string;
  taxRate: number;
  updatedAt: string;
  updatedBy?: string;
  syncStatus?: SyncStatus;
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
  const randomPart =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').substring(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
  return `${prefix.toUpperCase()}-${randomPart}`;
}
