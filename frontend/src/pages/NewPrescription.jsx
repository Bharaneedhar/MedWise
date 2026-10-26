import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { lookupPatientByPid, createPrescription, checkWithMedwise } from '../services/prescriptionService';
import { getPatientClinicalRecord } from '../services/doctorService';
import { getConsultationById } from '../services/consultationService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import MedicineAutocompleteInput from '../components/MedicineAutocompleteInput';
import {
  Pill,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  User,
  HeartPulse,
  Search,
  Loader2,
  X,
  Stethoscope,
} from 'lucide-react';

const PREDEFINED_INSTRUCTIONS = [
  'Take after meals',
  'Take before meals',
  'Take with food',
  'Take on an empty stomach',
  'Take at bedtime',
  'Take in the morning',
  'Take at night',
  'As directed by the doctor',
  'Other',
];

const STANDARD_INSTRUCTIONS = [
  'Take after meals',
  'Take before meals',
  'Take with food',
  'Take on an empty stomach',
  'Take at bedtime',
  'Take in the morning',
  'Take at night',
  'As directed by the doctor',
];

const NewPrescription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // PID lookup state
  const [pidInput, setPidInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [pidError, setPidError] = useState('');
  const [patientData, setPatientData] = useState(null); // { userId, name, pid, age, gender, bloodGroup }
  const [linkedConsultation, setLinkedConsultation] = useState(null);

  // Auto-populate patient from query parameters (consultationId, pid, or patientId)
  useEffect(() => {
    const consultationIdParam = searchParams.get('consultationId');
    const pidParam = searchParams.get('pid');
    const patientIdParam = searchParams.get('patientId');

    if (consultationIdParam) {
      setLookingUp(true);
      getConsultationById(consultationIdParam)
        .then((res) => {
          if (res && res.success && res.consultation) {
            const c = res.consultation;
            setLinkedConsultation(c);
            const patObj = c.patientId && typeof c.patientId === 'object' ? c.patientId : null;
            const computedPid = c.patientPid || '';
            setPidInput(computedPid);
            setPatientData({
              userId: patObj?._id || c.patientId,
              name: patObj?.name || c.patientName || 'Patient',
              pid: computedPid,
              age: c.patientAge || (patObj?.dateOfBirth ? Math.floor((new Date() - new Date(patObj.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : ''),
              gender: c.patientGender || patObj?.gender || '',
              bloodGroup: (c.patientBloodGroup && c.patientBloodGroup !== 'Unknown' ? c.patientBloodGroup : patObj?.bloodGroup) || '',
            });
            if (c.diagnosisNotes) {
              setClinicalDiagnosis(c.diagnosisNotes);
            }
            if (c.doctorRecommendations || c.clinicalNotes) {
              setDoctorNotes(c.doctorRecommendations || c.clinicalNotes || '');
            }
            if (c.followUpDate) {
              try {
                const fDate = new Date(c.followUpDate).toISOString().split('T')[0];
                setFollowUpDate(fDate);
              } catch (e) {}
            }
            setPidError('');
          }
        })
        .catch((err) => {
          setPidError(err.response?.data?.message || 'Failed to load linked consultation context.');
        })
        .finally(() => {
          setLookingUp(false);
        });
    } else if (pidParam) {
      const trimmed = pidParam.trim().toUpperCase();
      setPidInput(trimmed);
      setLookingUp(true);
      lookupPatientByPid(trimmed)
        .then((res) => {
          if (res && res.success && res.patient) {
            setPatientData(res.patient);
            setPidError('');
          }
        })
        .catch((err) => {
          setPidError(err.response?.data?.message || 'Patient lookup failed.');
        })
        .finally(() => {
          setLookingUp(false);
        });
    } else if (patientIdParam) {
      setLookingUp(true);
      getPatientClinicalRecord(patientIdParam)
        .then((res) => {
          if (res && res.success && res.record) {
            const rec = res.record;
            const computedPid = rec.pid || `PID-${rec.mobileNumber}`;
            setPidInput(computedPid);
            setPatientData({
              userId: rec.patientId || rec._id,
              name: rec.name,
              pid: computedPid,
              age: rec.age,
              gender: rec.gender || '',
              bloodGroup: rec.bloodGroup && rec.bloodGroup !== 'Unknown' ? rec.bloodGroup : '',
            });
            setPidError('');
          }
        })
        .catch(() => {
          // Silent fallback if patientId query param fails
        })
        .finally(() => {
          setLookingUp(false);
        });
    }
  }, [searchParams]);

  // Form State
  const [clinicalDiagnosis, setClinicalDiagnosis] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medicines, setMedicines] = useState([
    {
      medicineId: null,
      genericName: '',
      medicineName: '',
      dosage: '',
      dosageForm: '',
      frequency: '1-0-1',
      duration: '5 days',
      route: 'Oral',
      instructions: 'Take after meals',
      selectedMedicine: null,
      availableStrengths: [],
      dosageForms: [],
      routes: [],
    },
  ]);

  // PID Lookup handler
  const handlePatientLookup = async () => {
    setPidError('');
    setPatientData(null);

    const trimmed = pidInput.trim().toUpperCase();

    // Client-side format validation
    if (!trimmed) {
      setPidError('Please enter a Patient ID.');
      return;
    }

    if (!trimmed.startsWith('PID-') || trimmed.length !== 14) {
      setPidError('Invalid format. Expected: PID-XXXXXXXXXX (PID- followed by 10 digits).');
      return;
    }

    const digits = trimmed.substring(4);
    if (!/^\d{10}$/.test(digits)) {
      setPidError('Invalid format. The 10 characters after PID- must be digits.');
      return;
    }

    try {
      setLookingUp(true);
      const res = await lookupPatientByPid(trimmed);
      if (res && res.success && res.patient) {
        setPatientData(res.patient);
        setPidError('');
        try {
          const recRes = await getPatientClinicalRecord(res.patient.userId);
          if (recRes && recRes.record && Array.isArray(recRes.record.consultations)) {
            const completed = recRes.record.consultations.find((c) => ['Completed', 'Follow-up Needed'].includes(c.status));
            if (completed) {
              setLinkedConsultation(completed);
              if (completed.diagnosisNotes && !clinicalDiagnosis) {
                setClinicalDiagnosis(completed.diagnosisNotes);
              }
              if ((completed.doctorRecommendations || completed.clinicalNotes) && !doctorNotes) {
                setDoctorNotes(completed.doctorRecommendations || completed.clinicalNotes || '');
              }
              if (completed.followUpDate && !followUpDate) {
                try {
                  const fDate = new Date(completed.followUpDate).toISOString().split('T')[0];
                  setFollowUpDate(fDate);
                } catch (e) {}
              }
            } else {
              setPidError('A completed clinical consultation is required before creating a prescription for this patient.');
            }
          }
        } catch (e) {
          // Ignore lookup warning fallback
        }
      } else {
        setPidError('Patient not found. Please verify the Patient ID.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to lookup patient. Please try again.';
      setPidError(msg);
    } finally {
      setLookingUp(false);
    }
  };

  // Handle PID input key press — lookup on Enter
  const handlePidKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePatientLookup();
    }
  };

  // Clear patient when PID changes
  const handlePidChange = (value) => {
    setPidInput(value);
    if (patientData) {
      setPatientData(null);
    }
    if (pidError) {
      setPidError('');
    }
  };

  // Medicine list handlers
  const addMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        medicineId: null,
        genericName: '',
        medicineName: '',
        dosage: '',
        dosageForm: '',
        frequency: '1-0-1',
        duration: '7 days',
        route: 'Oral',
        instructions: 'Take after meals',
        isCustom: false,
        selectedMedicine: null,
        availableStrengths: [],
        dosageForms: [],
        routes: [],
      },
    ]);
  };

  const updateMedicine = (index, field, value) => {
    setMedicines((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  };

  const formatStrength = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && s.value != null && s.unit) return `${s.value} ${s.unit}`;
    return String(s);
  };

  const handleSelectMedicine = (index, medicine) => {
    setMedicines((prev) => {
      const arr = [...prev];
      const rawStrengths = medicine.availableStrengths || [];
      const strengths = rawStrengths.map(formatStrength);
      const forms = medicine.dosageForms || [];
      const routes = medicine.routes && medicine.routes.length > 0
        ? medicine.routes
        : ['Oral', 'Topical', 'Inhalation', 'Sublingual', 'Intravenous'];

      arr[index] = {
        ...arr[index],
        medicineId: medicine._id,
        genericName: medicine.genericName,
        medicineName: medicine.genericName,
        dosage: strengths.length > 0 ? strengths[0] : '',
        dosageForm: forms.length > 0 ? forms[0] : '',
        route: routes.length > 0 ? routes[0] : 'Oral',
        selectedMedicine: medicine,
        availableStrengths: strengths,
        dosageForms: forms,
        routes: routes,
      };
      return arr;
    });
  };

  const handleMedicineNameChange = (index, value) => {
    setMedicines((prev) => {
      const arr = [...prev];
      const item = arr[index];
      if (item.selectedMedicine && item.selectedMedicine.genericName !== value) {
        arr[index] = {
          ...item,
          medicineName: value,
          medicineId: null,
          genericName: '',
          selectedMedicine: null,
          availableStrengths: [],
          dosageForms: [],
          routes: [],
          dosage: '',
          dosageForm: '',
        };
      } else {
        arr[index] = { ...item, medicineName: value };
      }
      return arr;
    });
  };

  const handleClearMedicine = (index) => {
    setMedicines((prev) => {
      const arr = [...prev];
      arr[index] = {
        ...arr[index],
        medicineId: null,
        genericName: '',
        medicineName: '',
        dosage: '',
        dosageForm: '',
        selectedMedicine: null,
        availableStrengths: [],
        dosageForms: [],
        routes: [],
      };
      return arr;
    });
  };

  const removeMedicine = (index) => {
    if (medicines.length === 1) {
      setError('A prescription must contain at least one medicine.');
      return;
    }
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!patientData) {
      setError('Please lookup and verify a patient using their PID before creating a prescription.');
      return;
    }

    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i];
      if (!m.medicineName.trim()) {
        setError(`Medicine #${i + 1}: Name is required.`);
        return;
      }
      if (!m.dosage.trim()) {
        setError(`Medicine #${i + 1}: Dosage is required (e.g. 500mg).`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        patientPid: patientData.pid,
        patientId: patientData.userId,
        consultationId: linkedConsultation?._id || searchParams.get('consultationId') || undefined,
        clinicalDiagnosis,
        doctorNotes,
        medicines: medicines.map((m) => ({
          medicineId: m.medicineId || undefined,
          genericName: m.genericName || undefined,
          medicineName: m.medicineName.trim(),
          dosage: m.dosage.trim(),
          dosageForm: m.dosageForm ? m.dosageForm.trim() : undefined,
          strength: m.dosage ? m.dosage.trim() : undefined,
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          route: m.route ? m.route.trim() : 'Oral',
          instructions: m.instructions ? m.instructions.trim() : '',
        })),
        followUpDate: followUpDate || undefined,
      };

      const res = await createPrescription(payload);
      if (res && res.success) {
        setSuccess('Prescription drafted successfully!');
        setTimeout(() => {
          navigate(`/doctor/prescriptions/${res.prescription._id}`);
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create prescription.');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckWithMedwise = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (!patientData) {
      setError('Please lookup and verify a patient using their PID before analyzing with MedWise.');
      return;
    }

    if (!medicines || medicines.length === 0) {
      setError('A prescription must contain at least one medicine.');
      return;
    }

    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i];
      if (!m.medicineName.trim()) {
        setError(`Medicine #${i + 1}: Name is required.`);
        return;
      }
      if (!m.dosage.trim()) {
        setError(`Medicine #${i + 1}: Dosage is required (e.g. 500mg).`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        patientPid: patientData.pid,
        patientId: patientData.userId,
        clinicalDiagnosis,
        doctorNotes,
        medicines: medicines.map((m) => ({
          medicineId: m.medicineId || undefined,
          genericName: m.genericName || undefined,
          medicineName: m.medicineName.trim(),
          dosage: m.dosage.trim(),
          dosageForm: m.dosageForm ? m.dosageForm.trim() : undefined,
          strength: m.dosage ? m.dosage.trim() : undefined,
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          route: m.route ? m.route.trim() : 'Oral',
          instructions: m.instructions ? m.instructions.trim() : '',
        })),
        followUpDate: followUpDate || undefined,
      };

      const res = await createPrescription(payload);
      if (res && res.success && res.prescription) {
        setSuccess('Prescription drafted. Executing MedWise clinical analysis...');
        const rxId = res.prescription._id;
        await checkWithMedwise(rxId);
        navigate(`/doctor/prescriptions/${rxId}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create prescription or run MedWise analysis.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DoctorLayout>
      {/* BACK BUTTON */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/doctor/prescriptions"
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
          <span>Back to Prescriptions</span>
        </Link>
      </div>

      {/* HEADER BANNER */}
      <div className="profile-header-banner" style={{ marginBottom: '2rem' }}>
        <div className="profile-header-content">
          <div className="profile-header-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <Pill size={16} />
            <span>Prescription Authoring</span>
          </div>
          <h1 className="profile-header-title">Create Outpatient Prescription</h1>
          <p className="profile-header-desc">
            Document prescribed multi-drug treatment plans. Prepared for automated MedWise clinical safety validation.
          </p>
        </div>
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

      <form onSubmit={handleSubmit}>
        {/* STEP 1: PATIENT IDENTIFICATION VIA PID */}
        <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} style={{ color: 'var(--primary-600)' }} />
            <span>1. Patient Identification</span>
          </h2>

          {/* PID Input */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="patient-pid-input">
              Patient ID / PID <span style={{ color: 'var(--danger-500)' }}>*</span>
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
                width: '100%',
                maxWidth: '720px',
              }}
            >
              <input
                id="patient-pid-input"
                type="text"
                className="form-input"
                placeholder="PID- followed by 10-digit mobile number (e.g. PID-9876543210)"
                value={pidInput}
                onChange={(e) => handlePidChange(e.target.value)}
                onKeyDown={handlePidKeyDown}
                style={{
                  flex: '1 1 65%',
                  minWidth: '260px',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  letterSpacing: '0.03em',
                }}
                maxLength={14}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handlePatientLookup}
                disabled={lookingUp}
                style={{
                  flex: '0 0 auto',
                  minWidth: '160px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  padding: '0.65rem 1.25rem',
                }}
              >
                {lookingUp ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Looking up...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>Lookup Patient</span>
                  </>
                )}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.35rem' }}>
              Enter the patient's unique ID in format: PID- followed by their 10-digit mobile number
            </p>
          </div>

          {/* PID Error */}
          {pidError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1rem',
                background: 'var(--danger-50)',
                border: '1px solid var(--danger-100)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger-600)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{pidError}</span>
            </div>
          )}

          {/* Patient Details — Auto-populated, read-only */}
          {patientData && (
            <div
              style={{
                padding: '1.25rem',
                background: 'linear-gradient(135deg, var(--accent-emerald-light) 0%, #f0fdf4 100%)',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                marginTop: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)' }} />
                <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>Patient Verified</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Patient Name</span>
                  <strong style={{ color: 'var(--slate-900)', fontSize: '1rem' }}>{patientData.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Patient ID</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>{patientData.pid}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Age</span>
                  <strong style={{ color: 'var(--slate-900)', fontSize: '1rem' }}>{patientData.age} years</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Gender</span>
                  <strong style={{ color: 'var(--slate-900)', fontSize: '1rem' }}>{patientData.gender || ''}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Blood Group</span>
                  <strong style={{ color: '#dc2626', fontSize: '1rem' }}>{patientData.bloodGroup || ''}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: CLINICAL DIAGNOSIS */}
        <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeartPulse size={20} style={{ color: 'var(--accent-emerald)' }} />
            <span>2. Clinical Diagnosis & Context</span>
          </h2>

          <div className="form-grid-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="prescription-diagnosis">
                Clinical Diagnosis / Indication
              </label>
              <input
                id="prescription-diagnosis"
                type="text"
                className="form-input"
                value={clinicalDiagnosis}
                onChange={(e) => setClinicalDiagnosis(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prescription-notes">
                Physician Notes / Patient Instructions
              </label>
              <input
                id="prescription-notes"
                type="text"
                className="form-input"
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label" htmlFor="prescription-followup">
              Follow-up Date
            </label>
            <input
              id="prescription-followup"
              type="date"
              className="form-input"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              style={{ maxWidth: '280px' }}
            />
          </div>
        </div>

        {/* STEP 3: MEDICINES */}
        <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill size={20} style={{ color: '#6d28d9' }} />
            <span>3. Prescribed Medications ({medicines.length})</span>
          </h2>

          <div className="dynamic-items-container">
            {medicines.map((m, idx) => (
              <div key={idx} className="dynamic-item-card" style={{ marginBottom: '1rem' }}>
                <div className="dynamic-item-header">
                  <span className="dynamic-item-label">Medication #{idx + 1}</span>
                  {medicines.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-item"
                      onClick={() => removeMedicine(idx)}
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="form-grid-3col" style={{ marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Drug / Brand Name *</label>
                    <MedicineAutocompleteInput
                      id={`medicine-name-${idx}`}
                      value={m.medicineName}
                      onChange={(val) => handleMedicineNameChange(idx, val)}
                      onSelectMedicine={(med) => handleSelectMedicine(idx, med)}
                      onClear={() => handleClearMedicine(idx)}
                    />
                    {m.selectedMedicine && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          padding: '0.35rem 0.6rem',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.785rem',
                          color: '#166534',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <strong>Master DB:</strong> {m.selectedMedicine.genericName}
                          {m.selectedMedicine.drugClass && ` (${m.selectedMedicine.drugClass})`}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearMedicine(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <X size={13} />
                          <span>Clear</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Strength / Dosage *</label>
                    {m.availableStrengths && m.availableStrengths.length > 0 ? (
                      <select
                        className="form-input"
                        value={m.dosage}
                        onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                        required
                      >
                        {m.availableStrengths.map((str, i) => (
                          <option key={i} value={str}>
                            {str}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        value={m.dosage}
                        onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                        required
                      />
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Frequency *</label>
                    <select
                      className="form-input"
                      value={m.frequency}
                      onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}
                    >
                      <option value="1-0-0">1-0-0 (Morning)</option>
                      <option value="0-1-0">0-1-0 (Afternoon)</option>
                      <option value="0-0-1">0-0-1 (Night)</option>
                      <option value="1-0-1">1-0-1 (Morning & Night)</option>
                      <option value="1-1-0">1-1-0 (Morning & Afternoon)</option>
                      <option value="0-1-1">0-1-1 (Afternoon & Night)</option>
                      <option value="1-1-1">1-1-1 (Morning, Afternoon & Night)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-3col" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Dosage Form</label>
                    {m.dosageForms && m.dosageForms.length > 0 ? (
                      <select
                        className="form-input"
                        value={m.dosageForm}
                        onChange={(e) => updateMedicine(idx, 'dosageForm', e.target.value)}
                      >
                        {m.dosageForms.map((df, i) => (
                          <option key={i} value={df}>
                            {df}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        value={m.dosageForm || ''}
                        onChange={(e) => updateMedicine(idx, 'dosageForm', e.target.value)}
                      />
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Route</label>
                    {m.routes && m.routes.length > 0 ? (
                      <select
                        className="form-input"
                        value={m.route}
                        onChange={(e) => updateMedicine(idx, 'route', e.target.value)}
                      >
                        {m.routes.map((rt, i) => (
                          <option key={i} value={rt}>
                            {rt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="form-input"
                        value={m.route}
                        onChange={(e) => updateMedicine(idx, 'route', e.target.value)}
                      >
                        <option value="Oral">Oral</option>
                        <option value="Topical">Topical</option>
                        <option value="Inhalation">Inhalation</option>
                        <option value="Sublingual">Sublingual</option>
                        <option value="Intravenous">Intravenous</option>
                      </select>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Duration *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={m.duration}
                          onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`medicine-instructions-${idx}`}>
                    Special Patient Instructions
                  </label>
                  {(() => {
                    const isCustom = m.isCustom || (m.instructions && !STANDARD_INSTRUCTIONS.includes(m.instructions));
                    if (isCustom) {
                      return (
                        <div>
                          <input
                            id={`medicine-instructions-${idx}`}
                            type="text"
                            className="form-input"
                            value={m.instructions || ''}
                            onChange={(e) => updateMedicine(idx, 'instructions', e.target.value)}
                            placeholder="Enter custom instructions (e.g. Follow the specific instructions discussed during consultation)"
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              updateMedicine(idx, 'isCustom', false);
                              updateMedicine(idx, 'instructions', 'Take after meals');
                            }}
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              marginTop: '0.35rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                          >
                            ← Return to predefined dropdown options
                          </button>
                        </div>
                      );
                    }

                    const selectedOption = PREDEFINED_INSTRUCTIONS.includes(m.instructions) ? m.instructions : 'Take after meals';

                    return (
                      <select
                        id={`medicine-instructions-${idx}`}
                        className="form-input"
                        value={selectedOption}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            updateMedicine(idx, 'isCustom', true);
                            updateMedicine(idx, 'instructions', '');
                          } else {
                            updateMedicine(idx, 'isCustom', false);
                            updateMedicine(idx, 'instructions', val);
                          }
                        }}
                      >
                        {PREDEFINED_INSTRUCTIONS.map((opt, iIdx) => (
                          <option key={iIdx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-add-item"
            onClick={addMedicine}
            style={{ marginTop: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Add Another Medicine</span>
          </button>
        </div>

        {/* SUBMIT BAR */}
        <div className="profile-submit-bar">
          <div className="submit-bar-info">
            <ShieldCheck size={20} style={{ color: 'var(--primary-600)' }} />
            <span>Prescription will be prepared for MedWise clinical validation and approval.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/doctor/prescriptions" className="btn-secondary">
              Cancel
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCheckWithMedwise}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#60a5fa',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 700,
              }}
            >
              {saving ? (
                <>
                  <div className="spinner-sm" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>CHECK WITH MEDWISE</span>
                </>
              )}
            </button>
            <button
              type="submit"
              className="btn-primary profile-submit-btn"
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
                  <span>Draft & Review Prescription</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </DoctorLayout>
  );
};

export default NewPrescription;
