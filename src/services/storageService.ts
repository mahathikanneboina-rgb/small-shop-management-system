import { Product, StockHistory } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'small_shop_products_v1',
  STOCK_HISTORY: 'small_shop_stock_history_v1',
};

export const INITIAL_SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Notebook',
    category: 'Stationery',
    purchasePrice: 1.50,
    sellingPrice: 2.50,
    quantity: 20,
    minStock: 5,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'prod-2',
    name: 'Pen',
    category: 'Stationery',
    purchasePrice: 0.30,
    sellingPrice: 0.75,
    quantity: 50,
    minStock: 10,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'prod-3',
    name: 'Rice 5kg',
    category: 'Grocery',
    purchasePrice: 6.00,
    sellingPrice: 8.50,
    quantity: 3,
    minStock: 5,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'prod-4',
    name: 'Soap',
    category: 'Cosmetics',
    purchasePrice: 0.80,
    sellingPrice: 1.50,
    quantity: 0,
    minStock: 8,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'prod-5',
    name: 'Biscuit Packet',
    category: 'Bakery',
    purchasePrice: 1.00,
    sellingPrice: 1.60,
    quantity: 15,
    minStock: 5,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const INITIAL_SAMPLE_HISTORY: StockHistory[] = [
  {
    id: 'hist-1',
    productId: 'prod-1',
    productName: 'Notebook',
    previousQuantity: 0,
    quantityChanged: 20,
    newQuantity: 20,
    reason: 'Initial Stock',
    timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'hist-2',
    productId: 'prod-2',
    productName: 'Pen',
    previousQuantity: 0,
    quantityChanged: 50,
    newQuantity: 50,
    reason: 'Initial Stock',
    timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'hist-3',
    productId: 'prod-3',
    productName: 'Rice 5kg',
    previousQuantity: 0,
    quantityChanged: 8,
    newQuantity: 8,
    reason: 'Initial Stock',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'hist-4',
    productId: 'prod-3',
    productName: 'Rice 5kg',
    previousQuantity: 8,
    quantityChanged: -5,
    newQuantity: 3,
    reason: 'Sale',
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'hist-5',
    productId: 'prod-4',
    productName: 'Soap',
    previousQuantity: 0,
    quantityChanged: 10,
    newQuantity: 10,
    reason: 'Initial Stock',
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'hist-6',
    productId: 'prod-4',
    productName: 'Soap',
    previousQuantity: 10,
    quantityChanged: -10,
    newQuantity: 0,
    reason: 'Sale',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'hist-7',
    productId: 'prod-5',
    productName: 'Biscuit Packet',
    previousQuantity: 0,
    quantityChanged: 15,
    newQuantity: 15,
    reason: 'Initial Stock',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

class StorageService {
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  getProducts(): Product[] {
    if (!this.isBrowser()) return INITIAL_SAMPLE_PRODUCTS;

    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      this.saveProducts(INITIAL_SAMPLE_PRODUCTS);
      return INITIAL_SAMPLE_PRODUCTS;
    }
    try {
      return JSON.parse(data) as Product[];
    } catch {
      return INITIAL_SAMPLE_PRODUCTS;
    }
  }

  saveProducts(products: Product[]): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  getStockHistory(): StockHistory[] {
    if (!this.isBrowser()) return INITIAL_SAMPLE_HISTORY;

    const data = localStorage.getItem(STORAGE_KEYS.STOCK_HISTORY);
    if (!data) {
      this.saveStockHistory(INITIAL_SAMPLE_HISTORY);
      return INITIAL_SAMPLE_HISTORY;
    }
    try {
      return JSON.parse(data) as StockHistory[];
    } catch {
      return INITIAL_SAMPLE_HISTORY;
    }
  }

  saveStockHistory(history: StockHistory[]): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.STOCK_HISTORY, JSON.stringify(history));
  }

  addStockHistoryEntry(
    entry: Omit<StockHistory, 'id' | 'timestamp'>
  ): StockHistory {
    const history = this.getStockHistory();
    const newEntry: StockHistory = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...history];
    this.saveStockHistory(updated);
    return newEntry;
  }

  resetToSampleData(): void {
    if (!this.isBrowser()) return;
    this.saveProducts(INITIAL_SAMPLE_PRODUCTS);
    this.saveStockHistory(INITIAL_SAMPLE_HISTORY);
  }

  clearAllData(): void {
    if (!this.isBrowser()) return;
    this.saveProducts([]);
    this.saveStockHistory([]);
  }
}

export const storageService = new StorageService();
