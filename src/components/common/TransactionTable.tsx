'use client';

import React, { useState } from 'react';
import { Sale, Purchase } from '../../types';
import { useShop } from '../../context/ShopContext';
import { Modal } from './Modal';

interface TransactionTableProps {
  mode: 'sale' | 'purchase';
  transactions: Sale[] | Purchase[];
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ mode, transactions }) => {
  const { settings, cancelSale } = useShop();

  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [selectedSaleForCancel, setSelectedSaleForCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const currency = settings.currencySymbol || '₹';
  const formatCurrency = (value: number) => `${currency}${value.toFixed(2)}`;

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

  const handleConfirmCancel = () => {
    if (!selectedSaleForCancel) return;
    setIsCancelling(true);
    try {
      cancelSale(selectedSaleForCancel.id, cancelReason.trim() || 'Cancelled by store staff');
      setSelectedSaleForCancel(null);
      setCancelReason('');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="transaction-table-wrapper card" style={{ padding: '0', overflow: 'hidden' }}>
      <div className="table-responsive">
        <table className="app-table">
          <thead>
            <tr>
              <th>Time</th>
              {mode === 'sale' && <th>Invoice #</th>}
              <th>{mode === 'sale' ? 'Product / Items' : 'Product'}</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              {mode === 'sale' ? <th>Payment</th> : <th>Supplier</th>}
              <th>Notes</th>
              {mode === 'sale' && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const isSale = mode === 'sale';
              const sale = isSale ? (t as Sale) : null;
              const isCancelled = sale?.isCancelled;

              return (
                <tr
                  key={t.id}
                  style={{
                    backgroundColor: isCancelled ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    opacity: isCancelled ? 0.75 : 1,
                  }}
                >
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {formatDate(t.timestamp)}
                  </td>

                  {isSale && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                          {sale?.invoiceNumber || sale?.id}
                        </strong>
                        {isCancelled && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#dc2626',
                              backgroundColor: '#fee2e2',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              width: 'fit-content',
                            }}
                          >
                            ⛔ Cancelled
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong
                        style={{
                          textDecoration: isCancelled ? 'line-through' : 'none',
                        }}
                      >
                        {t.productName}
                      </strong>
                      {isSale && sale?.items && sale.items.length > 1 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {sale.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>{t.quantity}</td>
                  <td>{formatCurrency(t.unitPrice)}</td>
                  <td>
                    <strong
                      style={{
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        color: isCancelled ? 'var(--text-muted)' : 'inherit',
                      }}
                    >
                      {formatCurrency(t.totalAmount)}
                    </strong>
                  </td>

                  {isSale ? (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {sale?.paymentMethod}
                        </span>
                        {sale?.customerName && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Cust: {sale.customerName}
                          </span>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td>{(t as Purchase).supplierName}</td>
                  )}

                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {t.notes ?? ''}
                  </td>

                  {isSale && (
                    <td>
                      <div
                        className="table-actions-group"
                        style={{ justifyContent: 'flex-end', gap: '6px' }}
                      >
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          title="View / Print Invoice"
                        >
                          🖨️ Bill
                        </button>
                        {!isCancelled && (
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-xs"
                            onClick={() => setSelectedSaleForCancel(sale)}
                            title="Cancel / Reverse Sale"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {transactions.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No {mode === 'sale' ? 'sales' : 'purchases'} recorded yet.</p>
          </div>
        )}
      </div>

      {/* CANCELLATION CONFIRMATION MODAL */}
      {selectedSaleForCancel && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSaleForCancel(null)}
          title="Confirm Sale Reversal / Cancellation"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedSaleForCancel(null)}
                disabled={isCancelling}
              >
                Go Back
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? 'Reversing...' : 'Confirm Sale Cancellation'}
              </button>
            </>
          }
        >
          <div style={{ lineHeight: 1.6 }}>
            <p>
              Are you sure you want to cancel Invoice{' '}
              <strong>{selectedSaleForCancel.invoiceNumber || selectedSaleForCancel.id}</strong>?
            </p>

            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                padding: '12px 14px',
                borderRadius: '6px',
                margin: '12px 0',
                fontSize: '0.85rem',
                color: 'var(--danger-text)',
              }}
            >
              <strong>Safety Actions performed upon cancellation:</strong>
              <ul style={{ marginLeft: '18px', marginTop: '4px' }}>
                <li>Stock for all items in this bill will be returned to inventory.</li>
                <li>Stock History reversal entry will be permanently logged.</li>
                <li>Customer credit balance will be reversed (if credit sale).</li>
                <li>Transaction will be marked as cancelled in audit logs.</li>
              </ul>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label" htmlFor="cancel-reason">
                Reason for Cancellation (Optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                className="form-control"
                placeholder="e.g. Customer returned items, billing error"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW / REPRINT INVOICE MODAL */}
      {selectedSaleForReceipt && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSaleForReceipt(null)}
          title="Tax Invoice / Receipt"
          footer={
            <div className="receipt-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedSaleForReceipt(null)}
              >
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Bill
              </button>
            </div>
          }
        >
          <div className="receipt-container">
            <div className="receipt-header">
              <h2 className="receipt-shop-name">{settings.shopName}</h2>
              {settings.shopAddress && <p className="receipt-shop-info">{settings.shopAddress}</p>}
              {settings.shopPhone && <p className="receipt-shop-info">Phone: {settings.shopPhone}</p>}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-meta-grid">
              <div>
                <strong>Invoice:</strong>{' '}
                {selectedSaleForReceipt.invoiceNumber || selectedSaleForReceipt.id}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Date:</strong> {formatDate(selectedSaleForReceipt.timestamp)}
              </div>
              <div>
                <strong>Cashier:</strong> {selectedSaleForReceipt.userName || 'Staff'}
              </div>
              {selectedSaleForReceipt.customerName && (
                <div style={{ textAlign: 'right' }}>
                  <strong>Customer:</strong> {selectedSaleForReceipt.customerName}
                </div>
              )}
            </div>

            <div className="receipt-divider" />

            <table className="receipt-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedSaleForReceipt.items && selectedSaleForReceipt.items.length > 0 ? (
                  selectedSaleForReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'left' }}>{item.productName}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={{ textAlign: 'left' }}>{selectedSaleForReceipt.productName}</td>
                    <td style={{ textAlign: 'center' }}>{selectedSaleForReceipt.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(selectedSaleForReceipt.unitPrice)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(selectedSaleForReceipt.totalAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="receipt-divider" />

            <div className="receipt-totals">
              {selectedSaleForReceipt.subtotal !== undefined &&
                selectedSaleForReceipt.discount !== undefined &&
                selectedSaleForReceipt.discount > 0 && (
                  <>
                    <div className="receipt-total-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedSaleForReceipt.subtotal)}</span>
                    </div>
                    <div className="receipt-total-row">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedSaleForReceipt.discount)}</span>
                    </div>
                  </>
                )}

              <div className="receipt-total-row grand-total">
                <span>Grand Total:</span>
                <span>{formatCurrency(selectedSaleForReceipt.totalAmount)}</span>
              </div>

              <div className="receipt-total-row" style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                <span>Payment Mode:</span>
                <span>{selectedSaleForReceipt.paymentMethod}</span>
              </div>

              {selectedSaleForReceipt.isCancelled && (
                <div
                  className="receipt-total-row"
                  style={{
                    color: '#dc2626',
                    fontWeight: 700,
                    marginTop: '6px',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  *** CANCELLED / REVERSED SALE ***
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
