import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, updateMyProfile } from '../services/profileService';
import Loading from '../components/Loading';
import {
  ShieldCheck,
  AlertCircle,
  Stethoscope,
  Pill,
  HeartPulse,
  User as UserIcon,
  MapPin,
  Briefcase,
  Activity,
  PhoneCall,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';

const EMERGENCY_RELATIONSHIPS = [
  'Parent',
  'Spouse',
  'Sibling',
  'Child',
  'Relative',
  'Friend',
  'Other',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOCTOR_SPECIALIZATIONS = [
  'General Medicine',
  'Internal Medicine',
  'Cardiology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Dermatology',
  'Gastroenterology',
  'Oncology',
  'Pulmonology',
  'Psychiatry',
  'Other',
];

const DOCTOR_QUALIFICATIONS = ['MBBS', 'MD', 'MS', 'DNB', 'DM', 'MCh', 'Other'];

const PHARMACIST_QUALIFICATIONS = ['B.Pharm', 'M.Pharm', 'Pharm.D', 'D.Pharm', 'Other'];

/**
 * Validate phone number format (7 to 15 digits)
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
};

/**
 * Validate Date of Birth (must be valid date in past)
 */
const isValidDOB = (dobStr) => {
  if (!dobStr) return false;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return dob < today;
};

const CompleteProfile = () => {
  const { user, setUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobileNumber: '',
    dateOfBirth: '',
    gender: '',
    profilePhoto: '',
    address: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: 'India',
      pinCode: '',
    },
    // Doctor fields
    medicalRegistrationNumber: '',
    specialization: 'General Medicine',
    otherSpecialization: '',
    qualification: 'MBBS',
    otherQualification: '',
    yearsOfExperience: '',
    hospitalClinicName: '',
    hospitalClinicAddress: '',
    professionalContactNumber: '',
    // Pharmacist fields
    pharmacyRegistrationNumber: '',
    pharmacyHospitalName: '',
    pharmacyHospitalAddress: '',
    // Patient fields
    bloodGroup: '',
    allergyStatus: '',
    allergiesText: '',
    medicalConditions: [],
    currentMedications: [],
    previousSurgeries: [],
    // Emergency Contact (Patient only)
    emergencyContact: {
      name: '',
      relationship: 'Parent',
      mobileNumber: '',
    },
  });

  const role = (user?.role || '').toLowerCase().trim();

  // Load existing profile if any
  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const data = await getMyProfile();
        if (!cancelled && data) {
          const u = data.user || user || {};
          const p = data.profile || {};

          setFormData((prev) => ({
            ...prev,
            name: u.name || user?.name || '',
            email: u.email || user?.email || '',
            mobileNumber: p.mobileNumber || '',
            dateOfBirth: p.dateOfBirth
              ? new Date(p.dateOfBirth).toISOString().substring(0, 10)
              : '',
            gender: p.gender || '',
            profilePhoto: p.profilePhoto || '',
            address: {
              addressLine1: p.address?.addressLine1 || '',
              addressLine2: p.address?.addressLine2 || '',
              city: p.address?.city || '',
              state: p.address?.state || '',
              country: p.address?.country || 'India',
              pinCode: p.address?.pinCode || '',
            },
            medicalRegistrationNumber: p.medicalRegistrationNumber || '',
            specialization: p.specialization || 'General Medicine',
            otherSpecialization: p.otherSpecialization || '',
            qualification: p.qualification || (role === 'pharmacist' ? 'B.Pharm' : 'MBBS'),
            otherQualification: p.otherQualification || '',
            yearsOfExperience:
              p.yearsOfExperience !== undefined && p.yearsOfExperience !== null
                ? String(p.yearsOfExperience)
                : '',
            hospitalClinicName: p.hospitalClinicName || '',
            hospitalClinicAddress: p.hospitalClinicAddress || '',
            professionalContactNumber: p.professionalContactNumber || '',
            pharmacyRegistrationNumber: p.pharmacyRegistrationNumber || '',
            pharmacyHospitalName: p.pharmacyHospitalName || '',
            pharmacyHospitalAddress: p.pharmacyHospitalAddress || '',
            bloodGroup: p.bloodGroup || '',
            allergyStatus: p.hasNoKnownAllergies ? 'none' : (Array.isArray(p.allergies) && p.allergies.length > 0 ? 'yes' : ''),
            allergiesText: Array.isArray(p.allergies) ? p.allergies.join(', ') : '',
            medicalConditions: Array.isArray(p.medicalConditions) ? p.medicalConditions : [],
            currentMedications: Array.isArray(p.currentMedications) ? p.currentMedications : [],
            previousSurgeries: Array.isArray(p.previousSurgeries) ? p.previousSurgeries : [],
            emergencyContact: {
              name: p.emergencyContact?.name || '',
              relationship: p.emergencyContact?.relationship || 'Parent',
              mobileNumber: p.emergencyContact?.mobileNumber || '',
            },
          }));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Profile fetch note:', err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  // Handlers for standard fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }));
  };

  const handleEmergencyChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [name]: value },
    }));
  };

  // Dynamic Array Handlers for Patient
  const addMedicalCondition = () => {
    setFormData((prev) => ({
      ...prev,
      medicalConditions: [...prev.medicalConditions, { name: '', sinceYear: '', notes: '' }],
    }));
  };

  const updateMedicalCondition = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.medicalConditions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, medicalConditions: updated };
    });
  };

  const removeMedicalCondition = (index) => {
    setFormData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.filter((_, i) => i !== index),
    }));
  };

  const addCurrentMedication = () => {
    setFormData((prev) => ({
      ...prev,
      currentMedications: [
        ...prev.currentMedications,
        { name: '', dosage: '', frequency: '', notes: '' },
      ],
    }));
  };

  const updateCurrentMedication = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.currentMedications];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, currentMedications: updated };
    });
  };

  const removeCurrentMedication = (index) => {
    setFormData((prev) => ({
      ...prev,
      currentMedications: prev.currentMedications.filter((_, i) => i !== index),
    }));
  };

  const addSurgery = () => {
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: [
        ...prev.previousSurgeries,
        { surgeryName: '', year: '', hospital: '', notes: '' },
      ],
    }));
  };

  const updateSurgery = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.previousSurgeries];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, previousSurgeries: updated };
    });
  };

  const removeSurgery = (index) => {
    setFormData((prev) => ({
      ...prev,
      previousSurgeries: prev.previousSurgeries.filter((_, i) => i !== index),
    }));
  };

  /**
   * Validate all required fields and return exact specific missing field message
   */
  const validateForm = () => {
    // 1. Personal Information
    if (!formData.mobileNumber || !formData.mobileNumber.trim()) {
      return 'Please complete: Mobile Number.';
    }
    if (!isValidPhone(formData.mobileNumber.trim())) {
      return 'Please provide a valid Mobile Number (7 to 15 digits).';
    }
    if (!formData.dateOfBirth) {
      return 'Please complete: Date of Birth.';
    }
    if (!isValidDOB(formData.dateOfBirth)) {
      return 'Date of Birth must be a valid date in the past.';
    }
    if (!formData.gender || !formData.gender.trim()) {
      return 'Please complete: Gender.';
    }

    // 2. Contact Information
    if (!formData.address.addressLine1 || !formData.address.addressLine1.trim()) {
      return 'Please complete: Address Line 1.';
    }
    if (!formData.address.city || !formData.address.city.trim()) {
      return 'Please complete: City.';
    }
    if (!formData.address.state || !formData.address.state.trim()) {
      return 'Please complete: State.';
    }
    if (!formData.address.country || !formData.address.country.trim()) {
      return 'Please complete: Country.';
    }
    if (!formData.address.pinCode || !formData.address.pinCode.trim()) {
      return 'Please complete: PIN / ZIP Code.';
    }

    // 3. Role-Specific Information
    if (role === 'doctor') {
      if (!formData.medicalRegistrationNumber || !formData.medicalRegistrationNumber.trim()) {
        return 'Please complete: Medical Registration Number.';
      }
      if (
        formData.yearsOfExperience === '' ||
        formData.yearsOfExperience === null ||
        formData.yearsOfExperience === undefined ||
        isNaN(Number(formData.yearsOfExperience)) ||
        Number(formData.yearsOfExperience) < 0
      ) {
        return 'Please complete: Years of Experience (0 or greater).';
      }
      if (!formData.specialization || !formData.specialization.trim()) {
        return 'Please complete: Specialization.';
      }
      if (formData.specialization === 'Other' && (!formData.otherSpecialization || !formData.otherSpecialization.trim())) {
        return 'Please complete: Specify Other Specialization.';
      }
      if (!formData.qualification || !formData.qualification.trim()) {
        return 'Please complete: Qualification.';
      }
      if (formData.qualification === 'Other' && (!formData.otherQualification || !formData.otherQualification.trim())) {
        return 'Please complete: Specify Other Qualification.';
      }
      if (!formData.hospitalClinicName || !formData.hospitalClinicName.trim()) {
        return 'Please complete: Hospital / Clinic Name.';
      }
      if (!formData.hospitalClinicAddress || !formData.hospitalClinicAddress.trim()) {
        return 'Please complete: Hospital / Clinic Address.';
      }
    } else if (role === 'pharmacist') {
      if (!formData.pharmacyRegistrationNumber || !formData.pharmacyRegistrationNumber.trim()) {
        return 'Please complete: Pharmacy Registration Number.';
      }
      if (
        formData.yearsOfExperience === '' ||
        formData.yearsOfExperience === null ||
        formData.yearsOfExperience === undefined ||
        isNaN(Number(formData.yearsOfExperience)) ||
        Number(formData.yearsOfExperience) < 0
      ) {
        return 'Please complete: Years of Experience (0 or greater).';
      }
      if (!formData.qualification || !formData.qualification.trim()) {
        return 'Please complete: Qualification.';
      }
      if (formData.qualification === 'Other' && (!formData.otherQualification || !formData.otherQualification.trim())) {
        return 'Please complete: Specify Other Qualification.';
      }
      if (formData.specialization === 'Other' && (!formData.otherSpecialization || !formData.otherSpecialization.trim())) {
        return 'Please complete: Specify Other Specialization.';
      }
      if (!formData.pharmacyHospitalName || !formData.pharmacyHospitalName.trim()) {
        return 'Please complete: Pharmacy / Hospital Name.';
      }
      if (!formData.pharmacyHospitalAddress || !formData.pharmacyHospitalAddress.trim()) {
        return 'Please complete: Pharmacy / Hospital Address.';
      }
    } else if (role === 'patient') {
      if (!formData.emergencyContact.name || !formData.emergencyContact.name.trim()) {
        return 'Please complete: Emergency Contact Name.';
      }
      if (!formData.emergencyContact.relationship || !formData.emergencyContact.relationship.trim()) {
        return 'Please complete: Emergency Contact Relationship.';
      }
      if (!formData.emergencyContact.mobileNumber || !formData.emergencyContact.mobileNumber.trim()) {
        return 'Please complete: Emergency Contact Mobile Number.';
      }
      if (!isValidPhone(formData.emergencyContact.mobileNumber.trim())) {
        return 'Please provide a valid Emergency Contact Mobile Number (7 to 15 digits).';
      }

      // Mandatory Allergy Assessment Validation (No Default Selection)
      if (!formData.allergyStatus || (formData.allergyStatus !== 'none' && formData.allergyStatus !== 'yes')) {
        return 'Please complete: Allergy Assessment (select No Known Allergies or Patient Has Known Allergies).';
      }
      if (formData.allergyStatus === 'yes' && (!formData.allergiesText || !formData.allergiesText.trim())) {
        return 'Please complete: Allergy details are required when Patient Has Known Allergies is selected.';
      }
    }

    return null; // Valid
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Specific validation check
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      // Construct role-specific payload
      const payload = {
        name: formData.name ? formData.name.trim() : '',
        mobileNumber: formData.mobileNumber.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender.trim(),
        profilePhoto: formData.profilePhoto ? formData.profilePhoto.trim() : '',
        address: {
          addressLine1: formData.address.addressLine1.trim(),
          addressLine2: formData.address.addressLine2 ? formData.address.addressLine2.trim() : '',
          city: formData.address.city.trim(),
          state: formData.address.state.trim(),
          country: formData.address.country.trim(),
          pinCode: formData.address.pinCode.trim(),
        },
      };

      if (role === 'doctor') {
        payload.medicalRegistrationNumber = formData.medicalRegistrationNumber.trim();
        payload.specialization = formData.specialization.trim();
        payload.otherSpecialization =
          formData.specialization === 'Other' && formData.otherSpecialization
            ? formData.otherSpecialization.trim()
            : '';
        payload.qualification = formData.qualification.trim();
        payload.otherQualification =
          formData.qualification === 'Other' && formData.otherQualification
            ? formData.otherQualification.trim()
            : '';
        payload.yearsOfExperience = Number(formData.yearsOfExperience);
        payload.hospitalClinicName = formData.hospitalClinicName.trim();
        payload.hospitalClinicAddress = formData.hospitalClinicAddress.trim();
        payload.professionalContactNumber = formData.professionalContactNumber
          ? formData.professionalContactNumber.trim()
          : '';
      } else if (role === 'pharmacist') {
        payload.pharmacyRegistrationNumber = formData.pharmacyRegistrationNumber.trim();
        payload.qualification = formData.qualification.trim();
        payload.otherQualification =
          formData.qualification === 'Other' && formData.otherQualification
            ? formData.otherQualification.trim()
            : '';
        payload.specialization = formData.specialization ? formData.specialization.trim() : '';
        payload.otherSpecialization =
          formData.specialization === 'Other' && formData.otherSpecialization
            ? formData.otherSpecialization.trim()
            : '';
        payload.yearsOfExperience = Number(formData.yearsOfExperience);
        payload.pharmacyHospitalName = formData.pharmacyHospitalName.trim();
        payload.pharmacyHospitalAddress = formData.pharmacyHospitalAddress.trim();
        payload.professionalContactNumber = formData.professionalContactNumber
          ? formData.professionalContactNumber.trim()
          : '';
      } else if (role === 'patient') {
        payload.bloodGroup = formData.bloodGroup || '';
        payload.allergyStatus = formData.allergyStatus;
        payload.hasNoKnownAllergies = formData.allergyStatus === 'none';
        payload.allergies = formData.allergyStatus === 'yes'
          ? (formData.allergiesText || '').split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        payload.medicalConditions = formData.medicalConditions.filter((c) => c && c.name && c.name.trim());
        payload.currentMedications = formData.currentMedications.filter((m) => m && m.name && m.name.trim());
        payload.previousSurgeries = formData.previousSurgeries.filter((s) => s && s.surgeryName && s.surgeryName.trim());
        payload.emergencyContact = {
          name: formData.emergencyContact.name.trim(),
          relationship: formData.emergencyContact.relationship.trim(),
          mobileNumber: formData.emergencyContact.mobileNumber.trim(),
        };
      }

      // Submit to backend
      const res = await updateMyProfile(payload);

      // Immediately sync AuthContext user
      if (res && res.user) {
        setUser(res.user);
      } else {
        await refreshUser();
      }

      // Navigate to role dashboard
      const roleRoutes = {
        doctor: '/doctor/dashboard',
        pharmacist: '/pharmacist/dashboard',
        patient: '/patient/dashboard',
      };
      navigate(roleRoutes[role] || '/', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to complete profile. Please verify your entries.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading message="Loading profile setup..." />;

  const RoleIcon = role === 'doctor' ? Stethoscope : role === 'pharmacist' ? Pill : HeartPulse;
  const roleLabel = role === 'doctor' ? 'Doctor' : role === 'pharmacist' ? 'Pharmacist' : 'Patient';

  return (
    <div className="profile-page-container">
      <div className="profile-main-wrapper">
        {/* HEADER BANNER */}
        <div className="profile-header-banner">
          <div className="profile-header-content">
            <div className="profile-header-badge">
              <RoleIcon size={16} />
              <span>{roleLabel} Clinical Setup</span>
            </div>
            <h1 className="profile-header-title">Complete Your Profile</h1>
            <p className="profile-header-desc">
              Welcome, <strong>{user?.name}</strong>. Please complete your clinical registration
              details to finalize account activation and access your MedWise dashboard.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
            <ShieldCheck size={28} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>JWT Encrypted</span>
          </div>
        </div>

        {error && (
          <div className="alert-box error" role="alert" style={{ marginBottom: '1.75rem' }}>
            <AlertCircle className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* COMMON ROW: SIDE-BY-SIDE ON DESKTOP */}
          <div className="profile-sections-grid">
            {/* SECTION 1: PERSONAL INFORMATION */}
            <div className="profile-section-card">
              <div className="section-card-header">
                <div className="section-icon-badge">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h2 className="section-title">Personal Information</h2>
                </div>
              </div>
              <p className="section-desc">Basic demographic information for clinical identity</p>
              <div className="section-divider"></div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-name">
                  Full Name
                </label>
                <div className="input-wrapper">
                  <input
                    id="profile-name"
                    type="text"
                    className="form-input"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-email">
                  Email Address <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Read-only)</span>
                </label>
                <div className="input-wrapper">
                  <Lock className="input-icon-left" style={{ opacity: 0.5 }} />
                  <input
                    id="profile-email"
                    type="email"
                    className="form-input has-left-icon readonly"
                    name="email"
                    value={formData.email}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-mobile">
                  Mobile Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="profile-mobile"
                    type="text"
                    className="form-input"
                    name="mobileNumber"
                    placeholder="Enter 10-digit mobile number"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-dob">
                    Date of Birth <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="profile-dob"
                      type="date"
                      className="form-input"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profile-gender">
                    Gender <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="profile-gender"
                      className="form-input"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
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
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="profile-photo">
                  Profile Photo URL <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Optional)</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="profile-photo"
                    type="text"
                    className="form-input"
                    name="profilePhoto"
                    value={formData.profilePhoto}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: CONTACT INFORMATION */}
            <div className="profile-section-card">
              <div className="section-card-header">
                <div className="section-icon-badge">
                  <MapPin size={20} />
                </div>
                <div>
                  <h2 className="section-title">Contact Information</h2>
                </div>
              </div>
              <p className="section-desc">Residential or professional communication address</p>
              <div className="section-divider"></div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-address1">
                  Address Line 1 <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="profile-address1"
                    type="text"
                    className="form-input"
                    name="addressLine1"
                    value={formData.address.addressLine1}
                    onChange={handleAddressChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-address2">
                  Address Line 2 <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Optional)</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="profile-address2"
                    type="text"
                    className="form-input"
                    name="addressLine2"
                    value={formData.address.addressLine2}
                    onChange={handleAddressChange}
                  />
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-city">
                    City <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="profile-city"
                      type="text"
                      className="form-input"
                      name="city"
                      value={formData.address.city}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profile-state">
                    State <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="profile-state"
                      type="text"
                      className="form-input"
                      name="state"
                      value={formData.address.state}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-country">
                    Country <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="profile-country"
                      type="text"
                      className="form-input"
                      name="country"
                      value={formData.address.country}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profile-pincode">
                    PIN / ZIP Code <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="profile-pincode"
                      type="text"
                      className="form-input"
                      name="pinCode"
                      value={formData.address.pinCode}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROLE SPECIFIC: DOCTOR */}
          {role === 'doctor' && (
            <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
              <div className="section-card-header">
                <div className="section-icon-badge">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h2 className="section-title">Professional Information</h2>
                </div>
              </div>
              <p className="section-desc">Medical licensing, hospital affiliation, and clinical specialty details</p>
              <div className="section-divider"></div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-reg">
                    Medical Registration Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="doc-reg"
                      type="text"
                      className="form-input"
                      name="medicalRegistrationNumber"
                      placeholder="Enter medical registration number (e.g. MCI-123456)"
                      value={formData.medicalRegistrationNumber}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="doc-exp">
                    Years of Experience <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="doc-exp"
                      type="number"
                      className="form-input"
                      name="yearsOfExperience"
                      min="0"
                      value={formData.yearsOfExperience}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-spec">
                    Specialization <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="doc-spec"
                      className="form-input"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleInputChange}
                      required
                    >
                      {DOCTOR_SPECIALIZATIONS.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="doc-qual">
                    Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="doc-qual"
                      className="form-input"
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      required
                    >
                      {DOCTOR_QUALIFICATIONS.map((qual) => (
                        <option key={qual} value={qual}>
                          {qual}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Conditional 'Other' fields */}
              {(formData.specialization === 'Other' || formData.qualification === 'Other') && (
                <div className="form-grid-2col">
                  {formData.specialization === 'Other' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-other-spec">
                        Specify Other Specialization <span style={{ color: 'var(--danger-500)' }}>*</span>
                      </label>
                      <div className="input-wrapper">
                        <input
                          id="doc-other-spec"
                          type="text"
                          className="form-input"
                          name="otherSpecialization"
                          value={formData.otherSpecialization}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {formData.qualification === 'Other' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="doc-other-qual">
                        Specify Other Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                      </label>
                      <div className="input-wrapper">
                        <input
                          id="doc-other-qual"
                          type="text"
                          className="form-input"
                          name="otherQualification"
                          value={formData.otherQualification}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-hospital">
                    Hospital / Clinic Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="doc-hospital"
                      type="text"
                      className="form-input"
                      name="hospitalClinicName"
                      value={formData.hospitalClinicName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="doc-contact">
                    Professional Contact Number <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="doc-contact"
                      type="text"
                      className="form-input"
                      name="professionalContactNumber"
                      value={formData.professionalContactNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="doc-hosp-addr">
                  Hospital / Clinic Address <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="doc-hosp-addr"
                    type="text"
                    className="form-input"
                    name="hospitalClinicAddress"
                    value={formData.hospitalClinicAddress}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ROLE SPECIFIC: PHARMACIST */}
          {role === 'pharmacist' && (
            <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
              <div className="section-card-header">
                <div className="section-icon-badge">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h2 className="section-title">Professional Information</h2>
                </div>
              </div>
              <p className="section-desc">Pharmacy council registration, dispensing qualification, and facility details</p>
              <div className="section-divider"></div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-reg">
                    Pharmacy Registration Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-reg"
                      type="text"
                      className="form-input"
                      name="pharmacyRegistrationNumber"
                      placeholder="Enter pharmacist registration number (e.g. PCI-123456)"
                      value={formData.pharmacyRegistrationNumber}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-exp">
                    Years of Experience <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-exp"
                      type="number"
                      className="form-input"
                      name="yearsOfExperience"
                      min="0"
                      value={formData.yearsOfExperience}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-qual">
                    Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="pharm-qual"
                      className="form-input"
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      required
                    >
                      {PHARMACIST_QUALIFICATIONS.map((qual) => (
                        <option key={qual} value={qual}>
                          {qual}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-spec">
                    Specialization / Area of Focus <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-spec"
                      type="text"
                      className="form-input"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              {formData.qualification === 'Other' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-other-qual">
                    Specify Other Qualification <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-other-qual"
                      type="text"
                      className="form-input"
                      name="otherQualification"
                      value={formData.otherQualification}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-name">
                    Pharmacy / Hospital Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-name"
                      type="text"
                      className="form-input"
                      name="pharmacyHospitalName"
                      value={formData.pharmacyHospitalName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pharm-contact">
                    Professional Contact Number <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="pharm-contact"
                      type="text"
                      className="form-input"
                      name="professionalContactNumber"
                      value={formData.professionalContactNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pharm-addr">
                  Pharmacy / Hospital Address <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="pharm-addr"
                    type="text"
                    className="form-input"
                    name="pharmacyHospitalAddress"
                    value={formData.pharmacyHospitalAddress}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ROLE SPECIFIC: PATIENT */}
          {role === 'patient' && (
            <>
              {/* HEALTH INFORMATION */}
              <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
                <div className="section-card-header">
                  <div className="section-icon-badge">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h2 className="section-title">Health Information</h2>
                  </div>
                </div>
                <p className="section-desc">Medical background, ongoing treatments, and surgical history</p>
                <div className="section-divider"></div>

                <div className="form-group" style={{ maxWidth: '320px', marginBottom: '1.75rem' }}>
                  <label className="form-label" htmlFor="patient-blood">
                    Blood Group
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="patient-blood"
                      className="form-input"
                      name="bloodGroup"
                      value={formData.bloodGroup || ''}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mandatory Allergy Assessment */}
                <div style={{ marginBottom: '1.75rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)', marginBottom: '0.5rem', display: 'block' }}>
                    Allergy Assessment <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
                    Please explicitly declare your allergy status for MedWise clinical safety evaluations.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                      <input
                        type="radio"
                        name="allergyStatus"
                        value="none"
                        checked={formData.allergyStatus === 'none'}
                        onChange={(e) => setFormData((prev) => ({ ...prev, allergyStatus: e.target.value, allergiesText: '' }))}
                      />
                      <span>No Known Allergies</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                      <input
                        type="radio"
                        name="allergyStatus"
                        value="yes"
                        checked={formData.allergyStatus === 'yes'}
                        onChange={(e) => setFormData((prev) => ({ ...prev, allergyStatus: e.target.value }))}
                      />
                      <span>Patient Has Known Allergies</span>
                    </label>
                  </div>

                  {formData.allergyStatus === 'yes' && (
                    <div style={{ marginTop: '1rem' }}>
                      <label className="form-label" htmlFor="allergies-detail" style={{ fontSize: '0.85rem' }}>
                        Allergy & Allergen Details <span style={{ color: 'var(--danger-500)' }}>*</span>
                      </label>
                      <input
                        id="allergies-detail"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Penicillin, Amoxicillin, Aspirin, Peanuts"
                        value={formData.allergiesText || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, allergiesText: e.target.value }))}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px', display: 'block' }}>
                        Separate multiple allergies with commas.
                      </span>
                    </div>
                  )}
                </div>

                {/* Medical Conditions */}
                <div style={{ marginBottom: '2rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-800)', marginBottom: '0.75rem', display: 'block' }}>
                    Known Medical Conditions
                  </label>
                  <div className="dynamic-items-container">
                    {formData.medicalConditions.map((condition, idx) => (
                      <div key={idx} className="dynamic-item-card">
                        <div className="dynamic-item-header">
                          <span className="dynamic-item-label">Condition #{idx + 1}</span>
                          <button
                            type="button"
                            className="btn-remove-item"
                            onClick={() => removeMedicalCondition(idx)}
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
                              value={condition.name}
                              onChange={(e) => updateMedicalCondition(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Diagnosed Year</label>
                            <input
                              type="number"
                              className="form-input"
                              value={condition.sinceYear || ''}
                              onChange={(e) => updateMedicalCondition(idx, 'sinceYear', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Clinical Notes</label>
                          <input
                            type="text"
                            className="form-input"
                            value={condition.notes || ''}
                            onChange={(e) => updateMedicalCondition(idx, 'notes', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-add-item" onClick={addMedicalCondition}>
                    <Plus size={16} />
                    <span>Add Medical Condition</span>
                  </button>
                </div>

                {/* Current Medications */}
                <div style={{ marginBottom: '2rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-800)', marginBottom: '0.75rem', display: 'block' }}>
                    Current Medications
                  </label>
                  <div className="dynamic-items-container">
                    {formData.currentMedications.map((med, idx) => (
                      <div key={idx} className="dynamic-item-card">
                        <div className="dynamic-item-header">
                          <span className="dynamic-item-label">Medication #{idx + 1}</span>
                          <button
                            type="button"
                            className="btn-remove-item"
                            onClick={() => removeCurrentMedication(idx)}
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
                              value={med.name}
                              onChange={(e) => updateCurrentMedication(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Dosage</label>
                            <input
                              type="text"
                              className="form-input"
                              value={med.dosage || ''}
                              onChange={(e) => updateCurrentMedication(idx, 'dosage', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Frequency</label>
                            <input
                              type="text"
                              className="form-input"
                              value={med.frequency || ''}
                              onChange={(e) => updateCurrentMedication(idx, 'frequency', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Instructions / Notes</label>
                          <input
                            type="text"
                            className="form-input"
                            value={med.notes || ''}
                            onChange={(e) => updateCurrentMedication(idx, 'notes', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-add-item" onClick={addCurrentMedication}>
                    <Plus size={16} />
                    <span>Add Current Medication</span>
                  </button>
                </div>

                {/* Previous Major Surgeries */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-800)', marginBottom: '0.75rem', display: 'block' }}>
                    Previous Major Surgeries
                  </label>
                  <div className="dynamic-items-container">
                    {formData.previousSurgeries.map((surg, idx) => (
                      <div key={idx} className="dynamic-item-card">
                        <div className="dynamic-item-header">
                          <span className="dynamic-item-label">Surgery #{idx + 1}</span>
                          <button
                            type="button"
                            className="btn-remove-item"
                            onClick={() => removeSurgery(idx)}
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
                              value={surg.surgeryName}
                              onChange={(e) => updateSurgery(idx, 'surgeryName', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Year of Procedure</label>
                            <input
                              type="number"
                              className="form-input"
                              value={surg.year || ''}
                              onChange={(e) => updateSurgery(idx, 'year', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-grid-2col" style={{ marginBottom: 0 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hospital / Center</label>
                            <input
                              type="text"
                              className="form-input"
                              value={surg.hospital || ''}
                              onChange={(e) => updateSurgery(idx, 'hospital', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Procedure Notes</label>
                            <input
                              type="text"
                              className="form-input"
                              value={surg.notes || ''}
                              onChange={(e) => updateSurgery(idx, 'notes', e.target.value)}
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

              {/* EMERGENCY CONTACT: PATIENTS ONLY */}
              <div className="profile-section-card full-width" style={{ marginBottom: '1.75rem' }}>
                <div className="section-card-header">
                  <div className="section-icon-badge">
                    <PhoneCall size={20} />
                  </div>
                  <div>
                    <h2 className="section-title">Emergency Contact</h2>
                  </div>
                </div>
                <p className="section-desc">Designated contact person in case of urgent medical notifications</p>
                <div className="section-divider"></div>

                <div className="form-grid-3col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="em-name">
                      Contact Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="em-name"
                        type="text"
                        className="form-input"
                        name="name"
                        value={formData.emergencyContact.name}
                        onChange={handleEmergencyChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="em-rel">
                      Relationship <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <div className="input-wrapper">
                      <select
                        id="em-rel"
                        className="form-input"
                        name="relationship"
                        value={formData.emergencyContact.relationship}
                        onChange={handleEmergencyChange}
                        required
                      >
                        {EMERGENCY_RELATIONSHIPS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="em-mobile">
                      Mobile Number <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="em-mobile"
                        type="text"
                        className="form-input"
                        name="mobileNumber"
                        value={formData.emergencyContact.mobileNumber}
                        onChange={handleEmergencyChange}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SUBMIT ACTION BAR */}
          <div className="profile-submit-bar">
            <div className="submit-bar-info">
              <ShieldCheck size={20} style={{ color: 'var(--primary-600)' }} />
              <span>All information is encrypted and securely stored in compliance with medical data regulations.</span>
            </div>

            <button
              id="save-profile-btn"
              type="submit"
              className="btn-primary profile-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="spinner-sm"></div>
                  <span>Saving Profile...</span>
                </>
              ) : (
                'Save Profile & Continue'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
