'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Product, StockHistory, DashboardMetrics, StockChangeReason, Sale, Purchase } from '../types';
import { transactionService } from '../services/transactionService';
import { storageService } from '../services/storageService';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ShopContextType {
  products: Product[];
  stockHistory: StockHistory[];
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
  recordSale: (productId: string, quantity: number, paymentMethod: 'Cash' | 'UPI' | 'Credit', notes?: string) => boolean;
  recordPurchase: (productId: string, quantity: number, supplierName: string, notes?: string) => boolean;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initialize data on client mount
  useEffect(() => {
    try {
      const initialProducts = storageService.getProducts();
      const initialHistory = storageService.getStockHistory();
      setProducts(initialProducts);
      setStockHistory(initialHistory);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      showToast('error', 'Failed to load shop data from storage');
    } finally {
      setIsLoading(false);
    }
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

    return {
      totalProducts: products.length,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalInventoryCost,
      totalPotentialRevenue,
      totalSalesAmount,
      totalPurchasesAmount,
    };
  }, [products, sales, purchases]);

  const addProduct = useCallback(
    (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
      const now = new Date().toISOString();
      const newProduct: Product = {
        ...productData,
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const updatedProducts = [newProduct, ...products];
      setProducts(updatedProducts);
      storageService.saveProducts(updatedProducts);

      // Record Initial Stock in history if quantity > 0
      if (newProduct.quantity > 0) {
        const historyEntry = storageService.addStockHistoryEntry({
          productId: newProduct.id,
          productName: newProduct.name,
          previousQuantity: 0,
          quantityChanged: newProduct.quantity,
          newQuantity: newProduct.quantity,
          reason: 'Initial Stock',
        });
        setStockHistory((prev) => [historyEntry, ...prev]);
      }

      showToast('success', `Product "${newProduct.name}" added successfully`);
      return newProduct;
    },
    [products, showToast]
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
      };

      const updatedList = products.map((p) => (p.id === id ? updatedProduct : p));
      setProducts(updatedList);
      storageService.saveProducts(updatedList);

      // If quantity changed, log to stock history
      if (qtyChanged !== 0) {
        const historyEntry = storageService.addStockHistoryEntry({
          productId: id,
          productName: updatedProduct.name,
          previousQuantity: oldQty,
          quantityChanged: qtyChanged,
          newQuantity: newQty,
          reason: reason,
        });
        setStockHistory((prev) => [historyEntry, ...prev]);
      }

      showToast('success', `Product "${updatedProduct.name}" updated successfully`);
    },
    [products, showToast]
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
      };

      const updatedList = products.map((p) => (p.id === productId ? updatedProduct : p));
      setProducts(updatedList);
      storageService.saveProducts(updatedList);

      const historyEntry = storageService.addStockHistoryEntry({
        productId: target.id,
        productName: target.name,
        previousQuantity: target.quantity,
        quantityChanged: delta,
        newQuantity: newQty,
        reason: reason,
        notes: notes,
      });
      setStockHistory((prev) => [historyEntry, ...prev]);

      showToast(
        'success',
        `Stock for "${target.name}" adjusted (${delta > 0 ? `+${delta}` : delta})`
      );
      return true;
    },
    [products, showToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const target = products.find((p) => p.id === id);
      if (!target) return;

      const updatedList = products.filter((p) => p.id !== id);
      setProducts(updatedList);
      storageService.saveProducts(updatedList);

      showToast('info', `Product "${target.name}" deleted`);
    },
    [products, showToast]
  );

  const resetSampleData = useCallback(() => {
    storageService.resetToSampleData();
    setProducts(storageService.getProducts());
    setStockHistory(storageService.getStockHistory());
    showToast('success', 'Reset data to sample products');
  }, [showToast]);

  const getProductById = useCallback(
    (id: string) => {
      return products.find((p) => p.id === id);
    },
    [products]
  );

  // Record a sale transaction
  const recordSale = useCallback(
    (productId: string, quantity: number, paymentMethod: 'Cash' | 'UPI' | 'Credit', notes?: string) => {
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
        showToast('error', 'Insufficient stock for sale');
        return false;
      }
      const unitPrice = product.sellingPrice;
      const totalAmount = unitPrice * quantity;
      const success = adjustStock(productId, -quantity, 'Sale', notes);
      if (!success) return false;
      const saleEntry = transactionService.addSale({
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        paymentMethod,
        notes,
        timestamp: new Date().toISOString(),
      });
      setSales((prev) => [saleEntry, ...prev]);
      showToast('success', `Sale recorded for ${product.name}`);
      return true;
    },
    [products, adjustStock, showToast]
  );

  // Record a purchase transaction
  const recordPurchase = useCallback(
    (productId: string, quantity: number, supplierName: string, notes?: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) {
        showToast('error', 'Product not found');
        return false;
      }
      if (quantity <= 0) {
        showToast('error', 'Quantity must be greater than zero');
        return false;
      }
      const unitPrice = product.purchasePrice;
      const totalAmount = unitPrice * quantity;
      const success = adjustStock(productId, quantity, 'Purchase', notes);
      if (!success) return false;
      const purchaseEntry = transactionService.addPurchase({
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        supplierName,
        notes,
        timestamp: new Date().toISOString(),
      });
      setPurchases((prev) => [purchaseEntry, ...prev]);
      showToast('success', `Purchase recorded for ${product.name}`);
      return true;
    },
    [products, adjustStock, showToast]
  );

  return (
    <ShopContext.Provider
      value={{
        products,
        stockHistory,
        sales,
        purchases,
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
