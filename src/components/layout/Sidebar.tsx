'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemDef {
  label: string;
  href: string;
  icon: string;
  isWorking: boolean;
  featureKey?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { label: 'Dashboard', href: '/', icon: '📊', isWorking: true },
  { label: 'Products', href: '/products', icon: '📦', isWorking: true },
  { label: 'Sales', href: '/sales', icon: '🛒', isWorking: true },
  { label: 'Purchases', href: '/purchases', icon: '📥', isWorking: true },
  { label: 'Customers', href: '/coming-soon?feature=Customers', icon: '👥', isWorking: false, featureKey: 'Customers' },
  { label: 'Suppliers', href: '/coming-soon?feature=Suppliers', icon: '🏭', isWorking: false, featureKey: 'Suppliers' },
  { label: 'Expenses', href: '/coming-soon?feature=Expenses', icon: '💸', isWorking: false, featureKey: 'Expenses' },
  { label: 'Stock History', href: '/stock-history', icon: '📜', isWorking: true },
  { label: 'Reports', href: '/coming-soon?feature=Reports', icon: '📈', isWorking: false, featureKey: 'Reports' },
  { label: 'Settings', href: '/coming-soon?feature=Settings', icon: '⚙️', isWorking: false, featureKey: 'Settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFeature = searchParams.get('feature');

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="shop-logo-badge">🏪</div>
          <div className="shop-title-wrapper">
            <span className="shop-title">Small Shop</span>
            <span className="shop-subtitle">Management System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Main Navigation</div>
          {NAV_ITEMS.map((item) => {
            let isActive = false;
            if (item.isWorking) {
              isActive = pathname === item.href;
            } else if (pathname === '/coming-soon') {
              isActive = currentFeature === item.featureKey;
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (window.innerWidth <= 900) {
                    onClose();
                  }
                }}
              >
                <div className="nav-item-content">
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {!item.isWorking && <span className="badge-coming-soon">Soon</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span>Phase 1 Build</span>
          <span className="sidebar-version">v1.0.0</span>
        </div>
      </aside>
    </>
  );
};
