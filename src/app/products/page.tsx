'use client';

import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';
import {
  Product,
  ProductCategory,
  CATEGORIES,
  calculateStockStatus,
  StockStatus,
  StockChangeReason,
} from '../../types';
import { StockStatusBadge, CategoryBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

interface ProductFormData {
  name: string;
  category: ProductCategory;
  productCode: string;
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  minStock: string;
}

const INITIAL_FORM_DATA: ProductFormData = {
  name: '',
  category: 'Grocery',
  productCode: '',
  purchasePrice: '',
  sellingPrice: '',
  quantity: '',
  minStock: '5',
};

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct, adjustStock, isLoading } = useShop();

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Quick Adjustment Form state
  const [adjustDelta, setAdjustDelta] = useState<string>('1');
  const [adjustReason, setAdjustReason] = useState<StockChangeReason>('Sale');
  const [adjustType, setAdjustType] = useState<'decrease' | 'increase'>('decrease');

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      // Search filter matches name or productCode
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.productCode && p.productCode.toLowerCase().includes(term));

      // Category filter
      const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

      // Status filter
      const status = calculateStockStatus(p.quantity, p.minStock);
      const matchesStatus =
        statusFilter === 'ALL' ||
        status === statusFilter ||
        (statusFilter === 'Needs Restock' && p.quantity <= p.minStock);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  // Validation logic
  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    // Product code uniqueness validation
    const code = formData.productCode.trim();
    if (code) {
      const duplicate = products.find(
        (p) =>
          (!isEdit || p.id !== editingProduct?.id) &&
          p.productCode &&
          p.productCode.trim().toLowerCase() === code.toLowerCase()
      );
      if (duplicate) {
        errors.productCode = `Product code "${code}" is already used by "${duplicate.name}".`;
      }
    }

    const pPrice = parseFloat(formData.purchasePrice);
    if (formData.purchasePrice === '' || isNaN(pPrice) || pPrice < 0) {
      errors.purchasePrice = 'Purchase price must be a non-negative number';
    }

    const sPrice = parseFloat(formData.sellingPrice);
    if (formData.sellingPrice === '' || isNaN(sPrice) || sPrice < 0) {
      errors.sellingPrice = 'Selling price must be a non-negative number';
    }

    const qty = parseInt(formData.quantity, 10);
    if (formData.quantity === '' || isNaN(qty) || qty < 0) {
      errors.quantity = 'Quantity must be a non-negative integer';
    }

    const min = parseInt(formData.minStock, 10);
    if (formData.minStock === '' || isNaN(min) || min < 0) {
      errors.minStock = 'Minimum stock must be a non-negative integer';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAdd = () => {
    setFormData(INITIAL_FORM_DATA);
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setFormData({
      name: product.name,
      category: product.category,
      productCode: product.productCode || '',
      purchasePrice: product.purchasePrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      quantity: product.quantity.toString(),
      minStock: product.minStock.toString(),
    });
    setFormErrors({});
    setEditingProduct(product);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    addProduct({
      name: formData.name.trim(),
      category: formData.category,
      productCode: formData.productCode.trim() || undefined,
      purchasePrice: parseFloat(formData.purchasePrice),
      sellingPrice: parseFloat(formData.sellingPrice),
      quantity: parseInt(formData.quantity, 10),
      minStock: parseInt(formData.minStock, 10),
    });

    setIsAddModalOpen(false);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!validateForm(true)) return;

    updateProduct(
      editingProduct.id,
      {
        name: formData.name.trim(),
        category: formData.category,
        productCode: formData.productCode.trim() || undefined,
        purchasePrice: parseFloat(formData.purchasePrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        quantity: parseInt(formData.quantity, 10),
        minStock: parseInt(formData.minStock, 10),
      },
      'Stock Correction'
    );

    setEditingProduct(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingProduct) return;
    deleteProduct(deletingProduct.id);
    setDeletingProduct(null);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const amount = parseInt(adjustDelta, 10);
    if (isNaN(amount) || amount <= 0) return;

    const delta = adjustType === 'decrease' ? -amount : amount;
    const success = adjustStock(adjustingProduct.id, delta, adjustReason);

    if (success) {
      setAdjustingProduct(null);
      setAdjustDelta('1');
    }
  };

  const formatPrice = (val: number) => `$${val.toFixed(2)}`;

  const isSellingPriceLower =
    formData.sellingPrice !== '' &&
    formData.purchasePrice !== '' &&
    parseFloat(formData.sellingPrice) < parseFloat(formData.purchasePrice);

  return (
    <div>
      {/* Header Toolbar */}
      <div className="toolbar-bar">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Products Inventory</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage shop catalog, pricing, and live inventory thresholds
          </p>
        </div>
        <button
          type="button"
          id="btn-add-product"
          className="btn btn-primary"
          onClick={handleOpenAdd}
        >
          <span>+</span> Add Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div className="search-input-wrapper" style={{ minWidth: '280px' }}>
            <span className="search-icon">🔍</span>
            <input
              id="search-product-name"
              type="text"
              className="form-control"
              placeholder="Search by name or product code / barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              id="filter-category"
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '170px' }}>
            <select
              id="filter-status"
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Needs Restock">Needs Restock (&le; Min)</option>
            </select>
          </div>

          {(searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
              }}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredProducts.length}</strong> of {products.length} products
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="table-responsive">
          {isLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3 className="empty-state-title">Loading inventory...</h3>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <h3 className="empty-state-title">No products found</h3>
              <p className="empty-state-text">
                {products.length === 0
                  ? 'Your inventory is currently empty. Click "Add Product" to get started.'
                  : 'No products matched your search and filter criteria.'}
              </p>
              {products.length === 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenAdd}
                >
                  + Add First Product
                </button>
              )}
            </div>
          ) : (
            <table className="app-table" id="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>Quantity</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const status = calculateStockStatus(p.quantity, p.minStock);
                  const needsRestock = p.quantity <= p.minStock;
                  return (
                    <tr key={p.id} id={`product-row-${p.id}`}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '0.92rem' }}>{p.name}</strong>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {p.productCode ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'var(--border-subtle)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                🏷️ {p.productCode}
                              </span>
                            ) : null}
                            {needsRestock && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  color: '#dc2626',
                                  backgroundColor: '#fee2e2',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                }}
                              >
                                Needs Restock
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <CategoryBadge category={p.category} />
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatPrice(p.purchasePrice)}
                      </td>
                      <td>
                        <strong>{formatPrice(p.sellingPrice)}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color:
                              p.quantity === 0
                                ? 'var(--danger)'
                                : p.quantity <= p.minStock
                                ? 'var(--warning)'
                                : 'inherit',
                          }}
                        >
                          {p.quantity}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.minStock}</td>
                      <td>
                        <StockStatusBadge status={status} />
                      </td>
                      <td>
                        <div
                          className="table-actions-group"
                          style={{ justifyContent: 'flex-end' }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Quick Stock Change"
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustDelta('1');
                              setAdjustReason('Sale');
                              setAdjustType('decrease');
                            }}
                          >
                            +/- Stock
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            title="Edit Product Details"
                            onClick={() => handleOpenEdit(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-sm"
                            title="Delete Product"
                            onClick={() => setDeletingProduct(p)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Product"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-product-form"
              id="submit-add-product"
              className="btn btn-primary"
            >
              Add Product
            </button>
          </>
        }
      >
        <form id="add-product-form" onSubmit={handleAddSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="add-name">
              Product Name <span className="required">*</span>
            </label>
            <input
              id="add-name"
              type="text"
              className={`form-control ${formErrors.name ? 'error' : ''}`}
              placeholder="e.g. Wireless Mouse"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
            {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-product-code">
              Product Code / Barcode (Optional)
            </label>
            <input
              id="add-product-code"
              type="text"
              className={`form-control ${formErrors.productCode ? 'error' : ''}`}
              placeholder="e.g. 890123456789 or ITEM-101"
              value={formData.productCode}
              onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
            />
            {formErrors.productCode && (
              <span className="form-error-msg">{formErrors.productCode}</span>
            )}
            <span className="form-hint">
              Used for rapid barcode scanner lookup and instant billing search.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-category">
              Category <span className="required">*</span>
            </label>
            <select
              id="add-category"
              className="form-control"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as ProductCategory })
              }
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="add-purchase-price">
                Purchase Price ($) <span className="required">*</span>
              </label>
              <input
                id="add-purchase-price"
                type="number"
                step="0.01"
                min="0"
                className={`form-control ${formErrors.purchasePrice ? 'error' : ''}`}
                placeholder="0.00"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
              />
              {formErrors.purchasePrice && (
                <span className="form-error-msg">{formErrors.purchasePrice}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-selling-price">
                Selling Price ($) <span className="required">*</span>
              </label>
              <input
                id="add-selling-price"
                type="number"
                step="0.01"
                min="0"
                className={`form-control ${formErrors.sellingPrice ? 'error' : ''}`}
                placeholder="0.00"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
              />
              {formErrors.sellingPrice && (
                <span className="form-error-msg">{formErrors.sellingPrice}</span>
              )}
            </div>
          </div>

          {/* Non-blocking selling price warning */}
          {isSellingPriceLower && (
            <div className="form-warning-box">
              <span>⚠️</span>
              <div>
                <strong>Warning:</strong> Selling price ($
                {parseFloat(formData.sellingPrice).toFixed(2)}) is lower than purchase price ($
                {parseFloat(formData.purchasePrice).toFixed(2)}). This will result in a loss on sale.
              </div>
            </div>
          )}

          <div className="form-grid-2" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="add-quantity">
                Initial Quantity <span className="required">*</span>
              </label>
              <input
                id="add-quantity"
                type="number"
                min="0"
                className={`form-control ${formErrors.quantity ? 'error' : ''}`}
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
              {formErrors.quantity && (
                <span className="form-error-msg">{formErrors.quantity}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-min-stock">
                Minimum Stock Level <span className="required">*</span>
              </label>
              <input
                id="add-min-stock"
                type="number"
                min="0"
                className={`form-control ${formErrors.minStock ? 'error' : ''}`}
                placeholder="5"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
              />
              {formErrors.minStock && (
                <span className="form-error-msg">{formErrors.minStock}</span>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {editingProduct && (
        <Modal
          isOpen={true}
          onClose={() => setEditingProduct(null)}
          title={`Edit Product: ${editingProduct.name}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-product-form"
                id="submit-edit-product"
                className="btn btn-primary"
              >
                Save Changes
              </button>
            </>
          }
        >
          <form id="edit-product-form" onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-name">
                Product Name <span className="required">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                className={`form-control ${formErrors.name ? 'error' : ''}`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-product-code">
                Product Code / Barcode (Optional)
              </label>
              <input
                id="edit-product-code"
                type="text"
                className={`form-control ${formErrors.productCode ? 'error' : ''}`}
                placeholder="e.g. 890123456789 or ITEM-101"
                value={formData.productCode}
                onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
              />
              {formErrors.productCode && (
                <span className="form-error-msg">{formErrors.productCode}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-category">
                Category <span className="required">*</span>
              </label>
              <select
                id="edit-category"
                className="form-control"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as ProductCategory })
                }
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-purchase-price">
                  Purchase Price ($) <span className="required">*</span>
                </label>
                <input
                  id="edit-purchase-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${formErrors.purchasePrice ? 'error' : ''}`}
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                />
                {formErrors.purchasePrice && (
                  <span className="form-error-msg">{formErrors.purchasePrice}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-selling-price">
                  Selling Price ($) <span className="required">*</span>
                </label>
                <input
                  id="edit-selling-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${formErrors.sellingPrice ? 'error' : ''}`}
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                />
                {formErrors.sellingPrice && (
                  <span className="form-error-msg">{formErrors.sellingPrice}</span>
                )}
              </div>
            </div>

            {isSellingPriceLower && (
              <div className="form-warning-box">
                <span>⚠️</span>
                <div>
                  <strong>Warning:</strong> Selling price is lower than purchase price.
                </div>
              </div>
            )}

            <div className="form-grid-2" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-quantity">
                  Stock Quantity <span className="required">*</span>
                </label>
                <input
                  id="edit-quantity"
                  type="number"
                  min="0"
                  className={`form-control ${formErrors.quantity ? 'error' : ''}`}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                {formErrors.quantity && (
                  <span className="form-error-msg">{formErrors.quantity}</span>
                )}
                <span className="form-hint">
                  Changing this will record a &quot;Stock Correction&quot; in history.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-min-stock">
                  Minimum Stock Level <span className="required">*</span>
                </label>
                <input
                  id="edit-min-stock"
                  type="number"
                  min="0"
                  className={`form-control ${formErrors.minStock ? 'error' : ''}`}
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                />
                {formErrors.minStock && (
                  <span className="form-error-msg">{formErrors.minStock}</span>
                )}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingProduct(null)}
          title="Confirm Delete Product"
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
              >
                Delete Product
              </button>
            </>
          }
        >
          <div style={{ lineHeight: 1.6 }}>
            <p>
              Are you sure you want to delete <strong>{deletingProduct.name}</strong> (Category:{' '}
              {deletingProduct.category})?
            </p>
            <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--danger)' }}>
              ⚠️ This will remove the product from your catalog and dashboard stock totals.
            </p>
          </div>
        </Modal>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingProduct && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustingProduct(null)}
          title={`Adjust Stock: ${adjustingProduct.name}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAdjustingProduct(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="quick-adjust-form"
                id="btn-confirm-adjust"
                className="btn btn-primary"
              >
                Apply Adjustment
              </button>
            </>
          }
        >
          <form id="quick-adjust-form" onSubmit={handleAdjustSubmit}>
            <div
              style={{
                marginBottom: '16px',
                background: 'var(--bg-app)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Current Quantity:
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {adjustingProduct.quantity} units (Min: {adjustingProduct.minStock})
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Operation</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className={`btn ${
                    adjustType === 'decrease' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setAdjustType('decrease');
                    setAdjustReason('Sale');
                  }}
                >
                  - Deduct Stock (Sale / Out)
                </button>
                <button
                  type="button"
                  className={`btn ${
                    adjustType === 'increase' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setAdjustType('increase');
                    setAdjustReason('Purchase');
                  }}
                >
                  + Add Stock (Purchase / In)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adjust-delta">
                Quantity to {adjustType === 'decrease' ? 'Deduct' : 'Add'}{' '}
                <span className="required">*</span>
              </label>
              <input
                id="adjust-delta"
                type="number"
                min="1"
                max={adjustType === 'decrease' ? adjustingProduct.quantity : undefined}
                className="form-control"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adjust-reason-select">
                Reason for Stock Change
              </label>
              <select
                id="adjust-reason-select"
                className="form-control"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value as StockChangeReason)}
              >
                {adjustType === 'decrease' ? (
                  <>
                    <option value="Sale">Sale (Customer Purchase)</option>
                    <option value="Stock Correction">Stock Correction (Damage / Loss)</option>
                  </>
                ) : (
                  <>
                    <option value="Purchase">Purchase (Restock)</option>
                    <option value="Stock Correction">Stock Correction (Audit / Found)</option>
                  </>
                )}
              </select>
            </div>

            {adjustType === 'decrease' &&
              parseInt(adjustDelta, 10) > adjustingProduct.quantity && (
                <span className="form-error-msg">
                  Cannot deduct more than current quantity ({adjustingProduct.quantity}).
                </span>
              )}

            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginTop: '14px',
              }}
            >
              New Quantity will be:{' '}
              <strong>
                {adjustType === 'decrease'
                  ? Math.max(0, adjustingProduct.quantity - (parseInt(adjustDelta, 10) || 0))
                  : adjustingProduct.quantity + (parseInt(adjustDelta, 10) || 0)}
              </strong>{' '}
              units
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
