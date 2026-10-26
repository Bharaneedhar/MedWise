import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDoctorMedwiseReviews } from '../services/doctorService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  FileText,
  Sparkles,
} from 'lucide-react';

const DoctorMedwiseReviews = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        const res = await getDoctorMedwiseReviews();
        if (isMounted && res) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('MedWise reviews fetch error:', err.message);
          setError('Failed to load MedWise review queues.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading MedWise clinical decision reviews..." />;
  }

  const summary = data?.summary || { total: 0, pendingCount: 0, recommendedCount: 0, criticalCount: 0, approvedCount: 0 };
  const categories = data?.categories || { pendingReview: [], reviewRecommended: [], criticalAlerts: [], clearedApproved: [] };

  const currentList =
    activeCategory === 'pending'
      ? categories.pendingReview
      : activeCategory === 'recommended'
      ? categories.reviewRecommended
      : activeCategory === 'critical'
      ? categories.criticalAlerts
      : categories.clearedApproved;

  return (
    <DoctorLayout>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--slate-900)',
            }}
          >
            MedWise Reviews
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
            }}
          >
            Clinical Decision Support
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Review prescriptions requiring clinical safety validation, dosage evaluation, or drug-drug interaction oversight.
        </p>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 SUMMARY STAT CARDS */}
      <div className="summary-stats-grid" style={{ marginBottom: '2rem' }}>
        <div
          className="stat-summary-card"
          onClick={() => setActiveCategory('pending')}
          style={{ cursor: 'pointer', border: activeCategory === 'pending' ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)' }}
        >
          <div className="stat-icon-wrapper" style={{ background: 'var(--slate-100)', color: 'var(--slate-700)' }}>
            <Clock size={22} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{summary.pendingCount}</span>
            <span className="stat-label-text">Pending Review</span>
          </div>
        </div>

        <div
          className="stat-summary-card"
          onClick={() => setActiveCategory('recommended')}
          style={{ cursor: 'pointer', border: activeCategory === 'recommended' ? '2px solid #d97706' : '1px solid var(--slate-200)' }}
        >
          <div className="stat-icon-wrapper" style={{ background: '#fef3c7', color: '#b45309' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{summary.recommendedCount}</span>
            <span className="stat-label-text">Review Recommended</span>
          </div>
        </div>

        <div
          className="stat-summary-card"
          onClick={() => setActiveCategory('critical')}
          style={{ cursor: 'pointer', border: activeCategory === 'critical' ? '2px solid #dc2626' : '1px solid var(--slate-200)' }}
        >
          <div className="stat-icon-wrapper" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{summary.criticalCount}</span>
            <span className="stat-label-text">Critical Alerts</span>
          </div>
        </div>

        <div
          className="stat-summary-card"
          onClick={() => setActiveCategory('approved')}
          style={{ cursor: 'pointer', border: activeCategory === 'approved' ? '2px solid var(--accent-emerald)' : '1px solid var(--slate-200)' }}
        >
          <div className="stat-icon-wrapper" style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{summary.approvedCount}</span>
            <span className="stat-label-text">Cleared / Approved</span>
          </div>
        </div>
      </div>

      {/* CATEGORY LIST */}
      <div className="dashboard-card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--primary-600)' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0, textTransform: 'capitalize' }}>
              {activeCategory === 'pending'
                ? 'Pending Review Queue'
                : activeCategory === 'recommended'
                ? 'Review Recommended Prescriptions'
                : activeCategory === 'critical'
                ? 'Critical Safety Alerts'
                : 'Cleared / Approved Prescriptions'}
            </h2>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-500)' }}>
            {currentList.length} prescriptions
          </span>
        </div>

        {currentList.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '3rem 1.5rem' }}>
            <ShieldCheck className="empty-state-icon" size={40} style={{ color: 'var(--accent-emerald)' }} />
            <p className="empty-state-text">No prescriptions in this review category.</p>
            <p className="empty-state-subtext">All clinical safety queues are currently up to date.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {currentList.map((rx) => (
              <div
                key={rx._id}
                className="info-item-row"
                style={{ alignItems: 'center', flexWrap: 'wrap', padding: '1rem', gap: '1rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--primary-50)',
                      color: 'var(--primary-700)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.95rem' }}>
                      {rx.prescriptionId}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                      {rx.patientName}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      {rx.patientPid}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                    {rx.medicines?.length || 0} Medications Prescribed
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                    {rx.medwiseChecks?.overallRecommendation || 'Review pending engine evaluation'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className="info-item-tag"
                    style={{
                      background: rx.status === 'Approved' ? 'var(--accent-emerald-light)' : '#fef3c7',
                      color: rx.status === 'Approved' ? 'var(--accent-emerald)' : '#92400e',
                    }}
                  >
                    {rx.status}
                  </span>

                  <Link
                    to={`/doctor/prescriptions/${rx._id}`}
                    className="btn-primary"
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <Eye size={14} />
                    <span>Review & Decide</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
};

export default DoctorMedwiseReviews;
