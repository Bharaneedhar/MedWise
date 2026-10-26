import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPrescriptions, getPrescriptionById, dispensePrescription, deliverPrescription } from '../services/prescriptionService';
import PharmacistLayout from '../components/PharmacistLayout';
import Loading from '../components/Loading';
import {
  Pill,
  ClipboardList,
  Search,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  User,
  Stethoscope,
  Lock,
  PackageCheck,
  Truck,
  Check,
  Building2,
  Calendar,
} from 'lucide-react';

const PharmacistDashboard = ({ initialTab = 'Sent to Pharmacist', pageTitle = 'Pharmacist Dispensing & Delivery Portal' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab); // 'Sent to Pharmacist', 'Dispensed', 'Delivered', 'ALL'
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPrescriptions();
      if (data.success) {
        setPrescriptions(data.prescriptions || []);
      }
    } catch (err) {
      console.error('Error fetching pharmacist queue:', err);
      setError('Failed to load prescription queue. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (id) => {
    try {
      const data = await getPrescriptionById(id);
      if (data.success) {
        setSelectedPrescription(data.prescription);
      }
    } catch (err) {
      console.error('Error fetching prescription detail:', err);
      alert('Could not load prescription details: ' + (err.response?.data?.message || err.message));
    }
  };

  const closeModal = () => {
    setSelectedPrescription(null);
  };

  const handleDispense = async (rxId) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await dispensePrescription(rxId);
      if (res.success) {
        setSuccessMsg(`Prescription ${res.prescription.prescriptionId || rxId} successfully marked as DISPENSED.`);
        await fetchQueue();
        if (selectedPrescription && selectedPrescription._id === rxId) {
          setSelectedPrescription(res.prescription);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispense prescription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async (rxId) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await deliverPrescription(rxId);
      if (res.success) {
        setSuccessMsg(`Prescription ${res.prescription.prescriptionId || rxId} successfully marked as DELIVERED.`);
        await fetchQueue();
        if (selectedPrescription && selectedPrescription._id === rxId) {
          setSelectedPrescription(res.prescription);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark prescription as delivered.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for pending status match
  const isPendingStatus = (st) => ['Sent to Pharmacist', 'Doctor Approved', 'Approved'].includes(st);

  // Counts
  const pendingCount = prescriptions.filter((rx) => isPendingStatus(rx.status)).length;
  const dispensedCount = prescriptions.filter((rx) => rx.status === 'Dispensed').length;
  const deliveredCount = prescriptions.filter((rx) => rx.status === 'Delivered').length;

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (activeTab === 'Sent to Pharmacist') {
      if (!isPendingStatus(rx.status)) return false;
    } else if (activeTab !== 'ALL' && rx.status !== activeTab) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    const rxId = (rx.prescriptionId || rx._id || '').toLowerCase();
    const patientName = (rx.patientName || rx.patientId?.name || '').toLowerCase();
    const patientPid = (rx.patientPid || '').toLowerCase();
    const doctorName = (rx.doctorName || rx.doctorId?.name || '').toLowerCase();

    return (
      rxId.includes(term) ||
      patientName.includes(term) ||
      patientPid.includes(term) ||
      doctorName.includes(term)
    );
  });

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Sent to Pharmacist':
        return { background: '#fef3c7', color: '#92400e', label: 'To Dispense' };
      case 'Dispensed':
        return { background: '#dbeafe', color: '#1e40af', label: 'Dispensed' };
      case 'Delivered':
        return { background: '#d1fae5', color: '#065f46', label: 'Delivered' };
      default:
        return { background: '#e2e8f0', color: '#475569', label: status };
    }
  };

  return (
    <PharmacistLayout>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* WELCOME BANNER */}
        <div
          className="dashboard-welcome-banner"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)',
            padding: '1.75rem 2rem',
            borderRadius: '12px',
            color: 'white',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '0.25rem' }}>
              {pageTitle}
            </h1>
            <p style={{ color: '#99f6e4', fontSize: '0.95rem' }}>
              Manage active dispensing queues, complete prescription fulfillment, and track patient deliveries safely.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
            <ClipboardList size={44} style={{ color: '#5eead4' }} />
          </div>
        </div>

        {error && (
          <div className="alert-box error" role="alert" style={{ marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle className="alert-icon" size={20} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box success" role="alert" style={{ marginBottom: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 className="alert-icon" size={20} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* QUEUE CATEGORY TABS */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('Sent to Pharmacist')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: activeTab === 'Sent to Pharmacist' ? '2px solid #0d9488' : '1px solid #cbd5e1',
              background: activeTab === 'Sent to Pharmacist' ? '#f0fdf4' : 'white',
              color: activeTab === 'Sent to Pharmacist' ? '#0f766e' : '#475569',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'Sent to Pharmacist' ? '0 2px 4px rgba(13,148,136,0.15)' : 'none',
            }}
          >
            <Pill size={18} style={{ color: '#0d9488' }} />
            Pending / To Dispense
            <span style={{ background: '#d97706', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Dispensed')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: activeTab === 'Dispensed' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: activeTab === 'Dispensed' ? '#eff6ff' : 'white',
              color: activeTab === 'Dispensed' ? '#1d4ed8' : '#475569',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <PackageCheck size={18} style={{ color: '#2563eb' }} />
            Dispensed
            <span style={{ background: '#2563eb', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
              {dispensedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Delivered')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: activeTab === 'Delivered' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === 'Delivered' ? '#f0fdf4' : 'white',
              color: activeTab === 'Delivered' ? '#15803d' : '#475569',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Truck size={18} style={{ color: '#16a34a' }} />
            Delivered
            <span style={{ background: '#16a34a', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
              {deliveredCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: activeTab === 'ALL' ? '2px solid #475569' : '1px solid #cbd5e1',
              background: activeTab === 'ALL' ? '#f1f5f9' : 'white',
              color: activeTab === 'ALL' ? '#0f172a' : '#475569',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            All Prescriptions ({prescriptions.length})
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div style={{ background: 'white', padding: '1.25rem 1.5rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px', background: '#f1f5f9', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              id="pharmacist-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#1e293b' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
              Showing <strong>{filteredPrescriptions.length}</strong> prescription{filteredPrescriptions.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={fetchQueue}
              className="btn-secondary"
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}
            >
              Refresh Queue
            </button>
          </div>
        </div>

        {/* QUEUE TABLE */}
        {loading ? (
          <Loading message="Loading pharmacy queue..." />
        ) : filteredPrescriptions.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem 2rem', textAlign: 'center', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <div style={{ width: '56px', height: '56px', background: '#ccfbf1', color: '#0d9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>No Prescriptions Available</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
              {searchTerm
                ? 'No prescriptions match your search criteria.'
                : activeTab === 'Sent to Pharmacist'
                ? 'There are currently no doctor-approved prescriptions pending dispensing.'
                : `No prescriptions found in category: ${activeTab}`}
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '1rem 1.25rem' }}>Prescription ID</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Patient Name & PID</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Prescribing Doctor</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Date Prescribed</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrescriptions.map((rx) => {
                  const pName = rx.patientName || rx.patientId?.name || '';
                  const pPid = rx.patientPid || '';
                  const dName = rx.doctorName || (rx.doctorId?.name ? `Dr. ${rx.doctorId.name}` : '');
                  const dateStr = rx.createdAt ? new Date(rx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                  const badge = getStatusBadgeStyle(rx.status);
                  const rxIdStr = rx.prescriptionId || rx._id;

                  return (
                    <tr key={rx._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: '#0369a1', fontFamily: 'monospace' }}>
                        <Link to={`/pharmacist/prescriptions/${rxIdStr}`} style={{ color: '#0369a1', textDecoration: 'none' }}>
                          {rxIdStr}
                        </Link>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{pName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{pPid}</div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: '#334155', fontWeight: '500' }}>
                        {dName}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.25rem 0.65rem', borderRadius: '6px', background: badge.background, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          {/* SINGLE VIEW ACTION: View Prescription */}
                          <button
                            onClick={() => handleOpenDetails(rx._id)}
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Eye size={14} />
                            View Prescription
                          </button>

                          {/* ACTION BUTTON: DISPENSE */}
                          {rx.status === 'Sent to Pharmacist' && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleDispense(rx._id)}
                              style={{ background: '#0d9488', color: 'white', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: actionLoading ? 0.65 : 1 }}
                            >
                              <PackageCheck size={14} />
                              Dispense
                            </button>
                          )}

                          {/* ACTION BUTTON: MARK DELIVERED */}
                          {rx.status === 'Dispensed' && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleDeliver(rx._id)}
                              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: actionLoading ? 0.65 : 1 }}
                            >
                              <Truck size={14} />
                              Mark Delivered
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* DETAIL MODAL (QUICK VIEW) */}
        {selectedPrescription && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '850px', maxHeight: '90vh', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* MODAL HEADER */}
              <div style={{ background: '#0f172a', color: 'white', padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#0d9488', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
                    <Pill size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                      Prescription {selectedPrescription.prescriptionId || selectedPrescription._id}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Status: <strong style={{ color: '#38bdf8' }}>{selectedPrescription.status}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Lock size={12} /> Pharmacist Read-Only View
                  </span>
                  <button
                    onClick={closeModal}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* READ ONLY BANNER */}
              <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#166534', fontSize: '0.85rem' }}>
                <Info size={18} style={{ flexShrink: 0, color: '#15803d' }} />
                <span>
                  <strong>Pharmacist Dispensing Review:</strong> Prescriptions in this view are physician-approved. Pharmacists may dispense or mark delivered. Modifications to medicines or dosages are strictly prohibited.
                </span>
              </div>

              {/* MODAL BODY (SCROLLABLE) */}
              <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 2-COLUMN PATIENT & DOCTOR INFO */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  {/* PATIENT CARD */}
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#0369a1', fontWeight: '700', fontSize: '0.9rem' }}>
                      <User size={18} />
                      <span>PATIENT DEMOGRAPHICS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
                      <div><strong>Name:</strong> {selectedPrescription.patientName || selectedPrescription.patientId?.name || ''}</div>
                      <div><strong>PID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>{selectedPrescription.patientPid || ''}</span></div>
                      <div><strong>Age:</strong> {selectedPrescription.patientAge ? `${selectedPrescription.patientAge} years` : ''}</div>
                      <div><strong>Gender:</strong> {selectedPrescription.patientGender || ''}</div>
                      <div><strong>Blood Group:</strong> <span style={{ color: '#dc2626', fontWeight: 600 }}>{selectedPrescription.patientBloodGroup || ''}</span></div>
                    </div>
                  </div>

                  {/* DOCTOR CARD */}
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#0f766e', fontWeight: '700', fontSize: '0.9rem' }}>
                      <Stethoscope size={18} />
                      <span>PRESCRIBING DOCTOR & CLINIC</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
                      <div><strong>Doctor Name:</strong> {selectedPrescription.doctorName || (selectedPrescription.doctorId?.name ? `Dr. ${selectedPrescription.doctorId.name}` : '')}</div>
                      <div><strong>Specialization:</strong> {selectedPrescription.doctorSpecialization || ''}</div>
                      {selectedPrescription.doctorMedicalRegistrationNumber && (
                        <div><strong>Registration #:</strong> {selectedPrescription.doctorMedicalRegistrationNumber}</div>
                      )}
                      {selectedPrescription.doctorHospitalClinicName && (
                        <div><strong>Clinic/Hospital:</strong> {selectedPrescription.doctorHospitalClinicName}</div>
                      )}
                      <div><strong>Date Prescribed:</strong> {selectedPrescription.createdAt ? new Date(selectedPrescription.createdAt).toLocaleDateString() : ''}</div>
                    </div>
                  </div>
                </div>

                {/* PRESCRIBED MEDICINES TABLE */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Pill size={18} style={{ color: '#0d9488' }} />
                    Prescribed Medication List ({selectedPrescription.medicines?.length || 0})
                  </h3>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Medicine Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Dosage / Strength</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Frequency (X-Y-Z)</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Duration & Route</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrescription.medicines?.map((med, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === selectedPrescription.medicines.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: '600', color: '#0f172a' }}>
                              {med.medicineName || med.name}
                              {med.genericName && med.genericName !== med.medicineName && (
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Generic: {med.genericName}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                              {med.dosage || med.strength || ''}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>
                              {med.frequency || ''}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                              {med.duration ? `${med.duration}${med.route ? ` • Route: ${med.route}` : ''}` : (med.route ? `Route: ${med.route}` : '')}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.82rem' }}>
                              {med.instructions || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TIMESTAMPS / DISPENSING HISTORY */}
                <div style={{ background: '#f1f5f9', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div><strong>Approved by Doctor:</strong> {selectedPrescription.approvedAt ? new Date(selectedPrescription.approvedAt).toLocaleString() : ''}</div>
                  {selectedPrescription.dispensedAt && (
                    <div>
                      <strong>Dispensed at Pharmacy:</strong> {new Date(selectedPrescription.dispensedAt).toLocaleString()}
                      {selectedPrescription.pharmacistId?.name && (
                        <span> by <strong>{selectedPrescription.pharmacistId.name}</strong></span>
                      )}
                    </div>
                  )}
                  {selectedPrescription.deliveredAt && (
                    <div>
                      <strong>Delivered to Patient:</strong> {new Date(selectedPrescription.deliveredAt).toLocaleString()}
                      {selectedPrescription.deliveredByPharmacistId?.name && (
                        <span> by <strong>{selectedPrescription.deliveredByPharmacistId.name}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                {/* MEDWISE REVIEW SUMMARY (READ ONLY) */}
                {selectedPrescription.medwiseAnalysis && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldAlert size={20} style={{ color: '#0d9488' }} />
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                          MedWise Clinical Safety Audit Summary (Read-Only)
                        </h4>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0d9488', background: '#ccfbf1', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        Verified
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                      {typeof selectedPrescription.medwiseAnalysis.overallRecommendation === 'object'
                        ? selectedPrescription.medwiseAnalysis.overallRecommendation?.message
                        : String(selectedPrescription.medwiseAnalysis.overallRecommendation || 'Clinical Safety Check Passed')}
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER WITH ACTIONS */}
              <div style={{ background: '#f8fafc', padding: '1rem 1.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {selectedPrescription.status === 'Sent to Pharmacist' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleDispense(selectedPrescription._id)}
                      style={{ background: '#0d9488', color: 'white', border: 'none', padding: '0.56rem 1.25rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', opacity: actionLoading ? 0.65 : 1 }}
                    >
                      <PackageCheck size={16} /> Dispense Prescription
                    </button>
                  )}
                  {selectedPrescription.status === 'Dispensed' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleDeliver(selectedPrescription._id)}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.56rem 1.25rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', opacity: actionLoading ? 0.65 : 1 }}
                    >
                      <Truck size={16} /> Mark as Delivered
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    to={`/pharmacist/prescriptions/${selectedPrescription.prescriptionId || selectedPrescription._id}`}
                    style={{ background: '#0369a1', color: 'white', padding: '0.56rem 1.25rem', borderRadius: '6px', fontSize: '0.88rem', fontWeight: '600', textDecoration: 'none' }}
                  >
                    Open Full Detail Page
                  </Link>
                  <button
                    onClick={closeModal}
                    style={{ background: '#475569', color: 'white', border: 'none', padding: '0.56rem 1.25rem', borderRadius: '6px', fontSize: '0.88rem', fontWeight: '500', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PharmacistLayout>
  );
};

export default PharmacistDashboard;
