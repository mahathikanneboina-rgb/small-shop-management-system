'use client';

import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';
import { AuditLog, AuditLogAction } from '../../types';
import { RoleGuard } from '../../components/common/RoleGuard';

export default function AuditLogPage() {
  return (
    <RoleGuard requiredRole="owner">
      <AuditLogContent />
    </RoleGuard>
  );
}

function AuditLogContent() {
  const { auditLogs } = useShop();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
      const term = searchKeyword.toLowerCase().trim();
      const matchesSearch =
        term === '' ||
        log.userName.toLowerCase().includes(term) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(term)) ||
        log.description.toLowerCase().includes(term) ||
        log.entityId.toLowerCase().includes(term);

      return matchesAction && matchesSearch;
    });
  }, [auditLogs, searchKeyword, selectedAction]);

  const getActionBadge = (action: AuditLogAction) => {
    switch (action) {
      case 'SALE_CREATED':
        return <span className="sync-badge badge-synced">🛒 Sale Created</span>;
      case 'PURCHASE_CREATED':
        return <span className="sync-badge badge-syncing">📥 Purchase Created</span>;
      case 'PRODUCT_CREATED':
        return <span className="sync-badge badge-synced">📦 Product Added</span>;
      case 'PRODUCT_UPDATED':
        return <span className="sync-badge badge-pending">✏️ Product Updated</span>;
      case 'PRODUCT_DELETED':
        return <span className="sync-badge badge-failed">🗑️ Product Deleted</span>;
      case 'EXPENSE_CREATED':
        return <span className="sync-badge badge-pending">💸 Expense Logged</span>;
      case 'STAFF_DISABLED':
        return <span className="sync-badge badge-failed">⛔ Staff Disabled</span>;
      case 'STAFF_REACTIVATED':
        return <span className="sync-badge badge-synced">✅ Staff Reactivated</span>;
      case 'STOCK_CONFLICT_DETECTED':
        return <span className="sync-badge badge-failed">⚠️ Stock Conflict</span>;
      case 'LOGIN':
        return <span className="sync-badge badge-syncing">🔑 User Login</span>;
      case 'LOGOUT':
        return <span className="sync-badge">🚪 User Logout</span>;
      default:
        return <span className="sync-badge">{action}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">Security & Business Audit Log</h2>
          <p className="page-subheading">
            Immutable tracking record of sales, inventory changes, staff modifications, and logins.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="toolbar-bar">
        <div className="toolbar-search-filter">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by user name, email, or details..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="filter-select"
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
          >
            <option value="ALL">All Event Actions</option>
            <option value="SALE_CREATED">Sales Created</option>
            <option value="PURCHASE_CREATED">Purchases Created</option>
            <option value="PRODUCT_CREATED">Products Added</option>
            <option value="PRODUCT_UPDATED">Products Updated</option>
            <option value="PRODUCT_DELETED">Products Deleted</option>
            <option value="EXPENSE_CREATED">Expenses Logged</option>
            <option value="STAFF_DISABLED">Staff Disabled</option>
            <option value="STAFF_REACTIVATED">Staff Reactivated</option>
            <option value="STOCK_CONFLICT_DETECTED">Stock Conflicts</option>
            <option value="LOGIN">User Logins</option>
            <option value="LOGOUT">User Logouts</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Audit Records ({filteredLogs.length})</h3>
          <span className="table-subtitle">Chronological record of system activities</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-title">No Audit Logs Found</div>
            <p className="empty-state-text">
              {searchKeyword || selectedAction !== 'ALL'
                ? 'No events match the selected filters.'
                : 'All important business operations and logins will be recorded here.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <strong>{log.userName}</strong>
                      {log.userEmail && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {log.userEmail}
                        </div>
                      )}
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td>
                      <span className="entity-badge">{log.entityType}</span>
                    </td>
                    <td>
                      <span>{log.description}</span>
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
