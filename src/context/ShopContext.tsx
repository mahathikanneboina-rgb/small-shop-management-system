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
  SaleItem,
  Purchase,
  Customer,
  Supplier,
  Expense,
  SyncQueueItem,
  AuditLog,
  ShopSettings,
  generateTransactionId,
  generateInvoiceNumber,
} from '../types';
import { indexedDbService, DEFAULT_SHOP_SETTINGS } from '../services/indexedDbService';
import { syncService } from '../services/syncService';
import { auditService } from '../services/auditService';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface BillingSaleInput {
  items: SaleItem[];
  paymentMethod: 'Cash' | 'UPI' | 'Credit';
  customerId?: string;
  customerName?: string;
  discount?: number;
  amountReceived?: number;
  notes?: string;
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
  auditLogs: AuditLog[];
  settings: ShopSettings;
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
  recordBillingSale: (input: BillingSaleInput) => Sale | null;
  cancelSale: (saleId: string, reason?: string) => boolean;
  addCustomer: (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  recordPurchase: (
    productId: string,
    quantity: number,
    supplierName: string,
    notes?: string
  ) => boolean;
  recordExpense: (expense: Omit<Expense, 'id'>) => Expense;
  updateSettings: (newSettings: ShopSettings) => Promise<void>;
  syncNow: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isDisabled } = useAuth();
  const currentUserId = user?.uid;
  const currentUserName = profile?.name || user?.email || 'Store User';

  const [products, setProducts] = useState<Product[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
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
          setAuditLogs(data.auditLogs);
          setSettings(data.settings);
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
    const unsubQueue = syncService.subscribeSyncQueue(async (queue) => {
      if (mounted) {
        setSyncQueue(queue);
        setIsSyncing(queue.some((item) => item.status === 'syncing'));

        // Refresh audit logs
        const updatedLogs = await indexedDbService.getAll<AuditLog>('auditLogs');
        setAuditLogs(updatedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
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
      if (isDisabled) {
        showToast('error', 'Your account is disabled. Cannot modify products.');
        throw new Error('Account disabled');
      }

      const now = new Date().toISOString();
      const productId = generateTransactionId('PROD');
      const newProduct: Product = {
        ...productData,
        id: productId,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        userName: currentUserName,
        syncStatus: 'pending',
        version: 1,
      };

      // 1. Update React state immediately
      const updatedProducts = [newProduct, ...products];
      setProducts(updatedProducts);

      // 2. Persist to local IndexedDB
      indexedDbService.put('products', newProduct).catch((err) => {
        console.error('Failed to save product to IndexedDB:', err);
      });

      // 3. Queue cloud sync
      syncService.enqueue(
        newProduct.id,
        'products',
        'create',
        newProduct,
        currentUserId,
        currentUserName
      );

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
          userName: currentUserName,
          syncStatus: 'pending',
        };

        setStockHistory((prev) => [historyEntry, ...prev]);
        indexedDbService.put('stockHistory', historyEntry);
        syncService.enqueue(
          historyEntry.id,
          'stockHistory',
          'create',
          historyEntry,
          currentUserId,
          currentUserName
        );
      }

      // 5. Audit Log
      auditService.log(
        'PRODUCT_CREATED',
        'product',
        newProduct.id,
        `Created product ${newProduct.name} (Qty: ${newProduct.quantity})`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast(
        'success',
        isOnline
          ? `Product "${newProduct.name}" added and synced`
          : `Product "${newProduct.name}" saved locally. Waiting for internet connection.`
      );
      return newProduct;
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  const updateProduct = useCallback(
    (
      id: string,
      updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
      reason: StockChangeReason = 'Stock Correction'
    ) => {
      if (isDisabled) {
        showToast('error', 'Your account is disabled. Cannot modify products.');
        return;
      }

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
        version: (target.version || 1) + 1,
      };

      // 1. Update React state immediately
      const updatedList = products.map((p) => (p.id === id ? updatedProduct : p));
      setProducts(updatedList);

      // 2. Persist to local IndexedDB
      indexedDbService.put('products', updatedProduct);

      // 3. Queue cloud sync
      syncService.enqueue(
        updatedProduct.id,
        'products',
        'update',
        updatedProduct,
        currentUserId,
        currentUserName
      );

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
          userName: currentUserName,
          syncStatus: 'pending',
        };

        setStockHistory((prev) => [historyEntry, ...prev]);
        indexedDbService.put('stockHistory', historyEntry);
        syncService.enqueue(
          historyEntry.id,
          'stockHistory',
          'create',
          historyEntry,
          currentUserId,
          currentUserName
        );
      }

      // 5. Audit Log
      auditService.log(
        'PRODUCT_UPDATED',
        'product',
        id,
        `Updated product ${updatedProduct.name}${qtyChanged !== 0 ? ` (Qty changed by ${qtyChanged})` : ''}`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast(
        'success',
        isOnline
          ? `Product "${updatedProduct.name}" updated`
          : `Product "${updatedProduct.name}" updated locally (offline)`
      );
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  const adjustStock = useCallback(
    (
      productId: string,
      delta: number,
      reason: StockChangeReason,
      notes?: string
    ): boolean => {
      if (isDisabled) {
        showToast('error', 'Your account is disabled. Cannot adjust stock.');
        return false;
      }

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
        version: (target.version || 1) + 1,
      };

      // Update state
      const updatedList = products.map((p) => (p.id === productId ? updatedProduct : p));
      setProducts(updatedList);
      indexedDbService.put('products', updatedProduct);
      syncService.enqueue(
        updatedProduct.id,
        'products',
        'update',
        updatedProduct,
        currentUserId,
        currentUserName
      );

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
        userName: currentUserName,
        syncStatus: 'pending',
      };

      setStockHistory((prev) => [historyEntry, ...prev]);
      indexedDbService.put('stockHistory', historyEntry);
      syncService.enqueue(
        historyEntry.id,
        'stockHistory',
        'create',
        historyEntry,
        currentUserId,
        currentUserName
      );

      // Audit Log
      auditService.log(
        'PRODUCT_UPDATED',
        'product',
        target.id,
        `Adjusted stock for ${target.name} (${delta > 0 ? `+${delta}` : delta}) - Reason: ${reason}`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast(
        'success',
        `Stock for "${target.name}" adjusted (${delta > 0 ? `+${delta}` : delta})`
      );

      return true;
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, showToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      if (isDisabled) {
        showToast('error', 'Your account is disabled. Cannot delete products.');
        return;
      }

      const target = products.find((p) => p.id === id);
      if (!target) return;

      const updatedList = products.filter((p) => p.id !== id);
      setProducts(updatedList);
      indexedDbService.delete('products', id);
      syncService.enqueue(id, 'products', 'delete', { id }, currentUserId, currentUserName);

      auditService.log(
        'PRODUCT_DELETED',
        'product',
        id,
        `Deleted product ${target.name}`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast('info', `Product "${target.name}" deleted`);
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, showToast]
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
      setAuditLogs([]);
      setSettings(DEFAULT_SHOP_SETTINGS);
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

  // Record a sale transaction (Local-First + Sync + Audit)
  const recordSale = useCallback(
    (
      productId: string,
      quantity: number,
      paymentMethod: 'Cash' | 'UPI' | 'Credit',
      notes?: string
    ) => {
      if (isDisabled) {
        showToast('error', 'Your staff account is disabled. Cannot record sales.');
        return false;
      }

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
        version: (product.version || 1) + 1,
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
        userName: currentUserName,
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
        userName: currentUserName,
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
      syncService.enqueue(
        saleEntry.id,
        'sales',
        'create',
        saleEntry,
        currentUserId,
        currentUserName
      );
      syncService.enqueue(
        updatedProduct.id,
        'products',
        'update',
        updatedProduct,
        currentUserId,
        currentUserName
      );
      syncService.enqueue(
        historyEntry.id,
        'stockHistory',
        'create',
        historyEntry,
        currentUserId,
        currentUserName
      );

      // 9. Audit Log
      auditService.log(
        'SALE_CREATED',
        'sale',
        saleId,
        `Recorded sale of ${product.name} (Qty: ${quantity}, Amount: $${totalAmount.toFixed(2)}, Pay: ${paymentMethod})`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      // 10. Inform user
      showToast(
        'success',
        isOnline
          ? `Sale recorded and synced: ${product.name} (Qty: ${quantity})`
          : `Sale recorded locally. Waiting for internet connection.`
      );

      return true;
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  // Record a multi-item POS / Billing Sale (Local-First + Sync + Audit)
  const recordBillingSale = useCallback(
    (input: BillingSaleInput): Sale | null => {
      if (isDisabled) {
        showToast('error', 'Your staff account is disabled. Cannot create sales.');
        return null;
      }

      if (!input.items || input.items.length === 0) {
        showToast('error', 'Cart is empty. Add at least one product.');
        return null;
      }

      // 1. Stock & Product validation
      for (const item of input.items) {
        if (item.quantity <= 0) {
          showToast('error', `Invalid quantity for "${item.productName}".`);
          return null;
        }
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          showToast('error', `Product "${item.productName}" was not found.`);
          return null;
        }
        if (product.quantity < item.quantity) {
          showToast('error', `Only ${product.quantity} units available for "${product.name}".`);
          return null;
        }
      }

      // 2. Calculations
      const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const discount = Math.max(0, input.discount || 0);
      if (discount > subtotal) {
        showToast('error', 'Discount cannot exceed the subtotal.');
        return null;
      }
      const finalTotal = Math.max(0, subtotal - discount);

      // 3. Payment Method Validations
      let amountReceived = input.amountReceived;
      let changeAmount = 0;
      if (input.paymentMethod === 'Cash') {
        if (amountReceived === undefined) {
          amountReceived = finalTotal;
        }
        if (amountReceived < finalTotal) {
          showToast('error', `Received amount is less than total.`);
          return null;
        }
        changeAmount = amountReceived - finalTotal;
      } else if (input.paymentMethod === 'Credit') {
        if (!input.customerId || !input.customerName) {
          showToast('error', 'Please select a customer for credit sales.');
          return null;
        }
      }

      const now = new Date().toISOString();
      const saleId = generateTransactionId('SALE');
      const invoiceNumber = generateInvoiceNumber();

      // 4. Deduct stock & create StockHistory for each line item
      const updatedProductsMap = new Map<string, Product>();
      const newStockHistories: StockHistory[] = [];

      input.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId)!;
        const currentProd = updatedProductsMap.get(prod.id) || prod;
        const newQty = currentProd.quantity - item.quantity;
        const updatedProd: Product = {
          ...currentProd,
          quantity: newQty,
          updatedAt: now,
          syncStatus: 'pending',
          version: (currentProd.version || 1) + 1,
        };
        updatedProductsMap.set(prod.id, updatedProd);

        const histId = generateTransactionId('HIST');
        const histEntry: StockHistory = {
          id: histId,
          productId: prod.id,
          productName: prod.name,
          previousQuantity: currentProd.quantity,
          quantityChanged: -item.quantity,
          newQuantity: newQty,
          reason: 'Sale',
          notes: input.notes || `Bill #${invoiceNumber}`,
          timestamp: now,
          transactionId: saleId,
          userId: currentUserId,
          userName: currentUserName,
          syncStatus: 'pending',
        };
        newStockHistories.push(histEntry);
      });

      // 5. Update customer balance if credit sale
      let updatedCustomer: Customer | null = null;
      if (input.paymentMethod === 'Credit' && input.customerId) {
        const cust = customers.find((c) => c.id === input.customerId);
        if (cust) {
          updatedCustomer = {
            ...cust,
            creditDue: (cust.creditDue || 0) + finalTotal,
            totalPurchases: (cust.totalPurchases || 0) + finalTotal,
            updatedAt: now,
            syncStatus: 'pending',
          };
        }
      }

      // 6. Construct composite Sale record
      const primaryItem = input.items[0];
      const saleEntry: Sale = {
        id: saleId,
        invoiceNumber,
        productId: input.items.length === 1 ? primaryItem.productId : 'MULTIPLE',
        productName:
          input.items.length === 1
            ? primaryItem.productName
            : `${primaryItem.productName} +${input.items.length - 1} item${input.items.length > 2 ? 's' : ''}`,
        quantity: input.items.reduce((s, i) => s + i.quantity, 0),
        unitPrice:
          input.items.length === 1
            ? primaryItem.unitPrice
            : subtotal / Math.max(1, input.items.reduce((s, i) => s + i.quantity, 0)),
        subtotal,
        discount,
        totalAmount: finalTotal,
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
        customerName: input.customerName,
        amountReceived,
        changeAmount,
        items: input.items,
        notes: input.notes,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        userName: currentUserName,
        syncStatus: 'pending',
      };

      // 7. Update React state immediately
      setProducts((prev) =>
        prev.map((p) => (updatedProductsMap.has(p.id) ? updatedProductsMap.get(p.id)! : p))
      );
      setSales((prev) => [saleEntry, ...prev]);
      setStockHistory((prev) => [...newStockHistories, ...prev]);
      if (updatedCustomer) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === updatedCustomer!.id ? updatedCustomer! : c))
        );
      }

      // 8. Persist to IndexedDB & enqueue to Sync Queue
      indexedDbService.put('sales', saleEntry);
      syncService.enqueue(
        saleEntry.id,
        'sales',
        'create',
        saleEntry,
        currentUserId,
        currentUserName
      );

      updatedProductsMap.forEach((updatedProd) => {
        indexedDbService.put('products', updatedProd);
        syncService.enqueue(
          updatedProd.id,
          'products',
          'update',
          updatedProd,
          currentUserId,
          currentUserName
        );
      });

      newStockHistories.forEach((hist) => {
        indexedDbService.put('stockHistory', hist);
        syncService.enqueue(
          hist.id,
          'stockHistory',
          'create',
          hist,
          currentUserId,
          currentUserName
        );
      });

      if (updatedCustomer) {
        indexedDbService.put('customers', updatedCustomer);
        syncService.enqueue(
          updatedCustomer.id,
          'customers',
          'update',
          updatedCustomer,
          currentUserId,
          currentUserName
        );
      }

      // 9. Audit Log
      auditService.log(
        'SALE_CREATED',
        'sale',
        saleId,
        `Created Bill #${invoiceNumber} (${input.items.length} items, Total: ${finalTotal.toFixed(2)}, Pay: ${input.paymentMethod}${input.customerName ? `, Customer: ${input.customerName}` : ''})`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast(
        'success',
        isOnline
          ? `Bill #${invoiceNumber} completed & synced.`
          : `Bill #${invoiceNumber} saved locally (offline mode).`
      );

      return saleEntry;
    },
    [products, customers, currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  // Safe Sale Cancellation / Reversal
  const cancelSale = useCallback(
    (saleId: string, reason?: string): boolean => {
      if (isDisabled) {
        showToast('error', 'Your staff account is disabled. Cannot cancel sales.');
        return false;
      }

      const sale = sales.find((s) => s.id === saleId);
      if (!sale) {
        showToast('error', 'Sale not found.');
        return false;
      }
      if (sale.isCancelled) {
        showToast('warning', 'This sale has already been cancelled.');
        return false;
      }

      const now = new Date().toISOString();
      const updatedProductsMap = new Map<string, Product>();
      const reversalHistories: StockHistory[] = [];

      // Restore stock
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            const currentProd = updatedProductsMap.get(prod.id) || prod;
            const restoredQty = currentProd.quantity + item.quantity;
            const updatedProd: Product = {
              ...currentProd,
              quantity: restoredQty,
              updatedAt: now,
              syncStatus: 'pending',
              version: (currentProd.version || 1) + 1,
            };
            updatedProductsMap.set(prod.id, updatedProd);

            const histId = generateTransactionId('HIST');
            const histEntry: StockHistory = {
              id: histId,
              productId: prod.id,
              productName: prod.name,
              previousQuantity: currentProd.quantity,
              quantityChanged: item.quantity,
              newQuantity: restoredQty,
              reason: 'Sale Reversal',
              notes: reason || `Cancelled Bill #${sale.invoiceNumber || sale.id}`,
              timestamp: now,
              transactionId: sale.id,
              userId: currentUserId,
              userName: currentUserName,
              syncStatus: 'pending',
            };
            reversalHistories.push(histEntry);
          }
        });
      } else if (sale.productId && sale.productId !== 'MULTIPLE') {
        const prod = products.find((p) => p.id === sale.productId);
        if (prod) {
          const restoredQty = prod.quantity + sale.quantity;
          const updatedProd: Product = {
            ...prod,
            quantity: restoredQty,
            updatedAt: now,
            syncStatus: 'pending',
            version: (prod.version || 1) + 1,
          };
          updatedProductsMap.set(prod.id, updatedProd);

          const histId = generateTransactionId('HIST');
          const histEntry: StockHistory = {
            id: histId,
            productId: prod.id,
            productName: prod.name,
            previousQuantity: prod.quantity,
            quantityChanged: sale.quantity,
            newQuantity: restoredQty,
            reason: 'Sale Reversal',
            notes: reason || `Cancelled Sale #${sale.id}`,
            timestamp: now,
            transactionId: sale.id,
            userId: currentUserId,
            userName: currentUserName,
            syncStatus: 'pending',
          };
          reversalHistories.push(histEntry);
        }
      }

      // Customer credit reversal if applicable
      let updatedCustomer: Customer | null = null;
      if (sale.paymentMethod === 'Credit' && sale.customerId) {
        const cust = customers.find((c) => c.id === sale.customerId);
        if (cust) {
          updatedCustomer = {
            ...cust,
            creditDue: Math.max(0, (cust.creditDue || 0) - sale.totalAmount),
            totalPurchases: Math.max(0, (cust.totalPurchases || 0) - sale.totalAmount),
            updatedAt: now,
            syncStatus: 'pending',
          };
        }
      }

      const cancelledSale: Sale = {
        ...sale,
        isCancelled: true,
        cancelledAt: now,
        cancelledBy: currentUserName,
        cancelReason: reason || 'Sale cancelled by store staff',
        updatedAt: now,
        syncStatus: 'pending',
      };

      // State update
      setProducts((prev) =>
        prev.map((p) => (updatedProductsMap.has(p.id) ? updatedProductsMap.get(p.id)! : p))
      );
      setSales((prev) => prev.map((s) => (s.id === saleId ? cancelledSale : s)));
      setStockHistory((prev) => [...reversalHistories, ...prev]);
      if (updatedCustomer) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === updatedCustomer!.id ? updatedCustomer! : c))
        );
      }

      // IndexedDB & Sync
      indexedDbService.put('sales', cancelledSale);
      syncService.enqueue(
        cancelledSale.id,
        'sales',
        'update',
        cancelledSale,
        currentUserId,
        currentUserName
      );

      updatedProductsMap.forEach((updatedProd) => {
        indexedDbService.put('products', updatedProd);
        syncService.enqueue(
          updatedProd.id,
          'products',
          'update',
          updatedProd,
          currentUserId,
          currentUserName
        );
      });

      reversalHistories.forEach((hist) => {
        indexedDbService.put('stockHistory', hist);
        syncService.enqueue(
          hist.id,
          'stockHistory',
          'create',
          hist,
          currentUserId,
          currentUserName
        );
      });

      if (updatedCustomer) {
        indexedDbService.put('customers', updatedCustomer);
        syncService.enqueue(
          updatedCustomer.id,
          'customers',
          'update',
          updatedCustomer,
          currentUserId,
          currentUserName
        );
      }

      // Audit Log
      auditService.log(
        'SALE_CANCELLED',
        'sale',
        saleId,
        `Reversed/Cancelled Bill #${sale.invoiceNumber || sale.id} (${sale.productName}, Amount: ${sale.totalAmount.toFixed(2)}) - ${reason || 'User cancellation'}`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast('info', `Bill #${sale.invoiceNumber || sale.id} cancelled & stock restored.`);
      return true;
    },
    [sales, products, customers, currentUserId, currentUserName, user?.email, isDisabled, showToast]
  );

  const addCustomer = useCallback(
    (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer => {
      if (isDisabled) {
        showToast('error', 'Your account is disabled.');
        throw new Error('Account disabled');
      }

      const now = new Date().toISOString();
      const customerId = generateTransactionId('CUST');
      const newCustomer: Customer = {
        ...customerData,
        id: customerId,
        totalPurchases: customerData.totalPurchases || 0,
        creditDue: customerData.creditDue || 0,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        userName: currentUserName,
        syncStatus: 'pending',
      };

      setCustomers((prev) => [newCustomer, ...prev]);
      indexedDbService.put('customers', newCustomer);
      syncService.enqueue(
        newCustomer.id,
        'customers',
        'create',
        newCustomer,
        currentUserId,
        currentUserName
      );

      showToast('success', `Customer "${newCustomer.name}" added.`);
      return newCustomer;
    },
    [currentUserId, currentUserName, isDisabled, showToast]
  );

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) => {
      if (isDisabled) {
        showToast('error', 'Your account is disabled.');
        return;
      }

      const target = customers.find((c) => c.id === id);
      if (!target) return;

      const now = new Date().toISOString();
      const updatedCustomer: Customer = {
        ...target,
        ...updates,
        updatedAt: now,
        syncStatus: 'pending',
      };

      setCustomers((prev) => prev.map((c) => (c.id === id ? updatedCustomer : c)));
      indexedDbService.put('customers', updatedCustomer);
      syncService.enqueue(
        updatedCustomer.id,
        'customers',
        'update',
        updatedCustomer,
        currentUserId,
        currentUserName
      );
    },
    [customers, currentUserId, currentUserName, isDisabled, showToast]
  );

  // Record a purchase transaction (Local-First + Sync + Audit)
  const recordPurchase = useCallback(
    (
      productId: string,
      quantity: number,
      supplierName: string,
      notes?: string
    ) => {
      if (isDisabled) {
        showToast('error', 'Your staff account is disabled. Cannot record purchases.');
        return false;
      }

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
        version: (product.version || 1) + 1,
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
        userName: currentUserName,
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
        userName: currentUserName,
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
      syncService.enqueue(
        purchaseEntry.id,
        'purchases',
        'create',
        purchaseEntry,
        currentUserId,
        currentUserName
      );
      syncService.enqueue(
        updatedProduct.id,
        'products',
        'update',
        updatedProduct,
        currentUserId,
        currentUserName
      );
      syncService.enqueue(
        historyEntry.id,
        'stockHistory',
        'create',
        historyEntry,
        currentUserId,
        currentUserName
      );

      // 9. Audit Log
      auditService.log(
        'PURCHASE_CREATED',
        'purchase',
        purchaseId,
        `Recorded purchase of ${product.name} (+${quantity}, Total: $${totalAmount.toFixed(2)}, Supplier: ${supplierName})`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      // 10. Inform user
      showToast(
        'success',
        isOnline
          ? `Purchase recorded and synced: ${product.name} (+${quantity})`
          : `Purchase recorded locally. Waiting for internet connection.`
      );

      return true;
    },
    [products, currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  // Record an expense transaction (Local-First + Sync + Audit)
  const recordExpense = useCallback(
    (expense: Omit<Expense, 'id'>) => {
      if (isDisabled) {
        showToast('error', 'Your staff account is disabled. Cannot record expenses.');
        throw new Error('Account disabled');
      }

      const now = new Date().toISOString();
      const expenseId = generateTransactionId('EXPENSE');

      const newExp: Expense = {
        ...expense,
        id: expenseId,
        createdAt: now,
        updatedAt: now,
        userId: currentUserId,
        userName: currentUserName,
        syncStatus: 'pending',
      };

      setExpenses((prev) => [newExp, ...prev]);
      indexedDbService.put('expenses', newExp);
      syncService.enqueue(
        newExp.id,
        'expenses',
        'create',
        newExp,
        currentUserId,
        currentUserName
      );

      auditService.log(
        'EXPENSE_CREATED',
        'expense',
        expenseId,
        `Recorded expense: ${newExp.category} ($${newExp.amount.toFixed(2)})`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );

      showToast(
        'success',
        isOnline
          ? `Expense recorded: ${newExp.category} ($${newExp.amount.toFixed(2)})`
          : `Expense recorded locally. Waiting for internet connection.`
      );

      return newExp;
    },
    [currentUserId, currentUserName, user?.email, isDisabled, isOnline, showToast]
  );

  const updateSettings = useCallback(
    async (newSettings: ShopSettings) => {
      const now = new Date().toISOString();
      const updated: ShopSettings = {
        ...newSettings,
        updatedAt: now,
        updatedBy: currentUserId,
        syncStatus: 'pending',
      };

      setSettings(updated);
      await indexedDbService.put('settings', updated);
      await syncService.enqueue(
        updated.id,
        'settings',
        'update',
        updated,
        currentUserId,
        currentUserName
      );

      await auditService.log(
        'SETTINGS_UPDATED',
        'settings',
        updated.id,
        `Shop settings updated by ${currentUserName}`,
        { uid: currentUserId || 'system', name: currentUserName, email: user?.email || undefined }
      );
    },
    [currentUserId, currentUserName, user?.email]
  );

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      showToast('warning', 'Device is offline. Connect to the internet to synchronize.');
      return;
    }
    showToast('info', 'Synchronizing data with cloud...');
    try {
      const result = await syncService.syncPending();
      if (result.conflicts > 0) {
        showToast(
          'warning',
          `Sync finished with ${result.conflicts} stock conflict(s) detected. Please review affected products.`
        );
      } else if (result.failed > 0) {
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
        auditLogs,
        settings,
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
        recordBillingSale,
        cancelSale,
        addCustomer,
        updateCustomer,
        recordPurchase,
        recordExpense,
        updateSettings,
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
