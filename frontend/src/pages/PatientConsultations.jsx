import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../services/profileService';
import { getMyConsultations } from '../services/consultationService';
import PatientLayout from '../components/PatientLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  Stethoscope,
  Calendar,
  Building,
  MapPin,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  Video,
  UserCheck,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';

const PatientConsultations = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [profileRes, consultRes] = await Promise.allSettled([
          getMyProfile(),
          getMyConsultations(),
        ]);

        if (isMounted) {
          if (profileRes.status === 'fulfilled' && profileRes.value) {
            setProfile(profileRes.value.profile || {});
          }
          if (consultRes.status === 'fulfilled' && consultRes.value) {
            setConsultations(consultRes.value.consultations || []);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load consultation records:', err.message);
          setError('Failed to load consultation records. Please refresh.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading consultation history..." />;
  }

  return (
    <PatientLayout patientProfile={profile}>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--slate-900)',
            }}
          >
            My Consultations
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              border: '1px solid var(--primary-200)',
            }}
          >
            Clinical History
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Review your verified doctor consultations, diagnoses, and medical care plans.
        </p>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* CONSULTATIONS LIST OR EMPTY STATE */}
      {consultations.length === 0 ? (
        <div
          className="dashboard-card-section"
          style={{
            textAlign: 'center',
            padding: '3.5rem 2rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--accent-emerald-light)',
              color: 'var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              border: '1px solid #a7f3d0',
            }}
          >
            <Stethoscope size={32} />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--slate-900)',
              marginBottom: '0.5rem',
            }}
          >
            No consultations available.
          </h2>
          <p
            style={{
              fontSize: '0.925rem',
              color: 'var(--slate-500)',
              maxWidth: '520px',
              margin: '0 auto 2rem auto',
              lineHeight: 1.6,
            }}
          >
            Clinical consultations documented by your physician will appear here, complete with
            specialty notes, diagnostic findings, treatment instructions, and follow-up guidance.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              color: 'var(--slate-600)',
              fontWeight: 600,
            }}
          >
            <Sparkles size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Consultation records are maintained securely in your permanent MedWise EHR</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {consultations.map((consultation) => {
            const isOnline = consultation.consultationType === 'Online';

            return (
              <div
                key={consultation._id}
                className="dashboard-card-section"
                style={{ marginBottom: 0 }}
              >
                {/* CARD TOP HEADER */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--slate-100)',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--accent-emerald-light)',
                        color: 'var(--accent-emerald)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Stethoscope size={24} />
                    </div>
                    <div>
                      <h3
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--slate-900)',
                          margin: 0,
                        }}
                      >
                        {consultation.doctorName}
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                        {consultation.doctorSpecialization}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Consultation Type Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-full)',
                        background: isOnline ? '#eff6ff' : '#f0fdf4',
                        color: isOnline ? '#1d4ed8' : '#15803d',
                        border: `1px solid ${isOnline ? '#bfdbfe' : '#bbf7d0'}`,
                      }}
                    >
                      {isOnline ? <Video size={12} /> : <UserCheck size={12} />}
                      <span>{consultation.consultationType}</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-full)',
                        background:
                          consultation.status === 'Completed'
                            ? 'var(--accent-emerald-light)'
                            : consultation.status === 'Follow-up Needed'
                            ? '#fef3c7'
                            : 'var(--slate-100)',
                        color:
                          consultation.status === 'Completed'
                            ? 'var(--accent-emerald)'
                            : consultation.status === 'Follow-up Needed'
                            ? '#92400e'
                            : 'var(--slate-700)',
                      }}
                    >
                      {consultation.status}
                    </span>
                  </div>
                </div>

                {/* DETAILS GRID */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div className="profile-field-item">
                    <span className="profile-field-label">
                      <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Consultation Date
                    </span>
                    <span className="profile-field-value">
                      {formatDisplayDate(consultation.consultationDate)}
                    </span>
                  </div>

                  <div className="profile-field-item">
                    <span className="profile-field-label">
                      <Building size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Hospital / Clinic
                    </span>
                    <span className="profile-field-value">
                      {consultation.hospitalClinicName || ''}
                    </span>
                  </div>

                  <div className="profile-field-item">
                    <span className="profile-field-label">
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Facility Location
                    </span>
                    <span className="profile-field-value">
                      {consultation.hospitalClinicLocation || ''}
                    </span>
                  </div>

                  {consultation.followUpDate && (
                    <div className="profile-field-item">
                      <span className="profile-field-label">
                        <CalendarCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Follow-Up Date
                      </span>
                      <span className="profile-field-value" style={{ color: 'var(--primary-700)' }}>
                        {formatDisplayDate(consultation.followUpDate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* REASON FOR VISIT */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Reason for Visit / Primary Concern
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                    {consultation.reasonForVisit}
                  </div>
                </div>

                {/* CLINICAL NOTES, DIAGNOSIS & RECOMMENDATIONS */}
                {(consultation.clinicalNotes || consultation.diagnosisNotes || consultation.doctorRecommendations) && (
                  <div
                    style={{
                      background: 'var(--slate-50)',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {consultation.clinicalNotes && (
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                          Clinical Notes / HPI
                        </span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--slate-700)', margin: 0, whiteSpace: 'pre-line' }}>
                          {consultation.clinicalNotes}
                        </p>
                      </div>
                    )}

                    {consultation.diagnosisNotes && (
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                          Clinical Assessment / Diagnosis
                        </span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--slate-700)', margin: 0, whiteSpace: 'pre-line' }}>
                          {consultation.diagnosisNotes}
                        </p>
                      </div>
                    )}

                    {consultation.doctorRecommendations && (
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                          Doctor's Recommendations & Instructions
                        </span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--slate-700)', margin: 0, whiteSpace: 'pre-line' }}>
                          {consultation.doctorRecommendations}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PatientLayout>
  );
};

export default PatientConsultations;
