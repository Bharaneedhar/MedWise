import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getDoctorPatients, getPatientClinicalRecord } from '../services/doctorService';
import { createConsultation } from '../services/consultationService';
import { getMyProfile } from '../services/profileService';
import { getAppointmentById, getDoctorAppointments } from '../services/appointmentService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate, toCalendarDateString, isFollowUpDateInFuture, formatDisplayTemperature } from '../utils/patientUtils';
import {
  Stethoscope,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Building,
  MapPin,
  Clock,
  Droplet,
  FileText,
  Activity,
  Thermometer,
} from 'lucide-react';

const NewConsultation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedPatientId = searchParams.get('patientId');
  const preSelectedAppointmentId = searchParams.get('appointmentId');

  const [patients, setPatients] = useState([]);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    appointmentId: preSelectedAppointmentId || '',
    patientId: preSelectedPatientId || '',
    consultationDate: toCalendarDateString(new Date()),
    hospitalClinicName: '',
    hospitalClinicLocation: '',
    consultationType: 'In-person',
    reasonForVisit: '',
    clinicalNotes: '',
    diagnosisNotes: '',
    doctorRecommendations: '',
    followUpRequired: '',
    followUpDate: '',
    status: 'Completed',
  });

  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [patientsRes, profileRes, doctorApptsRes] = await Promise.allSettled([
          getDoctorPatients('', preSelectedPatientId || ''),
          getMyProfile(),
          getDoctorAppointments(),
        ]);

        let docProf = null;
        if (profileRes.status === 'fulfilled' && profileRes.value?.profile) {
          docProf = profileRes.value.profile;
        }

        let loadedPatients = [];
        if (patientsRes.status === 'fulfilled' && patientsRes.value?.patients) {
          loadedPatients = patientsRes.value.patients || [];
        }

        let allDoctorAppts = [];
        if (doctorApptsRes.status === 'fulfilled' && doctorApptsRes.value?.appointments) {
          allDoctorAppts = doctorApptsRes.value.appointments || [];
        }

        let targetAppt = null;
        if (preSelectedAppointmentId) {
          try {
            const apptRes = await getAppointmentById(preSelectedAppointmentId);
            if (apptRes && apptRes.appointment) {
              targetAppt = apptRes.appointment;
            }
          } catch (e) {
            console.warn('Could not fetch appointment by ID:', e.message);
          }
        }

        if (isMounted) {
          setPatients(loadedPatients);

          let initialClinicName = docProf?.workplaceName || docProf?.hospitalClinicName || '';
          let initialClinicLocation = docProf?.workplaceAddress || docProf?.hospitalClinicAddress || '';

          if (targetAppt) {
            setSelectedAppointment(targetAppt);
            const targetPatientId = targetAppt.patientId?._id || targetAppt.patientId;
            const targetPatientPid = targetAppt.patientPid || '';
            const apptReason = targetAppt.reason !== undefined && targetAppt.reason !== null ? targetAppt.reason.trim() : '';
            const apptDateStr = toCalendarDateString(targetAppt.appointmentDate) || toCalendarDateString(new Date());

            setFormData((prev) => ({
              ...prev,
              appointmentId: targetAppt._id,
              patientId: targetPatientId,
              reasonForVisit: apptReason,
              consultationDate: apptDateStr,
              hospitalClinicName: initialClinicName || prev.hospitalClinicName,
              hospitalClinicLocation: initialClinicLocation || prev.hospitalClinicLocation,
            }));

            // Resolve selected patient
            if (targetAppt.patientId && typeof targetAppt.patientId === 'object') {
              const pObj = {
                patientId: targetAppt.patientId._id,
                name: targetAppt.patientId.name,
                pid: targetPatientPid,
                email: targetAppt.patientId.email,
                mobileNumber: targetAppt.patientId.mobileNumber,
              };
              setSelectedPatient(pObj);
            } else {
              const foundP = loadedPatients.find((p) => String(p.patientId) === String(targetPatientId));
              if (foundP) setSelectedPatient(foundP);
            }
          } else if (preSelectedPatientId) {
            // Patient pre-selected without explicit appointmentId
            const foundP = loadedPatients.find((p) => String(p.patientId) === String(preSelectedPatientId));
            if (foundP) {
              setSelectedPatient(foundP);
            } else {
              try {
                const recRes = await getPatientClinicalRecord(preSelectedPatientId);
                if (recRes && recRes.record) {
                  const pObj = {
                    patientId: recRes.record.patientId || recRes.record._id,
                    name: recRes.record.name,
                    pid: recRes.record.pid,
                    age: recRes.record.age,
                    gender: recRes.record.gender,
                    bloodGroup: recRes.record.bloodGroup,
                  };
                  setSelectedPatient(pObj);
                  if (!loadedPatients.some((p) => String(p.patientId) === String(pObj.patientId))) {
                    loadedPatients = [pObj, ...loadedPatients];
                    setPatients(loadedPatients);
                  }
                }
              } catch (e) {
                console.warn('Could not fetch patient record:', e.message);
              }
            }

            // Find matching appointments for this patient
            const matchingAppts = allDoctorAppts.filter(
              (a) => String(a.patientId?._id || a.patientId) === String(preSelectedPatientId) && a.status === 'SCHEDULED'
            );
            setPatientAppointments(matchingAppts);

            // If exactly 1 scheduled appointment exists, populate from it
            if (matchingAppts.length === 1) {
              const appt = matchingAppts[0];
              setSelectedAppointment(appt);
              const apptReason = appt.reason !== undefined && appt.reason !== null ? appt.reason.trim() : '';
              const apptDateStr = toCalendarDateString(appt.appointmentDate) || toCalendarDateString(new Date());

              setFormData((prev) => ({
                ...prev,
                appointmentId: appt._id,
                reasonForVisit: apptReason,
                consultationDate: apptDateStr,
                hospitalClinicName: initialClinicName || prev.hospitalClinicName,
                hospitalClinicLocation: initialClinicLocation || prev.hospitalClinicLocation,
              }));
            } else {
              setFormData((prev) => ({
                ...prev,
                hospitalClinicName: initialClinicName || prev.hospitalClinicName,
                hospitalClinicLocation: initialClinicLocation || prev.hospitalClinicLocation,
              }));
            }
          } else {
            setFormData((prev) => ({
              ...prev,
              hospitalClinicName: initialClinicName || prev.hospitalClinicName,
              hospitalClinicLocation: initialClinicLocation || prev.hospitalClinicLocation,
            }));
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Error initializing consultation form:', err.message);
          setError('Failed to load consultation initialization data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, [preSelectedPatientId, preSelectedAppointmentId]);

  const handlePatientSelectChange = async (e) => {
    const patientId = e.target.value;
    setSelectedAppointment(null);
    setFormData((prev) => ({ ...prev, patientId, appointmentId: '', reasonForVisit: '' }));

    const found = patients.find((p) => String(p.patientId) === String(patientId));
    setSelectedPatient(found || null);

    if (patientId) {
      try {
        const apptsRes = await getDoctorAppointments();
        if (apptsRes && apptsRes.appointments) {
          const matching = apptsRes.appointments.filter(
            (a) => String(a.patientId?._id || a.patientId) === String(patientId) && a.status === 'SCHEDULED'
          );
          setPatientAppointments(matching);
          if (matching.length === 1) {
            const singleAppt = matching[0];
            setSelectedAppointment(singleAppt);
            setFormData((prev) => ({
              ...prev,
              appointmentId: singleAppt._id,
              reasonForVisit: singleAppt.reason ? singleAppt.reason.trim() : '',
              consultationDate: toCalendarDateString(singleAppt.appointmentDate) || prev.consultationDate,
            }));
          }
        }
      } catch (err) {
        console.warn('Error fetching patient appointments:', err.message);
      }
    } else {
      setPatientAppointments([]);
    }
  };

  const handleAppointmentSelectChange = (e) => {
    const apptId = e.target.value;
    if (!apptId) {
      setSelectedAppointment(null);
      setFormData((prev) => ({ ...prev, appointmentId: '', reasonForVisit: '' }));
      return;
    }

    const appt = patientAppointments.find((a) => String(a._id) === String(apptId));
    if (appt) {
      setSelectedAppointment(appt);
      const apptReason = appt.reason !== undefined && appt.reason !== null ? appt.reason.trim() : '';
      const apptDateStr = toCalendarDateString(appt.appointmentDate) || formData.consultationDate;

      setFormData((prev) => ({
        ...prev,
        appointmentId: appt._id,
        reasonForVisit: apptReason,
        consultationDate: apptDateStr,
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFollowUpRequiredChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => {
      if (value === 'Yes') {
        return {
          ...prev,
          followUpRequired: 'Yes',
          status: 'Follow-up Needed',
        };
      } else if (value === 'No') {
        return {
          ...prev,
          followUpRequired: 'No',
          status: 'Completed',
          followUpDate: '',
        };
      } else {
        return {
          ...prev,
          followUpRequired: '',
          status: 'Completed',
          followUpDate: '',
        };
      }
    });
  };

  const isFutureFollowUp = Boolean(
    selectedAppointment &&
    selectedAppointment.appointmentType === 'FOLLOW_UP' &&
    isFollowUpDateInFuture(selectedAppointment.appointmentDate)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isFutureFollowUp) {
      setError(`Cannot start follow-up consultation before scheduled date. Available from ${formatDisplayDate(selectedAppointment.appointmentDate)}.`);
      return;
    }

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
      const payload = {
        ...formData,
        patientPid: selectedPatient?.pid || selectedPatient?.patientPid || '',
        doctorSpecialization: 'General Medicine',
        vitals: selectedAppointment?.vitals || undefined,
      };

      const res = await createConsultation(payload);
      if (res && res.success) {
        setSuccess('Clinical consultation recorded successfully!');
        setTimeout(() => {
          navigate(`/doctor/consultations/${res.consultation._id}`);
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to document consultation.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Initializing consultation authoring form..." />;
  }

  return (
    <DoctorLayout>
      {/* BACK BUTTON */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to={preSelectedPatientId ? `/doctor/patients/${preSelectedPatientId}` : '/doctor/consultations'}
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
          <span>{preSelectedPatientId ? 'Back to Patient Record' : 'Back to Consultations List'}</span>
        </Link>
      </div>

      {/* PAGE TITLE */}
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
            New Clinical Consultation
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              border: '1px solid var(--primary-200)',
            }}
          >
            Outpatient Encounter
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Document clinical notes, assessment, and treatment plan for an established patient.
        </p>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-box success" role="alert" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 className="alert-icon" />
          <span>{success}</span>
        </div>
      )}

      {isFutureFollowUp && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertCircle className="alert-icon" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Follow-up Consultation Not Yet Available</div>
            <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>
              This follow-up is scheduled for {formatDisplayDate(selectedAppointment.appointmentDate)}.
              Follow-up consultations cannot be started before the scheduled date. <strong>Available from {formatDisplayDate(selectedAppointment.appointmentDate)}</strong>.
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* PATIENT IDENTIFICATION CARD (READ ONLY WHEN SELECTED) */}
        <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
          <h2 className="card-section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} style={{ color: 'var(--primary-600)' }} /> Patient Information
          </h2>

          {!preSelectedPatientId ? (
            <div className="form-group" style={{ marginBottom: selectedPatient ? '1.25rem' : 0 }}>
              <label className="form-label" htmlFor="patient-select">
                Select Established Patient <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              <select
                id="patient-select"
                className="form-input"
                name="patientId"
                value={formData.patientId}
                onChange={handlePatientSelectChange}
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
          ) : null}

          {/* APPOINTMENT SELECTION IF PATIENT HAS MULTIPLE SCHEDULED APPOINTMENTS */}
          {patientAppointments.length > 1 && !preSelectedAppointmentId && (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="appointment-select">
                Select Associated Appointment
              </label>
              <select
                id="appointment-select"
                className="form-input"
                name="appointmentId"
                value={formData.appointmentId}
                onChange={handleAppointmentSelectChange}
              >
                <option value="">-- Select Scheduled Appointment --</option>
                {patientAppointments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {new Date(a.appointmentDate).toISOString().split('T')[0]} ({a.appointmentTime || '10:00 AM'}) - {a.reason || 'No Notes'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedPatient && (
            <div
              style={{
                background: 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--primary-100)',
                    color: 'var(--primary-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {selectedPatient.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                    {selectedPatient.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-emerald)', background: 'var(--accent-emerald-light)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {selectedPatient.pid || selectedPatient.patientPid}
                    </span>
                    {selectedPatient.age && <span>{selectedPatient.age} yrs</span>}
                    {selectedPatient.gender && <span>• {selectedPatient.gender}</span>}
                    {selectedPatient.bloodGroup && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Droplet size={12} /> {selectedPatient.bloodGroup}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', background: 'white', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--slate-200)' }}>
                Read-Only Patient Record
              </span>
            </div>
          )}
        </div>

        {/* INTAKE VITALS CARD IF RECORDED AT APPOINTMENT INTAKE */}
        {selectedAppointment?.vitals && (selectedAppointment.vitals.bloodPressure?.systolic || selectedAppointment.vitals.temperature) && (
          <div
            className="dashboard-card-section"
            style={{
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, rgba(240, 253, 250, 0.7) 0%, rgba(238, 242, 255, 0.7) 100%)',
              borderColor: 'var(--primary-200)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 className="card-section-title" style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-800)' }}>
                <Activity size={18} style={{ color: 'var(--primary-600)' }} /> Recorded Intake Vitals
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-700)', background: 'white', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--primary-200)' }}>
                Captured at Intake Desk
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {selectedAppointment.vitals.bloodPressure?.systolic && (
                <div style={{ background: 'white', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Blood Pressure</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {selectedAppointment.vitals.bloodPressure.systolic} / {selectedAppointment.vitals.bloodPressure.diastolic} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-500)' }}>{selectedAppointment.vitals.bloodPressure.unit || 'mmHg'}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedAppointment.vitals.temperature && (
                <div style={{ background: 'white', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Thermometer size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Body Temperature</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {formatDisplayTemperature(selectedAppointment.vitals.temperature, selectedAppointment.vitals.temperatureUnit)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLINICAL ENCOUNTER FORM */}
        <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
          <h2 className="card-section-title" style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={18} style={{ color: 'var(--primary-600)' }} /> Encounter & Administrative Details
          </h2>

          <div className="form-grid-2col">
            {/* Consultation Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="consultationDate">
                Consultation Date <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              <input
                id="consultationDate"
                type="date"
                className="form-input"
                name="consultationDate"
                value={formData.consultationDate}
                onChange={handleInputChange}
                required
              />
            </div>

            {/* Consultation Type */}
            <div className="form-group">
              <label className="form-label" htmlFor="consultationType">
                Consultation Type
              </label>
              <select
                id="consultationType"
                className="form-input"
                name="consultationType"
                value={formData.consultationType}
                onChange={handleInputChange}
              >
                <option value="In-person">In-person Outpatient</option>
                <option value="Online">Online / Tele-consultation</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2col">
            {/* Facility Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="hospitalClinicName">
                Hospital / Clinic Name
              </label>
              <input
                id="hospitalClinicName"
                type="text"
                className="form-input"
                name="hospitalClinicName"
                value={formData.hospitalClinicName}
                onChange={handleInputChange}
                placeholder=""
              />
            </div>

            {/* Location / Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="hospitalClinicLocation">
                Hospital / Clinic Location & Address
              </label>
              <input
                id="hospitalClinicLocation"
                type="text"
                className="form-input"
                name="hospitalClinicLocation"
                value={formData.hospitalClinicLocation}
                onChange={handleInputChange}
                placeholder=""
              />
            </div>
          </div>

          {/* Reason for Visit */}
          <div className="form-group">
            <label className="form-label" htmlFor="reasonForVisit">
              Reason for Visit / Primary Chief Complaint
            </label>
            <input
              id="reasonForVisit"
              type="text"
              className="form-input"
              name="reasonForVisit"
              value={formData.reasonForVisit}
              onChange={handleInputChange}
              placeholder=""
            />
          </div>
        </div>

        {/* CLINICAL ASSESSMENT & NOTES */}
        <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
          <h2 className="card-section-title" style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: 'var(--primary-600)' }} /> Clinical Findings & Plan
          </h2>

          {/* Clinical Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="clinicalNotes">
              Clinical Notes / History of Present Illness (HPI)
            </label>
            <textarea
              id="clinicalNotes"
              className="form-input"
              name="clinicalNotes"
              rows={3}
              value={formData.clinicalNotes}
              onChange={handleInputChange}
              placeholder=""
            />
          </div>

          {/* Diagnosis & Assessment */}
          <div className="form-group">
            <label className="form-label" htmlFor="diagnosisNotes">
              Diagnosis & Clinical Assessment
            </label>
            <textarea
              id="diagnosisNotes"
              className="form-input"
              name="diagnosisNotes"
              rows={3}
              value={formData.diagnosisNotes}
              onChange={handleInputChange}
              placeholder=""
            />
          </div>

          {/* Doctor Recommendations */}
          <div className="form-group">
            <label className="form-label" htmlFor="doctorRecommendations">
              Doctor's Recommendations & Instructions
            </label>
            <textarea
              id="doctorRecommendations"
              className="form-input"
              name="doctorRecommendations"
              rows={3}
              value={formData.doctorRecommendations}
              onChange={handleInputChange}
              placeholder=""
            />
          </div>

          <div className="form-grid-2col">
            {/* Follow-up Required Dropdown */}
            <div className="form-group">
              <label className="form-label" htmlFor="followUpRequired">
                Follow-up Required?
              </label>
              <select
                id="followUpRequired"
                className="form-input"
                name="followUpRequired"
                value={formData.followUpRequired || ''}
                onChange={handleFollowUpRequiredChange}
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            {/* Scheduled Follow-up Date */}
            {formData.followUpRequired === 'Yes' && (
              <div className="form-group">
                <label className="form-label" htmlFor="followUpDate">
                  Scheduled Follow-up Date
                </label>
                <input
                  id="followUpDate"
                  type="date"
                  className="form-input"
                  name="followUpDate"
                  value={formData.followUpDate}
                  onChange={handleInputChange}
                />
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT ACTIONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
          <Link to="/doctor/consultations" className="btn-secondary" style={{ padding: '0.65rem 1.5rem' }}>
            Cancel
          </Link>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving || isFutureFollowUp}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.65rem 1.75rem',
              opacity: (saving || isFutureFollowUp) ? 0.6 : 1,
              cursor: (saving || isFutureFollowUp) ? 'not-allowed' : 'pointer',
              ...(isFutureFollowUp ? { backgroundColor: '#94a3b8', borderColor: '#94a3b8' } : {}),
            }}
            title={isFutureFollowUp ? `Available from ${formatDisplayDate(selectedAppointment.appointmentDate)}` : undefined}
          >
            {saving ? (
              <>
                <div className="spinner-sm" />
                <span>Saving Consultation...</span>
              </>
            ) : isFutureFollowUp ? (
              <>
                <Clock size={18} />
                <span>Available from {formatDisplayDate(selectedAppointment.appointmentDate)}</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Save Consultation Record</span>
              </>
            )}
          </button>
        </div>
      </form>
    </DoctorLayout>
  );
};

export default NewConsultation;
