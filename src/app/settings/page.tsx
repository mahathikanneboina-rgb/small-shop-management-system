'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useShop } from '../../context/ShopContext';
import { ShopSettings, ShopBackupData } from '../../types';
import { RoleGuard } from '../../components/common/RoleGuard';

export default function SettingsPage() {
  return (
    <RoleGuard requiredRole="owner">
      <SettingsContent />
    </RoleGuard>
  );
}

function SettingsContent() {
  const { settings, updateSettings, exportBackupData, restoreBackupData, showToast } = useShop();

  const [formData, setFormData] = useState<ShopSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Backup Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewBackup, setPreviewBackup] = useState<ShopBackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Export JSON Backup
  const handleExportBackup = () => {
    try {
      const backupData = exportBackupData();
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const filename = `small-shop-backup-${yyyy}-${mm}-${dd}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('success', `Exported store backup: ${filename}`);
    } catch (err: any) {
      showToast('error', `Failed to export backup: ${err.message || 'Unknown error'}`);
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showToast('error', 'Please select a valid JSON backup file.');
      return;
    }

    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: ShopBackupData = JSON.parse(text);

        if (!parsed.data || typeof parsed.data !== 'object') {
          showToast('error', 'Invalid backup format: missing store data payload.');
          setPreviewBackup(null);
          return;
        }

        setPreviewBackup(parsed);
      } catch {
        showToast('error', 'Failed to parse JSON backup file.');
        setPreviewBackup(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Safe Restore
  const handleConfirmRestore = async () => {
    if (!previewBackup) return;

    setIsRestoring(true);
    try {
      const res = await restoreBackupData(previewBackup);
      if (res.success) {
        setPreviewBackup(null);
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">⚙️ Shop Configuration & System Data</h2>
          <p className="page-subheading">
            Customize store identity, billing parameters, and manage secure offline JSON backups.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>
        {/* Store Settings Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏪</span> Store Identity & Receipt Information
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="shopName" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Store / Business Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="shopName"
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                required
                className="form-control"
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
                  className="form-control"
                  placeholder="+91 9876543210"
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
                  className="form-control"
                  placeholder="store@example.com"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="shopAddress" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Store Physical Address
              </label>
              <textarea
                id="shopAddress"
                rows={2}
                value={formData.shopAddress}
                onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
                className="form-control"
                placeholder="Market Road, Sector 4, Hyderabad"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label htmlFor="currencySymbol" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Currency Symbol
                </label>
                <input
                  id="currencySymbol"
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="form-control"
                  placeholder="₹"
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
                  className="form-control"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving Changes...' : 'Save Store Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Data Backup & Export Section */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span> Store Data Backup (Export JSON)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Download an offline JSON copy of your store&apos;s products, sales history, customers, suppliers, expenses, and configuration. Passwords and credentials are never exported.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Format: <code>small-shop-backup-YYYY-MM-DD.json</code>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportBackup}
            >
              📥 Download Store Backup (JSON)
            </button>
          </div>
        </div>

        {/* Safe Data Restore / Import Section */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔄</span> Restore & Merge Data from Backup
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Upload a valid JSON backup file to merge or restore products, transactions, and customer records into local storage. Existing matching records are safely updated without deleting historical activity.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          {previewBackup && (
            <div
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                📋 Backup Summary Preview:
              </h4>
              <ul style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginLeft: '20px', lineHeight: 1.6 }}>
                <li><strong>Shop Name:</strong> {previewBackup.shopName || previewBackup.data?.settings?.shopName || 'Store'}</li>
                <li><strong>Export Date:</strong> {previewBackup.exportDate ? new Date(previewBackup.exportDate).toLocaleString() : 'N/A'}</li>
                <li><strong>Products:</strong> {previewBackup.data?.products?.length || 0} items</li>
                <li><strong>Sales:</strong> {previewBackup.data?.sales?.length || 0} bills</li>
                <li><strong>Purchases:</strong> {previewBackup.data?.purchases?.length || 0} transactions</li>
                <li><strong>Customers:</strong> {previewBackup.data?.customers?.length || 0} records</li>
                <li><strong>Stock Histories:</strong> {previewBackup.data?.stockHistory?.length || 0} entries</li>
              </ul>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isRestoring}
                  onClick={handleConfirmRestore}
                >
                  {isRestoring ? 'Restoring Data...' : '✓ Confirm & Merge Restore'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={isRestoring}
                  onClick={() => {
                    setPreviewBackup(null);
                    setImportFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
