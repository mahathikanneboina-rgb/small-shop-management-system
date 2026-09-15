'use client';
import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';

interface TransactionFormProps {
  mode: 'sale' | 'purchase';
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ mode }) => {
  const { products, recordSale, recordPurchase, showToast } = useShop();
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [supplierName, setSupplierName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [productId, products]
  );
  const unitPrice =
    mode === 'sale'
      ? selectedProduct?.sellingPrice ?? 0
      : selectedProduct?.purchasePrice ?? 0;
  const totalAmount = unitPrice * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission

    if (!selectedProduct) {
      showToast('error', 'Please select a product');
      return;
    }
    if (quantity <= 0) {
      showToast('error', 'Quantity must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'sale') {
        const ok = recordSale(productId, quantity, paymentMethod, notes);
        if (ok) resetForm();
      } else {
        if (!supplierName.trim()) {
          showToast('error', 'Supplier name is required');
          return;
        }
        const ok = recordPurchase(productId, quantity, supplierName, notes);
        if (ok) resetForm();
      }
    } finally {
      // Release lock after small delay to avoid rapid double-click bounce
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  const resetForm = () => {
    setProductId('');
    setQuantity(1);
    setPaymentMethod('Cash');
    setSupplierName('');
    setNotes('');
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="product">Product</label>
        <select
          id="product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          disabled={isSubmitting}
        >
          <option value="" disabled>
            -- Select Product --
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stock: {p.quantity})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          required
          disabled={isSubmitting}
        />
      </div>

      {mode === 'sale' && (
        <div className="form-group">
          <label htmlFor="paymentMethod">Payment Method</label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            disabled={isSubmitting}
          >
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Credit">Credit</option>
          </select>
        </div>
      )}

      {mode === 'purchase' && (
        <div className="form-group">
          <label htmlFor="supplierName">Supplier Name</label>
          <input
            id="supplierName"
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="form-summary">
        <p>
          Unit Price: <strong>{unitPrice.toFixed(2)}</strong>
        </p>
        <p>
          Total Amount: <strong>{totalAmount.toFixed(2)}</strong>
        </p>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting || products.length === 0}
      >
        {isSubmitting
          ? 'Processing...'
          : mode === 'sale'
          ? 'Confirm Sale'
          : 'Confirm Purchase'}
      </button>
    </form>
  );
};
