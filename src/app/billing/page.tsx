'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import {
  Product,
  Sale,
  SaleItem,
  Customer,
  CATEGORIES,
  calculateStockStatus,
} from '../../types';
import { CategoryBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

export default function BillingPage() {
  const {
    products,
    customers,
    settings,
    recordBillingSale,
    addCustomer,
    showToast,
    isOnline,
  } = useShop();
  const { profile, isDisabled } = useAuth();

  // Left Column States (Catalog & Barcode Search)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Right Column States (Cart & Payment)
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Quick Customer Creation Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [newCustomerAddress, setNewCustomerAddress] = useState<string>('');

  // Invoice / Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Focus barcode input on mount and after sales
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Filter products for catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.productCode && p.productCode.toLowerCase().includes(term));
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Handle Barcode Scanner / Rapid Code Input followed by Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    // Exact productCode match has highest priority
    const exactByCode = products.find(
      (p) => p.productCode && p.productCode.trim().toLowerCase() === query.toLowerCase()
    );

    // Exact name match or single match
    const exactByName = products.find(
      (p) => p.name.trim().toLowerCase() === query.toLowerCase()
    );

    const target = exactByCode || exactByName || (filteredProducts.length === 1 ? filteredProducts[0] : null);

    if (target) {
      if (target.quantity <= 0) {
        showToast('error', `Product "${target.name}" is out of stock.`);
      } else {
        addToCart(target);
        setSearchTerm('');
      }
    } else {
      showToast('warning', `No single product found matching "${query}".`);
    }
  };

  // Add product to cart with available stock validation
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      showToast('error', `"${product.name}" is out of stock.`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        const currentItem = prevCart[existingIndex];
        if (currentItem.quantity + 1 > product.quantity) {
          showToast('warning', `Only ${product.quantity} units available in stock for "${product.name}".`);
          return prevCart;
        }
        const updated = [...prevCart];
        const newQty = currentItem.quantity + 1;
        updated[existingIndex] = {
          ...currentItem,
          quantity: newQty,
          lineTotal: newQty * currentItem.unitPrice,
        };
        return updated;
      } else {
        const newItem: SaleItem = {
          productId: product.id,
          productName: product.name,
          productCode: product.productCode,
          quantity: 1,
          unitPrice: product.sellingPrice,
          lineTotal: product.sellingPrice,
        };
        return [...prevCart, newItem];
      }
    });
  };

  // Update item quantity in cart with live stock checking
  const updateCartQuantity = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > product.quantity) {
              showToast('warning', `Only ${product.quantity} units available in stock.`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              lineTotal: newQty * item.unitPrice,
            };
          }
          return item;
        })
        .filter(Boolean) as SaleItem[];
    });
  };

  // Remove single item from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear entire cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountAmount('');
    setAmountReceived('');
    setSaleNotes('');
  };

  // Cart financial computations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const discount = useMemo(() => {
    const val = parseFloat(discountAmount);
    if (isNaN(val) || val < 0) return 0;
    return Math.min(val, subtotal);
  }, [discountAmount, subtotal]);

  const finalTotal = Math.max(0, subtotal - discount);

  const receivedVal = parseFloat(amountReceived);
  const changeDue = useMemo(() => {
    if (paymentMethod !== 'Cash' || isNaN(receivedVal)) return 0;
    return Math.max(0, receivedVal - finalTotal);
  }, [paymentMethod, receivedVal, finalTotal]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Handle Quick Customer Creation
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      showToast('error', 'Customer name is required');
      return;
    }

    try {
      const created = addCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        address: newCustomerAddress.trim(),
        creditDue: 0,
        totalPurchases: 0,
      });

      setSelectedCustomerId(created.id);
      setIsCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      showToast('success', `Customer "${created.name}" created and selected.`);
    } catch {
      showToast('error', 'Failed to create customer');
    }
  };

  // Checkout and Confirm Sale
  const handleConfirmSale = () => {
    if (isDisabled) {
      showToast('error', 'Your staff account is disabled. Cannot create sales.');
      return;
    }

    if (cart.length === 0) {
      showToast('error', 'Your cart is empty.');
      return;
    }

    // Validate stock for each item one last time
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        showToast('error', `Product "${item.productName}" not found in catalog.`);
        return;
      }
      if (item.quantity > prod.quantity) {
        showToast('error', `Cannot complete sale. Only ${prod.quantity} units available for "${prod.name}".`);
        return;
      }
    }

    // Payment method validations
    if (paymentMethod === 'Cash') {
      if (amountReceived !== '' && !isNaN(receivedVal) && receivedVal < finalTotal) {
        showToast('error', `Amount received (${currency}${receivedVal.toFixed(2)}) is less than bill total (${currency}${finalTotal.toFixed(2)}).`);
        return;
      }
    }

    if (paymentMethod === 'Credit') {
      if (!selectedCustomerId || !selectedCustomer) {
        showToast('error', 'Please select or add a customer for credit sales.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      const sale = recordBillingSale({
        items: cart,
        paymentMethod,
        customerId: paymentMethod === 'Credit' ? selectedCustomer?.id : undefined,
        customerName: paymentMethod === 'Credit' ? selectedCustomer?.name : undefined,
        discount,
        amountReceived: paymentMethod === 'Cash' ? (isNaN(receivedVal) ? finalTotal : receivedVal) : undefined,
        notes: saleNotes.trim() || undefined,
      });

      if (sale) {
        setCompletedSale(sale);
        // Clear cart for next customer
        setCart([]);
        setDiscountAmount('');
        setAmountReceived('');
        setSaleNotes('');
        setSelectedCustomerId('');
      }
    } catch (err: any) {
      showToast('error', `Failed to record sale: ${err.message || 'Error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Invoice Action
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const currency = settings.currencySymbol || '₹';

  const formatPrice = (val: number) => `${currency}${val.toFixed(2)}`;

  return (
    <div className="billing-page-wrapper">
      {/* Top Header Bar */}
      <div className="billing-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧾</span> POS & Billing Counter
          </h2>
          <span className={`sync-badge ${isOnline ? 'badge-synced' : 'badge-pending'}`} style={{ fontSize: '0.7rem' }}>
            {isOnline ? '🟢 Live Online' : '🟠 Offline Ready'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Cashier: <strong>{profile?.name || 'Staff User'}</strong>
          </span>
        </div>
      </div>

      {/* 2-Column POS Layout */}
      <div className="billing-grid-container">
        {/* LEFT COLUMN: Product Catalog & Barcode Search */}
        <div className="billing-catalog-column card">
          {/* Search Bar & Barcode Scanner input */}
          <form onSubmit={handleBarcodeSubmit} className="pos-search-box">
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">🏷️</span>
              <input
                ref={barcodeInputRef}
                id="pos-barcode-search"
                type="text"
                className="form-control"
                placeholder="Scan barcode or search product name / code (Enter to add)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-primary" title="Add matching product">
              + Add
            </button>
          </form>

          {/* Category Filter Pills */}
          <div className="pos-category-pills">
            <button
              type="button"
              className={`pos-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ALL')}
            >
              All Items ({products.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = products.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`pos-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Product Items Grid */}
          <div className="pos-products-grid">
            {filteredProducts.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '30px' }}>
                <div className="empty-state-icon">🔍</div>
                <h4 className="empty-state-title">No products found</h4>
                <p className="empty-state-text">
                  Try searching with a different term or select another category.
                </p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isOutOfStock = p.quantity <= 0;
                const isLowStock = p.quantity > 0 && p.quantity <= p.minStock;

                // Check quantity already in cart
                const inCartItem = cart.find((item) => item.productId === p.id);
                const inCartQty = inCartItem ? inCartItem.quantity : 0;
                const remainingStock = p.quantity - inCartQty;

                return (
                  <div
                    key={p.id}
                    className={`pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                    onClick={() => {
                      if (!isOutOfStock) addToCart(p);
                    }}
                  >
                    <div className="pos-card-header">
                      <CategoryBadge category={p.category} />
                      {p.productCode && (
                        <span className="pos-code-badge">
                          {p.productCode}
                        </span>
                      )}
                    </div>

                    <h4 className="pos-product-name" title={p.name}>
                      {p.name}
                    </h4>

                    <div className="pos-card-body">
                      <div className="pos-price">{formatPrice(p.sellingPrice)}</div>

                      <div className="pos-stock-status">
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isOutOfStock
                              ? 'var(--danger)'
                              : isLowStock
                              ? 'var(--warning)'
                              : 'var(--success-text)',
                          }}
                        >
                          {isOutOfStock
                            ? '❌ Out of Stock'
                            : isLowStock
                            ? `⚠️ Low: ${p.quantity} left`
                            : `Stock: ${p.quantity}`}
                        </span>

                        {inCartQty > 0 && (
                          <span className="pos-in-cart-badge">
                            🛒 {inCartQty} in cart
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn btn-sm ${isOutOfStock ? 'btn-outline' : 'btn-secondary'}`}
                      disabled={isOutOfStock || remainingStock <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p);
                      }}
                      style={{ width: '100%', marginTop: '6px' }}
                    >
                      {isOutOfStock
                        ? 'Unavailable'
                        : remainingStock <= 0
                        ? 'Max in Cart'
                        : '+ Add to Cart'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Cart, Discounts & Checkout */}
        <div className="billing-cart-column card">
          <div className="cart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                🛒 Current Bill Cart
              </h3>
              <span className="badge-coming-soon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}>
                {cart.reduce((s, i) => s + i.quantity, 0)} Items
              </span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={clearCart}
                title="Empty Cart"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Line Items Table/List */}
          <div className="cart-items-container">
            {cart.length === 0 ? (
              <div className="empty-cart-state">
                <span style={{ fontSize: '2.5rem' }}>🛒</span>
                <p style={{ fontWeight: 600, marginTop: '8px', color: 'var(--text-secondary)' }}>
                  Cart is empty
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Scan product barcode or click on products to add items.
                </p>
              </div>
            ) : (
              <div className="cart-list">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item-row">
                    <div className="cart-item-info">
                      <div className="cart-item-title">{item.productName}</div>
                      <div className="cart-item-meta">
                        {item.productCode && <span className="cart-item-code">{item.productCode}</span>}
                        <span>{formatPrice(item.unitPrice)} each</span>
                      </div>
                    </div>

                    <div className="cart-qty-stepper">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => updateCartQuantity(item.productId, -1)}
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => updateCartQuantity(item.productId, 1)}
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <div className="cart-item-total">
                      {formatPrice(item.lineTotal)}
                    </div>

                    <button
                      type="button"
                      className="cart-item-remove"
                      onClick={() => removeFromCart(item.productId)}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Financial Breakdown & Payment Controls */}
          {cart.length > 0 && (
            <div className="cart-footer">
              {/* Subtotal */}
              <div className="cart-summary-row">
                <span>Subtotal:</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>

              {/* Discount Input */}
              <div className="cart-discount-row">
                <label htmlFor="discount-input" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Discount ({currency}):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    id="discount-input"
                    type="number"
                    min="0"
                    max={subtotal}
                    step="1"
                    className="form-control"
                    placeholder="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    style={{ width: '90px', padding: '4px 8px', textAlign: 'right', fontSize: '0.9rem' }}
                  />
                  {discount > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--success-text)', fontWeight: 600 }}>
                      -{formatPrice(discount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Final Total */}
              <div className="cart-total-box">
                <span className="cart-total-label">Grand Total</span>
                <span className="cart-total-amount">{formatPrice(finalTotal)}</span>
              </div>

              {/* Payment Method Selector */}
              <div className="cart-payment-methods">
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Payment Method:
                </label>
                <div className="payment-method-tabs">
                  <button
                    type="button"
                    className={`pay-tab ${paymentMethod === 'Cash' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('Cash')}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    className={`pay-tab ${paymentMethod === 'UPI' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('UPI')}
                  >
                    📱 UPI
                  </button>
                  <button
                    type="button"
                    className={`pay-tab ${paymentMethod === 'Credit' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('Credit')}
                  >
                    👤 Credit
                  </button>
                </div>
              </div>

              {/* CASH PAYMENT SECTION */}
              {paymentMethod === 'Cash' && (
                <div className="pay-section cash-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="amount-received" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      Amount Received ({currency}):
                    </label>
                    <input
                      id="amount-received"
                      type="number"
                      min={finalTotal}
                      step="1"
                      className="form-control"
                      placeholder={finalTotal.toString()}
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      style={{ width: '110px', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}
                    />
                  </div>

                  {/* Quick Denomination Pills */}
                  <div className="quick-denom-pills">
                    <button type="button" onClick={() => setAmountReceived(finalTotal.toString())}>
                      Exact
                    </button>
                    {[50, 100, 200, 500, 2000]
                      .filter((val) => val >= finalTotal || val === 500 || val === 2000)
                      .slice(0, 4)
                      .map((denom) => (
                        <button key={denom} type="button" onClick={() => setAmountReceived(denom.toString())}>
                          ₹{denom}
                        </button>
                      ))}
                  </div>

                  {/* Change Calculation */}
                  <div className="change-calculation-box">
                    <span>Change to Return:</span>
                    <strong style={{ fontSize: '1.05rem', color: changeDue > 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {formatPrice(changeDue)}
                    </strong>
                  </div>
                </div>
              )}

              {/* UPI PAYMENT SECTION */}
              {paymentMethod === 'UPI' && (
                <div className="pay-section upi-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📲</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Collect <strong>{formatPrice(finalTotal)}</strong> via QR / UPI App.
                    </span>
                  </div>
                </div>
              )}

              {/* CREDIT PAYMENT SECTION */}
              {paymentMethod === 'Credit' && (
                <div className="pay-section credit-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="credit-customer-select" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      Select Customer: <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setIsCustomerModalOpen(true)}
                    >
                      + New Customer
                    </button>
                  </div>

                  <select
                    id="credit-customer-select"
                    className="form-control"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} - Due: {formatPrice(c.creditDue || 0)}
                      </option>
                    ))}
                  </select>

                  {selectedCustomer && (
                    <div className="customer-due-badge">
                      <span>Current Outstanding Balance:</span>
                      <strong>{formatPrice(selectedCustomer.creditDue || 0)}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Notes */}
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Optional bill notes (e.g. customer name, token #)..."
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                />
              </div>

              {/* Complete & Confirm Sale Button */}
              <button
                type="button"
                id="btn-confirm-billing-sale"
                className="btn btn-primary btn-block checkout-submit-btn"
                disabled={isProcessing || isDisabled}
                onClick={handleConfirmSale}
              >
                {isProcessing ? 'Processing Bill...' : `Confirm Sale & Bill (${formatPrice(finalTotal)})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsCustomerModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="quick-customer-form"
              className="btn btn-primary"
            >
              Save & Select Customer
            </button>
          </>
        }
      >
        <form id="quick-customer-form" onSubmit={handleCreateCustomer}>
          <div className="form-group">
            <label className="form-label" htmlFor="cust-name">
              Customer Full Name <span className="required">*</span>
            </label>
            <input
              id="cust-name"
              type="text"
              className="form-control"
              placeholder="e.g. Ramesh Kumar"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cust-phone">
              Phone Number
            </label>
            <input
              id="cust-phone"
              type="text"
              className="form-control"
              placeholder="e.g. +91 9876543210"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cust-address">
              Address / Notes
            </label>
            <textarea
              id="cust-address"
              rows={2}
              className="form-control"
              placeholder="Shop locality or account note"
              value={newCustomerAddress}
              onChange={(e) => setNewCustomerAddress(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* PRINTABLE INVOICE / RECEIPT MODAL */}
      {completedSale && (
        <Modal
          isOpen={true}
          onClose={() => {
            setCompletedSale(null);
            barcodeInputRef.current?.focus();
          }}
          title="Tax Invoice / Receipt"
          footer={
            <div className="receipt-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCompletedSale(null);
                  barcodeInputRef.current?.focus();
                }}
              >
                + New Sale
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrint}
              >
                🖨️ Print Bill / Invoice
              </button>
            </div>
          }
        >
          {/* Printable Receipt Canvas */}
          <div id="printable-receipt" className="receipt-container">
            <div className="receipt-header">
              <h2 className="receipt-shop-name">{settings.shopName}</h2>
              {settings.shopAddress && <p className="receipt-shop-info">{settings.shopAddress}</p>}
              {settings.shopPhone && <p className="receipt-shop-info">Phone: {settings.shopPhone}</p>}
              {settings.shopEmail && <p className="receipt-shop-info">Email: {settings.shopEmail}</p>}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-meta-grid">
              <div>
                <strong>Invoice:</strong> {completedSale.invoiceNumber || completedSale.id}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Date:</strong>{' '}
                {new Date(completedSale.timestamp).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div>
                <strong>Cashier:</strong> {completedSale.userName || 'Staff'}
              </div>
              {completedSale.customerName && (
                <div style={{ textAlign: 'right' }}>
                  <strong>Customer:</strong> {completedSale.customerName}
                </div>
              )}
            </div>

            <div className="receipt-divider" />

            {/* Line Items Table */}
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
                {completedSale.items && completedSale.items.length > 0 ? (
                  completedSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'left' }}>
                        {item.productName}
                        {item.productCode && (
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                            {item.productCode}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatPrice(item.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPrice(item.lineTotal)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={{ textAlign: 'left' }}>{completedSale.productName}</td>
                    <td style={{ textAlign: 'center' }}>{completedSale.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(completedSale.unitPrice)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(completedSale.totalAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="receipt-divider" />

            {/* Financial Summary */}
            <div className="receipt-totals">
              {completedSale.subtotal !== undefined && completedSale.discount !== undefined && completedSale.discount > 0 && (
                <>
                  <div className="receipt-total-row">
                    <span>Subtotal:</span>
                    <span>{formatPrice(completedSale.subtotal)}</span>
                  </div>
                  <div className="receipt-total-row">
                    <span>Discount:</span>
                    <span>-{formatPrice(completedSale.discount)}</span>
                  </div>
                </>
              )}

              <div className="receipt-total-row grand-total">
                <span>Grand Total:</span>
                <span>{formatPrice(completedSale.totalAmount)}</span>
              </div>

              <div className="receipt-total-row" style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                <span>Payment Mode:</span>
                <span>{completedSale.paymentMethod}</span>
              </div>

              {completedSale.paymentMethod === 'Cash' && completedSale.amountReceived !== undefined && (
                <>
                  <div className="receipt-total-row" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    <span>Amount Received:</span>
                    <span>{formatPrice(completedSale.amountReceived)}</span>
                  </div>
                  {completedSale.changeAmount !== undefined && completedSale.changeAmount > 0 && (
                    <div className="receipt-total-row" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      <span>Change Returned:</span>
                      <span>{formatPrice(completedSale.changeAmount)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-footer">
              <p>Thank you for shopping with us!</p>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                Please visit again.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
