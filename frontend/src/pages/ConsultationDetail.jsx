import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getConsultationById, updateConsultation } from '../services/consultationService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate, formatDisplayTemperature } from '../utils/patientUtils';
import {
  Stethoscope,
  ArrowLeft,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Building,
  MapPin,
  Clock,
  Video,
  UserCheck,
  FileText,
  X,
  Pill,
  Activity,
  Thermometer,
} from 'lucide-react';

const ConsultationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit Form State
  const [editForm, setEditForm] = useState({
    hospitalClinicName: '',
    hospitalClinicLocation: '',
    consultationDate: '',
    consultationType: 'In-person',
    reasonForVisit: '',
    clinicalNotes: '',
    diagnosisNotes: '',
    doctorRecommendations: '',
    followUpDate: '',
    status: 'Completed',
  });

  const fetchConsultation = async () => {
    try {
      const res = await getConsultationById(id);
      if (res && res.success) {
        const c = res.consultation;
        setConsultation(c);
        setEditForm({
          hospitalClinicName: c.hospitalClinicName || '',
          hospitalClinicLocation: c.hospitalClinicLocation || '',
          consultationDate: c.consultationDate ? new Date(c.consultationDate).toISOString().split('T')[0] : '',
          consultationType: c.consultationType || 'In-person',
          reasonForVisit: c.reasonForVisit || '',
          clinicalNotes: c.clinicalNotes || '',
          diagnosisNotes: c.diagnosisNotes || '',
          doctorRecommendations: c.doctorRecommendations || '',
          followUpRequired: (c.status === 'Follow-up Needed' || c.followUpDate) ? 'Yes' : (c.status === 'Completed' ? 'No' : ''),
          followUpDate: c.followUpDate ? new Date(c.followUpDate).toISOString().split('T')[0] : '',
          status: c.status || 'Completed',
        });
      }
    } catch (err) {
      console.warn('Fetch consultation error:', err.message);
      setError(err.response?.data?.message || 'Failed to load consultation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultation();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editForm.followUpRequired || (editForm.followUpRequired !== 'Yes' && editForm.followUpRequired !== 'No')) {
      setError('Please answer "Follow-up Required?": select Yes or No.');
      return;
    }
    if (editForm.followUpRequired === 'Yes' && !editForm.followUpDate) {
      setError('Please select a Follow-up Date.');
      return;
    }

    try {
      setSaving(true);
      const res = await updateConsultation(id, editForm);
      if (res && res.success) {
        setSuccess('Consultation record updated successfully!');
        setConsultation(res.consultation);
        setIsEditing(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update consultation record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading clinical consultation details..." />;
  }

  if (error || !consultation) {
    return (
      <DoctorLayout>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link
            to="/doctor/consultations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--slate-600)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Consultations</span>
          </Link>
        </div>
        <div className="alert-box error" role="alert">
          <AlertCircle className="alert-icon" />
          <span>{error || 'Consultation record not found.'}</span>
        </div>
      </DoctorLayout>
    );
  }

  const docIdStr = consultation.doctorId?._id ? consultation.doctorId._id.toString() : consultation.doctorId?.toString();
  const currentUserIdStr = user?._id?.toString() || user?.id?.toString();
  const isOwnerDoctor = user?.role === 'doctor' && docIdStr === currentUserIdStr;
  const isOnline = consultation.consultationType === 'Online';

  const patientObj = consultation.patientId && typeof consultation.patientId === 'object' ? consultation.patientId : null;
  const patientName = patientObj?.name || consultation.patientName || 'Patient Record';
  const patientIdVal = patientObj?._id || consultation.patientId;

  const linkedRx = consultation.prescriptionId && typeof consultation.prescriptionId === 'object' ? consultation.prescriptionId : null;
  const linkedRxIdVal = linkedRx?._id || (typeof consultation.prescriptionId === 'string' ? consultation.prescriptionId : null);

  return (
    <DoctorLayout>
      {/* BACK BUTTON */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/doctor/consultations"
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
          <span>Back to Consultations List</span>
        </Link>
      </div>

      {/* HEADER SECTION */}
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
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Stethoscope size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                  Clinical Consultation Record
                </h1>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    background: consultation.status === 'Completed' ? 'var(--accent-emerald-light)' : '#fef3c7',
                    color: consultation.status === 'Completed' ? 'var(--accent-emerald)' : '#92400e',
                  }}
                >
                  {consultation.status}
                </span>
              </div>

              <div style={{ fontSize: '0.88rem', color: 'var(--slate-600)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>Patient Name: <strong style={{ color: 'var(--slate-900)' }}>{patientName}</strong></span>
                {consultation.patientPid && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-emerald)', background: 'var(--accent-emerald-light)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    PID: {consultation.patientPid}
                  </span>
                )}
                <span>•</span>
                <span>Date: {formatDisplayDate(consultation.consultationDate)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {patientIdVal && (
              <Link
                to={`/doctor/patients/${patientIdVal}`}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                View Full Patient EHR
              </Link>
            )}

            {isOwnerDoctor && !linkedRxIdVal && (
              <Link
                to={`/doctor/prescriptions/new?consultationId=${consultation._id}`}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
              >
                <Pill size={16} />
                <span>Create Prescription</span>
              </Link>
            )}

            {isOwnerDoctor && !isEditing && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <Edit size={16} />
                <span>Edit Consultation</span>
              </button>
            )}
          </div>
        </div>
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

      {/* VIEW OR EDIT MODE */}
      {isEditing ? (
        /* EDIT FORM */
        <form onSubmit={handleSaveUpdate}>
          <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 className="card-section-title" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} style={{ color: 'var(--primary-600)' }} /> Edit Consultation Record
              </h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(false)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              >
                Cancel Edit
              </button>
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-date">Consultation Date</label>
                <input
                  id="edit-date"
                  type="date"
                  className="form-input"
                  name="consultationDate"
                  value={editForm.consultationDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-type">Consultation Type</label>
                <select
                  id="edit-type"
                  className="form-input"
                  name="consultationType"
                  value={editForm.consultationType}
                  onChange={handleInputChange}
                >
                  <option value="In-person">In-person Outpatient</option>
                  <option value="Online">Online / Tele-consultation</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-facility">Hospital / Clinic Name</label>
                <input
                  id="edit-facility"
                  type="text"
                  className="form-input"
                  name="hospitalClinicName"
                  value={editForm.hospitalClinicName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-location">Location / Address</label>
                <input
                  id="edit-location"
                  type="text"
                  className="form-input"
                  name="hospitalClinicLocation"
                  value={editForm.hospitalClinicLocation}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-reason">Reason for Visit <span style={{ color: 'var(--danger-500)' }}>*</span></label>
              <input
                id="edit-reason"
                type="text"
                className="form-input"
                name="reasonForVisit"
                value={editForm.reasonForVisit}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-notes">Clinical Notes / History (HPI)</label>
              <textarea
                id="edit-notes"
                className="form-input"
                name="clinicalNotes"
                rows={3}
                value={editForm.clinicalNotes}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-diagnosis">Diagnosis & Assessment</label>
              <textarea
                id="edit-diagnosis"
                className="form-input"
                name="diagnosisNotes"
                rows={3}
                value={editForm.diagnosisNotes}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-recomms">Doctor Recommendations</label>
              <textarea
                id="edit-recomms"
                className="form-input"
                name="doctorRecommendations"
                rows={3}
                value={editForm.doctorRecommendations}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-followup-req">Follow-up Required?</label>
                <select
                  id="edit-followup-req"
                  className="form-input"
                  name="followUpRequired"
                  value={editForm.followUpRequired || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditForm((prev) => {
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

              {editForm.followUpRequired === 'Yes' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-followup">Scheduled Follow-up Date</label>
                  <input
                    id="edit-followup"
                    type="date"
                    className="form-input"
                    name="followUpDate"
                    value={editForm.followUpDate}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--slate-100)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* READ ONLY VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* LINKED PRESCRIPTION CARD IF EXISTS */}
          {linkedRxIdVal && (
            <div className="dashboard-card-section" style={{ marginBottom: 0, borderLeft: '4px solid var(--accent-emerald)' }}>
              <h2 className="card-section-title" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pill size={18} style={{ color: 'var(--accent-emerald)' }} /> Related Prescription
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-700)' }}>
                      {linkedRx?.prescriptionId || 'Prescription Linked'}
                    </span>
                    {linkedRx?.status && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}>
                        {linkedRx.status}
                      </span>
                    )}
                  </div>
                  {linkedRx?.createdAt && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                      Prescription Date: {formatDisplayDate(linkedRx.createdAt)}
                    </div>
                  )}
                </div>
                <Link
                  to={`/doctor/prescriptions/${linkedRxIdVal}`}
                  className="btn-primary"
                  style={{ fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>View Prescription</span>
                </Link>
              </div>
            </div>
          )}

          {/* ADMINISTRATIVE & FACILITY DETAILS */}
          <div className="dashboard-card-section" style={{ marginBottom: 0 }}>
            <h2 className="card-section-title" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} style={{ color: 'var(--primary-600)' }} /> Facility & Administrative Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="profile-field-item">
                <span className="profile-field-label">Prescribing Physician</span>
                <span className="profile-field-value" style={{ fontWeight: 700 }}>
                  {consultation.doctorName || 'Dr. Physician'} ({consultation.doctorSpecialization || 'General Medicine'})
                </span>
              </div>

              <div className="profile-field-item">
                <span className="profile-field-label">Hospital / Clinic</span>
                <span className="profile-field-value">{consultation.hospitalClinicName || ''}</span>
              </div>

              {consultation.hospitalClinicLocation && (
                <div className="profile-field-item">
                  <span className="profile-field-label">Location / Address</span>
                  <span className="profile-field-value">{consultation.hospitalClinicLocation}</span>
                </div>
              )}

              <div className="profile-field-item">
                <span className="profile-field-label">Encounter Mode</span>
                <span className="profile-field-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {isOnline ? <Video size={14} style={{ color: '#1d4ed8' }} /> : <UserCheck size={14} style={{ color: '#15803d' }} />}
                  <span>{consultation.consultationType}</span>
                </span>
              </div>

              {consultation.followUpDate && (
                <div className="profile-field-item">
                  <span className="profile-field-label">Scheduled Follow-Up</span>
                  <span className="profile-field-value" style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
                    {formatDisplayDate(consultation.followUpDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RECORDED ADMISSION VITALS */}
          {consultation.vitals && (consultation.vitals.bloodPressure?.systolic || consultation.vitals.temperature) && (
            <div className="dashboard-card-section" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="card-section-title" style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} style={{ color: 'var(--primary-600)' }} /> Recorded Admission Vitals
                </h2>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--primary-200)' }}>
                  Intake Measurements
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {consultation.vitals.bloodPressure?.systolic && (
                  <div className="profile-field-item" style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    <span className="profile-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Activity size={13} style={{ color: '#dc2626' }} /> Blood Pressure
                    </span>
                    <span className="profile-field-value" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--slate-900)' }}>
                      {consultation.vitals.bloodPressure.systolic} / {consultation.vitals.bloodPressure.diastolic || '--'} {consultation.vitals.bloodPressure.unit || 'mmHg'}
                    </span>
                  </div>
                )}

                {consultation.vitals.temperature && (
                  <div className="profile-field-item" style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    <span className="profile-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Thermometer size={13} style={{ color: '#ea580c' }} /> Body Temperature
                    </span>
                    <span className="profile-field-value" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--slate-900)' }}>
                      {formatDisplayTemperature(consultation.vitals.temperature, consultation.vitals.temperatureUnit)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CLINICAL COMPLAINT & NOTES */}
          <div className="dashboard-card-section" style={{ marginBottom: 0 }}>
            <h2 className="card-section-title" style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: 'var(--primary-600)' }} /> Reason for Visit & Clinical Notes
            </h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Primary Chief Complaint / Reason for Visit
              </span>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-900)', margin: '0.25rem 0 0 0' }}>
                {consultation.reasonForVisit}
              </p>
            </div>

            {consultation.clinicalNotes && (
              <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
                  Clinical Notes / History of Present Illness (HPI)
                </span>
                <p style={{ fontSize: '0.925rem', color: 'var(--slate-800)', margin: '0.35rem 0 0 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {consultation.clinicalNotes}
                </p>
              </div>
            )}

            {consultation.diagnosisNotes && (
              <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Diagnosis & Clinical Assessment
                </span>
                <p style={{ fontSize: '0.925rem', color: '#78350f', margin: '0.35rem 0 0 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {consultation.diagnosisNotes}
                </p>
              </div>
            )}

            {consultation.doctorRecommendations && (
              <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Doctor's Recommendations & Patient Care Instructions
                </span>
                <p style={{ fontSize: '0.925rem', color: '#14532d', margin: '0.35rem 0 0 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {consultation.doctorRecommendations}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </DoctorLayout>
  );
};

export default ConsultationDetail;

