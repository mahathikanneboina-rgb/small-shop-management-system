'use client';

import React, { useState } from 'react';
import { useShop } from '../../context/ShopContext';
import { SyncQueueItem } from '../../types';

export default function SyncStatusPage() {
  const { isOnline, isSyncing, syncQueue, syncNow, retryFailedSync } = useShop();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const pendingItems = syncQueue.filter((item) => item.status === 'pending');
  const syncingItems = syncQueue.filter((item) => item.status === 'syncing');
  const syncedItems = syncQueue.filter((item) => item.status === 'synced');
  const failedItems = syncQueue.filter((item) => item.status === 'failed');

  const filteredQueue = syncQueue.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  const getStatusBadge = (status: SyncQueueItem['status']) => {
    switch (status) {
      case 'synced':
        return <span className="sync-badge badge-synced">Synced</span>;
      case 'syncing':
        return <span className="sync-badge badge-syncing">Syncing...</span>;
      case 'pending':
        return <span className="sync-badge badge-pending">Pending</span>;
      case 'failed':
        return <span className="sync-badge badge-failed">Failed</span>;
      default:
        return <span className="sync-badge">{status}</span>;
    }
  };

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'products':
        return 'Product';
      case 'sales':
        return 'Sale';
      case 'purchases':
        return 'Purchase';
      case 'stockHistory':
        return 'Stock History';
      case 'expenses':
        return 'Expense';
      case 'customers':
        return 'Customer';
      case 'suppliers':
        return 'Supplier';
      default:
        return entity;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">Sync & Offline Storage Status</h2>
          <p className="page-subheading">
            Monitor local IndexedDB persistence, network connectivity, and cloud synchronization
            queue.
          </p>
        </div>
        <div className="sync-actions-group">
          <button
            type="button"
            className="btn btn-primary"
            onClick={syncNow}
            disabled={!isOnline || isSyncing || pendingItems.length === 0}
          >
            {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={retryFailedSync}
            disabled={!isOnline || isSyncing || failedItems.length === 0}
          >
            ⚠️ Retry Failed ({failedItems.length})
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="sync-cards-grid">
        <div className="sync-card">
          <div className="sync-card-label">Connection Status</div>
          <div className="sync-card-value-wrapper">
            <span
              className={`status-dot-large ${isOnline ? 'dot-online' : 'dot-offline'}`}
            />
            <span className="sync-card-value">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="sync-card-note">
            {isOnline
              ? 'Connected to network. Local operations synchronize automatically.'
              : 'Working in offline mode. Changes are saved locally in IndexedDB.'}
          </div>
        </div>

        <div className="sync-card">
          <div className="sync-card-label">Synchronization State</div>
          <div className="sync-card-value">
            {isSyncing
              ? 'Sync in Progress'
              : failedItems.length > 0
              ? `${failedItems.length} Sync Error(s)`
              : pendingItems.length > 0
              ? `${pendingItems.length} Pending`
              : 'All Data Synced'}
          </div>
          <div className="sync-card-note">
            {pendingItems.length === 0 && failedItems.length === 0
              ? 'Local IndexedDB database is up to date with cloud storage.'
              : `${pendingItems.length} pending, ${failedItems.length} failed operations.`}
          </div>
        </div>

        <div className="sync-card">
          <div className="sync-card-label">Local Database</div>
          <div className="sync-card-value">IndexedDB (small-shop-db)</div>
          <div className="sync-card-note">
            Primary storage for instant zero-latency UI operations and offline resiliency.
          </div>
        </div>
      </div>

      {/* Queue Statistics Bar */}
      <div className="sync-stats-bar">
        <div
          className={`stat-pill ${filterStatus === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterStatus('ALL')}
        >
          Total Operations: <strong>{syncQueue.length}</strong>
        </div>
        <div
          className={`stat-pill ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending: <strong>{pendingItems.length}</strong>
        </div>
        <div
          className={`stat-pill ${filterStatus === 'syncing' ? 'active' : ''}`}
          onClick={() => setFilterStatus('syncing')}
        >
          Syncing: <strong>{syncingItems.length}</strong>
        </div>
        <div
          className={`stat-pill ${filterStatus === 'synced' ? 'active' : ''}`}
          onClick={() => setFilterStatus('synced')}
        >
          Synced: <strong>{syncedItems.length}</strong>
        </div>
        <div
          className={`stat-pill ${filterStatus === 'failed' ? 'active' : ''}`}
          onClick={() => setFilterStatus('failed')}
        >
          Failed: <strong>{failedItems.length}</strong>
        </div>
      </div>

      {/* Queue Table */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Synchronization Queue ({filteredQueue.length})</h3>
          <span className="table-subtitle">
            Operations logged locally and scheduled for cloud synchronization
          </span>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="empty-state-message">
            <p>No operations matching the selected filter.</p>
            <small>All recent transactions and changes will be logged here.</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operation ID</th>
                  <th>Entity</th>
                  <th>Type</th>
                  <th>Created At</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Error / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code className="code-badge">{item.operationId}</code>
                    </td>
                    <td>
                      <span className="entity-badge">{getEntityLabel(item.entityType)}</span>
                    </td>
                    <td>
                      <span className={`op-badge op-${item.operationType}`}>
                        {item.operationType.toUpperCase()}
                      </span>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>{item.retryCount || 0}</td>
                    <td>
                      {item.errorMessage ? (
                        <span className="sync-error-text" title={item.errorMessage}>
                          ⚠️ {item.errorMessage}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
