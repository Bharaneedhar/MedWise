import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPatientClinicalRecord, updatePatientMedicationStatus } from '../services/doctorService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  User,
  Activity,
  Pill,
  Calendar,
  FileText,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  Droplet,
  MapPin,
  PhoneCall,
  Clock,
  CheckCircle2,
  PlusCircle,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Building,
  CalendarCheck,
  Video,
  UserCheck,
  ExternalLink,
  PackageCheck,
  Truck,
  AlertCircle,
} from 'lucide-react';

const PatientClinicalRecord = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');

  const handleStatusChange = async (medicationId, newStatus) => {
    try {
      await updatePatientMedicationStatus(patientId, medicationId, newStatus);
      const data = await getPatientClinicalRecord(patientId);
      if (data && data.record) {
        setRecord(data.record);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update medication status');
    }
  };


  useEffect(() => {
    let isMounted = true;
    const fetchRecord = async () => {
      try {
        const data = await getPatientClinicalRecord(patientId);
        if (isMounted && data && data.record) {
          setRecord(data.record);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load clinical record:', err.message);
          setError(err.response?.data?.message || 'Failed to load patient clinical record.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchRecord();
    return () => {
      isMounted = false;
    };
  }, [patientId]);

  if (loading) {
    return <Loading message="Loading patient longitudinal clinical record..." />;
  }

  if (error || !record) {
    return (
      <DoctorLayout>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/doctor/patients"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Patients</span>
          </Link>
        </div>
        <div className="alert-box error" role="alert">
          <AlertTriangle className="alert-icon" />
          <span>{error || 'Patient record could not be loaded.'}</span>
        </div>
      </DoctorLayout>
    );
  }

  const consultations = record.consultations || [];
  const prescriptions = record.prescriptions || [];
  const conditions = record.medicalConditions || [];
  const allMedications = record.currentMedications || [];
  const activeMedications = allMedications.filter((m) => m.status !== 'INACTIVE');
  const inactiveMedications = allMedications.filter((m) => m.status === 'INACTIVE');
  const surgeries = record.previousSurgeries || [];
  const allergies = record.allergies || [];
  const hasNoKnownAllergies = record.hasNoKnownAllergies === true;

  // Combine Consultations and Prescriptions for Chronological Clinical Timeline (Newest First)
  const timelineItems = [
    ...consultations.map((c) => ({
      itemType: 'consultation',
      sortDate: new Date(c.consultationDate || c.createdAt),
      data: c,
    })),
    ...prescriptions.map((p) => ({
      itemType: 'prescription',
      sortDate: new Date(p.createdAt),
      data: p,
    })),
  ].sort((a, b) => b.sortDate - a.sortDate);

  return (
    <DoctorLayout>
      {/* BACK BUTTON */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/doctor/patients"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--slate-600)',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to My Patients</span>
        </Link>
      </div>

      {/* PATIENT BANNER / HEADER */}
      <div
        className="dashboard-card-section"
        style={{
          padding: '1.75rem',
          marginBottom: '1.75rem',
          background: 'linear-gradient(to right, #ffffff, #f8fafc)',
          border: '1px solid var(--slate-200)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {record.profilePhoto ? (
              <img
                src={record.profilePhoto}
                alt={record.name}
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--slate-200)',
                }}
              />
            ) : (
              <div
                className="user-avatar-circle"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                }}
              >
                {record.name ? record.name.charAt(0).toUpperCase() : 'P'}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                  {record.name}
                </h1>
                {record.bloodGroup && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      background: '#fee2e2',
                      color: '#dc2626',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Droplet size={13} />
                    <span>{record.bloodGroup}</span>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                {record.pid && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-emerald)', background: 'var(--accent-emerald-light)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    {record.pid}
                  </span>
                )}
                {record.age && <span>{record.age} years old</span>}
                {record.gender && (
                  <>
                    <span>•</span>
                    <span>{record.gender}</span>
                  </>
                )}
                {record.dateOfBirth && (
                  <>
                    <span>•</span>
                    <span>DOB: {formatDisplayDate(record.dateOfBirth)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CLINICAL ACTIONS */}
          {(() => {
            const latestCompleted = consultations.find((c) => ['Completed', 'Follow-up Needed'].includes(c.status));
            return (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Link
                  to={`/doctor/consultations/new?patientId=${record.patientId}`}
                  className={latestCompleted ? 'btn-secondary' : 'btn-primary'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  <Stethoscope size={16} />
                  <span>Start Consultation</span>
                </Link>

                {latestCompleted ? (
                  <Link
                    to={`/doctor/prescriptions/new?consultationId=${latestCompleted._id}&patientId=${record.patientId}`}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    <Pill size={16} />
                    <span>Create Prescription</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Complete a consultation first before creating a prescription"
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', opacity: 0.65, cursor: 'not-allowed' }}
                  >
                    <Pill size={16} />
                    <span>Create Prescription (Consultation Required)</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--slate-200)',
          marginBottom: '1.75rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'timeline', label: `Clinical Timeline (${timelineItems.length})`, icon: <Clock size={16} /> },
          { id: 'consultations', label: `Consultations (${consultations.length})`, icon: <Calendar size={16} /> },
          { id: 'prescriptions', label: `Prescriptions (${prescriptions.length})`, icon: <FileText size={16} /> },
          { id: 'medications', label: `Current Medications (${activeMedications.length})`, icon: <Pill size={16} /> },
          { id: 'overview', label: 'Health Overview', icon: <Activity size={16} /> },
          { id: 'safety', label: 'Safety & Allergies', icon: <ShieldAlert size={16} /> },
          { id: 'demographics', label: 'Demographics & Contact', icon: <User size={16} /> },
        ].map((tab) => (

          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab.id ? 700 : 600,
              color: activeTab === tab.id ? 'var(--primary-600)' : 'var(--slate-600)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary-600)' : 'transparent'}`,
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: CHRONOLOGICAL CLINICAL TIMELINE ──────────────── */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {timelineItems.length === 0 ? (
            <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <Clock className="empty-state-icon" size={40} style={{ color: 'var(--slate-400)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                No clinical history available.
              </h2>
            </div>
          ) : (
            timelineItems.map((item, idx) => {
              if (item.itemType === 'consultation') {
                const c = item.data;
                const isOnline = c.consultationType === 'Online';
                return (
                  <div
                    key={`consult-${c._id || idx}`}
                    className="dashboard-card-section"
                    style={{
                      marginBottom: 0,
                      borderLeft: '4px solid var(--primary-600)',
                    }}
                  >
                    {/* TIMELINE HEADER */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid var(--slate-100)',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--primary-50)',
                            color: 'var(--primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Stethoscope size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--slate-900)' }}>
                              Clinical Consultation Encounter
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: 'var(--radius-full)',
                                background: isOnline ? '#eff6ff' : '#f0fdf4',
                                color: isOnline ? '#1d4ed8' : '#15803d',
                                border: `1px solid ${isOnline ? '#bfdbfe' : '#bbf7d0'}`,
                              }}
                            >
                              {isOnline ? <Video size={11} /> : <UserCheck size={11} />}
                              <span>{c.consultationType || 'In-person'}</span>
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                            Date: {formatDisplayDate(c.consultationDate)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {c.prescriptionId && (
                          <Link
                            to={`/doctor/prescriptions/${typeof c.prescriptionId === 'object' ? c.prescriptionId._id : c.prescriptionId}`}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Pill size={12} />
                            <span>Linked Prescription</span>
                          </Link>
                        )}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            background: c.status === 'Completed' ? 'var(--accent-emerald-light)' : '#fef3c7',
                            color: c.status === 'Completed' ? 'var(--accent-emerald)' : '#92400e',
                          }}
                        >
                          {c.status}
                        </span>

                        <Link
                          to={`/doctor/consultations/${c._id}`}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>View Details</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>

                    {/* CLINICAL DETAILS */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Reason for Visit / Primary Concern:</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.925rem' }}>{c.reasonForVisit}</p>
                    </div>

                    {c.clinicalNotes && (
                      <div style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', border: '1px solid var(--slate-200)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>Clinical Notes / HPI:</span>
                        <p style={{ margin: '0.2rem 0 0 0', color: 'var(--slate-800)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.clinicalNotes}</p>
                      </div>
                    )}

                    {c.diagnosisNotes && (
                      <div style={{ background: '#fffbeb', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', border: '1px solid #fde68a' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Clinical Assessment / Diagnosis:</span>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#78350f', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.diagnosisNotes}</p>
                      </div>
                    )}

                    {c.doctorRecommendations && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>Doctor Recommendations & Plan:</span>
                        <p style={{ margin: '0.2rem 0 0 0', color: 'var(--slate-800)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.doctorRecommendations}</p>
                      </div>
                    )}
                  </div>
                );
              } else {
                const rx = item.data;
                const isDelivered = rx.status === 'Delivered';
                const isDispensed = rx.status === 'Dispensed';

                return (
                  <div
                    key={`rx-${rx._id || idx}`}
                    className="dashboard-card-section"
                    style={{
                      marginBottom: 0,
                      borderLeft: '4px solid var(--accent-emerald)',
                    }}
                  >
                    {/* PRESCRIPTION HEADER */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid var(--slate-100)',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--accent-emerald-light)',
                            color: 'var(--accent-emerald)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Pill size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                              {rx.prescriptionId}
                            </span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.25rem 0.65rem',
                                borderRadius: 'var(--radius-full)',
                                background: isDelivered ? '#d1fae5' : isDispensed ? '#e0f2fe' : rx.status === 'Approved' || rx.status === 'Sent to Pharmacist' ? 'var(--accent-emerald-light)' : '#fef3c7',
                                color: isDelivered ? '#065f46' : isDispensed ? '#0369a1' : rx.status === 'Approved' || rx.status === 'Sent to Pharmacist' ? 'var(--accent-emerald)' : '#92400e',
                              }}
                            >
                              {rx.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                            Date Drafted: {formatDisplayDate(rx.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {rx.consultationId && (
                          <Link
                            to={`/doctor/consultations/${typeof rx.consultationId === 'object' ? rx.consultationId._id : rx.consultationId}`}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Stethoscope size={12} />
                            <span>Linked Consultation</span>
                          </Link>
                        )}
                        <Link
                          to={`/doctor/prescriptions/${rx._id}`}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>View Prescription</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>

                    {/* MEDICINES SUMMARY */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                        Prescribed Medications ({rx.medicines?.length || 0})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(rx.medicines || []).map((med, mi) => (
                          <div
                            key={mi}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.65rem 0.85rem',
                              background: 'var(--slate-50)',
                              border: '1px solid var(--slate-200)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.875rem',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{med.medicineName}</span>
                            <span style={{ color: 'var(--slate-600)' }}>
                              {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SAVED MEDWISE DECISION SUPPORT REVIEW */}
                    {rx.medwiseChecks && (
                      <div
                        style={{
                          background: 'var(--slate-50)',
                          border: '1px solid var(--slate-200)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem 1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                          <ShieldCheck size={16} />
                          <span>MedWise Decision Support History</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>
                          {rx.medwiseChecks.overallRecommendation || 'MedWise clinical safety review archived.'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }
            })
          )}
        </div>
      )}

      {/* ── TAB 2: CONSULTATIONS HISTORY ────────────────────── */}
      {activeTab === 'consultations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {consultations.length === 0 ? (
            <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <Calendar className="empty-state-icon" size={40} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                No consultations available.
              </h2>
            </div>
          ) : (
            consultations.map((c) => {
              const isOnline = c.consultationType === 'Online';
              return (
                <div key={c._id} className="dashboard-card-section" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Stethoscope size={20} style={{ color: 'var(--primary-600)' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--slate-900)' }}>
                          {c.doctorName}
                        </div>
                        {c.doctorSpecialization && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                            {c.doctorSpecialization}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {c.prescriptionId && (
                        <Link
                          to={`/doctor/prescriptions/${typeof c.prescriptionId === 'object' ? c.prescriptionId._id : c.prescriptionId}`}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: 'var(--radius-full)',
                            background: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Pill size={12} />
                          <span>Linked Prescription</span>
                        </Link>
                      )}

                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          background: c.status === 'Completed' ? 'var(--accent-emerald-light)' : '#fef3c7',
                          color: c.status === 'Completed' ? 'var(--accent-emerald)' : '#92400e',
                        }}
                      >
                        {c.status}
                      </span>

                      <Link
                        to={`/doctor/consultations/${c._id}`}
                        className="btn-primary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="profile-field-item">
                      <span className="profile-field-label">Consultation Date</span>
                      <span className="profile-field-value">{formatDisplayDate(c.consultationDate)}</span>
                    </div>

                    {c.hospitalClinicName && (
                      <div className="profile-field-item">
                        <span className="profile-field-label">Hospital / Clinic</span>
                        <span className="profile-field-value">{c.hospitalClinicName}</span>
                      </div>
                    )}

                    {c.hospitalClinicLocation && (
                      <div className="profile-field-item">
                        <span className="profile-field-label">Location / Address</span>
                        <span className="profile-field-value">{c.hospitalClinicLocation}</span>
                      </div>
                    )}

                    {c.followUpDate && (
                      <div className="profile-field-item">
                        <span className="profile-field-label">Scheduled Follow-Up</span>
                        <span className="profile-field-value" style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
                          {formatDisplayDate(c.followUpDate)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Reason for Visit:</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.925rem' }}>{c.reasonForVisit}</p>
                  </div>

                  {c.clinicalNotes && (
                    <div style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', border: '1px solid var(--slate-200)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>Clinical Notes / HPI:</span>
                      <p style={{ margin: '0.2rem 0 0 0', color: 'var(--slate-800)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.clinicalNotes}</p>
                    </div>
                  )}

                  {c.diagnosisNotes && (
                    <div style={{ background: '#fffbeb', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', border: '1px solid #fde68a' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Clinical Assessment / Diagnosis:</span>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#78350f', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.diagnosisNotes}</p>
                    </div>
                  )}

                  {c.doctorRecommendations && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>Recommendations & Plan:</span>
                      <p style={{ margin: '0.2rem 0 0 0', color: 'var(--slate-800)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{c.doctorRecommendations}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB 3: PRESCRIPTIONS & MEDWISE REVIEWS ──────────── */}
      {activeTab === 'prescriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {prescriptions.length === 0 ? (
            <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <FileText className="empty-state-icon" size={40} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                No prescriptions available.
              </h2>
              <Link
                to={`/doctor/prescriptions/new?patientId=${record.patientId}`}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '1rem', fontSize: '0.85rem' }}
              >
                <Pill size={16} />
                <span>Create Prescription</span>
              </Link>
            </div>
          ) : (
            prescriptions.map((rx) => {
              const isDelivered = rx.status === 'Delivered';
              const isDispensed = rx.status === 'Dispensed';

              return (
                <div key={rx._id} className="dashboard-card-section" style={{ marginBottom: 0 }}>
                  {/* HEADER */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                        {rx.prescriptionId}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                        {formatDisplayDate(rx.createdAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {rx.consultationId && (
                        <Link
                          to={`/doctor/consultations/${typeof rx.consultationId === 'object' ? rx.consultationId._id : rx.consultationId}`}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: 'var(--radius-full)',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Stethoscope size={12} />
                          <span>Linked Consultation</span>
                        </Link>
                      )}

                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          background: isDelivered ? '#d1fae5' : isDispensed ? '#e0f2fe' : rx.status === 'Approved' || rx.status === 'Sent to Pharmacist' ? 'var(--accent-emerald-light)' : '#fef3c7',
                          color: isDelivered ? '#065f46' : isDispensed ? '#0369a1' : rx.status === 'Approved' || rx.status === 'Sent to Pharmacist' ? 'var(--accent-emerald)' : '#92400e',
                        }}
                      >
                        {rx.status}
                      </span>

                      <Link
                        to={`/doctor/prescriptions/${rx._id}`}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>

                  {/* MEDICINES LIST */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                      Prescribed Medications ({rx.medicines?.length || 0})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(rx.medicines || []).map((med, mi) => (
                        <div
                          key={mi}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.65rem 0.85rem',
                            background: 'var(--slate-50)',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{med.medicineName}</span>
                          <span style={{ color: 'var(--slate-600)' }}>
                            {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SAVED MEDWISE DECISION SUPPORT REVIEW */}
                  {rx.medwiseChecks && (
                    <div
                      style={{
                        background: 'var(--slate-50)',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        <ShieldCheck size={16} />
                        <span>MedWise Decision Support History</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>
                        {rx.medwiseChecks.overallRecommendation || 'MedWise clinical safety review archived.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: CURRENT MEDICATIONS & HISTORY ───────────────────────── */}
      {activeTab === 'medications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ACTIVE MEDICATIONS */}
          <div className="profile-section-card full-width">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pill size={18} style={{ color: '#10b981' }} />
                <span>ACTIVE CURRENT MEDICATIONS ({activeMedications.length})</span>
              </h3>
            </div>
            {activeMedications.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '1.5rem' }}>
                <p className="empty-state-text">No active current medications documented for this patient.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {activeMedications.map((m, i) => (
                  <div
                    key={m._id || i}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)' }}>{m.name || m.genericName}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid #86efac' }}>
                          Status: ACTIVE
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--slate-100)', color: 'var(--slate-700)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                          Source: {m.source === 'PRESCRIPTION' ? 'Prescription' : 'Patient Reported'}
                        </span>
                        {m.prescriptionId && (
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                            Rx Ref: {typeof m.prescriptionId === 'object' ? m.prescriptionId.prescriptionId || m.prescriptionId._id : m.prescriptionId}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                        {[
                          m.strength || m.dosage ? `Strength: ${m.strength || m.dosage}` : null,
                          m.frequency ? `Frequency: ${m.frequency}` : null,
                          m.duration ? `Duration: ${m.duration}` : null,
                          m.route ? `Route: ${m.route}` : null,
                        ].filter(Boolean).join(' • ')}
                      </div>
                      {(m.instructions || m.notes) && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                          Instructions: {m.instructions || m.notes}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(m._id || m.id, 'INACTIVE')}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                      >
                        Mark INACTIVE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INACTIVE / HISTORICAL MEDICATIONS */}
          <div className="profile-section-card full-width">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--slate-500)' }} />
                <span>INACTIVE / HISTORICAL MEDICATIONS ({inactiveMedications.length})</span>
              </h3>
            </div>
            {inactiveMedications.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '1.5rem' }}>
                <p className="empty-state-text">No inactive or discontinued medication history found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {inactiveMedications.map((m, i) => (
                  <div
                    key={m._id || i}
                    style={{
                      background: 'var(--slate-50)',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      opacity: 0.85,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-700)', textDecoration: 'line-through' }}>{m.name || m.genericName}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f1f5f9', color: '#64748b', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid #cbd5e1' }}>
                          Status: INACTIVE
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--slate-100)', color: 'var(--slate-600)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                          Source: {m.source === 'PRESCRIPTION' ? 'Prescription' : 'Patient Reported'}
                        </span>
                        {m.stoppedAt && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                            Stopped: {formatDisplayDate(m.stoppedAt)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                        {[
                          m.strength || m.dosage ? `Strength: ${m.strength || m.dosage}` : null,
                          m.frequency ? `Frequency: ${m.frequency}` : null,
                          m.duration ? `Duration: ${m.duration}` : null,
                        ].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(m._id || m.id, 'ACTIVE')}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Mark ACTIVE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: HEALTH OVERVIEW ───────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {conditions.length === 0 && activeMedications.length === 0 && surgeries.length === 0 ? (
            <div className="empty-state-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <Activity size={36} style={{ color: 'var(--slate-400)', margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--slate-800)', fontWeight: 700 }}>
                No health information recorded yet
              </h4>
              <p className="empty-state-text" style={{ maxWidth: '480px', margin: '0 auto' }}>
                No chronic medical conditions, active medications, or previous surgeries have been recorded for this patient.
              </p>
            </div>
          ) : (
            <>
              {/* Medical Conditions */}
              <div className="profile-section-card full-width">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: '#b45309' }} />
                  <span>Known Chronic Conditions ({conditions.length})</span>
                </h3>
                {conditions.length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text">No chronic medical conditions documented.</p>
                  </div>
                ) : (
                  <div className="patient-info-list">
                    {conditions.map((c, i) => (
                      <div key={i} className="info-item-row">
                        <div className="info-item-main">
                          <span className="info-item-title">{c.name}</span>
                          {c.notes && <span className="info-item-subtitle">{c.notes}</span>}
                        </div>
                        {c.sinceYear && <span className="info-item-tag" style={{ background: '#fef3c7', color: '#92400e' }}>Diagnosed {c.sinceYear}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Medications */}
              <div className="profile-section-card full-width">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Pill size={18} style={{ color: 'var(--primary-600)' }} />
                  <span>Active Medications ({activeMedications.length})</span>
                </h3>
                {activeMedications.length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text">No active medications documented.</p>
                  </div>
                ) : (
                  <div className="patient-info-list">
                    {activeMedications.map((m, i) => (
                      <div key={i} className="info-item-row">
                        <div className="info-item-main">
                          <span className="info-item-title">{m.name}</span>
                          <span className="info-item-subtitle">{[m.dosage, m.frequency, m.notes].filter(Boolean).join(' • ')}</span>
                        </div>
                        {m.dosage && <span className="info-item-tag">{m.dosage}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Previous Surgeries */}
              <div className="profile-section-card full-width">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--slate-600)' }} />
                  <span>Previous Major Surgeries ({surgeries.length})</span>
                </h3>
                {surgeries.length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text">No previous major surgical procedures recorded.</p>
                  </div>
                ) : (
                  <div className="patient-info-list">
                    {surgeries.map((s, i) => (
                      <div key={i} className="info-item-row">
                        <div className="info-item-main">
                          <span className="info-item-title">{s.surgeryName}</span>
                          <span className="info-item-subtitle">{[s.hospital, s.notes].filter(Boolean).join(' • ')}</span>
                        </div>
                        {s.year && <span className="info-item-tag">{s.year}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 5: SAFETY & ALLERGIES ───────────────────────── */}
      {activeTab === 'safety' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            className="profile-section-card full-width"
            style={{
              borderLeft: '4px solid #f59e0b',
              background: '#fffbeb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <ShieldAlert size={28} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#92400e', margin: 0 }}>
                  Clinical Safety & Allergy Intelligence
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#b45309', margin: '0.4rem 0 0 0', lineHeight: 1.5 }}>
                  MedWise automated clinical checks analyze active medications, chronic conditions, and allergy cross-sensitivities before prescription authorization.
                </p>
              </div>
            </div>
          </div>

          {/* Allergy Status & History */}
          <div className="profile-section-card full-width">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: allergies.length > 0 ? '#dc2626' : hasNoKnownAllergies ? 'var(--accent-emerald)' : '#d97706' }} />
              <span>Allergies & Adverse Reactions</span>
            </h3>

            {allergies.length > 0 ? (
              <div>
                <div style={{ marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                  <AlertCircle size={15} />
                  <span>{allergies.length} Documented Allergen{allergies.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {allergies.map((allergy, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '0.4rem 0.85rem',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 'var(--radius-md)',
                        color: '#991b1b',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }} />
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            ) : hasNoKnownAllergies ? (
              <div style={{ padding: '1rem 1.25rem', background: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={22} style={{ color: '#059669', flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#065f46', fontSize: '0.95rem', display: 'block' }}>No Known Drug Allergies (NKDA)</strong>
                  <span style={{ color: '#047857', fontSize: '0.85rem' }}>Patient has been assessed and explicitly confirmed to have no known drug allergies.</span>
                </div>
              </div>
            ) : (
              <div className="empty-state-card" style={{ padding: '1.25rem', background: '#fffbeb', border: '1px dashed #fde68a', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 700, fontSize: '0.9rem' }}>
                  <AlertCircle size={18} />
                  <span>Allergy Status Not Assessed / Not Recorded</span>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#92400e', lineHeight: 1.4 }}>
                  No allergy information has been recorded for this patient. Please verify allergy history with the patient prior to prescribing.
                </p>
              </div>
            )}
          </div>

          <div className="profile-section-card full-width">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem' }}>
              Documented Safety Parameters
            </h3>
            <div className="profile-view-grid">
              {record.bloodGroup ? (
                <div className="profile-field-item">
                  <span className="profile-field-label">Blood Group Compatibility</span>
                  <span className="profile-field-value" style={{ fontWeight: 700, color: '#dc2626' }}>{record.bloodGroup}</span>
                </div>
              ) : (
                <div className="profile-field-item">
                  <span className="profile-field-label">Blood Group Compatibility</span>
                  <span className="profile-field-value" style={{ color: 'var(--slate-500)', fontStyle: 'italic' }}>Not recorded</span>
                </div>
              )}
              <div className="profile-field-item">
                <span className="profile-field-label">Active Pharmacotherapy Count</span>
                <span className="profile-field-value">{activeMedications.length} Concurrent Medications</span>
              </div>
              <div className="profile-field-item">
                <span className="profile-field-label">Chronic Co-morbidities</span>
                <span className="profile-field-value">{conditions.length} Documented Conditions</span>
              </div>
              <div className="profile-field-item">
                <span className="profile-field-label">Safety Decision Support Status</span>
                <span className="profile-field-value" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>Ready for Clinical Engine</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: DEMOGRAPHICS & CONTACT ───────────────────── */}
      {activeTab === 'demographics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="profile-section-card full-width">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem' }}>
              Personal & Contact Information
            </h3>
            <div className="profile-view-grid">
              <div className="profile-field-item">
                <span className="profile-field-label">Full Name</span>
                <span className="profile-field-value">{record.name}</span>
              </div>
              {record.email && (
                <div className="profile-field-item">
                  <span className="profile-field-label">Email Address</span>
                  <span className="profile-field-value">{record.email}</span>
                </div>
              )}
              {record.mobileNumber && (
                <div className="profile-field-item">
                  <span className="profile-field-label">Mobile Number</span>
                  <span className="profile-field-value">{record.mobileNumber}</span>
                </div>
              )}
              {[record.address?.addressLine1, record.address?.city, record.address?.state, record.address?.pinCode].filter(Boolean).length > 0 && (
                <div className="profile-field-item">
                  <span className="profile-field-label">Residential Address</span>
                  <span className="profile-field-value">
                    {[record.address?.addressLine1, record.address?.city, record.address?.state, record.address?.pinCode]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(record.emergencyContact?.name || record.emergencyContact?.mobileNumber) && (
            <div className="profile-section-card full-width">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem' }}>
                Emergency Medical Contact
              </h3>
              <div className="profile-view-grid">
                {record.emergencyContact?.name && (
                  <div className="profile-field-item">
                    <span className="profile-field-label">Contact Name</span>
                    <span className="profile-field-value">{record.emergencyContact.name}</span>
                  </div>
                )}
                {record.emergencyContact?.relationship && (
                  <div className="profile-field-item">
                    <span className="profile-field-label">Relationship</span>
                    <span className="profile-field-value">{record.emergencyContact.relationship}</span>
                  </div>
                )}
                {record.emergencyContact?.mobileNumber && (
                  <div className="profile-field-item">
                    <span className="profile-field-label">Mobile Number</span>
                    <span className="profile-field-value">{record.emergencyContact.mobileNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DoctorLayout>
  );
};

export default PatientClinicalRecord;
