import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDoctorDashboard } from '../services/doctorService';
import { getDoctorAppointments } from '../services/appointmentService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate, isFollowUpDateInFuture } from '../utils/patientUtils';
import {
  Stethoscope,
  Users,
  Calendar,
  Pill,
  AlertTriangle,
  ArrowRight,
  Clock,
  UserCheck,
  Search,
  PlusCircle,
  FileText,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  CalendarPlus,
  UserPlus,
  User,
} from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [appointmentData, setAppointmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todaySearch, setTodaySearch] = useState('');

  const loadDashboardAndAppointments = async () => {
    try {
      const [dash, appts] = await Promise.all([
        getDoctorDashboard(),
        getDoctorAppointments(),
      ]);
      setDashboardData(dash);
      setAppointmentData(appts);
    } catch (err) {
      console.warn('Dashboard/Appointments load error:', err.message);
      setError('Failed to load workspace data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardAndAppointments();
  }, []);

  if (loading) {
    return <Loading message="Initializing physician clinical workspace..." />;
  }

  const doctorName = user?.name || 'Physician';
  const stats = dashboardData?.stats || {
    todayConsultationsCount: 0,
    activePatientsCount: 0,
    todayPrescriptionsCount: 0,
    pendingMedwiseReviewsCount: 0,
  };

  const apptStats = appointmentData?.stats || {
    totalToday: 0,
    totalUpcoming: 0,
    totalNewPatients: 0,
    totalFollowUps: 0,
    todayFollowUpsCount: 0,
    upcomingFollowUpsCount: 0,
  };

  const todayConsultations = dashboardData?.todayConsultations || [];
  const todayAppointments = appointmentData?.categorized?.today || [];
  const newPatientAppts = appointmentData?.categorized?.newPatients || [];
  const followUpToday = appointmentData?.categorized?.followUps?.today || [];
  const followUpUpcoming = appointmentData?.categorized?.followUps?.upcoming || [];
  const followUpOverdue = appointmentData?.categorized?.followUps?.overdue || [];

  const filteredTodayAppointments = todayAppointments.filter((a) => {
    if (!todaySearch.trim()) return true;
    const q = todaySearch.toLowerCase().trim();
    return (
      (a.patientName && a.patientName.toLowerCase().includes(q)) ||
      (a.patientPid && a.patientPid.toLowerCase().includes(q)) ||
      (a.reason && a.reason.toLowerCase().includes(q))
    );
  });

  return (
    <DoctorLayout>
      {/* WELCOME BANNER */}
      <div
        className="dashboard-welcome-banner"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 className="welcome-banner-title">
            Good day, {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
          </h1>
          <p className="welcome-banner-subtitle" style={{ color: '#bae6fd' }}>
            Here's your clinical workspace and appointment schedule at a glance.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
          <Stethoscope size={42} style={{ color: '#7dd3fc' }} />
        </div>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* SUMMARY STATS GRID */}
      <div className="summary-stats-grid" style={{ marginBottom: '2rem' }}>
        {/* 1. Today's Appointments */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--primary-50)', color: 'var(--primary-700)' }}
          >
            <Calendar size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{apptStats.totalToday}</span>
            <span className="stat-label-text">Today's Appointments</span>
          </div>
        </div>

        {/* 2. Active Patients */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}
          >
            <Users size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{stats.activePatientsCount}</span>
            <span className="stat-label-text">Active Care Patients</span>
          </div>
        </div>

        {/* 3. Follow-up Appointments */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: '#e0f2fe', color: '#0284c7' }}
          >
            <CalendarPlus size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{apptStats.totalFollowUps}</span>
            <span className="stat-label-text">Follow-up Appointments</span>
          </div>
        </div>

        {/* 4. Pending MedWise Reviews */}
        <div className="stat-summary-card">
          <div
            className="stat-icon-wrapper"
            style={{
              background: stats.pendingMedwiseReviewsCount > 0 ? '#fef3c7' : 'var(--slate-100)',
              color: stats.pendingMedwiseReviewsCount > 0 ? '#b45309' : 'var(--slate-600)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info-wrap">
            <span className="stat-value-text">{stats.pendingMedwiseReviewsCount}</span>
            <span className="stat-label-text">Pending Safety Reviews</span>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS PANEL */}
      <div
        className="dashboard-card-section"
        style={{
          marginBottom: '2rem',
          background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
          border: '1px solid var(--slate-200)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sparkles size={18} style={{ color: 'var(--primary-600)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0 }}>
            Quick Actions
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >

          <button
            type="button"
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
            onClick={() => navigate('/doctor/patients')}
          >
            <Search size={16} />
            <span>Find Patient Record</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
            onClick={() => navigate('/doctor/consultations')}
          >
            <PlusCircle size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Start Consultation</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
            onClick={() => navigate('/doctor/medwise-reviews')}
          >
            <ShieldAlert size={16} style={{ color: '#d97706' }} />
            <span>Review Pending Checks</span>
          </button>
        </div>
      </div>

      {/* PROMINENT TODAY'S APPOINTMENTS COUNTER BANNER */}
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--slate-200)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={28} />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Daily Schedule
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              Today's Appointments: {apptStats.totalToday}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 500 }}>
          {apptStats.totalToday === 0
            ? 'No outpatient appointments scheduled for today'
            : `${apptStats.totalToday} confirmed ${apptStats.totalToday === 1 ? 'appointment' : 'appointments'} scheduled for your clinical session`}
        </div>
      </div>

      {/* TODAY'S APPOINTMENTS SECTION */}
      <div className="dashboard-card-section" style={{ marginBottom: '2rem' }}>
        <div className="card-section-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-section-title-wrap">
            <Calendar size={20} style={{ color: 'var(--primary-600)' }} />
            <h2 className="card-section-title">Today's Appointments</h2>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--slate-600)' }}>
            {todayAppointments.length} Confirmed Today
          </span>
        </div>

        {/* PATIENT SEARCH FILTER (Within authorized appointments) */}
        {todayAppointments.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="input-with-icon" style={{ maxWidth: '400px' }}>
              <Search className="input-icon" size={16} />
              <input
                type="text"
                className="form-input"
                placeholder="Search today's appointments by name or PID..."
                value={todaySearch}
                onChange={(e) => setTodaySearch(e.target.value)}
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
              {todaySearch && (
                <button
                  type="button"
                  onClick={() => setTodaySearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--slate-400)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {todayAppointments.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '2.5rem 1.5rem' }}>
            <Calendar className="empty-state-icon" size={36} />
            <p className="empty-state-text">No appointments scheduled for today.</p>
            <p className="empty-state-subtext">
              Confirmed outpatient appointments scheduled by hospital administration will appear here automatically.
            </p>
          </div>
        ) : filteredTodayAppointments.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '2rem 1.5rem' }}>
            <Search className="empty-state-icon" size={32} />
            <p className="empty-state-text">No today's appointments match "{todaySearch}".</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setTodaySearch('')}
              style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="patient-info-list">
            {filteredTodayAppointments.map((appt) => (
              <div
                key={appt._id}
                className="info-item-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  padding: '1rem 1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* PATIENT INFO & SCHEDULED TIME */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px', flex: '1 1 auto' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background:
                        appt.appointmentType === 'FOLLOW_UP' ? '#e0f2fe' : 'var(--accent-emerald-light)',
                      color:
                        appt.appointmentType === 'FOLLOW_UP' ? '#0284c7' : 'var(--accent-emerald)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--slate-900)' }}>
                        {appt.patientName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          color: 'var(--accent-emerald)',
                          background: 'var(--accent-emerald-light)',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 700,
                        }}
                      >
                        {appt.patientPid}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '3px' }}>
                      Scheduled: <strong>{appt.appointmentTime || '10:00 AM'}</strong> • {formatDisplayDate(appt.appointmentDate)}
                    </div>
                  </div>
                </div>

                {/* STATUS & ACTIONS GROUP (Horizontally aligned, vertically centered, uniform heights) */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    flexShrink: 0,
                    flexWrap: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      height: '36px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      whiteSpace: 'nowrap',
                      background:
                        appt.status === 'COMPLETED' ? '#f1f5f9' : 'var(--accent-emerald-light)',
                      color:
                        appt.status === 'COMPLETED' ? 'var(--slate-600)' : 'var(--accent-emerald)',
                      border: `1px solid ${appt.status === 'COMPLETED' ? 'var(--slate-200)' : '#a7f3d0'}`,
                      boxSizing: 'border-box',
                    }}
                  >
                    {appt.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED'}
                  </span>

                  {appt.status !== 'COMPLETED' ? (
                    <Link
                      to={`/doctor/consultations/new?patientId=${appt.patientId?._id || appt.patientId}&appointmentId=${appt._id}`}
                      className="btn-primary"
                      style={{
                        height: '36px',
                        padding: '0 0.95rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                      }}
                    >
                      <Stethoscope size={15} />
                      <span>Start Consultation</span>
                    </Link>
                  ) : (
                    <Link
                      to={`/doctor/consultations/${appt.consultationId?._id || appt.consultationId}`}
                      className="btn-secondary"
                      style={{
                        height: '36px',
                        padding: '0 0.95rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                      }}
                    >
                      View Consultation
                    </Link>
                  )}

                  <Link
                    to={`/doctor/patients/${appt.patientId?._id || appt.patientId}`}
                    className="btn-secondary"
                    style={{
                      height: '36px',
                      padding: '0 0.95rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box',
                    }}
                  >
                    Open Patient
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOLLOW-UP APPOINTMENTS SECTION — CORE FEATURE */}
      <div className="dashboard-card-section" style={{ marginBottom: '2rem' }}>
        <div className="card-section-header">
          <div className="card-section-title-wrap">
            <CalendarPlus size={20} style={{ color: '#0284c7' }} />
            <h2 className="card-section-title">Follow-up Appointments</h2>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-600)' }}>
            Auto-generated from Consultations
          </span>
        </div>

        {/* OVERDUE FOLLOW-UPS (PENDING) */}
        {followUpOverdue.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></span>
              Overdue Follow-ups ({followUpOverdue.length})
            </h3>
            <div className="patient-info-list" style={{ marginBottom: '1rem' }}>
              {followUpOverdue.map((f) => (
                <div
                  key={f._id}
                  className="info-item-row"
                  style={{ alignItems: 'center', flexWrap: 'wrap', borderLeft: '4px solid #dc2626' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                        {f.patientName}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        {f.patientPid}
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
                      Scheduled Follow-up: {formatDisplayDate(f.appointmentDate)} (Overdue)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                      {f.reason}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link
                      to={`/doctor/consultations/new?patientId=${f.patientId?._id || f.patientId}&appointmentId=${f._id}`}
                      className="btn-primary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <Stethoscope size={14} />
                      <span>Start Follow-up Consultation</span>
                    </Link>
                    <Link
                      to={`/doctor/patients/${f.patientId?._id || f.patientId}`}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Patient Record
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* A. TODAY'S FOLLOW-UPS */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }}></span>
            Today's Follow-ups ({followUpToday.length})
          </h3>

          {followUpToday.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontStyle: 'italic', margin: '0 0 1rem 0' }}>
              No follow-up appointments scheduled for today.
            </p>
          ) : (
            <div className="patient-info-list" style={{ marginBottom: '1rem' }}>
              {followUpToday.map((f) => (
                <div
                  key={f._id}
                  className="info-item-row"
                  style={{ alignItems: 'center', flexWrap: 'wrap', borderLeft: '4px solid var(--accent-emerald)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                        {f.patientName}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        {f.patientPid}
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-800)', fontWeight: 600 }}>
                      Follow-up Date: {formatDisplayDate(f.appointmentDate)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                      {f.reason}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link
                      to={`/doctor/consultations/new?patientId=${f.patientId?._id || f.patientId}&appointmentId=${f._id}`}
                      className="btn-primary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <Stethoscope size={14} />
                      <span>Start Follow-up Consultation</span>
                    </Link>
                    <Link
                      to={`/doctor/patients/${f.patientId?._id || f.patientId}`}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Patient Record
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B. UPCOMING FOLLOW-UPS */}
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
            Upcoming Follow-ups ({followUpUpcoming.length})
          </h3>

          {followUpUpcoming.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontStyle: 'italic', margin: 0 }}>
              No upcoming follow-up appointments scheduled.
            </p>
          ) : (
            <div className="patient-info-list">
              {followUpUpcoming.map((f) => {
                const isFuture = isFollowUpDateInFuture(f.appointmentDate);
                const displayDate = formatDisplayDate(f.appointmentDate);

                return (
                  <div
                    key={f._id}
                    className="info-item-row"
                    style={{ alignItems: 'center', flexWrap: 'wrap', borderLeft: '4px solid #0284c7' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                          {f.patientName}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                          {f.patientPid}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-800)', fontWeight: 600 }}>
                        Scheduled Follow-up: {displayDate}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        {f.reason}
                      </div>
                      {isFuture && (
                        <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Clock size={12} />
                          <span>Available from {displayDate}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isFuture ? (
                        <button
                          type="button"
                          disabled
                          className="btn-primary"
                          style={{
                            padding: '0.4rem 0.85rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: 0.55,
                            cursor: 'not-allowed',
                            backgroundColor: '#94a3b8',
                            borderColor: '#94a3b8',
                            color: '#ffffff',
                          }}
                          title={`Available from ${displayDate}`}
                        >
                          <Stethoscope size={14} />
                          <span>Start Follow-up Consultation</span>
                        </button>
                      ) : (
                        <Link
                          to={`/doctor/consultations/new?patientId=${f.patientId?._id || f.patientId}&appointmentId=${f._id}`}
                          className="btn-primary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <Stethoscope size={14} />
                          <span>Start Follow-up Consultation</span>
                        </Link>
                      )}
                      <Link
                        to={`/doctor/patients/${f.patientId?._id || f.patientId}`}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Patient Record
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DoctorLayout>
  );
};

export default DoctorDashboard;
