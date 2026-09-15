'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: 'owner' | 'staff';
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, requiredRole }) => {
  const { user, profile, loading, isOwner, isDisabled, logout } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="guard-loading-wrapper">
        <div className="spin-icon" style={{ fontSize: '2rem' }}>🔄</div>
        <p>Verifying permissions...</p>
      </div>
    );
  }

  // If not logged in
  if (!user) {
    return (
      <div className="guard-denied-card">
        <div className="guard-icon">🔒</div>
        <h2>Authentication Required</h2>
        <p>Please log in to access the shop management system.</p>
        <Link href="/login" className="btn btn-primary">
          Go to Login
        </Link>
      </div>
    );
  }

  // If account is disabled by owner
  if (isDisabled) {
    return (
      <div className="guard-denied-card disabled-card">
        <div className="guard-icon">⛔</div>
        <h2>Account Disabled</h2>
        <p>
          Your staff account (<strong>{profile?.email}</strong>) has been deactivated by the shop owner.
        </p>
        <p className="guard-note">
          You are restricted from performing transactions or modifying shop records. Please contact your store owner to reactivate your access.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            await logout();
            router.push('/login');
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // If page requires owner role and user is not owner
  if (requiredRole === 'owner' && !isOwner) {
    return (
      <div className="guard-denied-card">
        <div className="guard-icon">🛡️</div>
        <h2>Access Restricted</h2>
        <p>This management module is reserved exclusively for Shop Owners.</p>
        <p className="guard-note">
          Logged in as: <strong>{profile?.name || user.email}</strong> (Role: Staff)
        </p>
        <Link href="/" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
