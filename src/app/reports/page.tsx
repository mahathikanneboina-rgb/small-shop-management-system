'use client';

import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';
import { calculateStockStatus } from '../../types';
import { CategoryBadge } from '../../components/common/Badge';

type DateRangeFilter = 'today' | '7days' | 'month' | 'all';

export default function ReportsPage() {
  const { products, sales, purchases, expenses, customers, settings } = useShop();

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const currency = settings.currencySymbol || '₹';
  const formatCurrency = (val: number) => `${currency}${val.toFixed(2)}`;

  // Filter items based on chosen date range
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: start.getTime(), end: Date.now() };
    }
    if (dateFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { start: start.getTime(), end: Date.now() };
    }
    if (dateFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.getTime(), end: Date.now() };
    }
    if (customStart || customEnd) {
      const start = customStart ? new Date(customStart).getTime() : 0;
      const end = customEnd ? new Date(customEnd).getTime() + 86400000 : Infinity;
      return { start, end };
    }
    return { start: 0, end: Infinity };
  }, [dateFilter, customStart, customEnd]);

  // Active (non-cancelled) filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isCancelled) return false;
      const t = new Date(s.timestamp || s.createdAt || 0).getTime();
      return t >= dateRangeBounds.start && t <= dateRangeBounds.end;
    });
  }, [sales, dateRangeBounds]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const t = new Date(p.timestamp || p.createdAt || 0).getTime();
      return t >= dateRangeBounds.start && t <= dateRangeBounds.end;
    });
  }, [purchases, dateRangeBounds]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const t = new Date(e.date || e.createdAt || 0).getTime();
      return t >= dateRangeBounds.start && t <= dateRangeBounds.end;
    });
  }, [expenses, dateRangeBounds]);

  // Aggregate Metrics
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredSales]);

  const totalPurchasesCost = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  }, [filteredPurchases]);

  const totalExpensesCost = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const totalDiscountsGiven = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0);
  }, [filteredSales]);

  const totalBillsCount = filteredSales.length;

  const averageBillValue = totalBillsCount > 0 ? totalSalesRevenue / totalBillsCount : 0;

  // Breakdown by Payment Method
  const paymentBreakdown = useMemo(() => {
    let cashTotal = 0;
    let cashCount = 0;
    let upiTotal = 0;
    let upiCount = 0;
    let creditTotal = 0;
    let creditCount = 0;

    filteredSales.forEach((s) => {
      if (s.paymentMethod === 'Cash') {
        cashTotal += s.totalAmount;
        cashCount++;
      } else if (s.paymentMethod === 'UPI') {
        upiTotal += s.totalAmount;
        upiCount++;
      } else if (s.paymentMethod === 'Credit') {
        creditTotal += s.totalAmount;
        creditCount++;
      }
    });

    return {
      cash: { total: cashTotal, count: cashCount },
      upi: { total: upiTotal, count: upiCount },
      credit: { total: creditTotal, count: creditCount },
    };
  }, [filteredSales]);

  // Top-selling products
  const topProducts = useMemo(() => {
    const productStats = new Map<string, { name: string; quantity: number; revenue: number; category?: string }>();

    filteredSales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId);
          const current = productStats.get(item.productName) || {
            name: item.productName,
            quantity: 0,
            revenue: 0,
            category: prod?.category,
          };
          current.quantity += item.quantity;
          current.revenue += item.lineTotal;
          productStats.set(item.productName, current);
        });
      } else if (sale.productId && sale.productId !== 'MULTIPLE') {
        const prod = products.find((p) => p.id === sale.productId);
        const current = productStats.get(sale.productName) || {
          name: sale.productName,
          quantity: 0,
          revenue: 0,
          category: prod?.category,
        };
        current.quantity += sale.quantity;
        current.revenue += sale.totalAmount;
        productStats.set(sale.productName, current);
      }
    });

    return Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredSales, products]);

  // Low stock and restock list
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.quantity <= p.minStock);
  }, [products]);

  // Customer Credit Outstanding
  const customerCreditSummary = useMemo(() => {
    const withCredit = customers.filter((c) => (c.creditDue || 0) > 0);
    const totalOutstanding = withCredit.reduce((sum, c) => sum + (c.creditDue || 0), 0);
    return { list: withCredit, totalOutstanding };
  }, [customers]);

  // Approximate Estimated Gross Profit = (Sales Revenue - Cost of Goods Sold - Operational Expenses)
  const estimatedProfit = useMemo(() => {
    let estimatedCOGS = 0;
    filteredSales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId);
          const unitCost = prod ? prod.purchasePrice : item.unitPrice * 0.7;
          estimatedCOGS += unitCost * item.quantity;
        });
      } else {
        const prod = products.find((p) => p.id === sale.productId);
        const unitCost = prod ? prod.purchasePrice : sale.unitPrice * 0.7;
        estimatedCOGS += unitCost * sale.quantity;
      }
    });
    return totalSalesRevenue - estimatedCOGS - totalExpensesCost;
  }, [filteredSales, products, totalSalesRevenue, totalExpensesCost]);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-heading">📊 Business Reports & Analytics</h2>
          <p className="page-subheading">
            Comprehensive overview of sales, payment channels, profit estimates, and inventory health.
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="report-date-filters">
          <button
            type="button"
            className={`btn btn-sm ${dateFilter === 'today' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateFilter('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`btn btn-sm ${dateFilter === '7days' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateFilter('7days')}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`btn btn-sm ${dateFilter === 'month' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateFilter('month')}
          >
            This Month
          </button>
          <button
            type="button"
            className={`btn btn-sm ${dateFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateFilter('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total Sales Revenue</span>
            <div className="metric-icon-box metric-icon-blue">🛒</div>
          </div>
          <div className="metric-value">{formatCurrency(totalSalesRevenue)}</div>
          <div className="metric-subtext">
            <span>{totalBillsCount} bill{totalBillsCount === 1 ? '' : 's'} recorded</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Estimated Profit</span>
            <div className="metric-icon-box metric-icon-green">📈</div>
          </div>
          <div
            className="metric-value"
            style={{ color: estimatedProfit >= 0 ? 'var(--success-text)' : 'var(--danger)' }}
          >
            {formatCurrency(estimatedProfit)}
          </div>
          <div className="metric-subtext">
            <span>After COGS & expenses</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Average Bill Value</span>
            <div className="metric-icon-box metric-icon-purple">🧾</div>
          </div>
          <div className="metric-value">{formatCurrency(averageBillValue)}</div>
          <div className="metric-subtext">
            <span>Per customer invoice</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total Discounts Given</span>
            <div className="metric-icon-box metric-icon-amber">🏷️</div>
          </div>
          <div className="metric-value">{formatCurrency(totalDiscountsGiven)}</div>
          <div className="metric-subtext">
            <span>Customer savings</span>
          </div>
        </div>
      </div>

      {/* Payment Channel Breakdown Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <span>💳</span> Sales by Payment Method
            </h3>
            <p className="card-subtitle">Breakdown of store revenue collection channels</p>
          </div>
        </div>

        <div className="payment-breakdown-grid">
          {/* Cash */}
          <div className="pay-breakdown-card">
            <div className="pay-channel-header">
              <span className="pay-channel-icon">💵</span>
              <div>
                <h4>Cash Sales</h4>
                <span className="pay-channel-count">{paymentBreakdown.cash.count} transactions</span>
              </div>
            </div>
            <div className="pay-channel-amount">{formatCurrency(paymentBreakdown.cash.total)}</div>
            <div className="pay-channel-bar-wrap">
              <div
                className="pay-channel-bar cash-bar"
                style={{
                  width: `${totalSalesRevenue > 0 ? (paymentBreakdown.cash.total / totalSalesRevenue) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* UPI */}
          <div className="pay-breakdown-card">
            <div className="pay-channel-header">
              <span className="pay-channel-icon">📱</span>
              <div>
                <h4>UPI / QR Sales</h4>
                <span className="pay-channel-count">{paymentBreakdown.upi.count} transactions</span>
              </div>
            </div>
            <div className="pay-channel-amount">{formatCurrency(paymentBreakdown.upi.total)}</div>
            <div className="pay-channel-bar-wrap">
              <div
                className="pay-channel-bar upi-bar"
                style={{
                  width: `${totalSalesRevenue > 0 ? (paymentBreakdown.upi.total / totalSalesRevenue) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Credit */}
          <div className="pay-breakdown-card">
            <div className="pay-channel-header">
              <span className="pay-channel-icon">👤</span>
              <div>
                <h4>Credit (Khata) Sales</h4>
                <span className="pay-channel-count">{paymentBreakdown.credit.count} transactions</span>
              </div>
            </div>
            <div className="pay-channel-amount">{formatCurrency(paymentBreakdown.credit.total)}</div>
            <div className="pay-channel-bar-wrap">
              <div
                className="pay-channel-bar credit-bar"
                style={{
                  width: `${totalSalesRevenue > 0 ? (paymentBreakdown.credit.total / totalSalesRevenue) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Top Products & Customer Outstanding / Low Stock */}
      <div className="dashboard-sections-grid">
        {/* Top-Selling Products */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <span>🔥</span> Top-Selling Products
              </h3>
              <p className="card-subtitle">Highest revenue generating inventory items</p>
            </div>
          </div>

          <div className="table-responsive">
            {topProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🛍️</div>
                <h4 className="empty-state-title">No sales data in this period</h4>
                <p className="empty-state-text">
                  Complete billing sales to see product performance rankings.
                </p>
              </div>
            ) : (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        {item.category ? <CategoryBadge category={item.category as any} /> : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-coming-soon" style={{ background: '#f1f5f9', color: '#334155' }}>
                          {item.quantity}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{formatCurrency(item.revenue)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Customer Credit & Low Stock Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Customer Credit Dues Box */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <span>👥</span> Customer Credit Ledger
                </h3>
                <p className="card-subtitle">
                  Total Outstanding: <strong>{formatCurrency(customerCreditSummary.totalOutstanding)}</strong>
                </p>
              </div>
            </div>

            <div className="table-responsive">
              {customerCreditSummary.list.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>✅ No outstanding customer dues.</p>
                </div>
              ) : (
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th style={{ textAlign: 'right' }}>Due Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerCreditSummary.list.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {c.phone || '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                          {formatCurrency(c.creditDue || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Low Stock Watchlist */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <span>⚠️</span> Restock Required ({lowStockProducts.length})
                </h3>
                <p className="card-subtitle">Items at or below minimum threshold</p>
              </div>
            </div>

            <div className="table-responsive">
              {lowStockProducts.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>✅ All products have healthy stock.</p>
                </div>
              ) : (
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Min</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.slice(0, 5).map((p) => {
                      const status = calculateStockStatus(p.quantity, p.minStock);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td style={{ fontWeight: 700, color: p.quantity === 0 ? '#dc2626' : '#d97706' }}>
                            {p.quantity}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{p.minStock}</td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                backgroundColor: p.quantity === 0 ? '#fee2e2' : '#fef3c7',
                                color: p.quantity === 0 ? '#991b1b' : '#92400e',
                              }}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
