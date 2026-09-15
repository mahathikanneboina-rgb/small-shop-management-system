'use client';

import React, { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../common/ToastContainer';
import { RoleGuard } from '../common/RoleGuard';

const PUBLIC_ROUTES = ['/login', '/register'];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return (
      <div className="auth-container">
        {children}
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Suspense fallback={<div style={{ width: '250px' }} />}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </Suspense>
      <div className="app-main-wrapper">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="app-content">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
