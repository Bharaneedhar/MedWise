import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, updateMyProfile } from '../services/profileService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  User as UserIcon,
  MapPin,
  Stethoscope,
  Pencil,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Lock,
  Camera,
  Award,
  Building,
} from 'lucide-react';

const DOCTOR_SPECIALIZATIONS = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Obstetrics & Gynecology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Other',
];

const DOCTOR_QUALIFICATIONS = [
  'MBBS',
  'MBBS, MD',
  'MBBS, MS',
  'MBBS, DNB',
  'MBBS, MD, DM',
  'MBBS, MS, MCh',
  'Other',
];

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

const FieldItem = ({ label, value, mono = false }) => (
  <div className="profile-field-item">
    <span className="profile-field-label">{label}</span>
    <span
      className="profile-field-value"
      style={mono ? { fontFamily: 'monospace', color: 'var(--primary-700)', fontWeight: 700 } : {}}
    >
      {value || ''}
    </span>
  </div>
);

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

const DoctorProfile = () => {
  const { user, setUser, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      if (data && data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.warn('Doctor profile load error:', err.message);
      setError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const startEditing = () => {
    if (!profile) return;
    setFormData({
      name: user?.name || profile.name || '',
      mobileNumber: profile.mobileNumber || '',
      dateOfBirth: profile.dateOfBirth
        ? new Date(profile.dateOfBirth).toISOString().substring(0, 10)
        : '',
      gender: profile.gender || '',
      profilePhoto: profile.profilePhoto || '',
      address: {
        addressLine1: profile.address?.addressLine1 || '',
        addressLine2: profile.address?.addressLine2 || '',
        city: profile.address?.city || '',
        state: profile.address?.state || '',
        country: profile.address?.country || 'India',
        pinCode: profile.address?.pinCode || '',
      },
      medicalRegistrationNumber: profile.medicalRegistrationNumber || '',
      specialization: profile.specialization || 'General Medicine',
      otherSpecialization: profile.otherSpecialization || '',
      qualification: profile.qualification || 'MBBS',
      otherQualification: profile.otherQualification || '',
      yearsOfExperience: profile.yearsOfExperience !== undefined ? profile.yearsOfExperience : 0,
      hospitalClinicName: profile.hospitalClinicName || '',
      hospitalClinicAddress: profile.hospitalClinicAddress || '',
      professionalContactNumber: profile.professionalContactNumber || '',
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

  const validateForm = () => {
    if (!formData.mobileNumber?.trim()) return 'Please complete: Mobile Number.';
    if (!isValidPhone(formData.mobileNumber.trim())) return 'Please provide a valid Mobile Number.';
    if (!formData.dateOfBirth) return 'Please complete: Date of Birth.';
    if (!isValidDOB(formData.dateOfBirth)) return 'Date of Birth must be a valid date in the past.';
    if (!formData.gender?.trim()) return 'Please complete: Gender.';
    if (!formData.address.addressLine1?.trim()) return 'Please complete: Address Line 1.';
    if (!formData.address.city?.trim()) return 'Please complete: City.';
    if (!formData.address.state?.trim()) return 'Please complete: State.';
    if (!formData.address.country?.trim()) return 'Please complete: Country.';
    if (!formData.address.pinCode?.trim()) return 'Please complete: PIN / ZIP Code.';
    if (!formData.medicalRegistrationNumber?.trim()) return 'Please complete: Medical Registration Number.';
    if (!formData.specialization?.trim()) return 'Please complete: Specialization.';
    if (formData.specialization === 'Other' && !formData.otherSpecialization?.trim())
      return 'Please complete: Specify Other Specialization.';
    if (!formData.qualification?.trim()) return 'Please complete: Qualification.';
    if (formData.qualification === 'Other' && !formData.otherQualification?.trim())
      return 'Please complete: Specify Other Qualification.';
    if (formData.yearsOfExperience === '' || isNaN(Number(formData.yearsOfExperience)))
      return 'Please complete: Years of Experience.';
    if (!formData.hospitalClinicName?.trim()) return 'Please complete: Hospital / Clinic Name.';
    if (!formData.hospitalClinicAddress?.trim()) return 'Please complete: Hospital / Clinic Address.';
    return null;
  };

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
        medicalRegistrationNumber: formData.medicalRegistrationNumber.trim(),
        specialization: formData.specialization.trim(),
        otherSpecialization: formData.otherSpecialization?.trim() || '',
        qualification: formData.qualification.trim(),
        otherQualification: formData.otherQualification?.trim() || '',
        yearsOfExperience: Number(formData.yearsOfExperience),
        hospitalClinicName: formData.hospitalClinicName.trim(),
        hospitalClinicAddress: formData.hospitalClinicAddress.trim(),
        professionalContactNumber: formData.professionalContactNumber?.trim() || '',
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
      setSuccess('Doctor profile updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading physician credentials and profile..." />;
  }

  const doctorName = user?.name || profile?.name || 'Physician';

  return (
    <DoctorLayout>
      {!editing ? (
        /* ── VIEW MODE ────────────────────────────────────────── */
        <div>
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
                Doctor Profile
              </h1>
              <span
                className="card-section-badge"
                style={{
                  background: 'var(--primary-50)',
                  color: 'var(--primary-700)',
                  border: '1px solid var(--primary-200)',
                }}
              >
                Verified Medical Practitioner
              </span>
            </div>

            <button
              id="edit-doctor-profile-btn"
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

          {/* 1. PROFESSIONAL CREDENTIALS */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<Award size={20} />}
              title="Professional Credentials & Practice"
              description="Clinical licensure, specialization, and practice location"
            />
            <div className="profile-view-grid">
              <FieldItem label="Medical Registration Number" value={profile?.medicalRegistrationNumber} mono />
              <FieldItem label="Specialization" value={profile?.specialization === 'Other' ? profile?.otherSpecialization : profile?.specialization} />
              <FieldItem label="Qualification" value={profile?.qualification === 'Other' ? profile?.otherQualification : profile?.qualification} />
              <FieldItem label="Years of Experience" value={`${profile?.yearsOfExperience || 0} years`} />
              <FieldItem label="Hospital / Clinic Name" value={profile?.hospitalClinicName} />
              <FieldItem label="Hospital Address" value={profile?.hospitalClinicAddress} />
              <FieldItem label="Professional Contact" value={profile?.professionalContactNumber || '—'} />
            </div>
          </div>

          {/* 2. PERSONAL INFORMATION */}
          <div className="profile-section-card full-width" style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<UserIcon size={20} />}
              title="Personal Information"
              description="Basic identity and communication details"
            />
            <div className="profile-view-grid">
              <FieldItem label="Full Name" value={doctorName} />
              <FieldItem label="Email Address" value={user?.email} />
              <FieldItem label="Mobile Number" value={profile?.mobileNumber} />
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
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* 3. CONTACT INFORMATION */}
          <div className="profile-section-card full-width">
            <SectionHeader
              icon={<MapPin size={20} />}
              title="Contact Information"
              description="Residential and mailing address"
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
        </div>
      ) : (
        /* ── EDIT MODE ────────────────────────────────────────── */
        <div>
          <div className="profile-header-banner" style={{ marginBottom: '2rem' }}>
            <div className="profile-header-content">
              <div className="profile-header-badge" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
                <Pencil size={16} />
                <span>Edit Credentials</span>
              </div>
              <h1 className="profile-header-title">Edit Doctor Profile</h1>
              <p className="profile-header-desc">
                Update your professional practice, medical registration, and contact details.
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
            {/* PROFESSIONAL CREDENTIALS */}
            <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
              <SectionHeader
                icon={<Award size={20} />}
                title="Professional Credentials"
                description="Your clinical licensure and medical background"
              />

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-med-reg">
                    Medical Registration Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-med-reg"
                    type="text"
                    className="form-input"
                    name="medicalRegistrationNumber"
                    value={formData.medicalRegistrationNumber}
                    onChange={handleInput}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-specialization">
                    Specialization <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <select
                    id="edit-specialization"
                    className="form-input"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInput}
                    required
                  >
                    {DOCTOR_SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.specialization === 'Other' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-other-spec">
                    Specify Other Specialization <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-other-spec"
                    type="text"
                    className="form-input"
                    name="otherSpecialization"
                    value={formData.otherSpecialization}
                    onChange={handleInput}
                    required
                  />
                </div>
              )}

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-qualification">
                    Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <select
                    id="edit-qualification"
                    className="form-input"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleInput}
                    required
                  >
                    {DOCTOR_QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-experience">
                    Years of Experience <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-experience"
                    type="number"
                    min="0"
                    className="form-input"
                    name="yearsOfExperience"
                    value={formData.yearsOfExperience}
                    onChange={handleInput}
                    required
                  />
                </div>
              </div>

              {formData.qualification === 'Other' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-other-qual">
                    Specify Other Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-other-qual"
                    type="text"
                    className="form-input"
                    name="otherQualification"
                    value={formData.otherQualification}
                    onChange={handleInput}
                    required
                  />
                </div>
              )}

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-hospital-name">
                    Hospital / Clinic Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-hospital-name"
                    type="text"
                    className="form-input"
                    name="hospitalClinicName"
                    value={formData.hospitalClinicName}
                    onChange={handleInput}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-hospital-addr">
                    Hospital / Clinic Address <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <input
                    id="edit-hospital-addr"
                    type="text"
                    className="form-input"
                    name="hospitalClinicAddress"
                    value={formData.hospitalClinicAddress}
                    onChange={handleInput}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="edit-prof-phone">
                  Professional Contact Number (Optional)
                </label>
                <input
                  id="edit-prof-phone"
                  type="text"
                  className="form-input"
                  name="professionalContactNumber"
                  value={formData.professionalContactNumber}
                  onChange={handleInput}
                />
              </div>
            </div>

            {/* PERSONAL + CONTACT SIDE BY SIDE */}
            <div className="profile-sections-grid">
              {/* PERSONAL */}
              <div className="profile-section-card">
                <SectionHeader icon={<UserIcon size={20} />} title="Personal Information" />

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" name="name" value={formData.name} onChange={handleInput} />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Read-only)</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon-left" style={{ opacity: 0.5 }} />
                    <input type="email" className="form-input has-left-icon readonly" value={user?.email || ''} readOnly disabled />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input type="text" className="form-input" name="mobileNumber" value={formData.mobileNumber} onChange={handleInput} required />
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label className="form-label">Date of Birth *</label>
                    <input type="date" className="form-input" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInput} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select className="form-input" name="gender" value={formData.gender} onChange={handleInput} required>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <Camera size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Profile Photo URL
                  </label>
                  <input type="text" className="form-input" name="profilePhoto" value={formData.profilePhoto} onChange={handleInput} />
                </div>
              </div>

              {/* CONTACT */}
              <div className="profile-section-card">
                <SectionHeader icon={<MapPin size={20} />} title="Contact Information" />

                <div className="form-group">
                  <label className="form-label">Address Line 1 *</label>
                  <input type="text" className="form-input" name="addressLine1" value={formData.address.addressLine1} onChange={handleAddress} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Address Line 2 (Optional)</label>
                  <input type="text" className="form-input" name="addressLine2" value={formData.address.addressLine2} onChange={handleAddress} />
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input type="text" className="form-input" name="city" value={formData.address.city} onChange={handleAddress} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input type="text" className="form-input" name="state" value={formData.address.state} onChange={handleAddress} required />
                  </div>
                </div>

                <div className="form-grid-2col" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label className="form-label">Country *</label>
                    <input type="text" className="form-input" name="country" value={formData.address.country} onChange={handleAddress} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN / ZIP Code *</label>
                    <input type="text" className="form-input" name="pinCode" value={formData.address.pinCode} onChange={handleAddress} required />
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BAR */}
            <div className="profile-submit-bar" style={{ marginTop: '1.75rem' }}>
              <div className="submit-bar-info">
                <span>Changes will be saved to your MedWise physician credentials.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  id="cancel-doc-edit-btn"
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
                  id="save-doc-profile-btn"
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
    </DoctorLayout>
  );
};

export default DoctorProfile;
