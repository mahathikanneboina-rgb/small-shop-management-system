// src/services/auditService.ts
import { AuditLog, AuditLogAction, generateTransactionId } from '../types';
import { indexedDbService } from './indexedDbService';
import { syncService } from './syncService';

class AuditService {
  async log(
    action: AuditLogAction,
    entityType: string,
    entityId: string,
    description: string,
    user?: { uid: string; name?: string; email?: string }
  ): Promise<AuditLog> {
    const auditId = generateTransactionId('AUDIT');
    const now = new Date().toISOString();

    const entry: AuditLog = {
      id: auditId,
      userId: user?.uid || 'system',
      userName: user?.name || user?.email || 'System User',
      userEmail: user?.email,
      action,
      entityType,
      entityId,
      description,
      timestamp: now,
      syncStatus: 'pending',
    };

    try {
      await indexedDbService.put('auditLogs', entry);
      await syncService.enqueue(
        entry.id,
        'auditLogs',
        'create',
        entry,
        entry.userId,
        entry.userName
      );
    } catch (err) {
      console.warn('Failed to record audit log:', err);
    }

    return entry;
  }

  async getLogs(): Promise<AuditLog[]> {
    return indexedDbService.getAll<AuditLog>('auditLogs');
  }
}

export const auditService = new AuditService();
