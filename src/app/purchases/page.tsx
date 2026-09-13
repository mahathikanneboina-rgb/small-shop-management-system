'use client';
import React from 'react';
import { useShop } from '../../context/ShopContext';
import { TransactionForm } from '../../components/common/TransactionForm';
import { TransactionTable } from '../../components/common/TransactionTable';

export default function PurchasesPage() {
  const { purchases } = useShop();

  return (
    <div className="page-container">
      <h2 className="page-title">Purchases</h2>
      <TransactionForm mode="purchase" />
      <h3>Recent Purchases</h3>
      <TransactionTable mode="purchase" transactions={purchases} />
    </div>
  );
}
