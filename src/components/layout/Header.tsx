'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'Dashboard';
      case '/products':
        return 'Products Management';
      case '/stock-history':
        return 'Stock History Log';
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
        <div className="header-meta-chip">
          <span className="live-indicator" />
          <span>Local Storage Active</span>
        </div>
        <div className="header-meta-chip">
          <span>📅 {currentDate}</span>
        </div>
      </div>
    </header>
  );
};
