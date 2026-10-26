import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import {
  lookupPatientByPid,
  getDepartmentsAndDoctors,
  getAvailableSlots,
  createAppointment,
} from '../services/appointmentService';
import {
  Search,
  User,
  HeartPulse,
  Thermometer,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Building2,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Droplet,
} from 'lucide-react';

const formatDoctorDisplayName = (name) => {
  if (!name) return 'Physician';
  const cleanName = name.replace(/^Dr\.?\s+/i, '').trim();
  return `Dr. ${cleanName}`;
};

const AdminAppointments = () => {
  // 1. Patient search state
  const [pidInput, setPidInput] = useState('');
  const [patient, setPatient] = useState(null);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patientError, setPatientError] = useState('');

  // 2. Vitals state
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [temperature, setTemperature] = useState('');

  // 3. Reason for visit state
  const [reason, setReason] = useState('');

  // 4. Department and Doctor state
  const [departments, setDepartments] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // 5. Date & Time slot state
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [appointmentDate, setAppointmentDate] = useState(getTodayDateString());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');

  // 6. Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Load departments and doctors on initial render
  useEffect(() => {
    const loadDoctorsData = async () => {
      try {
        setLoadingDoctors(true);
        const res = await getDepartmentsAndDoctors();
        if (res && res.success) {
          setDepartments(res.departments || []);
          setAllDoctors(res.doctors || []);
        }
      } catch (err) {
        setFormError('Failed to load registered hospital departments and doctors.');
      } finally {
        setLoadingDoctors(false);
      }
    };
    loadDoctorsData();
  }, []);

  // Filter doctors by selected department
  const filteredDoctors = selectedDepartment
    ? allDoctors.filter(
        (doc) => (doc.specialization || doc.department) === selectedDepartment
      )
    : [];

  // When department changes, reset selected doctor and slot
  const handleDepartmentChange = (dept) => {
    setSelectedDepartment(dept);
    setSelectedDoctorId('');
    setSelectedTimeSlot('');
    setSlots([]);
  };

  // When doctor changes, reset slot and reload slots
  const handleDoctorChange = (docId) => {
    setSelectedDoctorId(docId);
    setSelectedTimeSlot('');
  };

  // Fetch available slots whenever doctorId or appointmentDate changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDoctorId || !appointmentDate) {
        setSlots([]);
        return;
      }
      try {
        setLoadingSlots(true);
        const res = await getAvailableSlots(selectedDoctorId, appointmentDate);
        if (res && res.success) {
          setSlots(res.slots || []);
        }
      } catch (err) {
        console.warn('Could not load slots:', err.message);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDoctorId, appointmentDate]);

  // Handle PID Search
  const handleSearchPatient = async (e) => {
    if (e) e.preventDefault();
    setPatientError('');
    setPatient(null);

    const trimmed = pidInput.trim();
    if (!trimmed) {
      setPatientError('Please enter a Patient ID (PID) to search.');
      return;
    }

    try {
      setSearchingPatient(true);
      const res = await lookupPatientByPid(trimmed);
      if (res && res.success && res.patient) {
        setPatient(res.patient);
      } else {
        setPatientError(`No registered patient found matching PID "${trimmed}".`);
      }
    } catch (err) {
      setPatientError(
        err.response?.data?.message || `No registered patient found with PID "${trimmed}".`
      );
    } finally {
      setSearchingPatient(false);
    }
  };

  // Clear patient search
  const handleClearPatient = () => {
    setPatient(null);
    setPidInput('');
    setPatientError('');
  };

  // Reset entire form
  const handleResetForm = () => {
    setPatient(null);
    setPidInput('');
    setPatientError('');
    setSystolic('');
    setDiastolic('');
    setTemperature('');
    setReason('');
    setSelectedDepartment('');
    setSelectedDoctorId('');
    setAppointmentDate(getTodayDateString());
    setSelectedTimeSlot('');
    setSlots([]);
    setFormError('');
    setBookingSuccess(null);
  };

  // Handle Confirm Appointment Submit
  const handleConfirmAppointment = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!patient) {
      setFormError('Please search and select a verified patient using their PID.');
      return;
    }

    if (!selectedDepartment) {
      setFormError('Please select a hospital department.');
      return;
    }

    if (!selectedDoctorId) {
      setFormError('Please select a registered physician.');
      return;
    }

    if (!appointmentDate) {
      setFormError('Please select an appointment date.');
      return;
    }

    if (!selectedTimeSlot) {
      setFormError('Please select an available appointment time slot.');
      return;
    }

    // Validate Vitals if entered
    let vitalsPayload = null;
    if (systolic || diastolic || temperature) {
      vitalsPayload = {};

      if (systolic || diastolic) {
        const sysNum = Number(systolic);
        const diaNum = Number(diastolic);

        if (!systolic || isNaN(sysNum) || sysNum < 40 || sysNum > 300) {
          setFormError('Systolic Blood Pressure must be a valid number between 40 and 300 mmHg.');
          return;
        }

        if (!diastolic || isNaN(diaNum) || diaNum < 30 || diaNum > 200) {
          setFormError('Diastolic Blood Pressure must be a valid number between 30 and 200 mmHg.');
          return;
        }

        if (sysNum <= diaNum) {
          setFormError('Systolic pressure must be greater than diastolic pressure.');
          return;
        }

        vitalsPayload.bloodPressure = {
          systolic: sysNum,
          diastolic: diaNum,
          unit: 'mmHg',
        };
      }

      if (temperature) {
        const tempNum = Number(temperature);
        if (isNaN(tempNum) || tempNum < 85 || tempNum > 115) {
          setFormError('Body Temperature must be a valid reading between 85°F and 115°F.');
          return;
        }
        vitalsPayload.temperature = tempNum;
        vitalsPayload.temperatureUnit = '°F';
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        patientId: patient.patientId,
        doctorId: selectedDoctorId,
        department: selectedDepartment,
        patientPid: patient.pid,
        appointmentDate,
        appointmentTime: selectedTimeSlot,
        appointmentType: 'NEW_PATIENT',
        reason: reason.trim(),
        vitals: vitalsPayload,
      };

      const res = await createAppointment(payload);
      if (res && res.success) {
        const rawDoctorName = allDoctors.find((d) => String(d.doctorId) === String(selectedDoctorId))?.name;
        setBookingSuccess({
          appointment: res.appointment,
          patientName: patient.name,
          patientPid: patient.pid,
          doctorName: formatDoctorDisplayName(rawDoctorName),
          department: selectedDepartment,
          date: appointmentDate,
          time: selectedTimeSlot,
        });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Failed to confirm appointment. Please review fields and retry.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctorObj = allDoctors.find(
    (d) => String(d.doctorId) === String(selectedDoctorId)
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', paddingBottom: '3rem', boxSizing: 'border-box' }}>
        {/* PAGE HEADER */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(13, 148, 136, 0.1)',
              color: 'var(--accent-teal)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.5rem',
            }}
          >
            <ShieldCheck size={14} /> Official Appointment Desk
          </div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--slate-900)',
              margin: '0 0 0.35rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Book & Confirm Outpatient Appointment
          </h1>
          <p style={{ color: 'var(--slate-600)', fontSize: '0.9rem', margin: 0 }}>
            Identify verified patient by PID, record vital measurements, select department physician, and lock in an open time slot.
          </p>
        </div>

        {/* SUCCESS CONFIRMATION BANNER */}
        {bookingSuccess && (
          <div
            style={{
              background: '#ecfdf5',
              border: '2px solid var(--accent-emerald)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              marginBottom: '2rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--accent-emerald)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#065f46',
                    margin: '0 0 0.4rem 0',
                  }}
                >
                  Appointment Confirmed & Scheduled Successfully!
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#047857', margin: '0 0 1rem 0' }}>
                  The appointment has been secured in the hospital database and is now available in {bookingSuccess.doctorName}'s daily schedule.
                </p>

                {/* DETAILS SUMMARY GRID */}
                <div
                  style={{
                    background: 'white',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #a7f3d0',
                    padding: '1rem 1.25rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, display: 'block' }}>
                      Patient Details
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.95rem' }}>
                      {bookingSuccess.patientName}
                    </span>
                    <span style={{ display: 'block', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.8rem' }}>
                      {bookingSuccess.patientPid}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, display: 'block' }}>
                      Assigned Physician
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.95rem' }}>
                      {bookingSuccess.doctorName}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--slate-600)' }}>
                      {bookingSuccess.department}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, display: 'block' }}>
                      Scheduled Slot
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--primary-700)', fontSize: '0.95rem' }}>
                      {bookingSuccess.date}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-teal)' }}>
                      {bookingSuccess.time}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleResetForm}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                >
                  <RotateCcw size={16} />
                  <span>Book Another Appointment</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ERROR NOTIFICATION */}
        {formError && (
          <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <AlertTriangle className="alert-icon" />
            <span>{formError}</span>
          </div>
        )}

        {/* MAIN FORM */}
        <form onSubmit={handleConfirmAppointment} noValidate>
          {/* SECTION A: PATIENT IDENTIFICATION */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <div className="card-section-header">
              <div className="card-section-title-wrap">
                <User size={20} style={{ color: 'var(--accent-teal)' }} />
                <h2 className="card-section-title">Section A: Patient Identification</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-400)' }}>
                Required Step
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: 0, marginBottom: '1rem', wordBreak: 'break-word', maxWidth: '100%' }}>
              Lookup existing patient record using the unique Patient ID (PID). Real database records are retrieved without modifying history.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <div style={{ flex: '1 1 240px', minWidth: 'min(100%, 240px)', maxWidth: '100%', boxSizing: 'border-box' }}>
                <input
                  id="pid-search-input"
                  type="text"
                  className="form-input"
                  placeholder="Enter Patient ID (e.g. PID-9876543210 or 10-digit mobile)"
                  value={pidInput}
                  onChange={(e) => {
                    setPidInput(e.target.value);
                    setPatientError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchPatient();
                    }
                  }}
                  disabled={searchingPatient || !!patient}
                  style={{ height: '44px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {!patient ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSearchPatient}
                  disabled={searchingPatient || !pidInput.trim()}
                  style={{ height: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0 1.25rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <Search size={16} />
                  <span>{searchingPatient ? 'Searching...' : 'Lookup Patient'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearPatient}
                  style={{ height: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0 1.25rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <RotateCcw size={16} />
                  <span>Change Patient</span>
                </button>
              )}
            </div>

            {patientError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{patientError}</span>
              </div>
            )}

            {/* VERIFIED PATIENT DISPLAY CARD */}
            {patient && (
              <div
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
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
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'var(--accent-teal)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                    }}
                  >
                    {patient.name?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {patient.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: 'var(--accent-emerald)',
                          background: 'var(--accent-emerald-light)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        {patient.pid}
                      </span>
                      {patient.age && <span>{patient.age} yrs</span>}
                      {patient.gender && <span>• {patient.gender}</span>}
                      {patient.bloodGroup && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#dc2626', fontWeight: 600 }}>
                          <Droplet size={12} /> {patient.bloodGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--accent-emerald)',
                    background: 'white',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <CheckCircle2 size={14} /> Verified Patient
                </div>
              </div>
            )}
          </div>

          {/* SECTION B: PATIENT VITALS */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <div className="card-section-header">
              <div className="card-section-title-wrap">
                <HeartPulse size={20} style={{ color: '#e11d48' }} />
                <h2 className="card-section-title">Section B: Patient Vitals</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>
                Visit Specific Measurements
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: 0, marginBottom: '1.25rem' }}>
              Enter current vitals measured at admission desk. Values are saved strictly against this visit and will appear automatically in the assigned doctor's consultation encounter.
            </p>

            <div className="form-grid-2col" style={{ gap: '1.5rem' }}>
              {/* Blood Pressure */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartPulse size={15} style={{ color: '#e11d48' }} />
                  <span>Blood Pressure (mmHg)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      id="vitals-bp-systolic"
                      type="number"
                      className="form-input"
                      placeholder="Systolic (e.g. 120)"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      min="40"
                      max="300"
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px', display: 'block' }}>
                      Systolic (mmHg)
                    </span>
                  </div>

                  <span style={{ fontWeight: 700, color: 'var(--slate-400)', fontSize: '1.2rem' }}>/</span>

                  <div style={{ flex: 1 }}>
                    <input
                      id="vitals-bp-diastolic"
                      type="number"
                      className="form-input"
                      placeholder="Diastolic (e.g. 80)"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      min="30"
                      max="200"
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px', display: 'block' }}>
                      Diastolic (mmHg)
                    </span>
                  </div>
                </div>
              </div>

              {/* Body Temperature */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="vitals-temperature" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Thermometer size={15} style={{ color: 'var(--accent-teal)' }} />
                  <span>Body Temperature (°F)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="vitals-temperature"
                    type="number"
                    step="0.1"
                    className="form-input"
                    placeholder="e.g. 98.6"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    min="85"
                    max="115"
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--slate-400)',
                    }}
                  >
                    °F
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px', display: 'block' }}>
                  Measured in Fahrenheit (°F)
                </span>
              </div>
            </div>
          </div>

          {/* SECTION C: REASON FOR VISIT */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <div className="card-section-header">
              <div className="card-section-title-wrap">
                <FileText size={20} style={{ color: 'var(--primary-600)' }} />
                <h2 className="card-section-title">Section C: Reason for Visit</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>
                Chief Complaint
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="visit-reason">
                Primary Complaint / Purpose of Consultation
              </label>
              <textarea
                id="visit-reason"
                className="form-input"
                rows="2"
                placeholder="Describe patient's chief complaints, reported symptoms, or routine checkup purpose..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* SECTION D: DEPARTMENT AND DOCTOR SELECTION */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <div className="card-section-header">
              <div className="card-section-title-wrap">
                <Building2 size={20} style={{ color: 'var(--primary-600)' }} />
                <h2 className="card-section-title">Section D: Department & Physician Selection</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-400)' }}>
                Required Step
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: 0, marginBottom: '1.25rem' }}>
              Departments are dynamically populated from real registered physicians in MongoDB. Select a department to view eligible physicians.
            </p>

            <div className="form-grid-2col" style={{ gap: '1.25rem' }}>
              {/* Department Dropdown */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="department-select">
                  Hospital Department <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <select
                  id="department-select"
                  className="form-input"
                  value={selectedDepartment}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={loadingDoctors}
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Dropdown */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="doctor-select">
                  Assigned Physician <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <select
                  id="doctor-select"
                  className="form-input"
                  value={selectedDoctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  disabled={!selectedDepartment || filteredDoctors.length === 0}
                >
                  <option value="">
                    {!selectedDepartment
                      ? '-- Select Department First --'
                      : filteredDoctors.length === 0
                      ? '-- No Physicians Available in this Department --'
                      : '-- Select Registered Physician --'}
                  </option>
                  {filteredDoctors.map((doc) => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {formatDoctorDisplayName(doc.name)} ({doc.specialization}
                      {doc.hospitalClinicName ? ` • ${doc.hospitalClinicName}` : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedDoctorObj && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--primary-50)',
                  border: '1px solid var(--primary-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <Stethoscope size={18} style={{ color: 'var(--primary-700)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--primary-900)' }}>
                  Selected Physician: <strong>{formatDoctorDisplayName(selectedDoctorObj.name)}</strong> •{' '}
                  <span style={{ color: 'var(--primary-700)' }}>
                    Department of {selectedDoctorObj.specialization}
                  </span>
                  {selectedDoctorObj.hospitalClinicName && (
                    <span> ({selectedDoctorObj.hospitalClinicName})</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION E: APPOINTMENT DATE AND TIME SLOT */}
          <div className="dashboard-card-section" style={{ marginBottom: '2rem' }}>
            <div className="card-section-header">
              <div className="card-section-title-wrap">
                <Calendar size={20} style={{ color: 'var(--accent-teal)' }} />
                <h2 className="card-section-title">Section E: Appointment Date & Time Slot</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-400)' }}>
                Required Step
              </span>
            </div>

            <div className="form-grid-2col" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Date Picker */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="appointment-date-picker">
                  Appointment Date <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="appointment-date-picker"
                  type="date"
                  className="form-input"
                  value={appointmentDate}
                  min={getTodayDateString()}
                  onChange={(e) => {
                    setAppointmentDate(e.target.value);
                    setSelectedTimeSlot('');
                  }}
                  required
                />
              </div>

              {/* Selected Slot Overview */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Selected Slot</label>
                <div
                  style={{
                    height: '42px',
                    padding: '0 1rem',
                    background: selectedTimeSlot ? 'var(--accent-teal-light)' : 'var(--slate-50)',
                    border: `1px solid ${selectedTimeSlot ? 'var(--accent-teal)' : 'var(--slate-200)'}`,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: selectedTimeSlot ? 'var(--slate-900)' : 'var(--slate-400)',
                    fontWeight: selectedTimeSlot ? 700 : 500,
                    fontSize: '0.9rem',
                  }}
                >
                  <Clock size={16} style={{ color: selectedTimeSlot ? 'var(--accent-teal)' : 'var(--slate-400)' }} />
                  <span>{selectedTimeSlot ? `${selectedTimeSlot} (Reserved)` : 'No Slot Selected Yet'}</span>
                </div>
              </div>
            </div>

            {/* TIME SLOTS GRID */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Available Clinical Time Slots for {appointmentDate}
              </label>

              {!selectedDoctorId ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'var(--slate-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--slate-300)',
                    color: 'var(--slate-500)',
                    fontSize: '0.85rem',
                  }}
                >
                  Please select a department and physician above to view available time slots.
                </div>
              ) : loadingSlots ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                  Loading real-time availability for {formatDoctorDisplayName(selectedDoctorObj?.name)}...
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  {slots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot.time;
                    const isAvailable = slot.available;

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        id={`slot-${slot.time.replace(/[: ]/g, '-')}`}
                        onClick={() => {
                          if (isAvailable) setSelectedTimeSlot(slot.time);
                        }}
                        disabled={!isAvailable}
                        style={{
                          padding: '0.65rem 0.5rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          border: isSelected
                            ? '2px solid var(--accent-teal)'
                            : isAvailable
                            ? '1px solid var(--slate-200)'
                            : '1px solid var(--slate-100)',
                          background: isSelected
                            ? 'var(--accent-teal)'
                            : isAvailable
                            ? 'white'
                            : 'var(--slate-100)',
                          color: isSelected
                            ? 'white'
                            : isAvailable
                            ? 'var(--slate-800)'
                            : 'var(--slate-400)',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span>{slot.time}</span>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              opacity: 0.9,
                            }}
                          >
                            Selected
                          </span>
                        )}
                        {!isAvailable && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              opacity: 0.7,
                            }}
                          >
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SECTION F: CONFIRM APPOINTMENT ACTION */}
          <div
            style={{
              background: 'white',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Ready to finalize outpatient appointment?
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetForm}
                disabled={submitting}
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
              >
                Clear Form
              </button>

              <button
                type="submit"
                id="confirm-appointment-button"
                className="btn-primary"
                disabled={submitting || !patient || !selectedDoctorId || !selectedTimeSlot}
                style={{
                  padding: '0.75rem 1.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--accent-teal)',
                }}
              >
                <CheckCircle2 size={18} />
                <span>{submitting ? 'Confirming Appointment...' : 'Confirm Appointment'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminAppointments;
