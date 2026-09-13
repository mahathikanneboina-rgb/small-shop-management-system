import React from 'react';
import { useShop } from '../../context/ShopContext';
import { TransactionForm } from '../../components/common/TransactionForm';
import { TransactionTable } from '../../components/common/TransactionTable';

export default function SalesPage() {
  const { sales } = useShop();

  return (
    <div className="page-container">
      <h2 className="page-title">Sales</h2>
      <TransactionForm mode="sale" />
      <h3>Recent Sales</h3>
      <TransactionTable mode="sale" transactions={sales} />
    </div>
  );
}
