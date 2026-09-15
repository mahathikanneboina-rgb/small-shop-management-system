'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Product,
  StockHistory,
  DashboardMetrics,
  StockChangeReason,
  Sale,
  Purchase,
  Customer,
  Supplier,
  Expense,
  SyncQueueItem,
  generateTransactionId,
} from '../types';
import { indexedDbService } from '../services/indexedDbService';
import { syncService } from '../services/syncService';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ShopContextType {
  products: Product[];
  stockHistory: StockHistory[];
  sales: Sale[];
  purchases: Purchase[];
  customers: Customer[];
  suppliers: Supplier[];
  expenses: Expense[];
  syncQueue: SyncQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  metrics: DashboardMetrics;
  isLoading: boolean;
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
    reason?: StockChangeReason
  ) => void;
  adjustStock: (
    productId: string,
    delta: number,
    reason: StockChangeReason,
    notes?: string
  ) => boolean;
  deleteProduct: (id: string) => void;
  resetSampleData: () => void;
  getProductById: (id: string) => Product | undefined;
  recordSale: (
    productId: string,
    quantity: number,
    paymentMethod: 'Cash' | 'UPI' | 'Credit',
    notes?: string
  ) => boolean;
  recordPurchase: (
    productId: string,
    quantity: number,
    supplierName: string,
    notes?: string
  ) => boolean;
  recordExpense: (expense: Omit<Expense, 'id'>) => Expense;
  syncNow: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const [products, setProducts] = useState<Product[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initialize data on client mount with IndexedDB and localStorage migration
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const data = await indexedDbService.initAndMigrate();
        if (mounted) {
          setProducts(data.products);
          setStockHistory(data.stockHistory);
          setSales(data.sales);
          setPurchases(data.purchases);
          setCustomers(data.customers);
          setSuppliers(data.suppliers);
          setExpenses(data.expenses);
          setSyncQueue(data.syncQueue);
        }
      } catch (err) {
        console.error('Failed to initialize local IndexedDB storage:', err);
        showToast('error', 'Failed to load shop data from local storage');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    // Subscribe to online status changes
    const unsubOnline = syncService.subscribeOnlineStatus((online) => {
      if (mounted) {
        setIsOnline(online);
      }
    });

    // Subscribe to sync queue changes
    const unsubQueue = syncService.subscribeSyncQueue((queue) => {
      if (mounted) {
        setSyncQueue(queue);
        setIsSyncing(queue.some((item) => item.status === 'syncing'));
      }
    });

    return () => {
      mounted = false;
      unsubOnline();
      unsubQueue();
    };
  }, [showToast]);

  // Compute live dashboard metrics
  const metrics: DashboardMetrics = useMemo(() => {
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryCost = 0;
    let totalPotentialRevenue = 0;
    let totalSalesAmount = 0;
    let totalPurchasesAmount = 0;
    let totalExpenses = 0;

    products.forEach((p) => {
      totalStockUnits += p.quantity;
      if (p.quantity <= 0) {
        outOfStockCount++;
        lowStockCount++; // 0 is also <= minStock
      } else if (p.quantity <= p.minStock) {
        lowStockCount++;
      }
      totalInventoryCost += p.purchasePrice * p.quantity;
      totalPotentialRevenue += p.sellingPrice * p.quantity;
    });

    sales.forEach((s) => {
      totalSalesAmount += s.totalAmount;
    });
    purchases.forEach((p) => {
      totalPurchasesAmount += p.totalAmount;
    });
    expenses.forEach((e) => {
      totalExpenses += e.amount;
    });

    const estimatedProfit =
      totalSalesAmount -
      sales.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0) -
      totalExpenses;

    return {
      totalProducts: products.length,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalInventoryCost,
      totalPotentialRevenue,
      totalSalesAmount,
      totalPurchasesAmount,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalExpenses,
      estimatedProfit,
    } as DashboardMetrics;
  }, [products, sales, purchases, expenses, customers.length, suppliers.length]);

  const addProduct = useCallback(
    (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
      const now = new Date().toISOString();
      const productId = generateTransactionId('PROD');
      const newProduct: Product = {
        ...productData,
        id: productId,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      // 1. Update React state immediately
      const updatedProducts = [newProduct, ...products];
      setProducts(updatedProducts);

      // 2. Persist to local IndexedDB
      indexedDbService.put('products', newProduct).catch((err) => {
        console.error('Failed to save product to IndexedDB:', err);
      });

      // 3. Queue cloud sync
      syncService.enqueue(newProduct.id, 'products', 'create', newProduct, currentUserId);

      // 4. Record Initial Stock in history if quantity > 0
      if (newProduct.quantity > 0) {
        const histId = generateTransactionId('HIST');
        const historyEntry: StockHistory = {
          id: histId,
          productId: newProduct.id,
          productName: newProduct.name,
          previousQuantity: 0,
          quantityChanged: newProduct.quantity,
          newQuantity: newProduct.quantity,
          reason: 'Initial Stock',
          timestamp: now,
          transactionId: newProduct.id,
          userId: currentUserId,
          syncStatus: 'pending',
        };

        setStockHistory((prev) => [historyEntry, ...prev]);
        indexedDbService.put('stockHistory', historyEntry);
        syncService.enqueue(historyEntry.id, 'stockHistory', 'create', historyEntry, currentUserId);
      }

      showToast(
        'success',
        isOnline
          ? `Product "${newProduct.name}" added and synced`
          : `Product "${newProduct.name}" saved locally. Waiting for internet connection.`
      );
      return newProduct;
    },
    [products, currentUserId, isOnline, showToast]
  );

  const updateProduct = useCallback(
    (
      id: string,
      updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
      reason: StockChangeReason = 'Stock Correction'
    ) => {
      const target = products.find((p) => p.id === id);
      if (!target) {
        showToast('error', 'Product not found');
        return;
      }

      const now = new Date().toISOString();
      const oldQty = target.quantity;
      const newQty = updates.quantity !== undefined ? updates.quantity : oldQty;
      const qtyChanged = newQty - oldQty;

      const updatedProduct: Product = {
        ...target,
        ...updates,
        updatedAt: now,
        syncStatus: 'pending',
      };

      // 1. Update React state immediately
      const updatedList = products.map((p) => (p.id === id ? updatedProduct : p));
      setProducts(updatedList);

      // 2. Persist to local IndexedDB
      indexedDbService.put('products', updatedProduct);

      // 3. Queue cloud sync
      syncService.enqueue(updatedProduct.id, 'products', 'update', updatedProduct, currentUserId);

      // 4. Log stock history if quantity changed
      if (qtyChanged !== 0) {
        const histId = generateTransactionId('HIST');
        const historyEntry: StockHistory = {
          id: histId,
          productId: id,
          productName: updatedProduct.name,
          previousQuantity: oldQty,
          quantityChanged: qtyChanged,
          newQuantity: newQty,
          reason: reason,
          timestamp: now,
          transactionId: updatedProduct.id,
          userId: currentUserId,
          syncStatus: 'pending',
        };

        setStockHistory((prev) => [historyEntry, ...prev]);
        indexedDbService.put('stockHistory', historyEntry);
        syncService.enqueue(historyEntry.id, 'stockHistory', 'create', historyEntry, currentUserId);
      }

      showToast(
        'success',
        isOnline
          ? `Product "${updatedProduct.name}" updated`
          : `Product "${updatedProduct.name}" updated locally (offline)`
      );
    },
    [products, currentUserId, isOnline, showToast]
  );

  const adjustStock = useCallback(
    (
      productId: string,
      delta: number,
      reason: StockChangeReason,
      notes?: string
    ): boolean => {
      const target = products.find((p) => p.id === productId);
      if (!target) {
        showToast('error', 'Product not found');
        return false;
      }

      const newQty = target.quantity + delta;
      if (newQty < 0) {
        showToast('error', 'Cannot decrease stock below zero');
        return false;
      }

      const now = new Date().toISOString();
      const updatedProduct: Product = {
        ...target,
        quantity: newQty,
        updatedAt: now,
        syncStatus: 'pending',
      };

      // Update state
      const updatedList = products.map((p) => (p.id === productId ? updatedProduct : p));
      setProducts(updatedList);
      indexedDbService.put('products', updatedProduct);
      syncService.enqueue(updatedProduct.id, 'products', 'update', updatedProduct, currentUserId);

      // Stock history
      const histId = generateTransactionId('HIST');
      const historyEntry: StockHistory = {
        id: histId,
        productId: target.id,
        productName: target.name,
        previousQuantity: target.quantity,
        quantityChanged: delta,
        newQuantity: newQty,
        reason: reason,
        notes: notes,
        timestamp: now,
        transactionId: histId,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      setStockHistory((prev) => [historyEntry, ...prev]);
      indexedDbService.put('stockHistory', historyEntry);
      syncService.enqueue(historyEntry.id, 'stockHistory', 'create', historyEntry, currentUserId);

      showToast(
        'success',
        `Stock for "${target.name}" adjusted (${delta > 0 ? `+${delta}` : delta})`
      );

      return true;
    },
    [products, currentUserId, showToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const target = products.find((p) => p.id === id);
      if (!target) return;

      const updatedList = products.filter((p) => p.id !== id);
      setProducts(updatedList);
      indexedDbService.delete('products', id);
      syncService.enqueue(id, 'products', 'delete', { id }, currentUserId);

      showToast('info', `Product "${target.name}" deleted`);
    },
    [products, currentUserId, showToast]
  );

  const resetSampleData = useCallback(async () => {
    try {
      const resetData = await indexedDbService.resetToSampleData();
      setProducts(resetData.products);
      setStockHistory(resetData.stockHistory);
      setSales([]);
      setPurchases([]);
      setExpenses([]);
      setCustomers([]);
      setSuppliers([]);
      setSyncQueue([]);
      showToast('success', 'Reset data to sample products');
    } catch (err) {
      console.error('Failed to reset sample data:', err);
      showToast('error', 'Failed to reset sample data');
    }
  }, [showToast]);

  const getProductById = useCallback(
    (id: string) => {
      return products.find((p) => p.id === id);
    },
    [products]
  );

  // Record a sale transaction (Local-First + Sync)
  const recordSale = useCallback(
    (
      productId: string,
      quantity: number,
      paymentMethod: 'Cash' | 'UPI' | 'Credit',
      notes?: string
    ) => {
      // 1. Validate sale
      const product = products.find((p) => p.id === productId);
      if (!product) {
        showToast('error', 'Product not found');
        return false;
      }
      if (quantity <= 0) {
        showToast('error', 'Quantity must be greater than zero');
        return false;
      }
      if (product.quantity < quantity) {
        showToast('error', 'Unable to complete sale because available stock is insufficient.');
        return false;
      }

      const now = new Date().toISOString();
      const unitPrice = product.sellingPrice;
      const totalAmount = unitPrice * quantity;
      const newStockQuantity = product.quantity - quantity;

      // 2. Generate unique deterministic transaction ID
      const saleId = generateTransactionId('SALE');
      const histId = generateTransactionId('HIST');

      // 3. Construct updated product
      const updatedProduct: Product = {
        ...product,
        quantity: newStockQuantity,
        updatedAt: now,
        syncStatus: 'pending',
      };

      // 4. Construct sale record
      const saleEntry: Sale = {
        id: saleId,
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        paymentMethod,
        notes,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      // 5. Construct Stock History record
      const historyEntry: StockHistory = {
        id: histId,
        productId: product.id,
        productName: product.name,
        previousQuantity: product.quantity,
        quantityChanged: -quantity,
        newQuantity: newStockQuantity,
        reason: 'Sale',
        notes: notes || `Sale ${saleId}`,
        timestamp: now,
        transactionId: saleId,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      // 6. Update local React state immediately
      setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));
      setSales((prev) => [saleEntry, ...prev]);
      setStockHistory((prev) => [historyEntry, ...prev]);

      // 7. Persist all 3 changes locally to IndexedDB
      indexedDbService.put('products', updatedProduct);
      indexedDbService.put('sales', saleEntry);
      indexedDbService.put('stockHistory', historyEntry);

      // 8. Add sync operations to syncQueue
      syncService.enqueue(saleEntry.id, 'sales', 'create', saleEntry, currentUserId);
      syncService.enqueue(updatedProduct.id, 'products', 'update', updatedProduct, currentUserId);
      syncService.enqueue(historyEntry.id, 'stockHistory', 'create', historyEntry, currentUserId);

      // 9. Inform user
      showToast(
        'success',
        isOnline
          ? `Sale recorded and synced: ${product.name} (Qty: ${quantity})`
          : `Sale recorded locally. Waiting for internet connection.`
      );

      return true;
    },
    [products, currentUserId, isOnline, showToast]
  );

  // Record a purchase transaction (Local-First + Sync)
  const recordPurchase = useCallback(
    (
      productId: string,
      quantity: number,
      supplierName: string,
      notes?: string
    ) => {
      // 1. Validate purchase
      const product = products.find((p) => p.id === productId);
      if (!product) {
        showToast('error', 'Product not found');
        return false;
      }
      if (quantity <= 0) {
        showToast('error', 'Quantity must be greater than zero');
        return false;
      }
      if (!supplierName.trim()) {
        showToast('error', 'Supplier name is required');
        return false;
      }

      const now = new Date().toISOString();
      const unitPrice = product.purchasePrice;
      const totalAmount = unitPrice * quantity;
      const newStockQuantity = product.quantity + quantity;

      // 2. Generate unique deterministic IDs
      const purchaseId = generateTransactionId('PURCHASE');
      const histId = generateTransactionId('HIST');

      // 3. Construct updated product
      const updatedProduct: Product = {
        ...product,
        quantity: newStockQuantity,
        updatedAt: now,
        syncStatus: 'pending',
      };

      // 4. Construct purchase record
      const purchaseEntry: Purchase = {
        id: purchaseId,
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        supplierName,
        notes,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      // 5. Construct Stock History record
      const historyEntry: StockHistory = {
        id: histId,
        productId: product.id,
        productName: product.name,
        previousQuantity: product.quantity,
        quantityChanged: quantity,
        newQuantity: newStockQuantity,
        reason: 'Purchase',
        notes: notes || `Purchase ${purchaseId} from ${supplierName}`,
        timestamp: now,
        transactionId: purchaseId,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      // 6. Update local React state immediately
      setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));
      setPurchases((prev) => [purchaseEntry, ...prev]);
      setStockHistory((prev) => [historyEntry, ...prev]);

      // 7. Persist to IndexedDB
      indexedDbService.put('products', updatedProduct);
      indexedDbService.put('purchases', purchaseEntry);
      indexedDbService.put('stockHistory', historyEntry);

      // 8. Add sync operations to syncQueue
      syncService.enqueue(purchaseEntry.id, 'purchases', 'create', purchaseEntry, currentUserId);
      syncService.enqueue(updatedProduct.id, 'products', 'update', updatedProduct, currentUserId);
      syncService.enqueue(historyEntry.id, 'stockHistory', 'create', historyEntry, currentUserId);

      // 9. Inform user
      showToast(
        'success',
        isOnline
          ? `Purchase recorded and synced: ${product.name} (+${quantity})`
          : `Purchase recorded locally. Waiting for internet connection.`
      );

      return true;
    },
    [products, currentUserId, isOnline, showToast]
  );

  // Record an expense transaction (Local-First + Sync)
  const recordExpense = useCallback(
    (expense: Omit<Expense, 'id'>) => {
      const now = new Date().toISOString();
      const expenseId = generateTransactionId('EXPENSE');

      const newExp: Expense = {
        ...expense,
        id: expenseId,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        syncStatus: 'pending',
      };

      setExpenses((prev) => [newExp, ...prev]);
      indexedDbService.put('expenses', newExp);
      syncService.enqueue(newExp.id, 'expenses', 'create', newExp, currentUserId);

      showToast(
        'success',
        isOnline
          ? `Expense recorded: ${newExp.category} ($${newExp.amount.toFixed(2)})`
          : `Expense recorded locally. Waiting for internet connection.`
      );

      return newExp;
    },
    [currentUserId, isOnline, showToast]
  );

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      showToast('warning', 'Device is offline. Connect to the internet to synchronize.');
      return;
    }
    showToast('info', 'Synchronizing data with cloud...');
    try {
      const result = await syncService.syncPending();
      if (result.failed > 0) {
        showToast(
          'warning',
          `Sync completed: ${result.synced} succeeded, ${result.failed} failed and will be retried.`
        );
      } else if (result.synced > 0) {
        showToast('success', `All ${result.synced} pending operations synchronized successfully!`);
      } else {
        showToast('info', 'All data is already up to date.');
      }
    } catch (err: any) {
      showToast('error', `Sync error: ${err.message || 'Check cloud connection'}`);
    }
  }, [isOnline, showToast]);

  const retryFailedSync = useCallback(async () => {
    if (!isOnline) {
      showToast('warning', 'Device is offline. Connect to internet before retrying.');
      return;
    }
    showToast('info', 'Retrying failed operations...');
    try {
      const result = await syncService.retryFailed();
      if (result.failed > 0) {
        showToast(
          'warning',
          `Retry result: ${result.synced} succeeded, ${result.failed} still failed.`
        );
      } else {
        showToast('success', `Successfully synchronized ${result.synced} operations!`);
      }
    } catch (err: any) {
      showToast('error', `Retry failed: ${err.message || 'Unknown error'}`);
    }
  }, [isOnline, showToast]);

  return (
    <ShopContext.Provider
      value={{
        products,
        stockHistory,
        sales,
        purchases,
        customers,
        suppliers,
        expenses,
        syncQueue,
        isOnline,
        isSyncing,
        metrics,
        isLoading,
        toasts,
        showToast,
        removeToast,
        addProduct,
        updateProduct,
        adjustStock,
        deleteProduct,
        resetSampleData,
        getProductById,
        recordSale,
        recordPurchase,
        recordExpense,
        syncNow,
        retryFailedSync,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
