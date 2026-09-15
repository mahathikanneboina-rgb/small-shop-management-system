'use client';

import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

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
  ownerOnly?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFeature = searchParams.get('feature');
  const { profile, logout, isOwner, isDisabled } = useAuth();
  const { syncQueue } = useShop();
  const router = useRouter();

  const pendingCount = syncQueue.filter(
    (item) => item.status === 'pending' || item.status === 'syncing'
  ).length;
  const failedCount = syncQueue.filter(
    (item) => item.status === 'failed' || item.status === 'conflict'
  ).length;

  const NAV_ITEMS: NavItemDef[] = [
    { label: 'Dashboard', href: '/', icon: '📊', isWorking: true },
    { label: 'Products', href: '/products', icon: '📦', isWorking: true },
    { label: 'Sales', href: '/sales', icon: '🛒', isWorking: true },
    { label: 'Purchases', href: '/purchases', icon: '📥', isWorking: true },
    { label: 'Customers', href: '/coming-soon?feature=Customers', icon: '👥', isWorking: false, featureKey: 'Customers' },
    { label: 'Suppliers', href: '/coming-soon?feature=Suppliers', icon: '🏭', isWorking: false, featureKey: 'Suppliers' },
    { label: 'Expenses', href: '/coming-soon?feature=Expenses', icon: '💸', isWorking: false, featureKey: 'Expenses' },
    { label: 'Stock History', href: '/stock-history', icon: '📜', isWorking: true },
    { label: 'Sync Status', href: '/sync-status', icon: '🔄', isWorking: true },
    { label: 'Staff Management', href: '/staff', icon: '👥', isWorking: true, ownerOnly: true },
    { label: 'Audit Log', href: '/audit-log', icon: '🛡️', isWorking: true, ownerOnly: true },
    { label: 'Reports', href: '/coming-soon?feature=Reports', icon: '📈', isWorking: false, featureKey: 'Reports' },
    { label: 'Settings', href: '/settings', icon: '⚙️', isWorking: true, ownerOnly: true },
  ];

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

        {/* User Profile Section */}
        {profile && (
          <div className="sidebar-user">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="user-name">{profile.name}</p>
              <span className={`sync-badge ${isOwner ? 'badge-synced' : 'badge-syncing'}`} style={{ fontSize: '0.65rem' }}>
                {isOwner ? 'Owner' : 'Staff'}
              </span>
            </div>
            {isDisabled && (
              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#f87171', fontWeight: 600 }}>
                ⛔ Account Disabled
              </div>
            )}
            <button
              className="logout-button"
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
            >
              Logout
            </button>
          </div>
        )}

        <nav className="sidebar-nav">
          <div className="nav-section-title">
            {isOwner ? 'Store Owner Navigation' : 'Staff Navigation'}
          </div>

          {/* Filter items based on role */}
          {NAV_ITEMS.filter((item) => {
            if (item.ownerOnly && !isOwner) return false;
            return true;
          }).map((item) => {
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
                  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
                    onClose();
                  }
                }}
              >
                <div className="nav-item-content">
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {!item.isWorking && <span className="badge-coming-soon">Soon</span>}
                {item.label === 'Sync Status' && (pendingCount > 0 || failedCount > 0) && (
                  <span
                    className={`sync-nav-badge ${failedCount > 0 ? 'badge-failed' : 'badge-pending'}`}
                  >
                    {failedCount > 0 ? `! ${failedCount}` : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span>Phase 7 Enterprise Sync</span>
          <span className="sidebar-version">v1.2.0</span>
        </div>
      </aside>
    </>
  );
};
