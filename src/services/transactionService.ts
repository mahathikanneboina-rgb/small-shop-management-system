import { Sale, Purchase } from '../types';

const SALES_KEY = 'small_shop_sales_v1';
const PURCHASES_KEY = 'small_shop_purchases_v1';

class TransactionService {
  // Sales
  getSales(): Sale[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(SALES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data) as Sale[];
    } catch {
      return [];
    }
  }

  addSale(sale: Omit<Sale, 'id'>): Sale {
    const sales = this.getSales();
    const newSale: Sale = {
      ...sale,
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newSale, ...sales];
    if (typeof window !== 'undefined') {
      localStorage.setItem(SALES_KEY, JSON.stringify(updated));
    }
    return newSale;
  }

  // Purchases
  getPurchases(): Purchase[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(PURCHASES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data) as Purchase[];
    } catch {
      return [];
    }
  }

  addPurchase(purchase: Omit<Purchase, 'id'>): Purchase {
    const purchases = this.getPurchases();
    const newPurchase: Purchase = {
      ...purchase,
      id: `purchase-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newPurchase, ...purchases];
    if (typeof window !== 'undefined') {
      localStorage.setItem(PURCHASES_KEY, JSON.stringify(updated));
    }
    return newPurchase;
  }
}

export const transactionService = new TransactionService();
