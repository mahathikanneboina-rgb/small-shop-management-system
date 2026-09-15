'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { firestore } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { RoleGuard } from '../../components/common/RoleGuard';

export default function StaffManagementPage() {
  return (
    <RoleGuard requiredRole="owner">
      <StaffManagementContent />
    </RoleGuard>
  );
}

function StaffManagementContent() {
  const { profile: currentProfile, updateUserStatus, updateUserRole } = useAuth();
  const { showToast } = useShop();

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof firestore !== 'undefined' && (firestore as any).type === 'string') {
        const usersCol = collection(firestore, 'users');
        const snapshot = await getDocs(usersCol);
        const users = snapshot.docs.map((d) => d.data() as UserProfile);
        setStaffList(users);
      } else {
        // Fallback for mock/local testing
        if (currentProfile) {
          setStaffList([currentProfile]);
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch staff from Firestore:', err);
      showToast('error', `Failed to load staff list: ${err.message || 'Check connection'}`);
      if (currentProfile) {
        setStaffList([currentProfile]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentProfile, showToast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.uid === currentProfile?.uid) {
      showToast('warning', 'You cannot disable your own owner account.');
      return;
    }

    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled';
    const actionName = nextStatus === 'disabled' ? 'disable' : 'reactivate';

    if (!confirm(`Are you sure you want to ${actionName} ${user.name || user.email}?`)) {
      return;
    }

    setActionInProgress(user.uid);
    try {
      await updateUserStatus(user.uid, nextStatus);
      setStaffList((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, status: nextStatus } : u))
      );
      showToast(
        'success',
        `User ${user.name || user.email} ${nextStatus === 'disabled' ? 'disabled' : 'reactivated'}.`
      );
    } catch (err: any) {
      showToast('error', `Failed to update user: ${err.message || 'Operation failed'}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const activeStaffCount = staffList.filter((s) => s.status === 'active' && s.role === 'staff').length;
  const disabledCount = staffList.filter((s) => s.status === 'disabled').length;
  const ownerCount = staffList.filter((s) => s.role === 'owner').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-heading">Staff & User Management</h2>
          <p className="page-subheading">
            Manage employee access, active roles, and security authorization for your store.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchStaff}
            disabled={loading}
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="sync-cards-grid">
        <div className="sync-card">
          <div className="sync-card-label">Store Owners</div>
          <div className="sync-card-value">{ownerCount} Owner(s)</div>
          <div className="sync-card-note">Full administrative rights and staff management.</div>
        </div>

        <div className="sync-card">
          <div className="sync-card-label">Active Staff</div>
          <div className="sync-card-value">{activeStaffCount} Active</div>
          <div className="sync-card-note">Permitted to record sales, stock, and view reports.</div>
        </div>

        <div className="sync-card">
          <div className="sync-card-label">Disabled Accounts</div>
          <div className="sync-card-value">{disabledCount} Deactivated</div>
          <div className="sync-card-note">Blocked from performing any shop transactions.</div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Staff Directory ({staffList.length})</h3>
          <span className="table-subtitle">Registered user accounts and permission status</span>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spin-icon" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              🔄
            </div>
            <p>Loading staff accounts...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="empty-state">
            <p>No registered users found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Account Status</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((user) => {
                  const isSelf = user.uid === currentProfile?.uid;
                  const isUserOwner = user.role === 'owner';
                  const isBusy = actionInProgress === user.uid;

                  return (
                    <tr key={user.uid}>
                      <td>
                        <strong>{user.name || 'Unnamed Staff'}</strong>
                        {isSelf && <span className="entity-badge" style={{ marginLeft: '6px' }}>You</span>}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`sync-badge ${isUserOwner ? 'badge-synced' : 'badge-syncing'}`}>
                          {isUserOwner ? '👑 Owner' : '👤 Staff'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`sync-badge ${user.status === 'disabled' ? 'badge-failed' : 'badge-synced'}`}
                        >
                          {user.status === 'disabled' ? '⛔ Disabled' : '✅ Active'}
                        </span>
                      </td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {isSelf ? (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Current Account</span>
                        ) : isUserOwner ? (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Protected Owner</span>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn-sm ${user.status === 'disabled' ? 'btn-primary' : 'btn-danger'}`}
                            onClick={() => handleToggleStatus(user)}
                            disabled={isBusy}
                          >
                            {isBusy
                              ? 'Updating...'
                              : user.status === 'disabled'
                              ? 'Reactivate'
                              : 'Disable Access'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
