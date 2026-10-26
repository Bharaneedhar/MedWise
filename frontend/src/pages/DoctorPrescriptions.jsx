import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPrescriptions } from '../services/prescriptionService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  Pill,
  PlusCircle,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Send,
  Eye,
} from 'lucide-react';

const DoctorPrescriptions = () => {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchPrescriptions = async () => {
      try {
        const data = await getPrescriptions();
        if (isMounted && data) {
          setPrescriptions(data.prescriptions || []);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Prescriptions load note:', err.message);
          setError('Failed to load prescription history.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchPrescriptions();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading clinical prescription registry..." />;
  }

  return (
    <DoctorLayout>
      {/* PAGE HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--slate-900)',
              }}
            >
              Prescriptions
            </h1>
            <span
              className="card-section-badge"
              style={{
                background: '#ede9fe',
                color: '#6d28d9',
                border: '1px solid #ddd6fe',
              }}
            >
              {prescriptions.length} Records
            </span>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
            Author, review clinical decision checks, and manage electronic outpatient prescriptions.
          </p>
        </div>

        <Link
          to="/doctor/prescriptions/new"
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
        >
          <PlusCircle size={16} />
          <span>New Prescription</span>
        </Link>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* PRESCRIPTIONS LIST */}
      {prescriptions.length === 0 ? (
        <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Pill className="empty-state-icon" size={42} style={{ color: 'var(--slate-400)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            No Prescriptions Created Yet
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--slate-500)', maxWidth: '440px', margin: '0.5rem auto 1.5rem auto' }}>
            Author your first electronic prescription with multi-drug regimens and MedWise clinical checks.
          </p>
          <Link
            to="/doctor/prescriptions/new"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={16} />
            <span>Draft New Prescription</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {prescriptions.map((rx) => (
            <div key={rx._id} className="dashboard-card-section" style={{ marginBottom: 0 }}>
              {/* TOP HEADER */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid var(--slate-100)',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background: '#ede9fe',
                      color: '#6d28d9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-700)' }}>
                        {rx.prescriptionId}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>•</span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                        {rx.patientName}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      {rx.patientPid}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Status Badge */}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      background:
                        rx.status === 'Delivered'
                          ? '#d1fae5'
                          : rx.status === 'Dispensed'
                          ? '#dbeafe'
                          : rx.status === 'Sent to Pharmacist'
                          ? '#fef3c7'
                          : rx.status === 'Approved'
                          ? '#ecfdf5'
                          : '#f1f5f9',
                      color:
                        rx.status === 'Delivered'
                          ? '#065f46'
                          : rx.status === 'Dispensed'
                          ? '#1e40af'
                          : rx.status === 'Sent to Pharmacist'
                          ? '#92400e'
                          : rx.status === 'Approved'
                          ? '#047857'
                          : '#475569',
                    }}
                  >
                    {rx.status}
                  </span>

                  <Link
                    to={`/doctor/prescriptions/${rx._id || rx.prescriptionId}`}
                    className="btn-primary"
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <Eye size={14} />
                    <span>View & Review</span>
                  </Link>
                </div>
              </div>

              {/* MEDICINES SUMMARY */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Prescribed Regimen ({rx.medicines?.length || 0} Medicines):
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {(rx.medicines || []).map((m, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.65rem',
                        background: 'var(--slate-50)',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--slate-800)',
                      }}
                    >
                      {m.medicineName} ({m.dosage})
                    </span>
                  ))}
                </div>
              </div>

              {/* FOOTER METADATA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                <span>Authored: {formatDisplayDate(rx.createdAt)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* MedWise Status */}
                  <span>
                    MedWise:{' '}
                    <strong
                      style={{
                        color:
                          rx.medwiseChecks?.status === 'Cleared / Approved'
                            ? 'var(--accent-emerald)'
                            : rx.medwiseChecks?.status === 'Critical Alerts'
                            ? 'var(--danger-500)'
                            : 'var(--slate-600)',
                      }}
                    >
                      {rx.medwiseChecks?.status || 'Pending Review'}
                    </strong>
                  </span>
                  {/* Doctor Decision */}
                  <span>
                    Doctor:{' '}
                    <strong style={{ color: rx.doctorDecision === 'Approved' ? 'var(--accent-emerald)' : 'var(--slate-700)' }}>
                      {rx.doctorDecision}
                    </strong>
                  </span>
                  {/* Pharmacist Status */}
                  <span>
                    Pharmacist:{' '}
                    <strong
                      style={{
                        color:
                          rx.status === 'Dispensed' || rx.status === 'Delivered'
                            ? 'var(--accent-emerald)'
                            : rx.status === 'Sent to Pharmacist'
                            ? '#b45309'
                            : 'var(--slate-400)',
                      }}
                    >
                      {rx.status === 'Dispensed'
                        ? 'Dispensed'
                        : rx.status === 'Delivered'
                        ? 'Delivered'
                        : rx.status === 'Sent to Pharmacist'
                        ? 'Sent'
                        : 'Pending'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DoctorLayout>
  );
};

export default DoctorPrescriptions;
