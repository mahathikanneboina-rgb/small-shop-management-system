// src/services/transactionService.ts
import { Sale, Purchase } from '../types';
import { indexedDbService } from './indexedDbService';

class TransactionService {
  async getSales(): Promise<Sale[]> {
    return indexedDbService.getAll<Sale>('sales');
  }

  async addSale(sale: Sale): Promise<Sale> {
    return indexedDbService.put<Sale>('sales', sale);
  }

  async getPurchases(): Promise<Purchase[]> {
    return indexedDbService.getAll<Purchase>('purchases');
  }

  async addPurchase(purchase: Purchase): Promise<Purchase> {
    return indexedDbService.put<Purchase>('purchases', purchase);
  }
}

export const transactionService = new TransactionService();
