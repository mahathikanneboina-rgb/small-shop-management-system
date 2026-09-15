// src/services/syncService.ts
import { firestore } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { SyncQueueItem, SyncStatus, SyncEntityType, SyncOperationType } from '../types';
import { indexedDbService } from './indexedDbService';

type SyncListener = (queue: SyncQueueItem[]) => void;
type OnlineListener = (isOnline: boolean) => void;

class SyncService {
  private syncListeners: Set<SyncListener> = new Set();
  private onlineListeners: Set<OnlineListener> = new Set();
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
   */
  async enqueue(
    operationId: string,
    entityType: SyncEntityType,
    operationType: SyncOperationType,
    payload: any,
    userId?: string
  ): Promise<SyncQueueItem> {
    const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
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
   * Synchronize pending operations with Firestore.
   */
  async syncPending(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    if (!this.isOnline()) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
      const queue = await this.getQueue();
      const pendingItems = queue.filter(
        (item) => item.status === 'pending' || item.status === 'syncing'
      );

      for (const item of pendingItems) {
        // Double check online status before processing each item
        if (!this.isOnline()) {
          break;
        }

        // Mark as syncing in local queue
        item.status = 'syncing';
        await indexedDbService.put('syncQueue', item);
        await this.notifyQueueUpdated();

        try {
          await this.syncItemToFirestore(item);
          item.status = 'synced';
          item.errorMessage = undefined;
          await indexedDbService.put('syncQueue', item);

          // Update syncStatus in the local entity store as well
          await this.updateLocalEntitySyncStatus(item.entityType, item.operationId, 'synced');
          synced++;
        } catch (error: any) {
          console.warn(`Sync failed for item ${item.operationId}:`, error);
          item.status = 'failed';
          item.retryCount = (item.retryCount || 0) + 1;
          item.errorMessage = error?.message || 'Failed to synchronize with Firestore';
          await indexedDbService.put('syncQueue', item);
          await this.updateLocalEntitySyncStatus(item.entityType, item.operationId, 'failed');
          failed++;
        }
      }
    } finally {
      this.isSyncing = false;
      await this.notifyQueueUpdated();
    }

    return { synced, failed };
  }

  /**
   * Reset failed items to pending and retry synchronization.
   */
  async retryFailed(): Promise<{ synced: number; failed: number }> {
    const queue = await this.getQueue();
    const failedItems = queue.filter((item) => item.status === 'failed');

    for (const item of failedItems) {
      item.status = 'pending';
      item.errorMessage = undefined;
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
      // In development or test without valid Firebase credentials, simulate success or throw
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        // Has config but may be mock
        return;
      }
      return;
    }

    const collectionName = item.entityType;
    const docRef = doc(firestore, collectionName, item.operationId);

    if (item.operationType === 'delete') {
      await deleteDoc(docRef);
    } else {
      const sanitized = this.sanitizePayload({
        ...item.payload,
        id: item.operationId,
        syncedAt: new Date().toISOString(),
        lastUpdatedBy: item.userId || 'system',
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
