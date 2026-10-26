import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../services/profileService';
import { getPrescriptions } from '../services/prescriptionService';
import { getMyConsultations } from '../services/consultationService';
import PatientLayout from '../components/PatientLayout';
import Loading from '../components/Loading';
import { formatPatientId, getGreeting, formatDisplayDate } from '../utils/patientUtils';
import {
  CreditCard,
  Pill,
  Activity,
  FileText,
  HeartPulse,
  Calendar,
  CalendarCheck,
  AlertCircle,
  ArrowRight,
  Droplet,
  ExternalLink,
} from 'lucide-react';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchPatientData = async () => {
      try {
        const [profRes, rxRes, consultRes] = await Promise.all([
          getMyProfile(),
          getPrescriptions(),
          getMyConsultations(),
        ]);
        if (isMounted) {
          if (profRes) setProfile(profRes.profile || {});
          if (rxRes && rxRes.success) setPrescriptions(rxRes.prescriptions || []);
          if (consultRes && consultRes.success) setConsultations(consultRes.consultations || []);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Dashboard profile load error:', err.message);
          setError('Could not load health information. Please refresh.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPatientData();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading your health portal..." />;
  }

  const patientName = user?.name || profile?.name || 'Patient';
  const mobile = profile?.mobileNumber || user?.mobileNumber || '';
  const pid = formatPatientId(mobile);

  const conditions = Array.isArray(profile?.medicalConditions) ? profile.medicalConditions : [];
  const medications = Array.isArray(profile?.currentMedications) ? profile.currentMedications.filter(m => m.status !== 'INACTIVE') : [];
  const surgeries = Array.isArray(profile?.previousSurgeries) ? profile.previousSurgeries : [];

  const bloodGroup = (profile?.bloodGroup && profile.bloodGroup !== 'Unknown') ? profile.bloodGroup : 'Select Blood Group';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const upcomingFollowUps = (consultations || [])
    .filter((c) => c && c.followUpDate && new Date(c.followUpDate) >= startOfToday)
    .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

  return (
    <PatientLayout patientProfile={profile}>
      {/* WELCOME BANNER */}
      <div className="dashboard-welcome-banner">
        <div>
          <h1 className="welcome-banner-title">{getGreeting(patientName)}</h1>
          <p className="welcome-banner-subtitle">
            Here's your health information at a glance.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
          <HeartPulse size={42} style={{ color: '#a7f3d0' }} />
        </div>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* SUMMARY STATS GRID */}
      <div className="summary-stats-grid">
        {/* 1. Patient ID */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}
          >
            <CreditCard size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text" style={{ fontSize: '1.15rem' }}>{pid}</span>
            <span className="stat-label-text">Patient ID</span>
          </div>
        </div>

        {/* 2. Active Medications */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}
          >
            <Pill size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{medications.length}</span>
            <span className="stat-label-text">Active Medications</span>
          </div>
        </div>

        {/* 3. Medical Conditions */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: '#fef3c7', color: '#b45309' }}
          >
            <Activity size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{conditions.length}</span>
            <span className="stat-label-text">Medical Conditions</span>
          </div>
        </div>

        {/* 4. Prescriptions */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: '#ede9fe', color: '#6d28d9' }}
          >
            <FileText size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{prescriptions.length}</span>
            <span className="stat-label-text">Prescriptions</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTIONS */}
      <div className="patient-grid-layout">
        {/* SECTION 1: HEALTH OVERVIEW */}
        <div className="dashboard-card-section">
          <div className="card-section-header">
            <div className="card-section-title-wrap">
              <HeartPulse size={20} style={{ color: 'var(--accent-emerald)' }} />
              <h2 className="card-section-title">Health Overview</h2>
            </div>
            <Link
              to="/patient/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--accent-emerald)',
                textDecoration: 'none',
              }}
            >
              <span>Manage Profile</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Blood Group Highlight */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.25rem',
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Droplet size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Blood Group
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {bloodGroup}
              </div>
            </div>
          </div>

          {/* Medical Conditions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--slate-800)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Activity size={16} style={{ color: '#b45309' }} />
              <span>Medical Conditions ({conditions.length})</span>
            </h3>

            {conditions.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '1.5rem 1rem' }}>
                <p className="empty-state-text" style={{ fontSize: '0.875rem' }}>No medical conditions added.</p>
                <p className="empty-state-subtext">You can document chronic conditions in your profile.</p>
              </div>
            ) : (
              <div className="patient-info-list">
                {conditions.map((item, idx) => (
                  <div key={idx} className="info-item-row">
                    <div className="info-item-main">
                      <span className="info-item-title">{item.name}</span>
                      {item.notes && <span className="info-item-subtitle">{item.notes}</span>}
                    </div>
                    {item.sinceYear && (
                      <span className="info-item-tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Since {item.sinceYear}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Medications */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--slate-800)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Pill size={16} style={{ color: 'var(--primary-600)' }} />
              <span>Current Medications ({medications.length})</span>
            </h3>

            {medications.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '1.5rem 1rem' }}>
                <p className="empty-state-text" style={{ fontSize: '0.875rem' }}>No current medications added.</p>
                <p className="empty-state-subtext">Add ongoing prescribed medications in your profile.</p>
              </div>
            ) : (
              <div className="patient-info-list">
                {medications.map((item, idx) => (
                  <div key={idx} className="info-item-row">
                    <div className="info-item-main">
                      <span className="info-item-title">{item.name}</span>
                      <span className="info-item-subtitle">
                        {[item.dosage, item.frequency, item.notes].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                    {item.dosage && (
                      <span className="info-item-tag">{item.dosage}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Previous Major Surgeries Summary */}
          <div>
            <h3
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--slate-800)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={16} style={{ color: 'var(--slate-600)' }} />
              <span>Previous Major Surgeries ({surgeries.length})</span>
            </h3>

            {surgeries.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '1.5rem 1rem' }}>
                <p className="empty-state-text" style={{ fontSize: '0.875rem' }}>No surgical history added.</p>
                <p className="empty-state-subtext">Document previous major procedures in your profile.</p>
              </div>
            ) : (
              <div className="patient-info-list">
                {surgeries.map((item, idx) => (
                  <div key={idx} className="info-item-row">
                    <div className="info-item-main">
                      <span className="info-item-title">{item.surgeryName}</span>
                      <span className="info-item-subtitle">
                        {[item.hospital, item.notes].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                    {item.year && (
                      <span className="info-item-tag" style={{ background: 'var(--slate-200)', color: 'var(--slate-800)' }}>
                        {item.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* UPCOMING FOLLOW-UP SECTION */}
          {upcomingFollowUps.length > 0 && (
            <div className="dashboard-card-section" style={{ borderLeft: '4px solid var(--primary-600)' }}>
              <div className="card-section-header">
                <div className="card-section-title-wrap">
                  <CalendarCheck size={20} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-section-title">Upcoming Follow-up ({upcomingFollowUps.length})</h2>
                </div>
                <Link
                  to="/patient/consultations"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--primary-600)',
                    textDecoration: 'none',
                  }}
                >
                  <span>View All</span>
                  <ExternalLink size={14} />
                </Link>
              </div>

              <div className="patient-info-list">
                {upcomingFollowUps.map((c) => {
                  const docName = c.doctorName || (c.doctorId?.name ? `Dr. ${c.doctorId.name}` : 'Consulting Doctor');
                  const clinicName = c.hospitalClinicName || c.hospitalClinicLocation || 'City Health Center';
                  return (
                    <div key={c._id} className="info-item-row" style={{ padding: '1rem 1.25rem', alignItems: 'center' }}>
                      <div className="info-item-main">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <Calendar size={15} style={{ color: 'var(--primary-600)' }} />
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                            {formatDisplayDate(c.followUpDate)}
                          </span>
                        </div>
                        <span className="info-item-subtitle" style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                          Doctor: <strong>{docName}</strong> • {clinicName}
                        </span>
                      </div>

                      <Link
                        to="/patient/consultations"
                        className="btn-secondary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        View Consultation
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MY PRESCRIPTIONS PREVIEW */}
          <div className="dashboard-card-section">
          <div className="card-section-header">
            <div className="card-section-title-wrap">
              <FileText size={20} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-section-title">My Prescriptions ({prescriptions.length})</h2>
            </div>
            <Link
              to="/patient/prescriptions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--primary-600)',
                textDecoration: 'none',
              }}
            >
              <span>View All</span>
              <ExternalLink size={14} />
            </Link>
          </div>

          {prescriptions.length === 0 ? (
            <div className="empty-state-card" style={{ padding: '3rem 1.5rem' }}>
              <FileText className="empty-state-icon" size={42} style={{ color: 'var(--primary-500)', opacity: 0.8 }} />
              <p className="empty-state-text" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>No prescriptions available yet.</p>
              <p className="empty-state-subtext" style={{ maxWidth: '340px', margin: '0.5rem auto 1.5rem auto' }}>
                Prescriptions authored by your consulting doctor and audited through MedWise clinical safety checks will appear here.
              </p>
              <Link
                to="/patient/prescriptions"
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <FileText size={15} />
                <span>Go to Prescriptions</span>
              </Link>
            </div>
          ) : (
            <div className="patient-info-list">
              {prescriptions.slice(0, 3).map((rx) => {
                const docName = rx.doctorName || (rx.doctorId?.name ? `Dr. ${rx.doctorId.name}` : 'Consulting Doctor');
                const dateStr = rx.createdAt ? new Date(rx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                return (
                  <div key={rx._id} className="info-item-row" style={{ padding: '1rem 1.25rem' }}>
                    <div className="info-item-main">
                      <span className="info-item-title" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                        {rx.prescriptionId || rx._id}
                      </span>
                      <span className="info-item-subtitle">
                        Prescribed by {docName} {dateStr ? `• ${dateStr}` : ''}
                      </span>
                    </div>
                    <span className="info-item-tag" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                      {rx.status}
                    </span>
                  </div>
                );
              })}
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <Link
                  to="/patient/prescriptions"
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  <FileText size={15} />
                  <span>View All Prescriptions ({prescriptions.length})</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </PatientLayout>
);
};

export default PatientDashboard;
