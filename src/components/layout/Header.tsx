'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useShop } from '../../context/ShopContext';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const pathname = usePathname();
  const { isOnline, syncQueue, isSyncing } = useShop();

  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'Dashboard';
      case '/products':
        return 'Products Management';
      case '/sales':
        return 'Sales & Billing';
      case '/purchases':
        return 'Purchase Orders';
      case '/stock-history':
        return 'Stock History Log';
      case '/sync-status':
        return 'Sync & Storage Status';
      case '/coming-soon':
        return 'Module Status';
      default:
        return 'Shop Management';
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const pendingCount = syncQueue.filter(
    (item) => item.status === 'pending' || item.status === 'syncing'
  ).length;

  const failedCount = syncQueue.filter((item) => item.status === 'failed').length;

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>

      <div className="header-right">
        {/* Live Network & IndexedDB Status Indicator */}
        <div className={`header-meta-chip network-chip ${isOnline ? 'online' : 'offline'}`}>
          <span className={`status-dot ${isOnline ? 'dot-online' : 'dot-offline'}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Sync Status Badge linking to /sync-status */}
        <Link href="/sync-status" className="header-meta-chip sync-chip" title="View Sync Details">
          {isSyncing ? (
            <>
              <span className="spin-icon">🔄</span>
              <span>Syncing...</span>
            </>
          ) : failedCount > 0 ? (
            <>
              <span>⚠️</span>
              <span>{failedCount} Failed</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <span>⏳</span>
              <span>{pendingCount} Pending</span>
            </>
          ) : (
            <>
              <span>☁️</span>
              <span>All Synced</span>
            </>
          )}
        </Link>

        <div className="header-meta-chip date-chip">
          <span>📅 {currentDate}</span>
        </div>
      </div>
    </header>
  );
};
