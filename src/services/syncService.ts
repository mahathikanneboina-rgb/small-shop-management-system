// src/services/syncService.ts
import { firestore } from '../lib/firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import {
  SyncQueueItem,
  SyncStatus,
  SyncEntityType,
  SyncOperationType,
  Product,
  Sale,
  Purchase,
  Customer,
  Supplier,
  Expense,
  StockHistory,
  AuditLog,
  ShopSettings,
} from '../types';
import { indexedDbService } from './indexedDbService';

type SyncListener = (queue: SyncQueueItem[]) => void;
type OnlineListener = (isOnline: boolean) => void;
type RemoteDataListener = (data: {
  products?: Product[];
  sales?: Sale[];
  purchases?: Purchase[];
  stockHistory?: StockHistory[];
  expenses?: Expense[];
  customers?: Customer[];
  suppliers?: Supplier[];
  auditLogs?: AuditLog[];
  settings?: ShopSettings;
}) => void;

class SyncService {
  private syncListeners: Set<SyncListener> = new Set();
  private onlineListeners: Set<OnlineListener> = new Set();
  private remoteDataListeners: Set<RemoteDataListener> = new Set();
  private isSyncing = false;
  private online = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;

      window.addEventListener('online', () => {
        this.online = true;
        this.notifyOnlineStatus(true);
        // Automatically attempt synchronization when reconnecting
        this.syncPending();
      });

      window.addEventListener('offline', () => {
        this.online = false;
        this.notifyOnlineStatus(false);
      });
    }
  }

  isOnline(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  subscribeOnlineStatus(listener: OnlineListener): () => void {
    this.onlineListeners.add(listener);
    listener(this.isOnline());
    return () => this.onlineListeners.delete(listener);
  }

  private notifyOnlineStatus(isOnline: boolean) {
    this.onlineListeners.forEach((l) => {
      try {
        l(isOnline);
      } catch (e) {
        console.error('Error in online listener:', e);
      }
    });
  }

  subscribeSyncQueue(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    this.getQueue().then(listener).catch(console.error);
    return () => this.syncListeners.delete(listener);
  }

  subscribeRemoteData(listener: RemoteDataListener): () => void {
    this.remoteDataListeners.add(listener);
    return () => this.remoteDataListeners.delete(listener);
  }

  private notifyRemoteData(data: any) {
    this.remoteDataListeners.forEach((l) => {
      try {
        l(data);
      } catch (e) {
        console.error('Error notifying remote data:', e);
      }
    });
  }

  private async notifyQueueUpdated() {
    try {
      const queue = await this.getQueue();
      this.syncListeners.forEach((l) => {
        try {
          l(queue);
        } catch (e) {
          console.error('Error in sync listener:', e);
        }
      });
    } catch (e) {
      console.error('Error fetching sync queue for notification:', e);
    }
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    return indexedDbService.getAll<SyncQueueItem>('syncQueue');
  }

  /**
   * Enqueue a local operation into the IndexedDB sync queue.
   * Preserves the creator's userId and userName for historical audit.
   */
  async enqueue(
    operationId: string,
    entityType: SyncEntityType,
    operationType: SyncOperationType,
    payload: any,
    userId?: string,
    userName?: string
  ): Promise<SyncQueueItem> {
    const randomSuffix =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().substring(0, 8)
        : Math.random().toString(36).substring(2, 8);

    const queueItem: SyncQueueItem = {
      id: `sync-${Date.now()}-${randomSuffix}`,
      operationId,
      entityType,
      operationType,
      payload: this.sanitizePayload(payload),
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
      userId,
      userName,
    };

    await indexedDbService.put('syncQueue', queueItem);
    await this.notifyQueueUpdated();

    // Trigger sync automatically if online
    if (this.isOnline()) {
      this.syncPending().catch((err) => {
        console.warn('Background sync encountered an issue:', err);
      });
    }

    return queueItem;
  }

  /**
   * Synchronize pending operations with Firestore (Push & Pull).
   * Includes conflict detection for multi-device product modifications.
   */
  async syncPending(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    if (!this.isOnline()) {
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      // 1. PUSH: Process local pending queue operations
      const queue = await this.getQueue();
      const pendingItems = queue.filter(
        (item) => item.status === 'pending' || item.status === 'syncing'
      );

      for (const item of pendingItems) {
        if (!this.isOnline()) break;

        item.status = 'syncing';
        await indexedDbService.put('syncQueue', item);
        await this.notifyQueueUpdated();

        try {
          await this.syncItemToFirestore(item);
          item.status = 'synced';
          item.errorMessage = undefined;
          await indexedDbService.put('syncQueue', item);

          // Update syncStatus in local entity store
          await this.updateLocalEntitySyncStatus(item.entityType, item.operationId, 'synced');
          synced++;
        } catch (error: any) {
          console.warn(`Sync failed for item ${item.operationId}:`, error);
          if (error?.message?.includes('conflict') || error?.code === 'conflict') {
            item.status = 'conflict';
            item.conflictDetails = error.message;
            conflicts++;
          } else {
            item.status = 'failed';
          }
          item.retryCount = (item.retryCount || 0) + 1;
          item.errorMessage = error?.message || 'Failed to synchronize with Firestore';
          await indexedDbService.put('syncQueue', item);
          await this.updateLocalEntitySyncStatus(item.entityType, item.operationId, item.status);
          failed++;
        }
      }

      // 2. PULL: Pull updates from Firestore to enable multi-device sync
      if (this.isFirestoreConfigured()) {
        await this.pullRemoteUpdates();
      }
    } finally {
      this.isSyncing = false;
      await this.notifyQueueUpdated();
    }

    return { synced, failed, conflicts };
  }

  /**
   * Pull remote records from Firestore and reconcile locally.
   */
  private async pullRemoteUpdates(): Promise<void> {
    try {
      const collectionsToSync: Array<{
        name: string;
        store: SyncEntityType;
      }> = [
        { name: 'products', store: 'products' },
        { name: 'sales', store: 'sales' },
        { name: 'purchases', store: 'purchases' },
        { name: 'stockHistory', store: 'stockHistory' },
        { name: 'expenses', store: 'expenses' },
        { name: 'customers', store: 'customers' },
        { name: 'suppliers', store: 'suppliers' },
        { name: 'audit_logs', store: 'auditLogs' },
      ];

      for (const col of collectionsToSync) {
        try {
          const colRef = collection(firestore, col.name);
          const q = query(colRef, limit(100));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const remoteDocs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));

            if (col.store === 'products') {
              await this.reconcileProducts(remoteDocs as Product[]);
            } else {
              // Transactions / History / Audit are immutable records, merge by ID
              for (const remoteItem of remoteDocs) {
                const existing = await indexedDbService.getById<any>(col.store, (remoteItem as any).id);
                if (!existing) {
                  await indexedDbService.put(col.store, remoteItem as any);
                }
              }
            }
          }
        } catch (colErr) {
          // Non-blocking collection fetch warning (e.g. permission or empty)
          console.debug(`Pull check on ${col.name}:`, colErr);
        }
      }
    } catch (err) {
      console.warn('Error during pullRemoteUpdates:', err);
    }
  }

  /**
   * Multi-device product reconciliation and conflict detection.
   */
  private async reconcileProducts(remoteProducts: Product[]): Promise<void> {
    const queue = await this.getQueue();
    const pendingProductIds = new Set(
      queue
        .filter((q) => q.entityType === 'products' && (q.status === 'pending' || q.status === 'syncing'))
        .map((q) => q.operationId)
    );

    for (const remoteProd of remoteProducts) {
      const localProd = await indexedDbService.getById<Product>('products', remoteProd.id);

      if (!localProd) {
        // Product exists on other device, save locally
        await indexedDbService.put('products', { ...remoteProd, syncStatus: 'synced' });
      } else if (!pendingProductIds.has(remoteProd.id)) {
        // No unsynced local changes, accept remote updates
        await indexedDbService.put('products', { ...remoteProd, syncStatus: 'synced' });
      } else {
        // CONFLICT DETECTION: Local product has un-synced operations and remote product has different stock/version
        if (localProd.quantity !== remoteProd.quantity) {
          const delta = localProd.quantity - (localProd.version ? remoteProd.quantity : localProd.quantity);
          const reconciledStock = remoteProd.quantity + delta;

          if (reconciledStock < 0) {
            // Stock dropped below 0 due to concurrent sales on multiple devices
            localProd.conflict = true;
            localProd.conflictDetails = `Stock conflict detected: Remote stock is ${remoteProd.quantity}, local adjustment was ${delta}. Net result is below 0.`;
            await indexedDbService.put('products', localProd);
          } else {
            // Reconcile cleanly
            localProd.quantity = reconciledStock;
            localProd.version = (remoteProd.version || 1) + 1;
            localProd.conflict = false;
            await indexedDbService.put('products', localProd);
          }
        }
      }
    }
  }

  /**
   * Reset failed/conflict items to pending and retry synchronization.
   */
  async retryFailed(): Promise<{ synced: number; failed: number; conflicts: number }> {
    const queue = await this.getQueue();
    const failedItems = queue.filter(
      (item) => item.status === 'failed' || item.status === 'conflict'
    );

    for (const item of failedItems) {
      item.status = 'pending';
      item.errorMessage = undefined;
      item.conflictDetails = undefined;
      await indexedDbService.put('syncQueue', item);
    }

    await this.notifyQueueUpdated();
    return this.syncPending();
  }

  /**
   * Check if Firestore is usable / configured
   */
  private isFirestoreConfigured(): boolean {
    return (
      typeof firestore !== 'undefined' &&
      firestore !== null &&
      typeof (firestore as any).type === 'string'
    );
  }

  /**
   * Sync an individual item to Firestore idempotently.
   */
  private async syncItemToFirestore(item: SyncQueueItem): Promise<void> {
    if (!this.isFirestoreConfigured()) {
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        return;
      }
      return;
    }

    const collectionMap: Record<SyncEntityType, string> = {
      products: 'products',
      sales: 'sales',
      purchases: 'purchases',
      customers: 'customers',
      suppliers: 'suppliers',
      expenses: 'expenses',
      stockHistory: 'stockHistory',
      auditLogs: 'audit_logs',
      settings: 'settings',
    };

    const collectionName = collectionMap[item.entityType] || item.entityType;
    const docRef = doc(firestore, collectionName, item.operationId);

    if (item.operationType === 'delete') {
      await deleteDoc(docRef);
    } else {
      const sanitized = this.sanitizePayload({
        ...item.payload,
        id: item.operationId,
        syncedAt: new Date().toISOString(),
        // Always preserve the original creator's userId & userName
        userId: item.userId || item.payload.userId || 'system',
        userName: item.userName || item.payload.userName || 'System User',
      });
      await setDoc(docRef, sanitized, { merge: true });
    }
  }

  private async updateLocalEntitySyncStatus(
    entityType: SyncEntityType,
    id: string,
    status: SyncStatus
  ): Promise<void> {
    try {
      const existing = await indexedDbService.getById<any>(entityType, id);
      if (existing) {
        existing.syncStatus = status;
        await indexedDbService.put(entityType, existing);
      }
    } catch (e) {
      console.warn(`Could not update local entity status for ${entityType}/${id}:`, e);
    }
  }

  /**
   * Remove undefined values which cause Firestore to fail.
   */
  private sanitizePayload(data: any): any {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitizePayload(item));

    const result: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        result[key] = this.sanitizePayload(data[key]);
      }
    }
    return result;
  }
}

export const syncService = new SyncService();
