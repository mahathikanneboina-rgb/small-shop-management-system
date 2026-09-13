'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') || 'Module';

  const descriptions: Record<string, string> = {
    Sales: 'Sales POS, invoicing, receipts, and order processing will be available in Phase 2.',
    Purchases: 'Supplier purchase orders, bulk intake, and inbound stock tracking will be available in Phase 2.',
    Customers: 'Customer ledger, contact management, and credit tracking will be available in Phase 2.',
    Suppliers: 'Vendor contacts, payment schedules, and supply catalogues will be available in Phase 2.',
    Expenses: 'Daily operational expenses, petty cash, and shop overhead tracking will be available in Phase 2.',
    Reports: 'Detailed profit & loss reports, sales trends, and tax summaries will be available in Phase 2.',
    Settings: 'Shop details, receipt customization, user roles, and database sync will be available in Phase 2.',
  };

  return (
    <div className="card placeholder-card">
      <span className="placeholder-badge">Planned for Phase 2</span>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '10px' }}>
        {feature} Module
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
        {descriptions[feature] || 'This feature is currently in development and will be released in an upcoming phase.'}
      </p>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Link href="/" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
        <Link href="/products" className="btn btn-primary">
          Manage Products
        </Link>
      </div>
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <h3 className="empty-state-title">Loading module...</h3>
        </div>
      }
    >
      <ComingSoonContent />
    </Suspense>
  );
}
