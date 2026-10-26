import React, { useState, useEffect } from 'react';
import { getSystemUsers, deleteUserAccount } from '../services/systemManagementService';
import {
  ShieldAlert,
  Search,
  Filter,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';

const SystemManagementDashboard = () => {
  const [accessKey, setAccessKey] = useState(
    sessionStorage.getItem('medwise_sys_mgmt_key') || ''
  );
  const [keyInput, setKeyInput] = useState(accessKey || 'medwise-sys-admin-2026');
  const [isAuthorized, setIsAuthorized] = useState(Boolean(accessKey));

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Deletion Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  const fetchUsers = async (key = accessKey) => {
    if (!key) return;
    try {
      setLoading(true);
      setError('');
      const res = await getSystemUsers(search, roleFilter, key);
      if (res && res.success) {
        setUsers(res.users || []);
        setIsAuthorized(true);
        sessionStorage.setItem('medwise_sys_mgmt_key', key);
      }
    } catch (err) {
      console.error('System Management auth error:', err.message);
      setError(err.response?.data?.message || 'Unauthorized: Invalid System Management Key.');
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessKey) {
      fetchUsers(accessKey);
    }
  }, [search, roleFilter]);

  const handleKeySubmit = (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setAccessKey(keyInput.trim());
    fetchUsers(keyInput.trim());
  };

  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setConfirmName('');
    setDeleteResult(null);
    setError('');
    setSuccess('');
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    if (confirmName.trim().toLowerCase() !== selectedUser.name.trim().toLowerCase()) {
      setError(`Confirmation name mismatch. Please type "${selectedUser.name}" exactly to confirm.`);
      return;
    }

    try {
      setDeleting(true);
      setError('');
      const res = await deleteUserAccount(selectedUser._id, accessKey);
      if (res && res.success) {
        setSuccess(`Successfully deleted user ${selectedUser.name} (${selectedUser.role}).`);
        setDeleteResult(res.deletedSummary);
        setSelectedUser(null);
        fetchUsers(accessKey);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user account.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--slate-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', color: '#f8fafc' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: 'var(--slate-800)', border: '1px solid var(--slate-700)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>System Management Access</h1>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Restricted Administrative Console</span>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleKeySubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Management Key
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter system management secret key..."
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--slate-900)', border: '1px solid var(--slate-600)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem' }}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
            >
              Authenticate Management Access
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                MedWise System Management
              </h1>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                User Account Lifecycle & Protected Cascade Deletion Engine
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => fetchUsers(accessKey)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', background: '#1e293b', border: '1px solid #334155', borderRadius: 'var(--radius-md)', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('medwise_sys_mgmt_key');
                setIsAuthorized(false);
              }}
              style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Exit Console
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#86efac', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{success}</p>
              {deleteResult && (
                <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>
                  Deleted Records: {deleteResult.user} user account, {deleteResult.profile} profile, {deleteResult.consultations || 0} consultations, {deleteResult.prescriptions || 0} prescriptions, {deleteResult.appointments || 0} appointments.
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTROLS: SEARCH & ROLE FILTER */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search user name, email, PID, or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.25rem', background: '#1e293b', border: '1px solid #334155', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid #334155', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem' }}
            >
              <option value="">All Roles (Doctor, Pharmacist, Patient)</option>
              <option value="doctor">Doctors</option>
              <option value="pharmacist">Pharmacists</option>
              <option value="patient">Patients</option>
            </select>
          </div>
        </div>

        {/* USER LIST TABLE */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>User Account</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Role</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Profile Identity</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    {loading ? 'Loading user accounts...' : 'No matching user accounts found.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleColors = {
                    doctor: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '#1d4ed8' },
                    pharmacist: { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '#7e22ce' },
                    patient: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '#15803d' },
                  };
                  const rStyle = roleColors[u.role] || roleColors.patient;

                  return (
                    <tr key={u._id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: rStyle.bg,
                            color: rStyle.color,
                            border: `1px solid ${rStyle.border}`,
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                        {u.role === 'patient' && (
                          <div>
                            <div>PID: <strong style={{ color: '#4ade80' }}>{u.profile?.pid || 'N/A'}</strong></div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mobile: {u.profile?.mobileNumber || 'N/A'}</div>
                          </div>
                        )}
                        {u.role === 'doctor' && (
                          <div>
                            <div>License: {u.profile?.licenseNumber || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.profile?.specialization || 'General Doctor'}</div>
                          </div>
                        )}
                        {u.role === 'pharmacist' && (
                          <div>
                            <div>License: {u.profile?.licenseNumber || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.profile?.pharmacyName || 'Registered Pharmacy'}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontSize: '0.8rem', fontWeight: 600 }}>
                          <UserCheck size={14} /> Active
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDeleteModal(u)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.45rem 0.85rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            border: '1px solid #ef4444',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete Account</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* STRONG CONFIRMATION DELETION MODAL */}
        {selectedUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(4px)',
              zIndex: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              style={{
                maxWidth: '520px',
                width: '100%',
                background: '#1e293b',
                border: '2px solid #ef4444',
                borderRadius: 'var(--radius-xl)',
                padding: '1.75rem',
                boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldAlert size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                    Permanent Account Deletion Warning
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#fca5a5', fontWeight: 600 }}>
                  You are about to permanently delete this user account and all exclusive related data.
                </p>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <div><strong>Account Name:</strong> {selectedUser.name}</div>
                  <div><strong>Role:</strong> {selectedUser.role?.toUpperCase()}</div>
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  {selectedUser.profile?.pid && <div><strong>PID:</strong> {selectedUser.profile.pid}</div>}
                </div>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
                This action is irreversible. All consultations, prescriptions, appointments, and medical history exclusively owned by this account will be completely purged from the database.
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Type <span style={{ color: '#ef4444', fontFamily: 'monospace' }}>{selectedUser.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Type "${selectedUser.name}" here...`}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0f172a', border: '1px solid #475569', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  style={{ padding: '0.65rem 1.25rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting || confirmName.trim().toLowerCase() !== selectedUser.name.trim().toLowerCase()}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: confirmName.trim().toLowerCase() === selectedUser.name.trim().toLowerCase() ? '#dc2626' : '#475569',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: confirmName.trim().toLowerCase() === selectedUser.name.trim().toLowerCase() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {deleting ? 'Deleting Account...' : 'CONFIRM PERMANENT DELETION'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemManagementDashboard;
