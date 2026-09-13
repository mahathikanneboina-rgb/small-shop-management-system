'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useShop } from '../context/ShopContext';
import { calculateStockStatus } from '../types';
import { StockStatusBadge, CategoryBadge, ReasonBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export default function DashboardPage() {
  const { products, stockHistory, metrics, isLoading, resetSampleData, adjustStock } = useShop();

  // Quick stock adjustment modal state from low stock section
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<number>(5);
  const [adjustmentReason, setAdjustmentReason] = useState<'Purchase' | 'Stock Correction'>('Purchase');
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>('');

  const lowStockProducts = products.filter((p) => p.quantity <= p.minStock);
  const recentActivities = stockHistory.slice(0, 8);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleQuickAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (adjustmentDelta <= 0) return;

    adjustStock(selectedProduct.id, adjustmentDelta, adjustmentReason, adjustmentNotes);
    setSelectedProductId(null);
    setAdjustmentDelta(5);
    setAdjustmentNotes('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3 className="empty-state-title">Loading shop data...</h3>
      </div>
    );
  }

  return (
    <div>
      {/* Top Banner Toolbar */}
      <div className="toolbar-bar">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Shop Overview</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time summary of inventory, low stock warnings, and recent activity
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={resetSampleData}
            title="Reload initial demo products"
          >
            ↻ Reset Sample Data
          </button>
          <Link href="/products" className="btn btn-primary btn-sm">
            + Manage Products
          </Link>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total Products</span>
            <div className="metric-icon-box metric-icon-blue">📦</div>
          </div>
          <div className="metric-value">{metrics.totalProducts}</div>
          <div className="metric-subtext">
            <span>Distinct catalog items</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total Stock Items</span>
            <div className="metric-icon-box metric-icon-green">🔢</div>
          </div>
          <div className="metric-value">{metrics.totalStockUnits}</div>
          <div className="metric-subtext">
            <span>Total units available</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Low / Out of Stock</span>
            <div className="metric-icon-box metric-icon-amber">⚠️</div>
          </div>
          <div
            className="metric-value"
            style={{ color: metrics.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}
          >
            {metrics.lowStockCount}
          </div>
          <div className="metric-subtext">
            <span>
              {metrics.outOfStockCount > 0
                ? `${metrics.outOfStockCount} out of stock`
                : 'Items at or below min level'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Inventory Value</span>
            <div className="metric-icon-box metric-icon-purple">💰</div>
          </div>
          <div className="metric-value">{formatCurrency(metrics.totalInventoryCost)}</div>
          <div className="metric-subtext">
            <span>Potential retail: {formatCurrency(metrics.totalPotentialRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Section Grid: Low Stock Warnings & Recent Stock Activity */}
      <div className="dashboard-sections-grid">
        {/* Low Stock Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <span>⚠️</span> Low Stock Alerts ({lowStockProducts.length})
              </h3>
              <p className="card-subtitle">Products requiring urgent restocking</p>
            </div>
            <Link href="/products" className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>

          <div className="table-responsive">
            {lowStockProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h4 className="empty-state-title">All stock levels healthy</h4>
                <p className="empty-state-text">
                  No products are currently at or below their minimum stock threshold.
                </p>
              </div>
            ) : (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Min</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((p) => {
                    const status = calculateStockStatus(p.quantity, p.minStock);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                        </td>
                        <td>
                          <CategoryBadge category={p.category} />
                        </td>
                        <td>
                          <strong
                            style={{
                              color: p.quantity === 0 ? 'var(--danger)' : 'var(--warning)',
                            }}
                          >
                            {p.quantity}
                          </strong>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.minStock}</td>
                        <td>
                          <StockStatusBadge status={status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedProductId(p.id)}
                          >
                            + Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <span>🕒</span> Recent Stock Activity
              </h3>
              <p className="card-subtitle">Latest changes recorded in inventory</p>
            </div>
            <Link href="/stock-history" className="btn btn-outline btn-sm">
              Full History
            </Link>
          </div>

          <div className="table-responsive">
            {recentActivities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <h4 className="empty-state-title">No activity logged yet</h4>
                <p className="empty-state-text">
                  Stock changes will automatically appear here once products are added or updated.
                </p>
              </div>
            ) : (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Product</th>
                    <th>Change</th>
                    <th>New Qty</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatDate(entry.timestamp)}
                      </td>
                      <td>
                        <strong>{entry.productName}</strong>
                      </td>
                      <td>
                        <span
                          className={
                            entry.quantityChanged > 0
                              ? 'delta-positive'
                              : entry.quantityChanged < 0
                              ? 'delta-negative'
                              : 'delta-neutral'
                          }
                        >
                          {entry.quantityChanged > 0
                            ? `+${entry.quantityChanged}`
                            : entry.quantityChanged}
                        </span>
                      </td>
                      <td>
                        <strong>{entry.newQuantity}</strong>
                      </td>
                      <td>
                        <ReasonBadge reason={entry.reason} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {selectedProduct && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedProductId(null)}
          title={`Restock: ${selectedProduct.name}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedProductId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleQuickAdjust}
              >
                Confirm Restock
              </button>
            </>
          }
        >
          <form onSubmit={handleQuickAdjust}>
            <div style={{ marginBottom: '16px', background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Quantity:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {selectedProduct.quantity} units (Min: {selectedProduct.minStock})
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="restock-qty">
                Units to Add <span className="required">*</span>
              </label>
              <input
                id="restock-qty"
                type="number"
                min="1"
                className="form-control"
                value={adjustmentDelta}
                onChange={(e) => setAdjustmentDelta(Math.max(1, parseInt(e.target.value) || 0))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="restock-reason">
                Reason
              </label>
              <select
                id="restock-reason"
                className="form-control"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value as 'Purchase' | 'Stock Correction')}
              >
                <option value="Purchase">Purchase (New Supplier Batch)</option>
                <option value="Stock Correction">Stock Correction (Audit / Count adjustment)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="restock-notes">
                Notes (Optional)
              </label>
              <input
                id="restock-notes"
                type="text"
                className="form-control"
                placeholder="e.g. Received shipment #104"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
              Resulting Stock: <strong>{selectedProduct.quantity + adjustmentDelta}</strong> units
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
