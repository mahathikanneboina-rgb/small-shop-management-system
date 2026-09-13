import React from 'react';
import { Sale, Purchase } from '../../types';

interface TransactionTableProps {
  mode: 'sale' | 'purchase';
  transactions: Sale[] | Purchase[];
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ mode, transactions }) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="transaction-table-wrapper">
      <table className="app-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
            {mode === 'sale' ? <th>Payment</th> : <th>Supplier</th>}
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(t.timestamp)}</td>
              <td><strong>{t.productName}</strong></td>
              <td>{t.quantity}</td>
              <td>{formatCurrency(t.unitPrice)}</td>
              <td>{formatCurrency(t.totalAmount)}</td>
              {mode === 'sale' ? (
                <td>{(t as Sale).paymentMethod}</td>
              ) : (
                <td>{(t as Purchase).supplierName}</td>
              )}
              <td>{t.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <div className="empty-state">
          <p>No {mode === 'sale' ? 'sales' : 'purchases'} recorded yet.</p>
        </div>
      )}
    </div>
  );
};
