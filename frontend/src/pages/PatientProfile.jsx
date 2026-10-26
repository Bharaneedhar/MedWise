import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, updateMyProfile, updateMyMedicationStatus } from '../services/profileService';
import PatientLayout from '../components/PatientLayout';
import Loading from '../components/Loading';
import { formatPatientId, formatDisplayDate } from '../utils/patientUtils';
import {
  User as UserIcon,
  MapPin,
  Activity,
  PhoneCall,
  Pencil,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Lock,
  Plus,
  Trash2,
  Droplet,
  Camera,
  ShieldCheck,
} from 'lucide-react';

const EMERGENCY_RELATIONSHIPS = ['Parent', 'Spouse', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
};

const isValidDOB = (dobStr) => {
  if (!dobStr) return false;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  return dob < new Date();
};

// ─── READ-ONLY FIELD ITEM ──────────────────────────────────────
const FieldItem = ({ label, value, mono = false }) => (
  <div className="profile-field-item">
    <span className="profile-field-label">{label}</span>
    <span
      className="profile-field-value"
      style={mono ? { fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700 } : {}}
    >
      {value || ''}
    </span>
  </div>
);

// ─── SECTION HEADER ──────────────────────────────────────────
const SectionHeader = ({ icon, title, description }) => (
  <>
    <div className="section-card-header">
      <div className="section-icon-badge">{icon}</div>
      <div>
        <h2 className="section-title">{title}</h2>
      </div>
    </div>
    {description && <p className="section-desc">{description}</p>}
    <div className="section-divider" />
  </>
);

const PatientProfile = () => {
  const { user, setUser, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit form state
  const [formData, setFormData] = useState(null);

  // ── Load Profile ──────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      if (data) {
        setProfile(data.profile || {});
      }
    } catch (err) {
      setError('Failed to load profile. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleMedicationStatus = async (medicationId, newStatus) => {
    try {
      await updateMyMedicationStatus(medicationId, newStatus);
      await loadProfile();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update medication status.');
    }
  };

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);


  // ── Start Editing ─────────────────────────────────────────
  const startEditing = () => {
    const prof = profile || {};
    const hasNone = Boolean(prof.hasNoKnownAllergies);
    const hasAllergiesArr = Array.isArray(prof.allergies) && prof.allergies.length > 0;
    const initialStatus = hasNone ? 'none' : hasAllergiesArr ? 'yes' : '';

    setFormData({
      name: user?.name || prof.name || '',
      mobileNumber: prof.mobileNumber || user?.mobileNumber || '',
      dateOfBirth: prof.dateOfBirth
        ? new Date(prof.dateOfBirth).toISOString().substring(0, 10)
        : '',
      gender: prof.gender || '',
      profilePhoto: prof.profilePhoto || '',
      address: {
        addressLine1: prof.address?.addressLine1 || '',
        addressLine2: prof.address?.addressLine2 || '',
        city: prof.address?.city || '',
        state: prof.address?.state || '',
        country: prof.address?.country || 'India',
        pinCode: prof.address?.pinCode || '',
      },
      bloodGroup: prof.bloodGroup || '',
      allergyStatus: initialStatus,
      hasNoKnownAllergies: hasNone,
      allergiesText: Array.isArray(prof.allergies) ? prof.allergies.join(', ') : '',
      medicalConditions: Array.isArray(prof.medicalConditions)
        ? prof.medicalConditions.map((c) => ({ ...c }))
        : [],
      currentMedications: Array.isArray(prof.currentMedications)
        ? prof.currentMedications.map((m) => ({ ...m }))
        : [],
      previousSurgeries: Array.isArray(prof.previousSurgeries)
        ? prof.previousSurgeries.map((s) => ({ ...s }))
        : [],
      emergencyContact: {
        name: prof.emergencyContact?.name || '',
        relationship: prof.emergencyContact?.relationship || 'Parent',
        mobileNumber: prof.emergencyContact?.mobileNumber || '',
      },
    });
    setError('');
    setSuccess('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormData(null);
    setError('');
    setSuccess('');
  };

  // ── Handlers ──────────────────────────────────────────────
  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddress = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }));
  };

  const handleEmergency = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [name]: value },
    }));
  };

  // Dynamic list handlers
  const addCondition = () =>
    setFormData((prev) => ({
      ...prev,
      medicalConditions: [...prev.medicalConditions, { name: '', sinceYear: '', notes: '' }],
    }));

  const updateCondition = (i, field, val) =>
    setFormData((prev) => {
      const a = [...prev.medicalConditions];
      a[i] = { ...a[i], [field]: val };
      return { ...prev, medicalConditions: a };
    });

  const removeCondition = (i) =>
    setFormData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.filter((_, idx) => idx !== i),
    }));

  const addMed = () =>
    setFormData((prev) => ({
      ...prev,
      currentMedications: [
        ...prev.currentMedications,
        { name: '', dosage: '', frequency: '', notes: '' },
      ],
    }));

  const updateMed = (i, field, val) =>
    setFormData((prev) => {
      const a = [...prev.currentMedications];
      a[i] = { ...a[i], [field]: val };
      return { ...prev, currentMedications: a };
    });

  const removeMed = (i) =>
    setFormData((prev) => ({
      ...prev,
      currentMedications: prev.currentMedications.filter((_, idx) => idx !== i),
    }));

  const addSurgery = () =>
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: [
        ...prev.previousSurgeries,
        { surgeryName: '', year: '', hospital: '', notes: '' },
      ],
    }));

  const updateSurgery = (i, field, val) =>
    setFormData((prev) => {
      const a = [...prev.previousSurgeries];
      a[i] = { ...a[i], [field]: val };
      return { ...prev, previousSurgeries: a };
    });

  const removeSurgery = (i) =>
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: prev.previousSurgeries.filter((_, idx) => idx !== i),
    }));

  // ── Validation ────────────────────────────────────────────
  const validateForm = () => {
    if (!formData.mobileNumber?.trim()) return 'Please complete: Mobile Number.';
    if (!isValidPhone(formData.mobileNumber.trim()))
      return 'Please provide a valid Mobile Number (7 to 15 digits).';
    if (!formData.dateOfBirth) return 'Please complete: Date of Birth.';
    if (!isValidDOB(formData.dateOfBirth)) return 'Date of Birth must be a valid date in the past.';
    if (!formData.gender?.trim()) return 'Please complete: Gender.';
    if (!formData.address.addressLine1?.trim()) return 'Please complete: Address Line 1.';
    if (!formData.address.city?.trim()) return 'Please complete: City.';
    if (!formData.address.state?.trim()) return 'Please complete: State.';
    if (!formData.address.country?.trim()) return 'Please complete: Country.';
    if (!formData.address.pinCode?.trim()) return 'Please complete: PIN / ZIP Code.';
    if (!formData.emergencyContact.name?.trim()) return 'Please complete: Emergency Contact Name.';
    if (!formData.emergencyContact.relationship?.trim())
      return 'Please complete: Emergency Contact Relationship.';
    if (!formData.emergencyContact.mobileNumber?.trim())
      return 'Please complete: Emergency Contact Mobile Number.';
    if (!isValidPhone(formData.emergencyContact.mobileNumber.trim()))
      return 'Please provide a valid Emergency Contact Mobile Number.';
    if (!formData.allergyStatus || (formData.allergyStatus !== 'none' && formData.allergyStatus !== 'yes')) {
      return 'Please complete: Allergy Assessment (select No Known Allergies or Patient Has Known Allergies).';
    }
    if (formData.allergyStatus === 'yes' && (!formData.allergiesText || !formData.allergiesText.trim())) {
      return 'Please complete: Allergy details are required when Patient Has Known Allergies is selected.';
    }
    return null;
  };

  // ── Save Changes ──────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationErr = validateForm();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formData.name?.trim() || '',
        mobileNumber: formData.mobileNumber.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender.trim(),
        profilePhoto: formData.profilePhoto?.trim() || '',
        address: {
          addressLine1: formData.address.addressLine1.trim(),
          addressLine2: formData.address.addressLine2?.trim() || '',
          city: formData.address.city.trim(),
          state: formData.address.state.trim(),
          country: formData.address.country.trim(),
          pinCode: formData.address.pinCode.trim(),
        },
        bloodGroup: formData.bloodGroup || '',
        allergyStatus: formData.allergyStatus,
        hasNoKnownAllergies: formData.allergyStatus === 'none',
        allergies: formData.allergyStatus === 'yes'
          ? (formData.allergiesText || '').split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        medicalConditions: formData.medicalConditions.filter((c) => c?.name?.trim()),
        currentMedications: formData.currentMedications.filter((m) => m?.name?.trim()),
        previousSurgeries: formData.previousSurgeries.filter((s) => s?.surgeryName?.trim()),
        emergencyContact: {
          name: formData.emergencyContact.name.trim(),
          relationship: formData.emergencyContact.relationship.trim(),
          mobileNumber: formData.emergencyContact.mobileNumber.trim(),
        },
      };

      const res = await updateMyProfile(payload);

      if (res?.user) {
        setUser(res.user);
      } else {
        await refreshUser();
      }

      setProfile(res.profile || payload);
      setEditing(false);
      setFormData(null);
      setSuccess('Profile updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to save profile. Please verify your entries.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading your profile..." />;

  const pid = formatPatientId(profile?.mobileNumber || user?.mobileNumber);

  return (
    <PatientLayout patientProfile={profile}>
      {/* ─────────────────────────────────────────────────────────
          VIEW MODE
          ───────────────────────────────────────────────────────── */}
      {!editing ? (
        <div>
          {/* TOP BAR / ACTIONS */}
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
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: 'var(--slate-900)',
                  marginBottom: '0.25rem',
                }}
              >
                My Profile
              </h1>
              <div className="dropdown-pid-badge" style={{ fontSize: '0.8rem' }}>
                Patient ID: {pid}
              </div>
            </div>

            <button
              id="edit-profile-btn"
              type="button"
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={startEditing}
            >
              <Pencil size={16} />
              <span>Edit Profile</span>
            </button>
          </div>

          {success && (
            <div className="alert-box success" role="alert" style={{ marginBottom: '1.5rem' }}>
              <CheckCircle className="alert-icon" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. PERSONAL INFORMATION */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<UserIcon size={20} />}
              title="Personal Information"
              description="Basic demographic and clinical identity details"
            />
            <div className="profile-view-grid">
              <FieldItem label="Full Name" value={user?.name || profile?.name} />
              <FieldItem label="Email Address" value={user?.email} />
              <FieldItem label="Mobile Number" value={profile?.mobileNumber} />
              <FieldItem label="Patient ID" value={pid} mono />
              <FieldItem label="Date of Birth" value={formatDisplayDate(profile?.dateOfBirth)} />
              <FieldItem label="Gender" value={profile?.gender} />
            </div>
            {profile?.profilePhoto && (
              <div className="profile-field-item" style={{ marginTop: '0.5rem' }}>
                <span className="profile-field-label">Profile Photo</span>
                <img
                  src={profile.profilePhoto}
                  alt="Profile"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--slate-200)',
                    marginTop: '0.5rem',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* 2. CONTACT INFORMATION */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<MapPin size={20} />}
              title="Contact Information"
              description="Residential communication address"
            />
            <div className="profile-view-grid">
              <FieldItem label="Address Line 1" value={profile?.address?.addressLine1} />
              <FieldItem label="Address Line 2" value={profile?.address?.addressLine2 || '—'} />
              <FieldItem label="City" value={profile?.address?.city} />
              <FieldItem label="State" value={profile?.address?.state} />
              <FieldItem label="Country" value={profile?.address?.country} />
              <FieldItem label="PIN / ZIP Code" value={profile?.address?.pinCode} />
            </div>
          </div>

          {/* 3. HEALTH INFORMATION */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<Activity size={20} />}
              title="Health Information"
              description="Medical background, ongoing treatments, and surgical history"
            />

            {/* Blood Group */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                width: 'fit-content',
              }}
            >
              <Droplet size={18} style={{ color: '#dc2626' }} />
              <div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#dc2626',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Blood Group
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  {profile?.bloodGroup && profile.bloodGroup !== 'Unknown' ? profile.bloodGroup : 'Select Blood Group'}
                </div>
              </div>
            </div>

            {/* Medical Conditions */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--slate-800)',
                  marginBottom: '0.75rem',
                }}
              >
                Known Medical Conditions ({(profile?.medicalConditions || []).length})
              </h3>
              {!profile?.medicalConditions || profile.medicalConditions.length === 0 ? (
                <div className="empty-state-card" style={{ padding: '1.25rem' }}>
                  <p className="empty-state-text" style={{ fontSize: '0.875rem' }}>
                    No medical conditions documented.
                  </p>
                </div>
              ) : (
                <div className="patient-info-list">
                  {profile.medicalConditions.map((c, i) => (
                    <div key={i} className="info-item-row">
                      <div className="info-item-main">
                        <span className="info-item-title">{c.name}</span>
                        {c.notes && <span className="info-item-subtitle">{c.notes}</span>}
                      </div>
                      {c.sinceYear && (
                        <span
                          className="info-item-tag"
                          style={{ background: '#fef3c7', color: '#92400e' }}
                        >
                          Since {c.sinceYear}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current Medications */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--slate-800)',
                  marginBottom: '0.75rem',
                }}
              >
                Current Medications ({profile?.currentMedications?.length || 0})
              </h3>

              {/* Active Current Medications */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  ACTIVE CURRENT MEDICATIONS ({ (profile?.currentMedications || []).filter(m => m.status !== 'INACTIVE').length })
                </span>
                {(profile?.currentMedications || []).filter(m => m.status !== 'INACTIVE').length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '0.85rem 1rem' }}>
                    <p className="empty-state-text" style={{ fontSize: '0.8rem' }}>
                      No active current medications documented.
                    </p>
                  </div>
                ) : (
                  <div className="patient-info-list">
                    {(profile?.currentMedications || []).filter(m => m.status !== 'INACTIVE').map((m, i) => (
                      <div key={m._id || i} className="info-item-row" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem' }}>
                        <div className="info-item-main">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="info-item-title" style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{m.name || m.genericName}</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid #86efac' }}>
                              Status: ACTIVE
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--slate-100)', color: 'var(--slate-700)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                              Source: {m.source === 'PRESCRIPTION' ? 'Prescription' : 'Patient Reported'}
                            </span>
                          </div>
                          <span className="info-item-subtitle" style={{ marginTop: '0.2rem' }}>
                            {[
                              m.strength || m.dosage ? `Strength: ${m.strength || m.dosage}` : null,
                              m.frequency ? `Frequency: ${m.frequency}` : null,
                              m.duration ? `Duration: ${m.duration}` : null,
                              m.route ? `Route: ${m.route}` : null,
                              m.instructions || m.notes ? `Instructions: ${m.instructions || m.notes}` : null,
                            ].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleToggleMedicationStatus(m._id, 'INACTIVE')}
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                          >
                            Mark Stopped
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inactive / Historical Medications */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  INACTIVE / HISTORICAL MEDICATIONS ({ (profile?.currentMedications || []).filter(m => m.status === 'INACTIVE').length })
                </span>
                {(profile?.currentMedications || []).filter(m => m.status === 'INACTIVE').length === 0 ? (
                  <div className="empty-state-card" style={{ padding: '0.85rem 1rem' }}>
                    <p className="empty-state-text" style={{ fontSize: '0.8rem' }}>
                      No inactive or historical medications.
                    </p>
                  </div>
                ) : (
                  <div className="patient-info-list">
                    {(profile?.currentMedications || []).filter(m => m.status === 'INACTIVE').map((m, i) => (
                      <div key={m._id || i} className="info-item-row" style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-200)', opacity: 0.85, padding: '0.75rem 1rem' }}>
                        <div className="info-item-main">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="info-item-title" style={{ fontWeight: 700, color: 'var(--slate-700)', textDecoration: 'line-through' }}>{m.name || m.genericName}</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#64748b', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid #cbd5e1' }}>
                              Status: INACTIVE
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--slate-100)', color: 'var(--slate-600)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                              Source: {m.source === 'PRESCRIPTION' ? 'Prescription' : 'Patient Reported'}
                            </span>
                          </div>
                          <span className="info-item-subtitle" style={{ marginTop: '0.2rem' }}>
                            {[
                              m.strength || m.dosage ? `Strength: ${m.strength || m.dosage}` : null,
                              m.frequency ? `Frequency: ${m.frequency}` : null,
                              m.duration ? `Duration: ${m.duration}` : null,
                              m.stoppedAt ? `Stopped: ${formatDisplayDate(m.stoppedAt)}` : null,
                            ].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleToggleMedicationStatus(m._id, 'ACTIVE')}
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            Mark Active
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>


            {/* Previous Major Surgeries */}
            <div>
              <h3
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--slate-800)',
                  marginBottom: '0.75rem',
                }}
              >
                Previous Major Surgeries ({(profile?.previousSurgeries || []).length})
              </h3>
              {!profile?.previousSurgeries || profile.previousSurgeries.length === 0 ? (
                <div className="empty-state-card" style={{ padding: '1.25rem' }}>
                  <p className="empty-state-text" style={{ fontSize: '0.875rem' }}>
                    No surgical history documented.
                  </p>
                </div>
              ) : (
                <div className="patient-info-list">
                  {profile.previousSurgeries.map((s, i) => (
                    <div key={i} className="info-item-row">
                      <div className="info-item-main">
                        <span className="info-item-title">{s.surgeryName}</span>
                        <span className="info-item-subtitle">
                          {[s.hospital, s.notes].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                      {s.year && (
                        <span
                          className="info-item-tag"
                          style={{ background: 'var(--slate-200)', color: 'var(--slate-800)' }}
                        >
                          {s.year}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. EMERGENCY CONTACT */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<PhoneCall size={20} />}
              title="Emergency Contact"
              description="Designated contact person in case of urgent medical situations"
            />
            <div className="profile-view-grid">
              <FieldItem label="Contact Name" value={profile?.emergencyContact?.name} />
              <FieldItem label="Relationship" value={profile?.emergencyContact?.relationship} />
              <FieldItem label="Mobile Number" value={profile?.emergencyContact?.mobileNumber} />
            </div>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────
           EDIT MODE
           ───────────────────────────────────────────────────────── */
        <div>
          {/* EDIT HEADER BANNER */}
          <div className="profile-header-banner" style={{ marginBottom: '2rem' }}>
            <div className="profile-header-content">
              <div className="profile-header-badge">
                <Pencil size={16} />
                <span>Edit Mode</span>
              </div>
              <h1 className="profile-header-title">Edit Your Profile</h1>
              <p className="profile-header-desc">
                Update your personal details, health information, and emergency contact.
                All changes are saved to your MedWise medical record.
              </p>
            </div>
          </div>

          {error && (
            <div className="alert-box error" role="alert" style={{ marginBottom: '1.75rem' }}>
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSave} noValidate>
            {/* PERSONAL + CONTACT — SIDE BY SIDE */}
            <div className="profile-sections-grid">
              {/* PERSONAL INFORMATION */}
              <div className="profile-section-card">
                <SectionHeader
                  icon={<UserIcon size={20} />}
                  title="Personal Information"
                  description="Update your basic demographic details"
                />

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-name">
                    Full Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    className="form-input"
                    name="name"
                    value={formData.name}
                    onChange={handleInput}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      (Read-only)
                    </span>
                  </label>
                  <div className="input-wrapper">
                    <Lock className="input-icon-left" style={{ opacity: 0.5 }} />
                    <input
                      type="email"
                      className="form-input has-left-icon readonly"
                      value={user?.email || ''}
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-mobile">
                    Mobile Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-mobile"
                    type="text"
                    className="form-input"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInput}
                    placeholder="Enter 10-digit mobile number"
                    required
                  />
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-dob">
                      Date of Birth <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <input
                      id="edit-dob"
                      type="date"
                      className="form-input"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInput}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-gender">
                      Gender <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <select
                      id="edit-gender"
                      className="form-input"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInput}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="edit-photo">
                    <Camera
                      size={14}
                      style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}
                    />
                    Profile Photo URL{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      (Optional)
                    </span>
                  </label>
                  <input
                    id="edit-photo"
                    type="text"
                    className="form-input"
                    name="profilePhoto"
                    value={formData.profilePhoto}
                    onChange={handleInput}
                  />
                  {formData.profilePhoto && (
                    <img
                      src={formData.profilePhoto}
                      alt="Preview"
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginTop: '0.5rem',
                        border: '2px solid var(--slate-200)',
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </div>

              {/* CONTACT INFORMATION */}
              <div className="profile-section-card">
                <SectionHeader
                  icon={<MapPin size={20} />}
                  title="Contact Information"
                  description="Update your residential address"
                />

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-addr1">
                    Address Line 1 <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-addr1"
                    type="text"
                    className="form-input"
                    name="addressLine1"
                    value={formData.address.addressLine1}
                    onChange={handleAddress}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-addr2">
                    Address Line 2{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      (Optional)
                    </span>
                  </label>
                  <input
                    id="edit-addr2"
                    type="text"
                    className="form-input"
                    name="addressLine2"
                    value={formData.address.addressLine2}
                    onChange={handleAddress}
                  />
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-city">
                      City <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <input
                      id="edit-city"
                      type="text"
                      className="form-input"
                      name="city"
                      value={formData.address.city}
                      onChange={handleAddress}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-state">
                      State <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <input
                      id="edit-state"
                      type="text"
                      className="form-input"
                      name="state"
                      value={formData.address.state}
                      onChange={handleAddress}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2col" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-country">
                      Country <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <input
                      id="edit-country"
                      type="text"
                      className="form-input"
                      name="country"
                      value={formData.address.country}
                      onChange={handleAddress}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-pin">
                      PIN / ZIP Code <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <input
                      id="edit-pin"
                      type="text"
                      className="form-input"
                      name="pinCode"
                      value={formData.address.pinCode}
                      onChange={handleAddress}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* HEALTH INFORMATION */}
            <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
              <SectionHeader
                icon={<Activity size={20} />}
                title="Health Information"
                description="Manage your medical background and ongoing treatment details"
              />

              {/* Blood Group */}
              <div className="form-group" style={{ maxWidth: '320px', marginBottom: '1.75rem' }}>
                <label className="form-label" htmlFor="edit-blood">
                  Blood Group
                </label>
                <select
                  id="edit-blood"
                  className="form-input"
                  name="bloodGroup"
                  value={formData.bloodGroup || ''}
                  onChange={handleInput}
                >
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medical Conditions */}
              <div style={{ marginBottom: '2rem' }}>
                <label
                  className="form-label"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--slate-800)',
                    marginBottom: '0.75rem',
                    display: 'block',
                  }}
                >
                  Known Medical Conditions
                </label>
                <div className="dynamic-items-container">
                  {formData.medicalConditions.map((c, i) => (
                    <div key={i} className="dynamic-item-card">
                      <div className="dynamic-item-header">
                        <span className="dynamic-item-label">Condition #{i + 1}</span>
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => removeCondition(i)}
                        >
                          <Trash2 size={15} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Condition Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={c.name}
                            onChange={(e) => updateCondition(i, 'name', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Diagnosed Year</label>
                          <input
                            type="number"
                            className="form-input"
                            value={c.sinceYear || ''}
                            onChange={(e) => updateCondition(i, 'sinceYear', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Clinical Notes</label>
                        <input
                          type="text"
                          className="form-input"
                          value={c.notes || ''}
                          onChange={(e) => updateCondition(i, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-add-item" onClick={addCondition}>
                  <Plus size={16} />
                  <span>Add Medical Condition</span>
                </button>
              </div>

              {/* Current Medications */}
              <div style={{ marginBottom: '2rem' }}>
                <label
                  className="form-label"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--slate-800)',
                    marginBottom: '0.75rem',
                    display: 'block',
                  }}
                >
                  Current Medications
                </label>
                <div className="dynamic-items-container">
                  {formData.currentMedications.map((m, i) => (
                    <div key={i} className="dynamic-item-card">
                      <div className="dynamic-item-header">
                        <span className="dynamic-item-label">Medication #{i + 1}</span>
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => removeMed(i)}
                        >
                          <Trash2 size={15} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="form-grid-3col" style={{ marginBottom: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Drug / Brand Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={m.name}
                            onChange={(e) => updateMed(i, 'name', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Dosage</label>
                          <input
                            type="text"
                            className="form-input"
                            value={m.dosage || ''}
                            onChange={(e) => updateMed(i, 'dosage', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Frequency</label>
                          <input
                            type="text"
                            className="form-input"
                            value={m.frequency || ''}
                            onChange={(e) => updateMed(i, 'frequency', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Instructions / Notes</label>
                        <input
                          type="text"
                          className="form-input"
                          value={m.notes || ''}
                          onChange={(e) => updateMed(i, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-add-item" onClick={addMed}>
                  <Plus size={16} />
                  <span>Add Current Medication</span>
                </button>
              </div>

              {/* Previous Major Surgeries */}
              <div>
                <label
                  className="form-label"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--slate-800)',
                    marginBottom: '0.75rem',
                    display: 'block',
                  }}
                >
                  Previous Major Surgeries
                </label>
                <div className="dynamic-items-container">
                  {formData.previousSurgeries.map((s, i) => (
                    <div key={i} className="dynamic-item-card">
                      <div className="dynamic-item-header">
                        <span className="dynamic-item-label">Surgery #{i + 1}</span>
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => removeSurgery(i)}
                        >
                          <Trash2 size={15} />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Surgery Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={s.surgeryName}
                            onChange={(e) => updateSurgery(i, 'surgeryName', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Year of Procedure</label>
                          <input
                            type="number"
                            className="form-input"
                            value={s.year || ''}
                            onChange={(e) => updateSurgery(i, 'year', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-grid-2col" style={{ marginBottom: 0 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Hospital / Center</label>
                          <input
                            type="text"
                            className="form-input"
                            value={s.hospital || ''}
                            onChange={(e) => updateSurgery(i, 'hospital', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Procedure Notes</label>
                          <input
                            type="text"
                            className="form-input"
                            value={s.notes || ''}
                            onChange={(e) => updateSurgery(i, 'notes', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-add-item" onClick={addSurgery}>
                  <Plus size={16} />
                  <span>Add Previous Surgery</span>
                </button>
              </div>
            </div>

            {/* 4. EMERGENCY CONTACT */}
            <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
              <SectionHeader
                icon={<PhoneCall size={20} />}
                title="Emergency Contact"
                description="Person to contact in case of urgent medical situations"
              />
              <div className="form-grid-3col">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="edit-em-name">
                    Contact Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-em-name"
                    type="text"
                    className="form-input"
                    name="name"
                    value={formData.emergencyContact.name}
                    onChange={handleEmergency}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="edit-em-rel">
                    Relationship <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <select
                    id="edit-em-rel"
                    className="form-input"
                    name="relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={handleEmergency}
                    required
                  >
                    {EMERGENCY_RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="edit-em-mobile">
                    Mobile Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-em-mobile"
                    type="text"
                    className="form-input"
                    name="mobileNumber"
                    value={formData.emergencyContact.mobileNumber}
                    onChange={handleEmergency}
                    required
                  />
                </div>
              </div>
            </div>

            {/* ACTION BAR */}
            <div className="profile-submit-bar">
              <div className="submit-bar-info">
                <ShieldCheck size={20} style={{ color: 'var(--primary-600)' }} />
                <span>Changes will be saved to your MedWise health record immediately.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  id="cancel-edit-btn"
                  type="button"
                  className="btn-secondary"
                  onClick={cancelEditing}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
                <button
                  id="save-changes-btn"
                  type="submit"
                  className="btn-primary profile-submit-btn"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
        </div>
      )}
    </PatientLayout>
  );
};

export default PatientProfile;
