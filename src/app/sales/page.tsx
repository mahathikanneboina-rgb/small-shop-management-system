'use client';

import React from 'react';
import Link from 'next/link';
import { useShop } from '../../context/ShopContext';
import { TransactionForm } from '../../components/common/TransactionForm';
import { TransactionTable } from '../../components/common/TransactionTable';

export default function SalesPage() {
  const { sales } = useShop();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">🛒 Sales & Invoicing</h2>
          <p className="page-subheading">
            Review sales transactions, issue single sales, or launch the fast counter POS billing system.
          </p>
        </div>
        <Link href="/billing" className="btn btn-primary" style={{ fontWeight: 700 }}>
          🧾 Open POS Billing Counter
        </Link>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '10px' }}>
          Quick Single-Item Sale
        </h3>
        <TransactionForm mode="sale" />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Transaction History & Issued Bills ({sales.length})
          </h3>
        </div>
        <TransactionTable mode="sale" transactions={sales} />
      </div>
    </div>
  );
}
