import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDoctorClinicalOverview } from '../services/doctorService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  BarChart3,
  Users,
  Calendar,
  Pill,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const DoctorClinicalOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchOverview = async () => {
      try {
        const res = await getDoctorClinicalOverview();
        if (isMounted && res) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Clinical overview fetch note:', err.message);
          setError('Failed to load clinical analytics summary.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading clinical practice analytics..." />;
  }

  const metrics = data?.metrics || {
    totalPatients: 0,
    totalConsultations: 0,
    totalPrescriptions: 0,
    approvedPrescriptions: 0,
    pendingReviews: 0,
    sentToPharmacy: 0,
    dispensed: 0,
  };
  const recentConsultations = data?.recentConsultations || [];
  const recentPrescriptions = data?.recentPrescriptions || [];

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
            Clinical Overview
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              border: '1px solid var(--primary-200)',
            }}
          >
            Practice Analytics
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          High-level operational metrics and clinical volume summaries across your MedWise practice.
        </p>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* METRIC STATS */}
      <div className="summary-stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-summary-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}>
            <Users size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{metrics.totalPatients}</span>
            <span className="stat-label-text">Total Active Patients</span>
          </div>
        </div>

        <div className="stat-summary-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--primary-50)', color: 'var(--primary-700)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{metrics.totalConsultations}</span>
            <span className="stat-label-text">Documented Consults</span>
          </div>
        </div>

        <div className="stat-summary-card">
          <div className="stat-icon-wrapper" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <Pill size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{metrics.totalPrescriptions}</span>
            <span className="stat-label-text">Total Prescriptions</span>
          </div>
        </div>

        <div className="stat-summary-card">
          <div className="stat-icon-wrapper" style={{ background: '#fef3c7', color: '#b45309' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{metrics.pendingReviews}</span>
            <span className="stat-label-text">Awaiting Review</span>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SUMMARY: RECENT CONSULTATIONS + RECENT PRESCRIPTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.75rem' }}>
        {/* RECENT CONSULTATIONS */}
        <div className="dashboard-card-section">
          <div className="card-section-header">
            <div className="card-section-title-wrap">
              <Calendar size={20} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-section-title">Recent Consultations</h2>
            </div>
            <Link to="/doctor/consultations" style={{ fontSize: '0.85rem', color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none' }}>
              View All
            </Link>
          </div>

          {recentConsultations.length === 0 ? (
            <div className="empty-state-card" style={{ padding: '2rem' }}>
              <p className="empty-state-text">No consultations recorded yet.</p>
            </div>
          ) : (
            <div className="patient-info-list">
              {recentConsultations.map((c) => (
                <div key={c._id} className="info-item-row">
                  <div className="info-item-main">
                    <span className="info-item-title">{c.patientName || 'Patient'}</span>
                    <span className="info-item-subtitle">{c.reasonForVisit}</span>
                  </div>
                  <span className="info-item-tag">{formatDisplayDate(c.consultationDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT PRESCRIPTIONS */}
        <div className="dashboard-card-section">
          <div className="card-section-header">
            <div className="card-section-title-wrap">
              <Pill size={20} style={{ color: '#6d28d9' }} />
              <h2 className="card-section-title">Recent Prescriptions</h2>
            </div>
            <Link to="/doctor/prescriptions" style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 600, textDecoration: 'none' }}>
              View All
            </Link>
          </div>

          {recentPrescriptions.length === 0 ? (
            <div className="empty-state-card" style={{ padding: '2rem' }}>
              <p className="empty-state-text">No prescriptions drafted yet.</p>
            </div>
          ) : (
            <div className="patient-info-list">
              {recentPrescriptions.map((rx) => (
                <div key={rx._id} className="info-item-row">
                  <div className="info-item-main">
                    <span className="info-item-title">{rx.prescriptionId} - {rx.patientName}</span>
                    <span className="info-item-subtitle">{rx.medicines?.length || 0} medications</span>
                  </div>
                  <span
                    className="info-item-tag"
                    style={{
                      background: rx.status === 'Approved' ? 'var(--accent-emerald-light)' : '#fef3c7',
                      color: rx.status === 'Approved' ? 'var(--accent-emerald)' : '#92400e',
                    }}
                  >
                    {rx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DoctorLayout>
  );
};

export default DoctorClinicalOverview;
