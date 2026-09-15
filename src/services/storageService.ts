// src/services/storageService.ts
import { Product, StockHistory } from '../types';
import {
  indexedDbService,
  INITIAL_SAMPLE_PRODUCTS,
  INITIAL_SAMPLE_HISTORY,
} from './indexedDbService';

export { INITIAL_SAMPLE_PRODUCTS, INITIAL_SAMPLE_HISTORY };

class StorageService {
  async getProducts(): Promise<Product[]> {
    return indexedDbService.getAll<Product>('products');
  }

  async saveProducts(products: Product[]): Promise<void> {
    await indexedDbService.bulkPut('products', products);
  }

  async getStockHistory(): Promise<StockHistory[]> {
    return indexedDbService.getAll<StockHistory>('stockHistory');
  }

  async saveStockHistory(history: StockHistory[]): Promise<void> {
    await indexedDbService.bulkPut('stockHistory', history);
  }

  async resetToSampleData(): Promise<void> {
    await indexedDbService.resetToSampleData();
  }

  async clearAllData(): Promise<void> {
    await indexedDbService.clearStore('products');
    await indexedDbService.clearStore('stockHistory');
  }
}

export const storageService = new StorageService();
