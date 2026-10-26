import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPrescriptionById, checkWithMedwise } from '../services/prescriptionService';
import { updatePatientClinicalProfile } from '../services/doctorService';
import DoctorLayout from '../components/DoctorLayout';
import PharmacistLayout from '../components/PharmacistLayout';
import PatientLayout from '../components/PatientLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import { generatePrescriptionPdf } from '../utils/pdfGenerator';
import {
  ArrowLeft,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Activity,
  Pill,
  Layers,
  HeartPulse,
  FileText,
  User,
  Info,
  Edit,
  RotateCcw,
  ExternalLink,
  PlusCircle,
  Stethoscope,
  UserCheck,
  X,
  Check,
  Download,
} from 'lucide-react';

const MedwiseDetailedReport = () => {
  const { prescriptionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [error, setError] = useState('');

  // Inline missing details state
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState('');
  const [inputDob, setInputDob] = useState('');
  const [inputGender, setInputGender] = useState('');
  const [allergyChoice, setAllergyChoice] = useState('no_allergies');
  const [inputAllergiesText, setInputAllergiesText] = useState('');
  const [inputBloodGroup, setInputBloodGroup] = useState('Unknown');

  useEffect(() => {
    let isMounted = true;
    const fetchPrescription = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getPrescriptionById(prescriptionId);
        if (isMounted) {
          if (data && data.prescription) {
            setPrescription(data.prescription);
          } else {
            setError('Prescription record not found.');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Detailed Report fetch error:', err.message);
          setError(err.response?.data?.message || 'Failed to load prescription clinical report.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (prescriptionId) {
      fetchPrescription();
    } else {
      setLoading(false);
      setError('No prescription ID specified.');
    }

    return () => {
      isMounted = false;
    };
  }, [prescriptionId, user?.role]);

  const handleManualCheck = async () => {
    try {
      setRunningAnalysis(true);
      setError('');
      const analysisRes = await checkWithMedwise(prescriptionId);
      if (analysisRes && analysisRes.prescription) {
        setPrescription(analysisRes.prescription);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to execute MedWise clinical analysis.');
    } finally {
      setRunningAnalysis(false);
    }
  };

  const LayoutWrapper =
    user?.role === 'pharmacist'
      ? PharmacistLayout
      : user?.role === 'patient'
      ? PatientLayout
      : DoctorLayout;

  const backLink =
    user?.role === 'pharmacist'
      ? `/pharmacist/prescriptions/${prescriptionId}`
      : user?.role === 'patient'
      ? `/patient/prescriptions`
      : `/doctor/prescriptions/${prescriptionId}`;

  if (loading) {
    return <Loading message="Loading MedWise Detailed Clinical Report..." />;
  }

  if (error || !prescription) {
    return (
      <LayoutWrapper>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to={backLink}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--primary-600)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Prescription</span>
          </Link>
        </div>
        <div className="alert-box error" role="alert">
          <AlertCircle className="alert-icon" />
          <span>{error || 'Prescription record not found.'}</span>
        </div>
      </LayoutWrapper>
    );
  }

  const medicines = prescription.medicines || [];
  const medwiseAnalysis = prescription.medwiseAnalysis;
  const isOutdated = Boolean(medwiseAnalysis?.isOutdated);
  const checks = medwiseAnalysis?.checks;
  const dosageList = checks?.dosage || [];
  const interactions = checks?.interactions;
  const interactionList = interactions?.findings || [];
  const duplicates = checks?.duplicates;
  const duplicateList = duplicates?.findings || [];
  const allergySafety = checks?.allergySafety;
  const allergyList = allergySafety?.findings || [];

  const overallRec = medwiseAnalysis?.overallRecommendation || prescription.medwiseChecks?.overallRecommendation;
  const rawStatus = typeof overallRec === 'object' ? String(overallRec?.status || '').toLowerCase() : String(overallRec || '').toLowerCase();
  const recMessage = typeof overallRec === 'object' ? overallRec?.message : String(overallRec || '');

  // Strictly map outcome status to 3 outcome states: CLEARED, REVIEW RECOMMENDED, ANALYSIS INCOMPLETE
  let outcomeCode = 'CLEARED';
  if (rawStatus === 'review_required' || rawStatus.includes('review')) {
    outcomeCode = 'REVIEW RECOMMENDED';
  } else if (rawStatus === 'unable_to_assess' || rawStatus.includes('incomplete')) {
    outcomeCode = 'ANALYSIS INCOMPLETE';
  } else {
    outcomeCode = 'CLEARED';
  }

  const totalMeds = medicines.length;
  const totalPairs = totalMeds >= 2 ? (totalMeds * (totalMeds - 1)) / 2 : 0;

  // Patient profile data attached from backend controller
  const patientProfile = prescription.patientProfile || {};
  const currentMeds = Array.isArray(patientProfile.currentMedications) ? patientProfile.currentMedications : [];
  const patientUserId = typeof prescription.patientId === 'object' ? prescription.patientId?._id : prescription.patientId;

  // Identify ONLY actually missing required clinical fields
  const missingAge = prescription?.patientAge == null || prescription?.patientAge === 0;
  const missingGender = !prescription?.patientGender || prescription?.patientGender === 'Unspecified' || prescription?.patientGender === '';
  const missingAllergies = !patientProfile.hasNoKnownAllergies && (!Array.isArray(patientProfile.allergies) || patientProfile.allergies.length === 0);
  const missingBloodGroup = !prescription?.patientBloodGroup || prescription?.patientBloodGroup === 'Unknown' || prescription?.patientBloodGroup === '';

  const handleSaveMissingDetails = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setFormError('');

      const payload = {};
      if (missingAge && inputDob) {
        payload.dateOfBirth = inputDob;
      }
      if (missingGender && inputGender) {
        payload.gender = inputGender;
      }
      if (missingAllergies) {
        if (allergyChoice === 'no_allergies') {
          payload.hasNoKnownAllergies = true;
          payload.allergies = [];
        } else if (allergyChoice === 'has_allergies') {
          payload.hasNoKnownAllergies = false;
          payload.allergies = inputAllergiesText.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (missingBloodGroup && inputBloodGroup && inputBloodGroup !== 'Unknown') {
        payload.bloodGroup = inputBloodGroup;
      }

      if (Object.keys(payload).length === 0) {
        setFormError('Please enter at least one missing detail to update.');
        setSavingProfile(false);
        return;
      }

      const res = await updatePatientClinicalProfile(patientUserId, payload);
      if (res && res.success) {
        setShowMissingForm(false);
        const analysisRes = await checkWithMedwise(prescriptionId);
        if (analysisRes && analysisRes.prescription) {
          setPrescription(analysisRes.prescription);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update patient profile.');
    } finally {
      setSavingProfile(false);
    }
  };

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
          <span>Back to Prescription {prescription.prescriptionId}</span>
        </Link>
      </div>

      {/* PAGE HEADER */}
      <div
        className="dashboard-card-section"
        style={{
          borderTop: '4px solid var(--primary-600)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <div
                style={{
                  background: 'var(--primary-600)',
                  color: '#ffffff',
                  padding: '0.55rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileCheck size={24} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: 'var(--slate-900)',
                    margin: 0,
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  MEDWISE DETAILED CLINICAL REPORT
                </h1>
                <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                  Comprehensive Decision Support Evaluation for Prescription {prescription.prescriptionId}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span>Patient: <strong>{prescription.patientName}</strong> (<span style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700 }}>{prescription.patientPid}</span>)</span>
              <span>•</span>
              <span>Prescribed By: <strong>{prescription.doctorName?.startsWith('Dr.') ? prescription.doctorName : `Dr. ${prescription.doctorName || ''}`}</strong></span>
              <span>•</span>
              <span>Authored: <strong>{formatDisplayDate(prescription.createdAt)}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: isOutdated
                  ? '#fffbe6'
                  : outcomeCode === 'CLEARED'
                  ? '#dcfce7'
                  : outcomeCode === 'REVIEW RECOMMENDED'
                  ? '#fef3c7'
                  : '#eff6ff',
                color: isOutdated
                  ? '#92400e'
                  : outcomeCode === 'CLEARED'
                  ? '#15803d'
                  : outcomeCode === 'REVIEW RECOMMENDED'
                  ? '#92400e'
                  : '#1d4ed8',
                border: isOutdated
                  ? '1px solid #fde68a'
                  : outcomeCode === 'CLEARED'
                  ? '1px solid #bbf7d0'
                  : outcomeCode === 'REVIEW RECOMMENDED'
                  ? '1px solid #fde68a'
                  : '1px solid #bfdbfe',
              }}
            >
              {isOutdated ? '⚠️ Analysis Outdated' : outcomeCode}
            </span>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => generatePrescriptionPdf(prescription)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              <span>DOWNLOAD CDS REPORT PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* OUTDATED WARNING BANNER */}
      {isOutdated && (
        <div
          className="dashboard-card-section"
          style={{
            background: '#fffbe6',
            border: '1px solid #fde68a',
            borderLeft: '5px solid #d97706',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e', margin: '0 0 0.35rem 0' }}>
                MEDWISE ANALYSIS OUTDATED
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#b45309', margin: 0, lineHeight: 1.5 }}>
                Prescription information was modified after the previous clinical review. A fresh MedWise analysis is required to re-evaluate potential drug interactions, dosages, and safety rules before prescription approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NO ANALYSIS STATE */}
      {!medwiseAnalysis && (
        <div
          className="dashboard-card-section"
          style={{
            padding: '2.5rem 2rem',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--slate-300)',
            marginBottom: '1.75rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 1rem auto',
              borderRadius: '50%',
              background: '#eff6ff',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
            Clinical Safety Review Pending
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            Click <strong>CHECK WITH MEDWISE</strong> on the prescription detail page to execute the 8-stage clinical decision support engine and generate the detailed clinical report.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user?.role === 'doctor' && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleManualCheck}
                disabled={runningAnalysis}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                {runningAnalysis ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Executing MedWise Analysis...</span>
                  </>
                ) : (
                  <>
                    <Stethoscope size={16} />
                    <span>RUN MEDWISE ANALYSIS</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(backLink)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 700,
              }}
            >
              <ArrowLeft size={16} />
              <span>Return to Prescription Page</span>
            </button>
          </div>
        </div>
      )}

      {medwiseAnalysis && (
        <>
          {/* OVERALL MEDWISE AUDIT & COVERAGE SUMMARY (PHASE 6) */}
          <div
            className="dashboard-card-section"
            style={{
              marginBottom: '1.75rem',
              borderTop: `4px solid ${
                outcomeCode === 'CLEARED'
                  ? '#16a34a'
                  : outcomeCode === 'REVIEW RECOMMENDED'
                  ? '#d97706'
                  : '#2563eb'
              }`,
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={22} style={{ color: outcomeCode === 'CLEARED' ? '#16a34a' : outcomeCode === 'REVIEW RECOMMENDED' ? '#d97706' : '#2563eb' }} />
                  <span>OVERALL MEDWISE AUDIT</span>
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', fontWeight: 600, marginTop: '2px' }}>
                  Combined 8-Stage Clinical Decision Support Aggregation
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    padding: '0.4rem 1rem',
                    borderRadius: 'var(--radius-full)',
                    background: outcomeCode === 'CLEARED' ? '#dcfce7' : outcomeCode === 'REVIEW RECOMMENDED' ? '#fef3c7' : '#eff6ff',
                    color: outcomeCode === 'CLEARED' ? '#15803d' : outcomeCode === 'REVIEW RECOMMENDED' ? '#92400e' : '#1d4ed8',
                    border: outcomeCode === 'CLEARED' ? '1px solid #bbf7d0' : outcomeCode === 'REVIEW RECOMMENDED' ? '1px solid #fde68a' : '1px solid #bfdbfe',
                  }}
                >
                  Outcome: {outcomeCode}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--slate-800)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Clinical Assessment: {recMessage}
            </p>

            {/* FINDINGS METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Findings</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '2px' }}>
                  {medwiseAnalysis?.audit?.summary?.totalFindings ?? (dosageList.length + interactionList.length + duplicateList.length + allergyList.length)}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Critical</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                  {medwiseAnalysis?.audit?.summary?.criticalFindings ?? 0}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', background: '#fffbe6', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Warnings</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                  {medwiseAnalysis?.audit?.summary?.warningFindings ?? 0}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Incomplete</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                  {medwiseAnalysis?.audit?.summary?.incompleteAssessments ?? (missingAge || missingGender || missingAllergies ? 1 : 0)}
                </div>
              </div>
            </div>

            {/* ANALYSIS COVERAGE GRID */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--slate-700)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ANALYSIS COVERAGE
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.825rem' }}>
                {(() => {
                  const coverage = medwiseAnalysis?.audit?.coverage || {};
                  const stages = [
                    { name: 'Patient Context', state: coverage.patientContext || (missingAge || missingGender ? 'INCOMPLETE' : 'COMPLETED') },
                    { name: 'Prescription Validation', state: coverage.prescriptionValidation || 'COMPLETED' },
                    { name: 'Dosage Analysis', state: coverage.dosageAnalysis || (dosageList.some(d => d.status === 'unable_to_assess') ? 'INCOMPLETE' : 'COMPLETED') },
                    { name: 'Drug–Drug Interaction', state: coverage.drugInteraction || (interactions?.status === 'unable_to_assess' ? 'INCOMPLETE' : 'COMPLETED') },
                    { name: 'Duplicate Medication', state: coverage.duplicateMedication || (duplicates?.status === 'unable_to_assess' ? 'INCOMPLETE' : 'COMPLETED') },
                    { name: 'Allergy & Safety', state: coverage.allergySafety || (missingAllergies ? 'INCOMPLETE' : 'COMPLETED') },
                    { name: 'Patient-Specific CDS', state: coverage.patientSpecificCDS || 'COMPLETED' },
                    { name: 'Overall Audit', state: coverage.overallAudit || 'COMPLETED' },
                  ];

                  return stages.map((stg, i) => (
                    <div key={i} style={{ padding: '0.4rem 0.65rem', background: stg.state === 'COMPLETED' ? '#f0fdf4' : '#eff6ff', borderRadius: '6px', border: `1px solid ${stg.state === 'COMPLETED' ? '#bbf7d0' : '#bfdbfe'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{stg.name}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.75rem', color: stg.state === 'COMPLETED' ? '#166534' : '#1d4ed8' }}>
                        {stg.state === 'COMPLETED' ? '✓ Completed' : '⚠ Incomplete'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* SECTION 1: PATIENT CLINICAL CONTEXT */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} style={{ color: 'var(--primary-600)' }} />
              <span>1. Patient Clinical Context</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Age & Gender</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-900)', marginTop: '2px' }}>
                  {prescription.patientAge != null ? `${prescription.patientAge} years` : 'Adult'} • {prescription.patientGender || 'Unspecified'}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Blood Group</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  {prescription.patientBloodGroup && prescription.patientBloodGroup !== 'Unknown' ? prescription.patientBloodGroup : 'Not Specified'}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Allergy Assessment Status</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>
                  {patientProfile.hasNoKnownAllergies ? (
                    <span style={{ color: '#15803d' }}>✓ No known allergies (Assessed / N/A)</span>
                  ) : Array.isArray(patientProfile.allergies) && patientProfile.allergies.length > 0 ? (
                    <span style={{ color: '#b91c1c' }}>⚠ Allergies: {patientProfile.allergies.join(', ')}</span>
                  ) : (
                    <span style={{ color: '#92400e' }}>⚠ Allergy status uncompleted</span>
                  )}
                </div>
              </div>
            </div>

            {/* CURRENT MEDICATIONS & REGIMEN COMPARISON */}
            {currentMeds.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e40af', margin: '0 0 0.5rem 0' }}>
                  Patient's Current Medications vs Newly Prescribed Regimen
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                  {currentMeds.map((cm, idx) => {
                    const cmName = typeof cm === 'string' ? cm : cm.name || cm.genericName || 'Current Medication';
                    const cmDose = typeof cm === 'object' && cm.dosage ? cm.dosage : 'Recorded dose';
                    return (
                      <div key={idx} style={{ padding: '0.5rem 0.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #dbeafe', color: '#1e293b' }}>
                        <strong>Current Medication:</strong> {cmName} ({cmDose}) → <strong>Newly Prescribed:</strong> {medicines.map((m) => m.genericName || m.medicineName).join(', ')}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: DOSAGE ANALYSIS */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pill size={20} style={{ color: 'var(--primary-600)' }} />
              <span>2. Dosage Analysis ({medicines.length} Medicine(s) Evaluated)</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {medicines.map((m, idx) => {
                const medSearchName = String(m.genericName || m.medicineName || '').toLowerCase();
                const match = dosageList.find(
                  (d) =>
                    (d.genericName && String(d.genericName).toLowerCase() === medSearchName) ||
                    (d.medicineId && String(d.medicineId) === String(m.medicineId))
                );

                const prescribedSingleDose = m.dosage || match?.prescribedDose || '';
                const prescribedFrequency = m.frequency || match?.prescribedFrequency || '';
                const prescribedDuration = m.duration || match?.prescribedDuration || '';
                const calculatedDailyDoseVal = match?.calculatedDailyDose != null ? `${match.calculatedDailyDose} ${match.calculatedDailyDoseUnit || 'mg'}` : null;
                const applicablePopulation = match?.applicablePopulation || null;
                const guidelineRange = match?.guidelineRange || null;
                const isReview = match && match.status === 'review_required';
                const isUnassessable = match && match.status === 'unable_to_assess';
                const isAccepted = match && match.status === 'accepted';
                const statusBadgeText = isReview ? 'REVIEW REQUIRED' : isUnassessable ? 'UNABLE TO ASSESS' : isAccepted ? 'ACCEPTED' : 'WITHIN GUIDANCE';
                const reason = match?.reason || match?.message || (isAccepted ? 'No verified dosage guideline is configured in the Medicine Master. The dosage prescribed by the doctor is accepted as entered.' : 'Prescribed dosage falls within configured master dosage guidance.');
                const clinicalConsideration = match?.clinicalConsideration || null;
                const evidenceSource = match?.evidenceSource || null;
                const doctorReviewRequiredStr = match?.doctorReviewRequired !== undefined ? (match.doctorReviewRequired ? 'Yes' : 'No') : (isReview ? 'Yes' : 'No');

                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      background: isReview ? '#fffdf5' : isUnassessable ? '#eff6ff' : isAccepted ? '#f0fdf4' : '#f0fdf4',
                      borderLeft: `5px solid ${isReview ? '#d97706' : isUnassessable ? '#2563eb' : isAccepted ? '#16a34a' : '#16a34a'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.85rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                          Medicine: {m.medicineName} {m.genericName && <span style={{ color: 'var(--slate-500)', fontWeight: 600 }}>({m.genericName})</span>}
                        </h3>
                      </div>
                      <div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: isReview ? '#fef3c7' : isUnassessable ? '#eff6ff' : isAccepted ? '#dcfce7' : '#dcfce7',
                            color: isReview ? '#92400e' : isUnassessable ? '#1d4ed8' : isAccepted ? '#15803d' : '#15803d',
                            fontWeight: 800,
                            fontSize: '0.775rem',
                            display: 'inline-block',
                          }}
                        >
                          {isReview ? '⚠ REVIEW REQUIRED' : isUnassessable ? 'UNABLE TO ASSESS' : isAccepted ? '✓ ACCEPTED' : '✓ WITHIN GUIDANCE'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
                      {prescribedSingleDose ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Prescribed Dose:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{prescribedSingleDose}</span>
                        </div>
                      ) : null}

                      {prescribedFrequency ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Frequency:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{prescribedFrequency}</span>
                        </div>
                      ) : null}

                      {prescribedDuration ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Duration:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{prescribedDuration}</span>
                        </div>
                      ) : null}

                      {calculatedDailyDoseVal ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Calculated Daily Dose:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{calculatedDailyDoseVal}</span>
                        </div>
                      ) : null}

                      {applicablePopulation ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Applicable Population:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{applicablePopulation}</span>
                        </div>
                      ) : null}

                      {guidelineRange ? (
                        <div>
                          <strong style={{ color: 'var(--slate-600)' }}>Guideline:</strong>{' '}
                          <span style={{ color: 'var(--slate-900)', fontWeight: 700 }}>{guidelineRange}</span>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-800)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div>
                        <strong>Assessment:</strong> {statusBadgeText}
                      </div>

                      {reason ? (
                        <div>
                          <strong>Reason:</strong> {reason}
                        </div>
                      ) : null}

                      {clinicalConsideration ? (
                        <div>
                          <strong>Clinical Consideration:</strong> {clinicalConsideration}
                        </div>
                      ) : null}

                      {evidenceSource ? (
                        <div style={{ color: 'var(--slate-500)', fontSize: '0.8rem' }}>
                          <strong>Evidence:</strong> {evidenceSource}
                        </div>
                      ) : null}

                      {doctorReviewRequiredStr ? (
                        <div>
                          <strong>Doctor Review Required:</strong> {doctorReviewRequiredStr}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: DRUG-DRUG INTERACTION ANALYSIS */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} style={{ color: 'var(--primary-600)' }} />
                <span>3. Drug–Drug Interaction Analysis</span>
              </h2>
              <span style={{ fontSize: '0.775rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                Traceable to MedWise DrugInteraction Database
              </span>
            </div>

            {(() => {
              const currentPrescriptionInteractions = interactionList.filter(
                (f) => f.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION'
              );
              const activePreviousInteractions = interactionList.filter(
                (f) => f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION'
              );

              const currentPairsCount =
                interactions?.currentPrescriptionPairsCount !== undefined
                  ? interactions.currentPrescriptionPairsCount
                  : (currentPrescriptionInteractions.length || (medicines.length > 1 ? (medicines.length * (medicines.length - 1)) / 2 : 0));

              const activePreviousPairsCount =
                interactions?.activePreviousPairsCount !== undefined
                  ? interactions.activePreviousPairsCount
                  : activePreviousInteractions.length;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  {/* SECTION A: CURRENT PRESCRIPTION INTERACTIONS */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                          A. CURRENT PRESCRIPTION INTERACTIONS
                        </h3>
                        <p style={{ fontSize: '0.775rem', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                          Interactions between medicines in this prescription.
                        </p>
                      </div>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: currentPairsCount > 0 ? '#eff6ff' : '#f1f5f9',
                          color: currentPairsCount > 0 ? '#1d4ed8' : 'var(--slate-600)',
                          fontSize: '0.775rem',
                          fontWeight: 700,
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        {currentPairsCount} pair(s) evaluated
                      </span>
                    </div>

                    {currentPairsCount === 0 ? (
                      <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', color: 'var(--slate-600)', fontSize: '0.85rem' }}>
                        Prescription contains a single medicine. Pairwise interaction evaluation requires 2 or more medicines in this prescription. (0 pair(s) evaluated)
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Pair #</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Evaluated Pair</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Status & Severity</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Reason & Potential Concern</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Clinical Consideration & Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              if (currentPrescriptionInteractions.length > 0) {
                                return currentPrescriptionInteractions.map((match, idx) => {
                                  const nameA = String(match.medicineA?.genericName || match.medicineA?.medicineName || match.medicineA?.name || 'Med A').trim();
                                  const nameB = String(match.medicineB?.genericName || match.medicineB?.medicineName || match.medicineB?.name || 'Med B').trim();
                                  const isFlagged = match.status === 'interaction_flagged';
                                  const isUnable = match.status === 'unable_to_assess';
                                  const severity = match.severity || 'none';
                                  const isCritical = severity === 'Contraindicated' || severity === 'Major' || severity === 'critical';
                                  const effect = match.reason || match.message || (isFlagged ? 'Potential interaction detected.' : 'No verified interaction record in MedWise database.');
                                  const concern = match.potentialConcern || '';
                                  const consideration = match.clinicalConsideration || '';
                                  const evidence = match.evidenceSource || 'MedWise DrugInteraction Database';

                                  return (
                                    <tr key={`curr_item_${idx}`} style={{ borderBottom: '1px solid #f1f5f9', background: isFlagged ? '#fffbeb' : '#ffffff' }}>
                                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: isFlagged ? '#92400e' : 'var(--slate-500)' }}>
                                        #{idx + 1}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                                        <div>{nameA} <span style={{ color: 'var(--primary-600)' }}>↔</span> {nameB}</div>
                                        <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', fontWeight: 600, marginTop: '2px' }}>
                                          Source: Current Prescription
                                        </div>
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem' }}>
                                        {isFlagged ? (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: isCritical ? '#fee2e2' : '#fef3c7', color: isCritical ? '#b91c1c' : '#92400e', fontWeight: 800, fontSize: '0.75rem', display: 'inline-block' }}>
                                            ⚠ {severity.toUpperCase()}
                                          </span>
                                        ) : isUnable ? (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem' }}>
                                            Unable to Assess
                                          </span>
                                        ) : (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.75rem' }}>
                                            ✓ No Interaction
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-700)', fontSize: '0.8rem', maxWidth: '260px' }}>
                                        <div style={{ fontWeight: isFlagged ? 600 : 400 }}>{effect}</div>
                                        {concern && concern !== effect && (
                                          <div style={{ fontSize: '0.75rem', color: isFlagged ? '#92400e' : 'var(--slate-500)', marginTop: '2px' }}>
                                            <em>Concern:</em> {concern}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-600)', fontSize: '0.775rem', maxWidth: '240px' }}>
                                        {consideration && (
                                          <div style={{ color: 'var(--primary-700)', fontWeight: 600, marginBottom: '2px' }}>
                                            {consideration}
                                          </div>
                                        )}
                                        {evidence && (
                                          <div style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>
                                            Ref: {evidence}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                });
                              }

                              const rows = [];
                              let pIdx = 0;
                              for (let i = 0; i < medicines.length; i++) {
                                for (let j = i + 1; j < medicines.length; j++) {
                                  pIdx++;
                                  const nameA = String(medicines[i].genericName || medicines[i].medicineName || '').trim();
                                  const nameB = String(medicines[j].genericName || medicines[j].medicineName || '').trim();
                                  const match = interactionList.find((f) => {
                                    const medA = String(f.medicineA?.genericName || f.medicineA?.medicineName || '').trim();
                                    const medB = String(f.medicineB?.genericName || f.medicineB?.medicineName || '').trim();
                                    return (
                                      (medA.toLowerCase() === nameA.toLowerCase() && medB.toLowerCase() === nameB.toLowerCase()) ||
                                      (medA.toLowerCase() === nameB.toLowerCase() && medB.toLowerCase() === nameA.toLowerCase())
                                    );
                                  });
                                  const isFlagged = match && match.status === 'interaction_flagged';
                                  const isUnable = match && match.status === 'unable_to_assess';
                                  const severity = match?.severity || 'none';
                                  const isCritical = severity === 'Contraindicated' || severity === 'Major' || severity === 'critical';
                                  const effect = match?.reason || match?.message || (isFlagged ? 'Potential interaction detected.' : 'No verified interaction record in MedWise database.');
                                  const concern = match?.potentialConcern || '';
                                  const consideration = match?.clinicalConsideration || '';
                                  const evidence = match?.evidenceSource || 'MedWise DrugInteraction Database';

                                  rows.push(
                                    <tr key={`curr_fb_${pIdx}`} style={{ borderBottom: '1px solid #f1f5f9', background: isFlagged ? '#fffbeb' : '#ffffff' }}>
                                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: isFlagged ? '#92400e' : 'var(--slate-500)' }}>
                                        #{pIdx}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                                        <div>{nameA} <span style={{ color: 'var(--primary-600)' }}>↔</span> {nameB}</div>
                                        <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', fontWeight: 600, marginTop: '2px' }}>
                                          Source: Current Prescription
                                        </div>
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem' }}>
                                        {isFlagged ? (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: isCritical ? '#fee2e2' : '#fef3c7', color: isCritical ? '#b91c1c' : '#92400e', fontWeight: 800, fontSize: '0.75rem', display: 'inline-block' }}>
                                            ⚠ {severity.toUpperCase()}
                                          </span>
                                        ) : isUnable ? (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem' }}>
                                            Unable to Assess
                                          </span>
                                        ) : (
                                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.75rem' }}>
                                            ✓ No Interaction
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-700)', fontSize: '0.8rem', maxWidth: '260px' }}>
                                        <div style={{ fontWeight: isFlagged ? 600 : 400 }}>{effect}</div>
                                        {concern && concern !== effect && (
                                          <div style={{ fontSize: '0.75rem', color: isFlagged ? '#92400e' : 'var(--slate-500)', marginTop: '2px' }}>
                                            <em>Concern:</em> {concern}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-600)', fontSize: '0.775rem', maxWidth: '240px' }}>
                                        {consideration && (
                                          <div style={{ color: 'var(--primary-700)', fontWeight: 600, marginBottom: '2px' }}>
                                            {consideration}
                                          </div>
                                        )}
                                        {evidence && (
                                          <div style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>
                                            Ref: {evidence}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              }
                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECTION B: ACTIVE PREVIOUS PRESCRIPTION INTERACTIONS */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                          B. ACTIVE PREVIOUS PRESCRIPTION INTERACTIONS
                        </h3>
                        <p style={{ fontSize: '0.775rem', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                          Interactions between currently active medicines from previous prescriptions and this prescription.
                        </p>
                      </div>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: activePreviousPairsCount > 0 ? '#eff6ff' : '#f1f5f9',
                          color: activePreviousPairsCount > 0 ? '#1d4ed8' : 'var(--slate-600)',
                          fontSize: '0.775rem',
                          fontWeight: 700,
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        {activePreviousPairsCount} pair(s) evaluated
                      </span>
                    </div>

                    {activePreviousPairsCount === 0 || activePreviousInteractions.length === 0 ? (
                      <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', color: 'var(--slate-600)', fontSize: '0.85rem' }}>
                        No active previous medications identified for this patient. Previous-prescription interaction analysis evaluated 0 pair(s).
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Pair #</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Evaluated Pair (Active Previous ↔ Current)</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Status & Severity</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Reason & Potential Concern</th>
                              <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-700)' }}>Clinical Consideration & Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activePreviousInteractions.map((match, idx) => {
                              const nameA = String(match.medicineA?.genericName || match.medicineA?.medicineName || match.medicineA?.name || 'Previous Med').trim();
                              const nameB = String(match.medicineB?.genericName || match.medicineB?.medicineName || match.medicineB?.name || 'New Med').trim();
                              const isFlagged = match.status === 'interaction_flagged';
                              const isUnable = match.status === 'unable_to_assess';
                              const severity = match.severity || 'none';
                              const isCritical = severity === 'Contraindicated' || severity === 'Major' || severity === 'critical';
                              const effect = match.reason || match.message || (isFlagged ? 'Potential interaction detected.' : 'No verified interaction record in MedWise database.');
                              const concern = match.potentialConcern || '';
                              const consideration = match.clinicalConsideration || '';
                              const evidence = match.evidenceSource || 'MedWise DrugInteraction Database';

                              return (
                                <tr key={`prev_item_${idx}`} style={{ borderBottom: '1px solid #f1f5f9', background: isFlagged ? '#fffbeb' : '#ffffff' }}>
                                  <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: isFlagged ? '#92400e' : 'var(--slate-500)' }}>
                                    #{idx + 1}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                                    <div>{nameA} <span style={{ color: 'var(--primary-600)' }}>↔</span> {nameB}</div>
                                    <div style={{ fontSize: '0.725rem', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>
                                      Active Previous ({nameA}) ↔ Current ({nameB})
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem' }}>
                                    {isFlagged ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: isCritical ? '#fee2e2' : '#fef3c7', color: isCritical ? '#b91c1c' : '#92400e', fontWeight: 800, fontSize: '0.75rem', display: 'inline-block' }}>
                                        ⚠ {severity.toUpperCase()}
                                      </span>
                                    ) : isUnable ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem' }}>
                                        Unable to Assess
                                      </span>
                                    ) : (
                                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.75rem' }}>
                                        ✓ No Interaction
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-700)', fontSize: '0.8rem', maxWidth: '260px' }}>
                                    <div style={{ fontWeight: isFlagged ? 600 : 400 }}>{effect}</div>
                                    {concern && concern !== effect && (
                                      <div style={{ fontSize: '0.75rem', color: isFlagged ? '#92400e' : 'var(--slate-500)', marginTop: '2px' }}>
                                        <em>Concern:</em> {concern}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', color: 'var(--slate-600)', fontSize: '0.775rem', maxWidth: '240px' }}>
                                    {consideration && (
                                      <div style={{ color: 'var(--primary-700)', fontWeight: 600, marginBottom: '2px' }}>
                                        {consideration}
                                      </div>
                                    )}
                                    {evidence && (
                                      <div style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>
                                        Ref: {evidence}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SECTION 4: DUPLICATE MEDICATION ANALYSIS */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} style={{ color: 'var(--primary-600)' }} />
              <span>4. Duplicate Medication Analysis</span>
            </h2>

            {duplicateList.filter((d) => d.status === 'duplicate_found').length === 0 ? (
              <div style={{ padding: '1rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', fontWeight: 600 }}>
                ✓ No duplicate active ingredients or therapeutic class redundancies detected in this regimen.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {duplicateList.filter((d) => d.status === 'duplicate_found').map((dup, idx) => {
                  const medAName = dup.medicineA?.genericName || dup.medicineA?.name || 'Medicine A';
                  const medBName = dup.medicineB?.genericName || dup.medicineB?.name || 'Medicine B';
                  const sourceLabel = dup.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION'
                    ? 'Current Medication → New Prescription'
                    : 'New Prescription → New Prescription';
                  const dupTypeLabel = dup.duplicateType === 'EXACT_MEDICINE'
                    ? 'Exact Medicine'
                    : dup.duplicateType === 'DUPLICATE_GROUP'
                    ? 'Duplicate Group'
                    : dup.duplicateType;
                  const docReviewStr = dup.doctorReviewRequired !== undefined ? (dup.doctorReviewRequired ? 'Yes' : 'No') : 'Yes';

                  return (
                    <div key={idx} style={{ padding: '1.25rem', background: '#fffdf5', border: '1px solid #fde68a', borderLeft: '5px solid #d97706', borderRadius: '8px', color: 'var(--slate-900)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
                            Medicine A: {medAName} • Medicine B: {medBName}
                          </h3>
                          <div style={{ fontSize: '0.775rem', color: '#854d0e', fontWeight: 600, marginTop: '2px' }}>
                            Source: {sourceLabel}
                          </div>
                        </div>
                        <div>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.75rem' }}>
                            ⚠ DUPLICATE FLAGGED
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                        {dupTypeLabel ? (
                          <div>
                            <strong>Duplicate Type:</strong> {dupTypeLabel}
                          </div>
                        ) : null}

                        {dup.reason || dup.message ? (
                          <div>
                            <strong>Reason:</strong> {dup.reason || dup.message}
                          </div>
                        ) : null}

                        {dup.severity ? (
                          <div>
                            <strong>Severity:</strong> {dup.severity}
                          </div>
                        ) : null}

                        {dup.evidenceSource ? (
                          <div style={{ color: 'var(--slate-500)', fontSize: '0.8rem' }}>
                            <strong>Evidence:</strong> {dup.evidenceSource}
                          </div>
                        ) : null}

                        {docReviewStr ? (
                          <div>
                            <strong>Doctor Review Required:</strong> {docReviewStr}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 5: ALLERGY & SAFETY */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} style={{ color: 'var(--primary-600)' }} />
              <span>5. Allergy & Safety Analysis</span>
            </h2>

            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <strong>Patient Allergy Status:</strong>{' '}
              {patientProfile.hasNoKnownAllergies ? (
                <span style={{ color: '#16a34a', fontWeight: 700 }}>No known allergies (Assessed / N/A)</span>
              ) : Array.isArray(patientProfile.allergies) && patientProfile.allergies.length > 0 ? (
                <span style={{ color: '#dc2626', fontWeight: 700 }}>Documented Allergies: {patientProfile.allergies.join(', ')}</span>
              ) : (
                <span style={{ color: '#d97706', fontWeight: 700 }}>Uncompleted Allergy Assessment</span>
              )}
            </div>

            {allergyList.filter((a) => a.status === 'allergy_risk' || a.status === 'safety_rule_flagged').length === 0 ? (
              <div style={{ padding: '1rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', fontWeight: 600 }}>
                ✓ No allergen contraindications or safety rule warnings flagged for prescribed medications.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allergyList.filter((a) => a.status === 'allergy_risk' || a.status === 'safety_rule_flagged').map((item, idx) => {
                  const medName = item.medicine?.genericName || item.medicine?.name || 'Medicine';
                  const isAllergy = item.status === 'allergy_risk';
                  const ruleTypeLabel = item.ruleType || item.type || (isAllergy ? 'Allergy' : 'Safety Rule');
                  const docReviewStr = item.doctorReviewRequired !== undefined ? (item.doctorReviewRequired ? 'Yes' : 'No') : 'Yes';

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '1.25rem',
                        background: isAllergy ? '#fff5f5' : '#f0f9ff',
                        border: `1px solid ${isAllergy ? '#fecaca' : '#bae6fd'}`,
                        borderLeft: `5px solid ${isAllergy ? '#dc2626' : '#0284c7'}`,
                        borderRadius: '8px',
                        color: 'var(--slate-900)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: isAllergy ? '#991b1b' : '#0369a1', margin: 0 }}>
                            Medicine: {medName}
                          </h3>
                          <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)', fontWeight: 600, marginTop: '2px' }}>
                            Rule Type: {ruleTypeLabel}
                          </div>
                        </div>
                        <div>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: isAllergy ? '#fee2e2' : '#e0f2fe',
                              color: isAllergy ? '#991b1b' : '#0369a1',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                            }}
                          >
                            {isAllergy ? '⚠ ALLERGY RISK' : '⚠ SAFETY RULE FLAGGED'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                        {item.severity ? (
                          <div>
                            <strong>Severity:</strong> {item.severity}
                          </div>
                        ) : null}

                        {item.reason || item.message ? (
                          <div>
                            <strong>Reason:</strong> {item.reason || item.message}
                          </div>
                        ) : null}

                        {item.potentialConcern ? (
                          <div>
                            <strong>Potential Concern:</strong> {item.potentialConcern}
                          </div>
                        ) : null}

                        {item.clinicalConsideration ? (
                          <div>
                            <strong>Clinical Consideration:</strong> {item.clinicalConsideration}
                          </div>
                        ) : null}

                        {item.evidenceSource ? (
                          <div style={{ color: 'var(--slate-500)', fontSize: '0.8rem' }}>
                            <strong>Evidence:</strong> {item.evidenceSource}
                          </div>
                        ) : null}

                        {docReviewStr ? (
                          <div>
                            <strong>Doctor Review Required:</strong> {docReviewStr}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 6: PATIENT-SPECIFIC CONSIDERATIONS */}
          <div className="dashboard-card-section" style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={20} style={{ color: 'var(--primary-600)' }} />
              <span>6. Patient-Specific Clinical Analysis</span>
            </h2>

            {(() => {
              const psList = (checks?.patientSpecific?.findings || []).filter((f) => f.status === 'patient_specific_flagged');

              if (psList.length === 0) {
                return (
                  <div style={{ padding: '1rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', fontWeight: 600 }}>
                    ✓ Prescription evaluated against patient demographic profile (Age: <strong>{prescription.patientAge != null ? `${prescription.patientAge} years` : 'Adult'}</strong>, Gender: <strong>{prescription.patientGender || 'Unspecified'}</strong>) and documented clinical conditions. No patient-specific clinical precautions flagged for available patient profile context.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {psList.map((item, idx) => {
                    const medName = item.medicine?.genericName || item.medicine?.name || 'Medicine';
                    const docReviewStr = item.doctorReviewRequired !== undefined ? (item.doctorReviewRequired ? 'Yes' : 'No') : 'Yes';

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '1.25rem',
                          background: '#fcf5ff',
                          border: '1px solid #e9d5ff',
                          borderLeft: '5px solid #9333ea',
                          borderRadius: '8px',
                          color: 'var(--slate-900)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6b21a8', margin: 0 }}>
                              Patient Factor: {item.patientFactor || 'Patient Context'}
                            </h3>
                            <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)', fontWeight: 600, marginTop: '2px' }}>
                              Medicine: {medName}
                            </div>
                          </div>
                          <div>
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#f3e8ff', color: '#6b21a8', fontWeight: 800, fontSize: '0.75rem' }}>
                              ⚠ PATIENT PRECAUTION FLAGGED
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                          {item.findingType || item.type ? (
                            <div>
                              <strong>Finding:</strong> {item.findingType || item.type}
                            </div>
                          ) : null}

                          {item.reason || item.message ? (
                            <div>
                              <strong>Reason:</strong> {item.reason || item.message}
                            </div>
                          ) : null}

                          {item.clinicalConsideration ? (
                            <div>
                              <strong>Clinical Consideration:</strong> {item.clinicalConsideration}
                            </div>
                          ) : null}

                          {item.evidenceSource ? (
                            <div style={{ color: 'var(--slate-500)', fontSize: '0.8rem' }}>
                              <strong>Evidence:</strong> {item.evidenceSource}
                            </div>
                          ) : null}

                          {docReviewStr ? (
                            <div>
                              <strong>Doctor Review Required:</strong> {docReviewStr}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* SECTION 7: OVERALL CLINICAL ASSESSMENT */}
          <div
            className="dashboard-card-section"
            style={{
              background: outcomeCode === 'CLEARED' ? '#f0fdf4' : outcomeCode === 'REVIEW RECOMMENDED' ? '#fffbe6' : '#eff6ff',
              border: `1px solid ${outcomeCode === 'CLEARED' ? '#bbf7d0' : outcomeCode === 'REVIEW RECOMMENDED' ? '#fde68a' : '#bfdbfe'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: outcomeCode === 'CLEARED' ? '#166534' : outcomeCode === 'REVIEW RECOMMENDED' ? '#92400e' : '#1e40af', margin: '0 0 0.5rem 0' }}>
              7. Overall Clinical Assessment — {outcomeCode}
            </h2>

            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: outcomeCode === 'CLEARED' ? '#15803d' : outcomeCode === 'REVIEW RECOMMENDED' ? '#b45309' : '#1d4ed8', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
              {recMessage}
            </p>

            {/* ACTION BUTTONS BASED ON OUTCOME */}
            {user?.role === 'doctor' && (
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                {outcomeCode === 'REVIEW RECOMMENDED' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(backLink)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#d97706' }}
                  >
                    <Edit size={16} />
                    <span>Edit Prescription & Re-run MedWise</span>
                  </button>
                )}

                {outcomeCode === 'ANALYSIS INCOMPLETE' && patientUserId && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowMissingForm(!showMissingForm)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb' }}
                  >
                    <PlusCircle size={16} />
                    <span>{showMissingForm ? 'Hide Form' : 'ADD MISSING DETAILS'}</span>
                  </button>
                )}

                {outcomeCode === 'CLEARED' && !isOutdated && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(backLink)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#16a34a' }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Return to Prescription Approval</span>
                  </button>
                )}
              </div>
            )}

            {/* INLINE MISSING INFORMATION FORM */}
            {showMissingForm && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  background: '#ffffff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 2px 10px rgba(37,99,235,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PlusCircle size={18} />
                    Add Missing Patient Details (Updates MongoDB Profile & Re-runs MedWise)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowMissingForm(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {formError && (
                  <div className="alert-box error" style={{ marginBottom: '1rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveMissingDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {missingAge && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                        Date of Birth (Missing Age) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={inputDob}
                        onChange={(e) => setInputDob(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}

                  {missingGender && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                        Gender <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        className="form-control"
                        value={inputGender}
                        onChange={(e) => setInputGender(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="">Select Gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  {missingAllergies && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                        Allergy Status <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input
                            type="radio"
                            name="allergyChoiceDet"
                            value="no_allergies"
                            checked={allergyChoice === 'no_allergies'}
                            onChange={() => setAllergyChoice('no_allergies')}
                          />
                          No known allergies
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input
                            type="radio"
                            name="allergyChoiceDet"
                            value="has_allergies"
                            checked={allergyChoice === 'has_allergies'}
                            onChange={() => setAllergyChoice('has_allergies')}
                          />
                          Yes, patient has allergies
                        </label>
                      </div>

                      {allergyChoice === 'has_allergies' && (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Amoxicillin, Penicillin (comma separated)"
                          value={inputAllergiesText}
                          onChange={(e) => setInputAllergiesText(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      )}
                    </div>
                  )}

                  {missingBloodGroup && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                        Blood Group (Optional)
                      </label>
                      <select
                        className="form-control"
                        value={inputBloodGroup}
                        onChange={(e) => setInputBloodGroup(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="Unknown">Unknown / Select...</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {savingProfile ? 'Saving & Re-running...' : 'SAVE & RE-RUN MEDWISE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMissingForm(false)}
                      style={{
                        background: '#e2e8f0',
                        color: '#475569',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </LayoutWrapper>
  );
};

export default MedwiseDetailedReport;
