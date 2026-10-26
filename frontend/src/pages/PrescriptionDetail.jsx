import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getPrescriptionById,
  checkWithMedwise,
  updatePrescription,
  deletePrescription,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
} from '../services/prescriptionService';
import DoctorLayout from '../components/DoctorLayout';
import PharmacistLayout from '../components/PharmacistLayout';
import Loading from '../components/Loading';
import MedicineAutocompleteInput from '../components/MedicineAutocompleteInput';
import MedwiseClinicalReview from '../components/MedwiseClinicalReview';
import { formatDisplayDate } from '../utils/patientUtils';
import { generatePrescriptionPdf } from '../utils/pdfGenerator';
import {
  Pill,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  Clock,
  Sparkles,
  FileText,
  User,
  ShieldAlert,
  Send,
  Check,
  Activity,
  Droplet,
  Download,
  Edit,
  Plus,
  Trash2,
  Save,
  PackageCheck,
  Truck,
  ExternalLink,
  Stethoscope,
  X,
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

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
const PrescriptionDetail = () => {
  const { prescriptionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRx, setDeletingRx] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing form state
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editMedicines, setEditMedicines] = useState([]);

  const fetchPrescription = async () => {
    try {
      const data = await getPrescriptionById(prescriptionId);
      if (data && data.prescription) {
        setPrescription(data.prescription);
      }
    } catch (err) {
      console.warn('Prescription fetch error:', err.message);
      setError('Failed to load prescription record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescription();
  }, [prescriptionId]);

  const formatStrength = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && s.value != null && s.unit) return `${s.value} ${s.unit}`;
    return String(s);
  };

  const handleSelectEditMedicine = (index, medicine) => {
    setEditMedicines((prev) => {
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
        dosage: arr[index].dosage || (strengths.length > 0 ? strengths[0] : ''),
        dosageForm: arr[index].dosageForm || (forms.length > 0 ? forms[0] : ''),
        route: arr[index].route || (routes.length > 0 ? routes[0] : 'Oral'),
        selectedMedicine: medicine,
        availableStrengths: strengths,
        dosageForms: forms,
        routes: routes,
      };
      return arr;
    });
  };

  const handleEditMedicineNameChange = (index, value) => {
    setEditMedicines((prev) => {
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
        };
      } else {
        arr[index] = { ...item, medicineName: value };
      }
      return arr;
    });
  };

  const handleClearEditMedicine = (index) => {
    setEditMedicines((prev) => {
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

  const startEditing = () => {
    if (!prescription) return;
    setEditDiagnosis(prescription.clinicalDiagnosis || '');
    setEditNotes(prescription.doctorNotes || '');
    setEditFollowUp(prescription.followUpDate ? prescription.followUpDate.split('T')[0] : '');
    setEditMedicines(
      (prescription.medicines || []).map((m) => {
        const inst = m.instructions && m.instructions.trim() ? m.instructions.trim() : 'Take after meals';
        const isStd = STANDARD_INSTRUCTIONS.includes(inst);
        return {
          medicineId: m.medicineId || null,
          genericName: m.genericName || '',
          medicineName: m.medicineName || '',
          dosage: m.dosage || '',
          dosageForm: m.dosageForm || '',
          frequency: m.frequency || '1-0-1',
          duration: m.duration || '5 days',
          route: m.route || 'Oral',
          instructions: inst,
          isCustom: !isStd,
          selectedMedicine: null,
          availableStrengths: [],
          dosageForms: [],
          routes: [],
        };
      })
    );
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const updateEditMedicine = (index, field, value) => {
    setEditMedicines((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  };

  const addEditMedicine = () => {
    setEditMedicines((prev) => [
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

  const removeEditMedicine = (index) => {
    if (editMedicines.length === 1) {
      setError('A prescription must contain at least one medicine.');
      return;
    }
    setEditMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    try {
      setSavingEdit(true);
      setError('');
      setSuccess('');

      for (let i = 0; i < editMedicines.length; i++) {
        const m = editMedicines[i];
        if (!m.medicineName.trim()) {
          setError(`Medicine #${i + 1}: Name is required.`);
          setSavingEdit(false);
          return;
        }
        if (!m.dosage.trim()) {
          setError(`Medicine #${i + 1}: Dosage is required (e.g. 500mg).`);
          setSavingEdit(false);
          return;
        }
      }

      const payload = {
        clinicalDiagnosis: editDiagnosis,
        doctorNotes: editNotes,
        followUpDate: editFollowUp || undefined,
        medicines: editMedicines.map((m) => ({
          medicineId: m.medicineId || undefined,
          genericName: m.genericName || undefined,
          medicineName: m.medicineName.trim(),
          dosage: m.dosage.trim(),
          dosageForm: m.dosageForm ? m.dosageForm.trim() : undefined,
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          route: m.route ? m.route.trim() : 'Oral',
          instructions: m.instructions ? m.instructions.trim() : '',
        })),
      };

      const res = await updatePrescription(prescription._id, payload);
      if (res && res.success) {
        setPrescription(res.prescription);
        setSuccess('Prescription updated successfully! Previous MedWise analysis marked as OUTDATED. Please click CHECK WITH MEDWISE to run a fresh analysis.');
        setIsEditing(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update prescription.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCheckWithMedwise = async () => {
    try {
      setChecking(true);
      setError('');
      setSuccess('');
      const res = await checkWithMedwise(prescription._id);
      if (res && res.success) {
        setPrescription(res.prescription);
        setSuccess('MedWise full clinical analysis completed successfully.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to trigger MedWise checks.');
    } finally {
      setChecking(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    try {
      setApproving(true);
      setError('');
      setSuccess('');
      const res = await approvePrescription(prescription._id);
      if (res && res.success) {
        setPrescription(res.prescription);
        setSuccess('Prescription approved successfully! Queued for pharmacist dispensing.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve prescription.');
    } finally {
      setApproving(false);
    }
  };

  const handleDeletePrescription = async () => {
    try {
      setDeletingRx(true);
      setError('');
      setSuccess('');
      const res = await deletePrescription(prescription._id);
      if (res && res.success) {
        navigate('/doctor/prescriptions', {
          state: { message: `Prescription ${prescription.prescriptionId} deleted successfully.` },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete prescription.');
      setShowDeleteModal(false);
    } finally {
      setDeletingRx(false);
    }
  };

  const handleDispenseAction = async () => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      const res = await dispensePrescription(prescription._id || prescriptionId);
      if (res && res.success) {
        setPrescription(res.prescription);
        setSuccess(`Prescription ${res.prescription.prescriptionId || prescriptionId} marked as DISPENSED successfully.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispense prescription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliverAction = async () => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      const res = await deliverPrescription(prescription._id || prescriptionId);
      if (res && res.success) {
        setPrescription(res.prescription);
        setSuccess(`Prescription ${res.prescription.prescriptionId || prescriptionId} marked as DELIVERED successfully.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark prescription as delivered.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!prescription) return;
    generatePrescriptionPdf(prescription);
  };

  const LayoutWrapper = user?.role === 'pharmacist' ? PharmacistLayout : DoctorLayout;
  const backLink = user?.role === 'pharmacist' ? '/pharmacist/prescriptions' : user?.role === 'patient' ? '/patient/prescriptions' : '/doctor/prescriptions';

  if (loading) {
    return <Loading message="Loading prescription details..." />;
  }

  if (!prescription) {
    return (
      <LayoutWrapper>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to={backLink}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Prescriptions</span>
          </Link>
        </div>
        <div className="alert-box error" role="alert">
          <AlertTriangle className="alert-icon" />
          <span>Prescription not found.</span>
        </div>
      </LayoutWrapper>
    );
  }

  const medwise = prescription.medwiseChecks || {};
  const isApproved = prescription.status === 'Approved' || prescription.status === 'Sent to Pharmacist' || prescription.status === 'Dispensed' || prescription.status === 'Delivered';
  const isOwner = user && prescription && String(prescription.doctorId) === String(user._id || user.id);
  const overallStatus = prescription.medwiseAnalysis?.overallRecommendation?.status || prescription.medwiseChecks?.overallRecommendation?.status;
  const isCleared = overallStatus === 'cleared' && !prescription.medwiseAnalysis?.isOutdated;
  const isApprovalBlocked = approving || isEditing || !isOwner || !isCleared;

  return (
    <LayoutWrapper>
      {/* BACK LINK */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to={backLink}
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

      {/* 1. PRESCRIPTION DETAILS HEADER CARD */}
      <div
        className="dashboard-card-section"
        style={{
          padding: '1.75rem',
          marginBottom: '1.75rem',
          background: 'linear-gradient(to right, #ffffff, #f8fafc)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <h1
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'var(--primary-700)',
                  margin: 0,
                }}
              >
                {prescription.prescriptionId}
              </h1>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  background: isApproved ? 'var(--accent-emerald-light)' : '#fef3c7',
                  color: isApproved ? 'var(--accent-emerald)' : '#92400e',
                }}
              >
                {prescription.status}
              </span>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--slate-600)' }}>
              Patient: <strong>{prescription.patientName}</strong> (<span style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700 }}>{prescription.patientPid}</span>) • Authored: {formatDisplayDate(prescription.createdAt)}
            </div>

            {/* Patient demographics row */}
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {prescription.patientAge != null && <span>Age: <strong>{prescription.patientAge} years</strong></span>}
              {prescription.patientGender && <span>Gender: <strong>{prescription.patientGender}</strong></span>}
              {prescription.patientBloodGroup && prescription.patientBloodGroup !== 'Unknown' && (
                <span>Blood Group: <strong style={{ color: '#dc2626' }}>{prescription.patientBloodGroup}</strong></span>
              )}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Download PDF */}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#10b981',
                color: '#059669',
                background: '#ecfdf5',
                fontWeight: 700,
              }}
            >
              <Download size={16} />
              <span>Download Prescription PDF</span>
            </button>

            {/* Check with MedWise (Doctor Only) */}
            {user?.role === 'doctor' && isOwner && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCheckWithMedwise}
                disabled={checking}
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
                {checking ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <Stethoscope size={16} />
                    <span>CHECK WITH MEDWISE</span>
                  </>
                )}
              </button>
            )}

            {/* Edit Prescription (Doctor Only) */}
            {user?.role === 'doctor' && !isApproved && !isEditing && isOwner && (
              <button
                type="button"
                className="btn-secondary"
                onClick={startEditing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#94a3b8',
                  color: 'var(--slate-700)',
                  fontWeight: 600,
                }}
              >
                <Edit size={16} />
                <span>Edit Prescription</span>
              </button>
            )}

            {/* Doctor Approve */}
            {user?.role === 'doctor' && !isApproved && isOwner && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleApprove}
                disabled={isApprovalBlocked}
                title={
                  !isOwner
                    ? 'Only the prescribing doctor who owns this prescription can approve it'
                    : !prescription.medwiseAnalysis
                    ? 'MedWise analysis required before approval. Please click CHECK WITH MEDWISE first.'
                    : prescription.medwiseAnalysis?.isOutdated
                    ? 'MedWise analysis is outdated due to edits. Please click CHECK WITH MEDWISE first.'
                    : overallStatus !== 'cleared'
                    ? 'Doctor approval requires a CLEARED MedWise outcome. Please view detailed report or resolve findings.'
                    : 'Approve prescription and send to pharmacist'
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isApprovalBlocked ? 0.65 : 1,
                  cursor: isApprovalBlocked ? 'not-allowed' : 'pointer',
                }}
              >
                {approving ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Approve Prescription</span>
                  </>
                )}
              </button>
            )}

            {/* DELETE PRESCRIPTION (Doctor Author Only - All Lifecycle Statuses) */}
            {user?.role === 'doctor' && isOwner && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#fca5a5',
                  color: '#dc2626',
                  background: '#fff5f5',
                  fontWeight: 600,
                }}
              >
                <Trash2 size={16} />
                <span>DELETE PRESCRIPTION</span>
              </button>
            )}

            {/* Pharmacist Dispense Action */}
            {user?.role === 'pharmacist' && prescription.status === 'Sent to Pharmacist' && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleDispenseAction}
                disabled={actionLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0d9488',
                  opacity: actionLoading ? 0.65 : 1,
                }}
              >
                <PackageCheck size={16} />
                <span>Dispense Prescription</span>
              </button>
            )}

            {/* Pharmacist Mark Delivered Action */}
            {user?.role === 'pharmacist' && prescription.status === 'Dispensed' && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleDeliverAction}
                disabled={actionLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#2563eb',
                  opacity: actionLoading ? 0.65 : 1,
                }}
              >
                <Truck size={16} />
                <span>Mark as Delivered</span>
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

      {/* OUTDATED ANALYSIS WARNING BANNER */}
      {prescription.medwiseAnalysis?.isOutdated && (
        <div
          className="alert-box warning"
          role="alert"
          style={{
            marginBottom: '1.5rem',
            background: '#fffbe6',
            border: '1px solid #fde68a',
            borderLeft: '5px solid #d97706',
            color: '#92400e',
          }}
        >
          <AlertTriangle className="alert-icon" style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', color: '#b45309', fontSize: '0.95rem', marginBottom: '0.15rem' }}>
              ⚠️ Prescription Modified — Analysis Outdated
            </strong>
            <span style={{ fontSize: '0.85rem' }}>
              Prescription information was modified after the last MedWise check. The previous clinical analysis is marked as <strong>OUTDATED</strong>. Please click <strong>CHECK WITH MEDWISE</strong> to re-evaluate the latest prescription data.
            </span>
          </div>
        </div>
      )}

      {/* STACKED FLOW ORDER: Prescribed Medicines → MEDWISE CLINICAL REVIEW → Prescription Lifecycle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* 2. PRESCRIBED MEDICINES SECTION */}
        <div>
          {isEditing ? (
            /* EDIT FORM VIEW */
            <div className="dashboard-card-section" style={{ borderLeft: '4px solid var(--primary-600)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit size={20} style={{ color: 'var(--primary-600)' }} />
                  <span>Edit Prescription Regimen</span>
                </h2>
                <button
                  type="button"
                  onClick={cancelEditing}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
              </div>

              {/* Diagnosis & Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="form-label">Clinical Diagnosis</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDiagnosis}
                    onChange={(e) => setEditDiagnosis(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Physician Notes / Patient Instructions</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Follow-up Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editFollowUp}
                    onChange={(e) => setEditFollowUp(e.target.value)}
                    style={{ maxWidth: '280px' }}
                  />
                </div>
              </div>

              {/* Medicines List Editor */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem' }}>
                Medications ({editMedicines.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                {editMedicines.map((m, idx) => (
                  <div key={idx} style={{ padding: '1rem', background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-800)' }}>Medication #{idx + 1}</span>
                      {editMedicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditMedicine(idx)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Medicine Name / Master Search <span style={{ color: 'var(--danger-500)' }}>*</span>
                      </label>
                      <MedicineAutocompleteInput
                        value={m.medicineName}
                        onChange={(val) => handleEditMedicineNameChange(idx, val)}
                        onSelectMedicine={(medObj) => handleSelectEditMedicine(idx, medObj)}
                        onClear={() => handleClearEditMedicine(idx)}
                        selectedMedicine={m.selectedMedicine}
                        placeholder="Search medicine master database (e.g. Paracetamol, Metformin)..."
                        id={`edit-med-name-${idx}`}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Dosage / Strength *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={m.dosage}
                          onChange={(e) => updateEditMedicine(idx, 'dosage', e.target.value)}
                          placeholder="e.g. 500 mg"
                        />
                        {m.availableStrengths && m.availableStrengths.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {m.availableStrengths.map((str, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => updateEditMedicine(idx, 'dosage', str)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.7rem',
                                  background: m.dosage === str ? 'var(--primary-100)' : '#f1f5f9',
                                  color: m.dosage === str ? 'var(--primary-700)' : '#475569',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                {str}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Dosage Form</label>
                        <select
                          className="form-input"
                          value={m.dosageForm || 'Tablet'}
                          onChange={(e) => updateEditMedicine(idx, 'dosageForm', e.target.value)}
                        >
                          <option value="Tablet">Tablet</option>
                          <option value="Capsule">Capsule</option>
                          <option value="Syrup">Syrup</option>
                          <option value="Injection">Injection</option>
                          <option value="Ointment">Ointment</option>
                          <option value="Drops">Drops</option>
                          <option value="Inhaler">Inhaler</option>
                          <option value="Patch">Patch</option>
                          <option value="Powder">Powder</option>
                          <option value="Solution">Solution</option>
                          <option value="Suspension">Suspension</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Route</label>
                        <select
                          className="form-input"
                          value={m.route || 'Oral'}
                          onChange={(e) => updateEditMedicine(idx, 'route', e.target.value)}
                        >
                          <option value="Oral">Oral</option>
                          <option value="Topical">Topical</option>
                          <option value="Inhalation">Inhalation</option>
                          <option value="Sublingual">Sublingual</option>
                          <option value="Intravenous">Intravenous</option>
                          <option value="Intramuscular">Intramuscular</option>
                          <option value="Subcutaneous">Subcutaneous</option>
                          <option value="Rectal">Rectal</option>
                          <option value="Ophthalmic">Ophthalmic</option>
                          <option value="Otic">Otic</option>
                          <option value="Nasal">Nasal</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Frequency</label>
                        <select
                          className="form-input"
                          value={m.frequency}
                          onChange={(e) => updateEditMedicine(idx, 'frequency', e.target.value)}
                        >
                          <option value="1-0-0">1-0-0 (Morning)</option>
                          <option value="0-1-0">0-1-0 (Afternoon)</option>
                          <option value="0-0-1">0-0-1 (Night)</option>
                          <option value="1-0-1">1-0-1 (Morning & Night)</option>
                          <option value="1-1-0">1-1-0 (Morning & Afternoon)</option>
                          <option value="0-1-1">0-1-1 (Afternoon & Night)</option>
                          <option value="1-1-1">1-1-1 (Morning, Afternoon & Night)</option>
                          <option value="Once daily">Once daily</option>
                          <option value="Twice daily">Twice daily</option>
                          <option value="Three times daily">Three times daily</option>
                          <option value="As needed (PRN)">As needed (PRN)</option>
                          <option value="Every 8 hours">Every 8 hours</option>
                          <option value="Every 12 hours">Every 12 hours</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Duration</label>
                        <input
                          type="text"
                          className="form-input"
                          value={m.duration}
                          onChange={(e) => updateEditMedicine(idx, 'duration', e.target.value)}
                          placeholder="e.g. 5 days"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }} htmlFor={`edit-medicine-instructions-${idx}`}>
                        Special Patient Instructions
                      </label>
                      {(() => {
                        const isCustom = m.isCustom || (m.instructions && !STANDARD_INSTRUCTIONS.includes(m.instructions));
                        if (isCustom) {
                          return (
                            <div>
                              <input
                                id={`edit-medicine-instructions-${idx}`}
                                type="text"
                                className="form-input"
                                value={m.instructions || ''}
                                onChange={(e) => updateEditMedicine(idx, 'instructions', e.target.value)}
                                placeholder="Enter custom instructions (e.g. Follow the specific instructions discussed during consultation)"
                              />
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  updateEditMedicine(idx, 'isCustom', false);
                                  updateEditMedicine(idx, 'instructions', 'Take after meals');
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
                            id={`edit-medicine-instructions-${idx}`}
                            className="form-input"
                            value={selectedOption}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Other') {
                                updateEditMedicine(idx, 'isCustom', true);
                                updateEditMedicine(idx, 'instructions', '');
                              } else {
                                updateEditMedicine(idx, 'isCustom', false);
                                updateEditMedicine(idx, 'instructions', val);
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

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addEditMedicine}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                >
                  <Plus size={15} />
                  <span>Add Medicine</span>
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={cancelEditing}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {savingEdit ? (
                      <>
                        <div className="spinner-sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Modifications</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STATIC PRESCRIBED MEDICINES VIEW */
            <>
              <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Pill size={20} style={{ color: 'var(--primary-600)' }} />
                  <span>Prescribed Regimen ({prescription.medicines?.length || 0})</span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(prescription.medicines || []).map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        background: 'var(--slate-50)',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--slate-900)' }}>
                          {idx + 1}. {m.medicineName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            background: 'var(--primary-100)',
                            color: 'var(--primary-700)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {m.dosage}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '0.25rem' }}>
                        {m.frequency} • {m.duration} • Route: {m.route || 'Oral'}
                      </div>

                      {m.instructions && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                          Instructions: {m.instructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* DIAGNOSIS & CLINICAL NOTES */}
              {(prescription.clinicalDiagnosis || (user?.role !== 'pharmacist' && prescription.doctorNotes)) && (
                <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem' }}>
                    {prescription.clinicalDiagnosis && user?.role !== 'pharmacist' && prescription.doctorNotes
                      ? 'Clinical Indication & Doctor Notes'
                      : prescription.clinicalDiagnosis
                      ? 'Clinical Indication'
                      : 'Doctor Notes'}
                  </h3>
                  {prescription.clinicalDiagnosis && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Diagnosis:</span>
                      <p style={{ margin: '0.15rem 0 0 0', fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.9rem' }}>{prescription.clinicalDiagnosis}</p>
                    </div>
                  )}
                  {user?.role !== 'pharmacist' && prescription.doctorNotes && (
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Notes:</span>
                      <p style={{ margin: '0.15rem 0 0 0', color: 'var(--slate-700)', fontSize: '0.875rem' }}>{prescription.doctorNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* FOLLOW-UP */}
              {prescription.followUpDate && (
                <div className="dashboard-card-section" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.5rem' }}>
                    Follow-up
                  </h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)' }}>
                    Next Follow-up: <strong>{formatDisplayDate(prescription.followUpDate)}</strong>
                  </div>
                </div>
              )}

              {/* LINKED CLINICAL CONSULTATION */}
              {prescription.consultationId && (
                <div
                  className="dashboard-card-section"
                  style={{
                    marginBottom: '1.5rem',
                    borderLeft: '4px solid #0284c7',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={18} style={{ color: '#0284c7' }} />
                      <span>Linked Clinical Consultation</span>
                    </h3>
                    {user?.role === 'doctor' && (
                      <Link
                        to={`/doctor/consultations/${typeof prescription.consultationId === 'object' ? prescription.consultationId._id : prescription.consultationId}`}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--primary-600)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        <span>View Consultation</span>
                        <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                  {typeof prescription.consultationId === 'object' && prescription.consultationId !== null ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div>
                        <strong>Date:</strong> {formatDisplayDate(prescription.consultationId.consultationDate)}
                      </div>
                      {prescription.consultationId.reasonForVisit && (
                        <div>
                          <strong>Reason for Visit:</strong> {prescription.consultationId.reasonForVisit}
                        </div>
                      )}
                      {prescription.consultationId.diagnosisAssessment && (
                        <div>
                          <strong>Diagnosis:</strong> {prescription.consultationId.diagnosisAssessment}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                      Prescription originated from Clinical Consultation ID: <strong>{prescription.consultationId}</strong>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. MEDWISE CLINICAL REVIEW SECTION */}
        <div>
          <MedwiseClinicalReview
            prescription={prescription}
            checking={checking}
            onCheckWithMedwise={handleCheckWithMedwise}
            isOwner={isOwner}
            userRole={user?.role}
          />
        </div>

        {/* 4. PRESCRIPTION STATUS LIFECYCLE TRACKER */}
        <div className="dashboard-card-section">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem' }}>
            Prescription Lifecycle
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--slate-700)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span><strong>Draft Created:</strong> {formatDisplayDate(prescription.createdAt)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: prescription.approvedAt ? 'var(--slate-700)' : 'var(--slate-400)' }}>
              <CheckCircle2 size={16} style={{ color: prescription.approvedAt ? 'var(--accent-emerald)' : 'var(--slate-300)' }} />
              <span><strong>Doctor Approved:</strong> {prescription.approvedAt ? formatDisplayDate(prescription.approvedAt) : 'Pending Doctor Decision'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: prescription.dispensedAt ? 'var(--slate-700)' : 'var(--slate-400)' }}>
              <CheckCircle2 size={16} style={{ color: prescription.dispensedAt ? 'var(--accent-emerald)' : 'var(--slate-300)' }} />
              <span><strong>Pharmacist Dispensed:</strong> {prescription.dispensedAt ? formatDisplayDate(prescription.dispensedAt) : 'Pending Pharmacy Action'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: prescription.deliveredAt ? 'var(--slate-700)' : 'var(--slate-400)' }}>
              <CheckCircle2 size={16} style={{ color: prescription.deliveredAt ? 'var(--accent-emerald)' : 'var(--slate-300)' }} />
              <span><strong>Delivered to Patient:</strong> {prescription.deliveredAt ? formatDisplayDate(prescription.deliveredAt) : 'Pending Delivery'}</span>
            </div>
          </div>
        </div>

        {/* DELETE CONFIRMATION MODAL */}
        {showDeleteModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(3px)',
              zIndex: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              style={{
                maxWidth: '480px',
                width: '100%',
                background: '#fff',
                border: '2px solid #ef4444',
                borderRadius: 'var(--radius-xl)',
                padding: '1.5rem',
                boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={22} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>
                  Delete Prescription {prescription.prescriptionId}?
                </h3>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 0.35rem 0', fontWeight: 700, color: '#991b1b' }}>
                  This permanently deletes this prescription and its MedWise review data.
                </p>
                <div style={{ color: '#475569' }}>
                  <div>Prescription ID: <strong style={{ fontFamily: 'monospace', color: '#dc2626' }}>{prescription.prescriptionId}</strong></div>
                  <div>Patient Name: <strong>{prescription.patientName}</strong> ({prescription.patientPid})</div>
                  <div>Current Status: <strong>{prescription.status}</strong></div>
                </div>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
                Note: The underlying clinical consultation record will remain intact. This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingRx}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePrescription}
                  disabled={deletingRx}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: deletingRx ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {deletingRx ? 'Deleting...' : 'Delete Prescription'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
};

export default PrescriptionDetail;
