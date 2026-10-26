import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePatientClinicalProfile } from '../services/doctorService';
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Activity,
  Pill,
  Info,
  Check,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Layers,
  HeartPulse,
  ChevronRight,
  UserCheck,
  X,
} from 'lucide-react';

const ANALYSIS_STAGES = [
  { key: 'patient_context', number: 1, label: 'Patient Context' },
  { key: 'prescription_validation', number: 2, label: 'Prescription Validation' },
  { key: 'dosage_analysis', number: 3, label: 'Dosage Analysis' },
  { key: 'drug_drug_pairwise', number: 4, label: 'Drug–Drug Pairwise' },
  { key: 'duplicates', number: 5, label: 'Duplicate Medication' },
  { key: 'allergy_safety', number: 6, label: 'Allergy & Safety' },
  { key: 'patient_specific', number: 7, label: 'Patient-Specific' },
  { key: 'overall_audit', number: 8, label: 'Overall Audit' },
];

const MedwiseClinicalReview = ({
  prescription,
  checking = false,
  onCheckWithMedwise,
  isOwner = false,
  userRole = 'doctor',
}) => {
  const navigate = useNavigate();
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  // Inline missing details state
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState('');
  const [inputDob, setInputDob] = useState('');
  const [inputGender, setInputGender] = useState('');
  const [allergyChoice, setAllergyChoice] = useState('no_allergies');
  const [inputAllergiesText, setInputAllergiesText] = useState('');
  const [inputBloodGroup, setInputBloodGroup] = useState('Unknown');

  // Animate stages while checking API call is active
  useEffect(() => {
    let interval;
    if (checking) {
      setActiveStageIndex(0);
      interval = setInterval(() => {
        setActiveStageIndex((prev) => {
          if (prev < ANALYSIS_STAGES.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 350);
    } else {
      setActiveStageIndex(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checking]);

  const medicines = prescription?.medicines || [];
  const medwiseAnalysis = prescription?.medwiseAnalysis;
  const isOutdated = Boolean(medwiseAnalysis?.isOutdated);
  const hasAnalysis = Boolean(medwiseAnalysis && !isOutdated);

  const checks = medwiseAnalysis?.checks;
  const dosageList = checks?.dosage || [];
  const interactions = checks?.interactions;
  const duplicates = checks?.duplicates;
  const allergySafety = checks?.allergySafety;
  const allergyList = allergySafety?.findings || [];
  const patientSpecific = checks?.patientSpecific;
  const audit = medwiseAnalysis?.audit;
  const overallRec = medwiseAnalysis?.overallRecommendation || prescription?.medwiseChecks?.overallRecommendation;

  const totalMeds = medicines.length;
  const totalPairs = totalMeds >= 2 ? (totalMeds * (totalMeds - 1)) / 2 : 0;

  // Determine overall status code: 'cleared', 'review_required', 'unable_to_assess'
  const outcomeStatus = typeof overallRec === 'object' ? overallRec?.status : String(overallRec || '').toLowerCase();

  const prescriptionId = prescription?._id || prescription?.prescriptionId;
  const reportUrl = `/${userRole || 'doctor'}/prescriptions/${prescriptionId}/report`;
  const patientProfile = prescription?.patientProfile || {};
  const patientUserId = typeof prescription?.patientId === 'object' ? prescription?.patientId?._id : prescription?.patientId;

  // Identify ONLY actually missing required clinical fields
  const auditFindings = audit?.findings || [];
  const allergyFindings = allergyList || [];

  const hasAuditAllergyIncomplete = auditFindings.some(
    (f) => f.type === 'allergy_assessment_incomplete' || f.findingType === 'allergy_assessment_incomplete' || f.field === 'allergies'
  );
  const hasSafetyAllergyIncomplete = allergyFindings.some(
    (f) => f.status === 'unable_to_assess' || (f.type === 'allergy' && f.message?.includes('allergy records unavailable'))
  );
  const isAllergyAssessmentMissing =
    hasAuditAllergyIncomplete ||
    hasSafetyAllergyIncomplete ||
    (!patientProfile.hasNoKnownAllergies && (!Array.isArray(patientProfile.allergies) || patientProfile.allergies.length === 0));

  const missingAge =
    prescription?.patientAge == null ||
    prescription?.patientAge === 0 ||
    auditFindings.some((f) => f.type === 'patient_age_incomplete' || f.field === 'patientAge');

  const missingGender =
    !prescription?.patientGender ||
    prescription?.patientGender === 'Unspecified' ||
    prescription?.patientGender === '' ||
    auditFindings.some((f) => f.type === 'patient_gender_incomplete' || f.field === 'patientGender');

  const missingBloodGroup =
    !prescription?.patientBloodGroup ||
    prescription?.patientBloodGroup === 'Unknown' ||
    prescription?.patientBloodGroup === '' ||
    auditFindings.some((f) => f.type === 'patient_blood_group_incomplete' || f.field === 'bloodGroup');

  const missingAllergies = isAllergyAssessmentMissing;
  const hasPatientClinicalMissing = missingAge || missingGender || missingAllergies || missingBloodGroup;

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
        if (onCheckWithMedwise) {
          await onCheckWithMedwise();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update patient profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div
      className="dashboard-card-section"
      style={{
        borderTop: '4px solid var(--primary-600)',
        background: '#ffffff',
        padding: '1.75rem',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* 1. SECTION HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                background: '#eff6ff',
                color: 'var(--primary-600)',
                padding: '0.5rem',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bfdbfe',
              }}
            >
              <Stethoscope size={22} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--slate-900)',
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '-0.01em',
                }}
              >
                MEDWISE CLINICAL REVIEW
              </h2>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginTop: '0.65rem',
              fontSize: '0.825rem',
              color: 'var(--slate-600)',
            }}
          >
            <span>
              Medicines Evaluated: <strong>{totalMeds}</strong> ({totalPairs} pairwise pairs)
            </span>
            <span>•</span>
            <span>
              Status:{' '}
              <span
                style={{
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  background: isOutdated
                    ? '#fef3c7'
                    : outcomeStatus === 'cleared'
                    ? '#dcfce7'
                    : outcomeStatus === 'review_required'
                    ? '#fffbe6'
                    : outcomeStatus === 'unable_to_assess'
                    ? '#eff6ff'
                    : '#f1f5f9',
                  color: isOutdated
                    ? '#92400e'
                    : outcomeStatus === 'cleared'
                    ? '#15803d'
                    : outcomeStatus === 'review_required'
                    ? '#92400e'
                    : outcomeStatus === 'unable_to_assess'
                    ? '#1e40af'
                    : '#64748b',
                  border: isOutdated
                    ? '1px solid #fde68a'
                    : outcomeStatus === 'cleared'
                    ? '1px solid #bbf7d0'
                    : outcomeStatus === 'review_required'
                    ? '1px solid #fde68a'
                    : outcomeStatus === 'unable_to_assess'
                    ? '1px solid #bfdbfe'
                    : '1px solid #e2e8f0',
                }}
              >
                {isOutdated
                  ? '⚠️ Outdated'
                  : outcomeStatus === 'cleared'
                  ? '✓ Cleared'
                  : outcomeStatus === 'review_required'
                  ? '⚠ Review Recommended'
                  : outcomeStatus === 'unable_to_assess'
                  ? 'ℹ Analysis Incomplete'
                  : 'Pending Analysis'}
              </span>
            </span>
          </div>
        </div>

        {/* CHECK WITH MEDWISE BUTTON */}
        {userRole === 'doctor' && isOwner && (
          <button
            type="button"
            className="btn-primary"
            onClick={onCheckWithMedwise}
            disabled={checking}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              background: isOutdated
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
            }}
          >
            {checking ? (
              <>
                <div className="spinner-sm" />
                <span>ANALYSING...</span>
              </>
            ) : (
              <>
                <Stethoscope size={18} />
                <span>{hasAnalysis ? 'RE-RUN MEDWISE ANALYSIS' : 'CHECK WITH MEDWISE'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 2. 8-STAGE HORIZONTAL PIPELINE CHAIN */}
      <div style={{ background: '#f8fafc', padding: '1.25rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '0.5rem',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {ANALYSIS_STAGES.map((stage, idx) => {
            const isCompleted = hasAnalysis || (!checking && idx < activeStageIndex);
            const isCurrent = checking && idx === activeStageIndex;
            const isPending = !hasAnalysis && (!checking || idx > activeStageIndex);

            return (
              <div
                key={stage.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '6px',
                  position: 'relative',
                }}
              >
                {/* Circle step indicator */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    transition: 'all 0.3s ease',
                    background: isCurrent
                      ? '#dbeafe'
                      : isCompleted
                      ? '#16a34a'
                      : '#ffffff',
                    color: isCurrent
                      ? '#1d4ed8'
                      : isCompleted
                      ? '#ffffff'
                      : '#94a3b8',
                    border: isCurrent
                      ? '2px solid #2563eb'
                      : isCompleted
                      ? '2px solid #16a34a'
                      : '2px solid #cbd5e1',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(37,99,235,0.2)' : 'none',
                  }}
                >
                  {isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : isCurrent ? (
                    <div className="spinner-sm" style={{ borderTopColor: '#2563eb' }} />
                  ) : (
                    stage.number
                  )}
                </div>

                {/* Stage Label */}
                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: isCurrent || isCompleted ? 700 : 500,
                    color: isCurrent
                      ? '#1d4ed8'
                      : isCompleted
                      ? '#15803d'
                      : '#64748b',
                    lineHeight: 1.2,
                  }}
                >
                  {stage.label}
                </span>

                {/* Status indicator tag */}
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: isCurrent ? '#1d4ed8' : isCompleted ? '#166534' : '#94a3b8',
                  }}
                >
                  {isCurrent ? 'Analysing' : isCompleted ? 'Completed' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* OUTDATED ANALYSIS BANNER */}
      {isOutdated && (
        <div
          style={{
            background: '#fffbe6',
            border: '1px solid #fde68a',
            borderLeft: '5px solid #d97706',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', color: '#92400e', fontSize: '0.9rem' }}>
              OUTDATED ANALYSIS
            </strong>
            <span style={{ fontSize: '0.85rem', color: '#b45309' }}>
              Prescription data was modified. Please click <strong>CHECK WITH MEDWISE</strong> to re-evaluate clinical safety.
            </span>
          </div>
        </div>
      )}

      {/* 3. ONLY THREE MEDWISE OUTCOME STATES (RESULT STRIP) */}
      {hasAnalysis && (
        <>
          {outcomeStatus === 'cleared' && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderLeft: '6px solid #16a34a',
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <ShieldCheck size={28} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#166534', margin: 0, letterSpacing: '0.02em' }}>
                    CLEARED
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#15803d', margin: '2px 0 0 0', fontWeight: 600 }}>
                    No changes required. Prescribed regimen is validated for doctor approval.
                  </p>
                </div>
              </div>
            </div>
          )}

          {outcomeStatus === 'review_required' && (
            <div
              style={{
                background: '#fffbe6',
                border: '1px solid #fde68a',
                borderLeft: '6px solid #d97706',
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <AlertTriangle size={28} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#92400e', margin: 0, letterSpacing: '0.02em' }}>
                    REVIEW RECOMMENDED
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#b45309', margin: '2px 0 0 0', fontWeight: 600 }}>
                    MedWise identified one or more findings requiring doctor review before approval.
                  </p>
                </div>
              </div>
            </div>
          )}

          {outcomeStatus === 'unable_to_assess' && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderLeft: '6px solid #2563eb',
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <Info size={28} style={{ color: '#2563eb', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e40af', margin: 0, letterSpacing: '0.02em' }}>
                    ANALYSIS INCOMPLETE
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#1d4ed8', margin: '2px 0 0 0', fontWeight: 600 }}>
                    Required clinical information is missing and one or more checks could not be completed.
                  </p>
                </div>
              </div>
              {userRole === 'doctor' && isOwner && hasPatientClinicalMissing && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowMissingForm(!showMissingForm)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: '#93c5fd',
                      color: '#1d4ed8',
                      background: showMissingForm ? '#dbeafe' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    <UserCheck size={16} />
                    <span>{showMissingForm ? 'HIDE MISSING FORM' : 'ADD MISSING DETAILS'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INLINE MISSING DETAILS FORM */}
          {showMissingForm && userRole === 'doctor' && hasPatientClinicalMissing && (
            <div
              style={{
                background: '#ffffff',
                border: '2px solid #2563eb',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 4px 14px rgba(37,99,235,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={20} style={{ color: '#2563eb' }} />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                    Provide Missing Patient Clinical Details
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMissingForm(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                >
                  <X size={16} />
                  <span>Close</span>
                </button>
              </div>

              <p style={{ fontSize: '0.825rem', color: 'var(--slate-600)', marginBottom: '1rem', lineHeight: 1.4 }}>
                MedWise identified specific missing patient profile details required for complete clinical decision support. Enter <strong>ONLY</strong> the missing fields below.
              </p>

              <form onSubmit={handleSaveMissingDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {missingAge && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '4px' }}>
                      Patient Date of Birth <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={inputDob}
                      onChange={(e) => setInputDob(e.target.value)}
                      required
                      style={{ maxWidth: '280px' }}
                    />
                  </div>
                )}

                {missingGender && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '4px' }}>
                      Patient Gender <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={inputGender}
                      onChange={(e) => setInputGender(e.target.value)}
                      required
                      style={{ maxWidth: '280px' }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

                {missingAllergies && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '6px' }}>
                      Patient Allergy Assessment Status <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, color: 'var(--slate-800)', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="allergyChoice"
                          checked={allergyChoice === 'no_allergies'}
                          onChange={() => setAllergyChoice('no_allergies')}
                        />
                        <span>No Known Allergies (Patient assessed & has no known drug/food allergies)</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, color: 'var(--slate-800)', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="allergyChoice"
                          checked={allergyChoice === 'has_allergies'}
                          onChange={() => setAllergyChoice('has_allergies')}
                        />
                        <span>Patient Has Known Allergies</span>
                      </label>

                      {allergyChoice === 'has_allergies' && (
                        <div style={{ marginLeft: '1.75rem', marginTop: '0.25rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter allergies separated by commas (e.g. Penicillin, Sulfa, Aspirin)"
                            value={inputAllergiesText}
                            onChange={(e) => setInputAllergiesText(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {missingBloodGroup && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '4px' }}>
                      Blood Group (Optional)
                    </label>
                    <select
                      className="form-input"
                      value={inputBloodGroup}
                      onChange={(e) => setInputBloodGroup(e.target.value)}
                      style={{ maxWidth: '280px' }}
                    >
                      <option value="Unknown">Unknown / Not Specified</option>
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

                {formError && (
                  <div style={{ color: '#dc2626', fontSize: '0.825rem', fontWeight: 600 }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingProfile}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#2563eb',
                      fontWeight: 700,
                      padding: '0.55rem 1.1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    {savingProfile ? (
                      <>
                        <div className="spinner-sm" />
                        <span>Saving & Re-running MedWise...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>SAVE & RE-RUN MEDWISE</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowMissingForm(false)}
                    disabled={savingProfile}
                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. COMPACT 6-CARD SUMMARY GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {/* 1. Dosage Analysis */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Dosage Analysis
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: dosageList.some((d) => d.status === 'review_required') ? '#92400e' : '#15803d' }}>
                {dosageList.some((d) => d.status === 'review_required') ? '⚠ Review Required' : 'Completed / Accepted'}
              </div>
            </div>

            {/* 2. Drug-Drug Interactions */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Drug–Drug Pairwise
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: (interactions?.flaggedCount || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                {(interactions?.flaggedCount || 0) > 0 ? `⚠ ${interactions.flaggedCount} Finding(s)` : 'No Interactions'}
              </div>
            </div>

            {/* 3. Duplicate Medication */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Duplicate Medication
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: (duplicates?.duplicateCount || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                {(duplicates?.duplicateCount || 0) > 0 ? `⚠ ${duplicates.duplicateCount} Duplicate(s)` : 'No Duplicates'}
              </div>
            </div>

            {/* 4. Allergy & Safety */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Allergy & Safety
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: allergyList.some((f) => f.status === 'allergy_risk' || f.status === 'safety_rule_flagged') ? '#b91c1c' : '#15803d' }}>
                {allergyList.some((f) => f.status === 'allergy_risk' || f.status === 'safety_rule_flagged') ? '⚠ Finding Identified' : 'N/A / No Finding'}
              </div>
            </div>

            {/* 5. Patient-Specific */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Patient-Specific
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: patientSpecific?.status === 'review_required' ? '#92400e' : '#15803d' }}>
                {patientSpecific?.status === 'review_required' ? '⚠ Finding Identified' : 'No Issues'}
              </div>
            </div>

            {/* 6. Complete Audit */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Complete Audit
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', color: outcomeStatus === 'cleared' ? '#15803d' : outcomeStatus === 'review_required' ? '#92400e' : '#1e40af' }}>
                {outcomeStatus === 'cleared' ? 'Cleared' : outcomeStatus === 'review_required' ? 'Review Recommended' : 'Incomplete'}
              </div>
            </div>
          </div>

          {/* VIEW DETAILED REPORT FOOTER ACTION */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(reportUrl)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--primary-300)',
                color: 'var(--primary-700)',
                background: '#f0f9ff',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              <FileText size={16} />
              <span>VIEW DETAILED CLINICAL REPORT</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {!medwiseAnalysis && !checking && (
        <div
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--slate-300)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 0.75rem auto',
              borderRadius: '50%',
              background: '#eff6ff',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Stethoscope size={24} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.35rem' }}>
            Clinical Safety Review Pending
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', maxWidth: '440px', margin: '0 auto 1.25rem auto' }}>
            Click <strong>CHECK WITH MEDWISE</strong> to evaluate dosages, drug–drug interactions, duplicate medications, and allergen safety.
          </p>
          {userRole === 'doctor' && isOwner && (
            <button
              type="button"
              className="btn-primary"
              onClick={onCheckWithMedwise}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.6rem 1.2rem',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <Stethoscope size={16} />
              <span>CHECK WITH MEDWISE</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MedwiseClinicalReview;

