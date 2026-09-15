// src/services/indexedDbService.ts
import {
  Product,
  StockHistory,
  Sale,
  Purchase,
  Customer,
  Supplier,
  Expense,
  SyncQueueItem,
  SyncEntityType,
  AuditLog,
  ShopSettings,
} from '../types';

export const INITIAL_SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Notebook',
    category: 'Stationery',
    purchasePrice: 1.5,
    sellingPrice: 2.5,
    quantity: 20,
    minStock: 5,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    syncStatus: 'synced',
    version: 1,
  },
  {
    id: 'prod-2',
    name: 'Pen',
    category: 'Stationery',
    purchasePrice: 0.3,
    sellingPrice: 0.75,
    quantity: 50,
    minStock: 10,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    syncStatus: 'synced',
    version: 1,
  },
  {
    id: 'prod-3',
    name: 'Rice 5kg',
    category: 'Grocery',
    purchasePrice: 6.0,
    sellingPrice: 8.5,
    quantity: 3,
    minStock: 5,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    syncStatus: 'synced',
    version: 1,
  },
  {
    id: 'prod-4',
    name: 'Soap',
    category: 'Cosmetics',
    purchasePrice: 0.8,
    sellingPrice: 1.5,
    quantity: 0,
    minStock: 8,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    syncStatus: 'synced',
    version: 1,
  },
  {
    id: 'prod-5',
    name: 'Biscuit Packet',
    category: 'Bakery',
    purchasePrice: 1.0,
    sellingPrice: 1.6,
    quantity: 15,
    minStock: 5,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    syncStatus: 'synced',
    version: 1,
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
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
    syncStatus: 'synced',
  },
];

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  id: 'shop_settings',
  shopName: 'Small Shop Management',
  shopPhone: '+1 234 567 8900',
  shopEmail: 'owner@smallshop.com',
  shopAddress: '123 Market Street, Cityville',
  currencySymbol: '$',
  taxRate: 0,
  updatedAt: new Date().toISOString(),
};

const DB_NAME = 'small-shop-db';
const DB_VERSION = 2;

export type DBStoreName = SyncEntityType | 'syncQueue';

const ALL_STORES: DBStoreName[] = [
  'products',
  'sales',
  'purchases',
  'customers',
  'suppliers',
  'expenses',
  'stockHistory',
  'syncQueue',
  'auditLogs',
  'settings',
];

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isBrowser()) {
      return Promise.reject(new Error('IndexedDB is only available in browser environments'));
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        ALL_STORES.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  async getAll<T>(storeName: DBStoreName): Promise<T[]> {
    if (!this.isBrowser()) return [];
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as T[]) || []);
      };
      request.onerror = () => {
        reject(request.error || new Error(`Error getting all from ${storeName}`));
      };
    });
  }

  async getById<T>(storeName: DBStoreName, id: string): Promise<T | undefined> {
    if (!this.isBrowser()) return undefined;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };
      request.onerror = () => {
        reject(request.error || new Error(`Error getting ${id} from ${storeName}`));
      };
    });
  }

  async put<T extends { id: string }>(storeName: DBStoreName, item: T): Promise<T> {
    if (!this.isBrowser()) return item;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        resolve(item);
      };
      request.onerror = () => {
        reject(request.error || new Error(`Error putting into ${storeName}`));
      };
    });
  }

  async bulkPut<T extends { id: string }>(storeName: DBStoreName, items: T[]): Promise<void> {
    if (!this.isBrowser() || items.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => store.put(item));

      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error || new Error(`Error bulk putting into ${storeName}`));
      };
    });
  }

  async delete(storeName: DBStoreName, id: string): Promise<void> {
    if (!this.isBrowser()) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error || new Error(`Error deleting ${id} from ${storeName}`));
      };
    });
  }

  async clearStore(storeName: DBStoreName): Promise<void> {
    if (!this.isBrowser()) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error || new Error(`Error clearing ${storeName}`));
      };
    });
  }

  /**
   * One-time initialization and migration:
   * 1. Checks if IndexedDB already contains products.
   * 2. If empty, inspects localStorage for existing user data.
   * 3. Migrates localStorage data to IndexedDB if found.
   * 4. If neither exists, seeds the initial sample products and history.
   */
  async initAndMigrate(): Promise<{
    products: Product[];
    stockHistory: StockHistory[];
    sales: Sale[];
    purchases: Purchase[];
    customers: Customer[];
    suppliers: Supplier[];
    expenses: Expense[];
    syncQueue: SyncQueueItem[];
    auditLogs: AuditLog[];
    settings: ShopSettings;
  }> {
    if (!this.isBrowser()) {
      return {
        products: INITIAL_SAMPLE_PRODUCTS,
        stockHistory: INITIAL_SAMPLE_HISTORY,
        sales: [],
        purchases: [],
        customers: [],
        suppliers: [],
        expenses: [],
        syncQueue: [],
        auditLogs: [],
        settings: DEFAULT_SHOP_SETTINGS,
      };
    }

    let products = await this.getAll<Product>('products');
    let stockHistory = await this.getAll<StockHistory>('stockHistory');
    let sales = await this.getAll<Sale>('sales');
    let purchases = await this.getAll<Purchase>('purchases');
    let customers = await this.getAll<Customer>('customers');
    let suppliers = await this.getAll<Supplier>('suppliers');
    let expenses = await this.getAll<Expense>('expenses');
    let syncQueue = await this.getAll<SyncQueueItem>('syncQueue');
    let auditLogs = await this.getAll<AuditLog>('auditLogs');
    let settings = await this.getById<ShopSettings>('settings', 'shop_settings');

    if (!settings) {
      settings = DEFAULT_SHOP_SETTINGS;
      await this.put('settings', settings);
    }

    // Check if IndexedDB is completely uninitialized
    if (products.length === 0 && stockHistory.length === 0 && sales.length === 0) {
      // Check for legacy localStorage data
      const localProductsRaw = localStorage.getItem('small_shop_products_v1');
      const localHistoryRaw = localStorage.getItem('small_shop_stock_history_v1');
      const localSalesRaw = localStorage.getItem('small_shop_sales_v1');
      const localPurchasesRaw = localStorage.getItem('small_shop_purchases_v1');
      const localExpensesRaw = localStorage.getItem('small_shop_expenses_v1');

      if (localProductsRaw) {
        try {
          const parsedProducts = JSON.parse(localProductsRaw) as Product[];
          if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
            products = parsedProducts;
            await this.bulkPut('products', products);
          }
        } catch (e) {
          console.warn('Failed to migrate local products:', e);
        }
      }

      if (localHistoryRaw) {
        try {
          const parsedHistory = JSON.parse(localHistoryRaw) as StockHistory[];
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            stockHistory = parsedHistory;
            await this.bulkPut('stockHistory', stockHistory);
          }
        } catch (e) {
          console.warn('Failed to migrate local history:', e);
        }
      }

      if (localSalesRaw) {
        try {
          const parsedSales = JSON.parse(localSalesRaw) as Sale[];
          if (Array.isArray(parsedSales) && parsedSales.length > 0) {
            sales = parsedSales;
            await this.bulkPut('sales', sales);
          }
        } catch (e) {
          console.warn('Failed to migrate local sales:', e);
        }
      }

      if (localPurchasesRaw) {
        try {
          const parsedPurchases = JSON.parse(localPurchasesRaw) as Purchase[];
          if (Array.isArray(parsedPurchases) && parsedPurchases.length > 0) {
            purchases = parsedPurchases;
            await this.bulkPut('purchases', purchases);
          }
        } catch (e) {
          console.warn('Failed to migrate local purchases:', e);
        }
      }

      if (localExpensesRaw) {
        try {
          const parsedExpenses = JSON.parse(localExpensesRaw) as Expense[];
          if (Array.isArray(parsedExpenses) && parsedExpenses.length > 0) {
            expenses = parsedExpenses;
            await this.bulkPut('expenses', expenses);
          }
        } catch (e) {
          console.warn('Failed to migrate local expenses:', e);
        }
      }

      // If still empty after checking localStorage, seed with sample data
      if (products.length === 0) {
        products = [...INITIAL_SAMPLE_PRODUCTS];
        stockHistory = [...INITIAL_SAMPLE_HISTORY];
        await this.bulkPut('products', products);
        await this.bulkPut('stockHistory', stockHistory);
      }
    }

    return {
      products,
      stockHistory,
      sales,
      purchases,
      customers,
      suppliers,
      expenses,
      syncQueue,
      auditLogs,
      settings,
    };
  }

  async resetToSampleData(): Promise<{
    products: Product[];
    stockHistory: StockHistory[];
  }> {
    await this.clearStore('products');
    await this.clearStore('stockHistory');
    await this.clearStore('sales');
    await this.clearStore('purchases');
    await this.clearStore('customers');
    await this.clearStore('suppliers');
    await this.clearStore('expenses');
    await this.clearStore('syncQueue');
    await this.clearStore('auditLogs');

    await this.bulkPut('products', INITIAL_SAMPLE_PRODUCTS);
    await this.bulkPut('stockHistory', INITIAL_SAMPLE_HISTORY);
    await this.put('settings', DEFAULT_SHOP_SETTINGS);

    return {
      products: INITIAL_SAMPLE_PRODUCTS,
      stockHistory: INITIAL_SAMPLE_HISTORY,
    };
  }
}

export const indexedDbService = new IndexedDbService();
