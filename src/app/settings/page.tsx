'use client';

import React, { useState, useEffect } from 'react';
import { useShop } from '../../context/ShopContext';
import { ShopSettings } from '../../types';
import { RoleGuard } from '../../components/common/RoleGuard';

export default function SettingsPage() {
  return (
    <RoleGuard requiredRole="owner">
      <SettingsContent />
    </RoleGuard>
  );
}

function SettingsContent() {
  const { settings, updateSettings, showToast } = useShop();

  const [formData, setFormData] = useState<ShopSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopName.trim()) {
      showToast('error', 'Shop name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings(formData);
      showToast('success', 'Shop settings updated successfully');
    } catch (err: any) {
      showToast('error', `Failed to save settings: ${err.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">Shop Configuration & Settings</h2>
          <p className="page-subheading">
            Customize your store identity, contact information, and billing parameters.
          </p>
        </div>
      </div>

      <div className="max-w-2xl" style={{ maxWidth: '680px' }}>
        <div className="table-card" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="shopName" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Store / Business Name
              </label>
              <input
                id="shopName"
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label htmlFor="shopPhone" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Contact Phone
                </label>
                <input
                  id="shopPhone"
                  type="text"
                  value={formData.shopPhone}
                  onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopEmail" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Contact Email
                </label>
                <input
                  id="shopEmail"
                  type="email"
                  value={formData.shopEmail}
                  onChange={(e) => setFormData({ ...formData, shopEmail: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="shopAddress" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Store Address
              </label>
              <textarea
                id="shopAddress"
                rows={2}
                value={formData.shopAddress}
                onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="form-group">
                <label htmlFor="currencySymbol" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Currency Symbol
                </label>
                <input
                  id="currencySymbol"
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="taxRate" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Standard Tax Rate (%)
                </label>
                <input
                  id="taxRate"
                  type="number"
                  min={0}
                  step="0.1"
                  value={formData.taxRate || 0}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
