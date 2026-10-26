import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyConsultations } from '../services/consultationService';
import { getDoctorPatients } from '../services/doctorService';
import { getMyProfile } from '../services/profileService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import axios from 'axios';
import { tokenStorage } from '../services/authService';
import {
  Calendar,
  PlusCircle,
  Stethoscope,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Save,
  Building,
  UserCheck,
  Video,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const DoctorConsultations = () => {
  const [consultations, setConsultations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    patientId: '',
    consultationType: 'In-person',
    hospitalClinicName: '',
    hospitalClinicLocation: '',
    reasonForVisit: '',
    diagnosisNotes: '',
    doctorRecommendations: '',
    followUpRequired: '',
    followUpDate: '',
    status: 'Completed',
  });

  const fetchData = async () => {
    try {
      const [consultRes, patientsRes, profileRes] = await Promise.allSettled([
        getMyConsultations(),
        getDoctorPatients(),
        getMyProfile(),
      ]);

      if (consultRes.status === 'fulfilled' && consultRes.value) {
        setConsultations(consultRes.value.consultations || []);
      }
      if (patientsRes.status === 'fulfilled' && patientsRes.value) {
        setPatients(patientsRes.value.patients || []);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value?.profile) {
        const docProf = profileRes.value.profile;
        setFormData((prev) => ({
          ...prev,
          hospitalClinicName: docProf.workplaceName || docProf.hospitalClinicName || prev.hospitalClinicName || '',
          hospitalClinicLocation: docProf.workplaceAddress || docProf.hospitalClinicAddress || prev.hospitalClinicLocation || '',
        }));
      }
    } catch (err) {
      console.warn('Consultations fetch error:', err.message);
      setError('Could not load consultation records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateConsultation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.patientId) {
      setError('Please select a patient for the consultation.');
      return;
    }
    if (!formData.followUpRequired || (formData.followUpRequired !== 'Yes' && formData.followUpRequired !== 'No')) {
      setError('Please answer "Follow-up Required?": select Yes or No.');
      return;
    }
    if (formData.followUpRequired === 'Yes' && !formData.followUpDate) {
      setError('Please select a Follow-up Date.');
      return;
    }

    try {
      setSaving(true);
      const token = tokenStorage.getToken();
      const selectedPatient = patients.find((p) => String(p.patientId) === String(formData.patientId));

      const payload = {
        ...formData,
        patientPid: selectedPatient?.pid || '',
      };

      const res = await axios.post(`${API_URL}/consultations`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data && res.data.success) {
        setSuccess('Consultation documented successfully and saved to patient record.');
        setShowModal(false);
        setFormData({
          patientId: '',
          consultationType: 'In-person',
          hospitalClinicName: '',
          hospitalClinicLocation: '',
          reasonForVisit: '',
          diagnosisNotes: '',
          doctorRecommendations: '',
          followUpRequired: '',
          followUpDate: '',
          status: 'Completed',
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to document consultation.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading doctor consultation history..." />;
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
              Consultations
            </h1>
            <span
              className="card-section-badge"
              style={{
                background: 'var(--primary-50)',
                color: 'var(--primary-700)',
                border: '1px solid var(--primary-200)',
              }}
            >
              {consultations.length} Consultations
            </span>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
            Document and review outpatient clinical interactions and treatment plans.
          </p>
        </div>

        <Link
          to="/doctor/consultations/new"
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
        >
          <PlusCircle size={16} />
          <span>Start Consultation</span>
        </Link>
      </div>

      {success && (
        <div className="alert-box success" role="alert" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 className="alert-icon" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* CONSULTATIONS LIST */}
      {consultations.length === 0 ? (
        <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Calendar className="empty-state-icon" size={42} style={{ color: 'var(--slate-400)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            No Consultations Documented Yet
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--slate-500)', maxWidth: '440px', margin: '0.5rem auto 1.5rem auto' }}>
            Document new clinical encounters with your patients. Consultations are automatically saved in the patient's EHR.
          </p>
          <Link
            to="/doctor/consultations/new"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <PlusCircle size={16} />
            <span>Document First Consultation</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {consultations.map((c) => {
            const isOnline = c.consultationType === 'Online';
            return (
              <div key={c._id} className="dashboard-card-section" style={{ marginBottom: 0 }}>
                {/* HEADER */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    paddingBottom: '0.75rem',
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
                        background: 'var(--primary-50)',
                        color: 'var(--primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Stethoscope size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--slate-900)' }}>
                        Patient Name: {c.patientName || (typeof c.patientId === 'object' && c.patientId?.name) || 'Patient Record'}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                        PID: {c.patientPid || 'PID-Verified'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        background: isOnline ? '#eff6ff' : '#f0fdf4',
                        color: isOnline ? '#1d4ed8' : '#15803d',
                        border: `1px solid ${isOnline ? '#bfdbfe' : '#bbf7d0'}`,
                      }}
                    >
                      {isOnline ? <Video size={12} /> : <UserCheck size={12} />}
                      <span>{c.consultationType}</span>
                    </span>

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

                    <Link
                      to={`/doctor/patients/${c.patientId}`}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none' }}
                    >
                      Patient Record
                    </Link>
                  </div>
                </div>

                {/* DETAILS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="profile-field-item">
                    <span className="profile-field-label">Date & Time</span>
                    <span className="profile-field-value">{formatDisplayDate(c.consultationDate)}</span>
                  </div>
                  <div className="profile-field-item">
                    <span className="profile-field-label">Facility</span>
                    <span className="profile-field-value">{c.hospitalClinicName || ''}</span>
                  </div>
                  {c.followUpDate && (
                    <div className="profile-field-item">
                      <span className="profile-field-label">Follow-up Scheduled</span>
                      <span className="profile-field-value" style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
                        {formatDisplayDate(c.followUpDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Reason:</span>
                  <p style={{ margin: '0.15rem 0 0 0', fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.9rem' }}>{c.reasonForVisit}</p>
                </div>

                {c.diagnosisNotes && (
                  <div style={{ background: 'var(--slate-50)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Clinical Assessment:</span>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--slate-700)' }}>{c.diagnosisNotes}</p>
                  </div>
                )}

                {c.doctorRecommendations && (
                  <div style={{ background: '#f0fdf4', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>Recommendations:</span>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--slate-700)' }}>{c.doctorRecommendations}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── START CONSULTATION MODAL ───────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="profile-main-wrapper"
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--slate-200)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Stethoscope size={20} style={{ color: 'var(--primary-600)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>
                  Start Clinical Consultation
                </h2>
              </div>
              <button
                type="button"
                className="portal-mobile-toggle"
                onClick={() => setShowModal(false)}
                style={{ width: '32px', height: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateConsultation} style={{ padding: '1.5rem' }}>
              {/* PATIENT SELECTION */}
              <div className="form-group">
                <label className="form-label" htmlFor="consult-patient">
                  Select Patient <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <select
                  id="consult-patient"
                  className="form-input"
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Choose Patient from Workspace --</option>
                  {patients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name} ({p.pid}) - {p.gender}, {p.age} yrs
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="consult-type">
                    Consultation Type
                  </label>
                  <select
                    id="consult-type"
                    className="form-input"
                    name="consultationType"
                    value={formData.consultationType}
                    onChange={handleInputChange}
                  >
                    <option value="In-person">In-person</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="consult-facility">
                    Hospital / Clinic
                  </label>
                  <input
                    id="consult-facility"
                    type="text"
                    className="form-input"
                    name="hospitalClinicName"
                    value={formData.hospitalClinicName}
                    onChange={handleInputChange}
                    placeholder=""
                  />
                </div>
              </div>

              {/* REASON FOR VISIT */}
              <div className="form-group">
                <label className="form-label" htmlFor="consult-reason">
                  Reason for Visit / Primary Concern <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="consult-reason"
                  type="text"
                  className="form-input"
                  name="reasonForVisit"
                  value={formData.reasonForVisit}
                  onChange={handleInputChange}
                  placeholder=""
                />
              </div>

              {/* CLINICAL ASSESSMENT / DIAGNOSIS */}
              <div className="form-group">
                <label className="form-label" htmlFor="consult-diagnosis">
                  Clinical Assessment & Diagnosis
                </label>
                <textarea
                  id="consult-diagnosis"
                  className="form-input"
                  name="diagnosisNotes"
                  rows={2}
                  value={formData.diagnosisNotes}
                  onChange={handleInputChange}
                  placeholder=""
                />
              </div>

              {/* DOCTOR RECOMMENDATIONS */}
              <div className="form-group">
                <label className="form-label" htmlFor="consult-recomms">
                  Doctor's Recommendations & Instructions
                </label>
                <textarea
                  id="consult-recomms"
                  className="form-input"
                  name="doctorRecommendations"
                  rows={2}
                  value={formData.doctorRecommendations}
                  onChange={handleInputChange}
                  placeholder=""
                />
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="consult-followup-req">
                    Follow-up Required?
                  </label>
                  <select
                    id="consult-followup-req"
                    className="form-input"
                    name="followUpRequired"
                    value={formData.followUpRequired || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => {
                        if (val === 'Yes') {
                          return { ...prev, followUpRequired: 'Yes', status: 'Follow-up Needed' };
                        } else if (val === 'No') {
                          return { ...prev, followUpRequired: 'No', status: 'Completed', followUpDate: '' };
                        } else {
                          return { ...prev, followUpRequired: '', status: 'Completed', followUpDate: '' };
                        }
                      });
                    }}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {formData.followUpRequired === 'Yes' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="consult-followup">
                      Scheduled Follow-up Date
                    </label>
                    <input
                      id="consult-followup"
                      type="date"
                      className="form-input"
                      name="followUpDate"
                      value={formData.followUpDate}
                      onChange={handleInputChange}
                    />
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--slate-100)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {saving ? (
                    <>
                      <div className="spinner-sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Consultation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DoctorLayout>
  );
};

export default DoctorConsultations;
