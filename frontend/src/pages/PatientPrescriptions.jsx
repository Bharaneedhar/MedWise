import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../services/profileService';
import { getPrescriptions, getPrescriptionById } from '../services/prescriptionService';
import PatientLayout from '../components/PatientLayout';
import Loading from '../components/Loading';
import {
  Activity,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Stethoscope,
  Pill,
  Clock,
  Eye,
  X,
  Calendar,
  Building,
  Truck,
  PackageCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

const PatientPrescriptions = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPatientData = async () => {
      try {
        const [profRes, rxRes] = await Promise.all([
          getMyProfile(),
          getPrescriptions(),
        ]);
        if (isMounted) {
          if (profRes) setProfile(profRes.profile || {});
          if (rxRes && rxRes.success) setPrescriptions(rxRes.prescriptions || []);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Prescriptions page load error:', err.message);
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

  const handleOpenDetails = async (id) => {
    try {
      const res = await getPrescriptionById(id);
      if (res.success) {
        setSelectedPrescription(res.prescription);
      }
    } catch (err) {
      alert('Failed to load prescription details: ' + (err.response?.data?.message || err.message));
    }
  };

  const closeModal = () => {
    setSelectedPrescription(null);
  };

  const getStatusStepIndex = (status) => {
    switch (status) {
      case 'Draft':
      case 'MedWise Review Required':
      case 'Review Recommended':
        return 0;
      case 'Approved':
      case 'Sent to Pharmacist':
        return 1;
      case 'Dispensed':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return 1;
    }
  };

  if (loading) {
    return <Loading message="Loading prescriptions & status tracking..." />;
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
            My Prescriptions & Medication Tracker
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              border: '1px solid var(--primary-200)',
            }}
          >
            Clinical Records
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Track and review your doctor-authorized clinical prescriptions and pharmacy dispensing progress.
        </p>
      </div>

      {prescriptions.length === 0 ? (
        /* EMPTY STATE MAIN CARD */
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
              background: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              border: '1px solid var(--primary-100)',
            }}
          >
            <FileText size={32} />
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
            No Prescriptions Issued Yet
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
            Once your consulting physician writes and verifies an outpatient prescription through
            the MedWise portal, your active medications and dispensing status will appear here automatically.
          </p>
        </div>
      ) : (
        /* PRESCRIPTIONS LIST CARD */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {prescriptions.map((rx) => {
            const stepIdx = getStatusStepIndex(rx.status);
            const dateStr = rx.createdAt ? new Date(rx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
            const docName = rx.doctorName || (rx.doctorId?.name ? `Dr. ${rx.doctorId.name}` : 'Consulting Doctor');

            return (
              <div
                key={rx._id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid var(--slate-200)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '1.1rem', color: '#0369a1' }}>
                        {rx.prescriptionId || rx._id}
                      </span>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#e0f2fe', color: '#0369a1', fontWeight: '600' }}>
                        Outpatient Prescription
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: '600' }}>
                      Prescribed by {docName} ({rx.doctorSpecialization || 'General Medicine'})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Date: {dateStr} {rx.doctorHospitalClinicName ? `• ${rx.doctorHospitalClinicName}` : ''}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenDetails(rx._id)}
                    style={{
                      background: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Eye size={16} /> View Full Details
                  </button>
                </div>

                {/* STATUS PROGRESS STEPPER */}
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                    Fulfillment & Delivery Progress: <strong style={{ color: '#0f172a' }}>{rx.status}</strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', position: 'relative' }}>
                    {/* STEP 1: SENT TO PHARMACY */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textTransform: 'none', textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: stepIdx >= 1 ? '#0d9488' : '#e2e8f0', color: stepIdx >= 1 ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        {stepIdx > 1 ? <CheckCircle2 size={18} /> : 1}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: stepIdx >= 1 ? '700' : '500', color: stepIdx >= 1 ? '#0f766e' : '#64748b' }}>
                        Sent to Pharmacist
                      </span>
                    </div>

                    {/* STEP 2: DISPENSED */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: stepIdx >= 2 ? '#2563eb' : '#e2e8f0', color: stepIdx >= 2 ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        {stepIdx > 2 ? <CheckCircle2 size={18} /> : 2}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: stepIdx >= 2 ? '700' : '500', color: stepIdx >= 2 ? '#1d4ed8' : '#64748b' }}>
                        Dispensed
                      </span>
                    </div>

                    {/* STEP 3: DELIVERED */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: stepIdx >= 3 ? '#16a34a' : '#e2e8f0', color: stepIdx >= 3 ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        {stepIdx === 3 ? <CheckCircle2 size={18} /> : 3}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: stepIdx === 3 ? '700' : '500', color: stepIdx === 3 ? '#15803d' : '#64748b' }}>
                        Delivered
                      </span>
                    </div>
                  </div>
                </div>

                {/* MEDICINES SUMMARY SNIPPET */}
                <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                  <strong>Prescribed Medications ({rx.medicines?.length || 0}):</strong>{' '}
                  {rx.medicines?.map((m) => m.name || m.medicineName).join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL FOR PATIENT */}
      {selectedPrescription && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* HEADER */}
            <div style={{ background: '#0f172a', color: 'white', padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#0ea5e9', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
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

              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* BODY */}
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* DOCTOR & CLINIC DETAILS */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: '#0369a1', marginBottom: '0.5rem' }}>
                  <Stethoscope size={18} /> PRESCRIBING PHYSICIAN & CLINIC
                </div>
                <div><strong>Doctor:</strong> {selectedPrescription.doctorName || 'Consulting Physician'}</div>
                {selectedPrescription.doctorSpecialization && <div><strong>Specialization:</strong> {selectedPrescription.doctorSpecialization}</div>}
                {selectedPrescription.doctorHospitalClinicName && <div><strong>Hospital / Clinic:</strong> {selectedPrescription.doctorHospitalClinicName}</div>}
                <div><strong>Prescription Date:</strong> {selectedPrescription.createdAt ? new Date(selectedPrescription.createdAt).toLocaleDateString() : ''}</div>
              </div>

              {/* LINKED CLINICAL CONSULTATION */}
              {selectedPrescription.consultationId && (
                <div style={{ background: '#eff6ff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: '#1d4ed8', marginBottom: '0.35rem' }}>
                    <Activity size={18} /> LINKED CLINICAL CONSULTATION
                  </div>
                  {typeof selectedPrescription.consultationId === 'object' && selectedPrescription.consultationId !== null ? (
                    <div style={{ color: '#1e40af', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div><strong>Consultation Date:</strong> {selectedPrescription.consultationId.consultationDate ? new Date(selectedPrescription.consultationId.consultationDate).toLocaleDateString() : ''}</div>
                      {selectedPrescription.consultationId.reasonForVisit && <div><strong>Reason for Visit:</strong> {selectedPrescription.consultationId.reasonForVisit}</div>}
                      {selectedPrescription.consultationId.diagnosisAssessment && <div><strong>Diagnosis Assessment:</strong> {selectedPrescription.consultationId.diagnosisAssessment}</div>}
                    </div>
                  ) : (
                    <div style={{ color: '#1e40af' }}>
                      Issued during clinical consultation encounter.
                    </div>
                  )}
                </div>
              )}

              {/* DIAGNOSIS & DOCTOR INSTRUCTIONS */}
              {(selectedPrescription.diagnosis || selectedPrescription.doctorNotes || selectedPrescription.notes) && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#92400e', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Doctor Instructions & Diagnosis
                  </h4>
                  {selectedPrescription.diagnosis && <p style={{ margin: '0 0 0.25rem 0', color: '#78350f' }}><strong>Diagnosis:</strong> {selectedPrescription.diagnosis}</p>}
                  {(selectedPrescription.doctorNotes || selectedPrescription.notes) && <p style={{ margin: 0, color: '#78350f' }}><strong>Instructions:</strong> {selectedPrescription.doctorNotes || selectedPrescription.notes}</p>}
                </div>
              )}

              {/* MEDICINES LIST */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Pill size={18} style={{ color: '#0ea5e9' }} /> Prescribed Medications ({selectedPrescription.medicines?.length || 0})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedPrescription.medicines?.map((med, idx) => {
                    const medName = med.name || med.medicineName || med.genericName || 'Medicine';
                    const doseStrength = [med.dosage, med.strength]
                      .filter(Boolean)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(' / ') || '';
                    const frequencyStr = med.frequency || '';

                    const formatDuration = (val) => {
                      if (!val) return '';
                      const strVal = String(val).trim();
                      if (/[a-zA-Z]/.test(strVal)) {
                        return strVal;
                      }
                      return `${strVal} days`;
                    };

                    const durationStr = formatDuration(med.duration);
                    const routeStr = med.route || 'Oral';
                    const instructionsStr = med.instructions || med.specialInstructions || 'Take as prescribed';

                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        {/* Card Header: Medicine Name */}
                        <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                              {idx + 1}
                            </div>
                            <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                              {medName}
                            </span>
                          </div>
                        </div>

                        {/* Structured Fields Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '0.85rem',
                            background: '#f8fafc',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9',
                          }}
                        >
                          {/* Field 1: Medicine Name */}
                          <div>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Medicine
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                              {medName}
                            </div>
                          </div>

                          {/* Field 2: Dose / Strength */}
                          <div>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Dose / Strength
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                              {doseStrength}
                            </div>
                          </div>

                          {/* Field 3: Frequency (X-Y-Z) */}
                          <div>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Frequency (X-Y-Z)
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0284c7', fontFamily: 'monospace' }}>
                              {frequencyStr}
                            </div>
                          </div>

                          {/* Field 4: Duration */}
                          <div>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Duration
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                              {durationStr}
                            </div>
                          </div>

                          {/* Field 5: Route */}
                          <div>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Route
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                              {routeStr}
                            </div>
                          </div>

                          {/* Field 6: Instructions */}
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '0.725rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                              Instructions
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                              {instructionsStr}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DISPENSING & DELIVERY TIMESTAMPS */}
              {(selectedPrescription.dispensedAt || selectedPrescription.deliveredAt) && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {selectedPrescription.dispensedAt && (
                    <div><strong>Dispensed at Pharmacy:</strong> {new Date(selectedPrescription.dispensedAt).toLocaleString()}</div>
                  )}
                  {selectedPrescription.deliveredAt && (
                    <div><strong>Delivered to You:</strong> {new Date(selectedPrescription.deliveredAt).toLocaleString()}</div>
                  )}
                </div>
              )}

              {/* FOLLOW-UP DATE */}
              {selectedPrescription.followUpDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Calendar size={16} style={{ color: '#0ea5e9' }} />
                  <span><strong>Scheduled Follow-Up:</strong> {new Date(selectedPrescription.followUpDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div style={{ background: '#f8fafc', padding: '1rem 1.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{ background: '#475569', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' }}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </PatientLayout>
  );
};

export default PatientPrescriptions;
