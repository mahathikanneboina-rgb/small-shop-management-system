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

// New transaction types
export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // selling price at time of sale
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Credit';
  notes?: string;
  timestamp: string;
}

export interface Purchase {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // purchase price at time of purchase
  totalAmount: number;
  supplierName: string;
  notes?: string;
  timestamp: string;
}

// New entity types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  totalPurchases?: number; // optional aggregate
  creditDue?: number; // optional credit amount
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  totalPurchases?: number; // optional aggregate
  amountPayable?: number; // optional payable amount
}

export interface Expense {
  id: string;
  category: 'Rent' | 'Electricity' | 'Transport' | 'Maintenance' | 'Other';
  amount: number;
  description?: string;
  date: string; // ISO string
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
  totalSalesAmount: number; // sum of all sale totalAmount
  totalPurchasesAmount: number; // sum of all purchase totalAmount
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
