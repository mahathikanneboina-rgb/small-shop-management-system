'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useShop } from '../../context/ShopContext';
import { StockChangeReason } from '../../types';
import { ReasonBadge } from '../../components/common/Badge';

export default function StockHistoryPage() {
  const { stockHistory, isLoading } = useShop();

  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');

  const filteredHistory = useMemo(() => {
    return stockHistory.filter((item) => {
      const matchesSearch = item.productName
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim());
      const matchesReason = reasonFilter === 'ALL' || item.reason === reasonFilter;
      return matchesSearch && matchesReason;
    });
  }, [stockHistory, searchTerm, reasonFilter]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* Header Toolbar */}
      <div className="toolbar-bar">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Stock Movement History</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Complete audit trail of all inventory updates, sales, purchases, and corrections
          </p>
        </div>
        <Link href="/products" className="btn btn-outline btn-sm">
          Go to Products
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search by Product Name */}
          <div className="search-input-wrapper" style={{ minWidth: '240px' }}>
            <span className="search-icon">🔍</span>
            <input
              id="search-history-product"
              type="text"
              className="form-control"
              placeholder="Search by product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Reason Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              id="filter-history-reason"
              className="form-control"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
            >
              <option value="ALL">All Reasons</option>
              <option value="Initial Stock">Initial Stock</option>
              <option value="Stock Correction">Stock Correction</option>
              <option value="Sale">Sale</option>
              <option value="Purchase">Purchase</option>
            </select>
          </div>

          {(searchTerm || reasonFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchTerm('');
                setReasonFilter('ALL');
              }}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredHistory.length}</strong> of {stockHistory.length} entries
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="table-responsive">
          {isLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3 className="empty-state-title">Loading history...</h3>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📜</div>
              <h3 className="empty-state-title">No stock movements found</h3>
              <p className="empty-state-text">
                {stockHistory.length === 0
                  ? 'No inventory movements have been logged yet.'
                  : 'No logs match your filter criteria.'}
              </p>
            </div>
          ) : (
            <table className="app-table" id="stock-history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Previous Qty</th>
                  <th>Quantity Changed</th>
                  <th>New Quantity</th>
                  <th>Reason</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {formatDate(item.timestamp)}
                    </td>
                    <td>
                      <strong>{item.productName}</strong>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.previousQuantity}</td>
                    <td>
                      <span
                        className={
                          item.quantityChanged > 0
                            ? 'delta-positive'
                            : item.quantityChanged < 0
                            ? 'delta-negative'
                            : 'delta-neutral'
                        }
                        style={{ fontSize: '0.95rem' }}
                      >
                        {item.quantityChanged > 0
                          ? `+${item.quantityChanged}`
                          : item.quantityChanged}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.95rem' }}>{item.newQuantity}</strong>
                    </td>
                    <td>
                      <ReasonBadge reason={item.reason} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {item.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
