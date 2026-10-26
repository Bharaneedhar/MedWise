const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const PharmacistProfile = require('../models/PharmacistProfile');
const PatientProfile = require('../models/PatientProfile');

/**
 * Resolve Mongoose model based on validated user role
 */
const getProfileModelByRole = (role) => {
  const normRole = (role || '').toLowerCase().trim();
  switch (normRole) {
    case 'doctor':
      return DoctorProfile;
    case 'pharmacist':
      return PharmacistProfile;
    case 'patient':
      return PatientProfile;
    default:
      return null;
  }
};

/**
 * Validate phone number format (supports Indian and International mobile numbers)
 */
const isValidPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Matches 7 to 15 digits, optionally prefixed with +
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  return phoneRegex.test(cleaned);
};

/**
 * Validate Date of Birth (must be valid past date)
 */
const isValidDOB = (dobString) => {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return dob < today;
};

/**
 * Helper to check profile completion across role models
 */
const checkUserProfileCompleted = async (userId, role) => {
  try {
    const normRole = (role || '').toLowerCase().trim();
    if (normRole === 'admin') return true;
    const Model = getProfileModelByRole(normRole);
    if (!Model) return false;
    const profile = await Model.findOne({ userId });
    return !!(profile && profile.profileCompleted);
  } catch (error) {
    return false;
  }
};

/**
 * @desc    Get current authenticated user's role-specific profile
 * @route   GET /api/profile/me
 * @access  Private (JWT Protected)
 */
const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = (req.user.role || '').toLowerCase().trim();

    const ProfileModel = getProfileModelByRole(role);
    if (!ProfileModel) {
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}' associated with this account`,
      });
    }

    const profile = await ProfileModel.findOne({ userId });
    const isCompleted = !!(profile && profile.profileCompleted);

    return res.status(200).json({
      success: true,
      profileCompleted: isCompleted,
      profile: profile || null,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        profileCompleted: isCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create or update current authenticated user's role-specific profile
 * @route   PUT /api/profile/me
 * @access  Private (JWT Protected)
 */
const createOrUpdateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = (req.user.role || '').toLowerCase().trim(); // Always determine role from authenticated user

    const ProfileModel = getProfileModelByRole(role);
    if (!ProfileModel) {
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}' for profile management`,
      });
    }

    const {
      name,
      mobileNumber,
      dateOfBirth,
      gender,
      profilePhoto,
      address,
      emergencyContact,
      // Doctor fields
      medicalRegistrationNumber,
      specialization,
      otherSpecialization,
      qualification,
      otherQualification,
      yearsOfExperience,
      hospitalClinicName,
      hospitalClinicAddress,
      professionalContactNumber,
      // Pharmacist fields
      pharmacyRegistrationNumber,
      pharmacyHospitalName,
      pharmacyHospitalAddress,
      // Patient fields
      bloodGroup,
      medicalConditions,
      currentMedications,
      previousSurgeries,
    } = req.body;

    // 1. COMMON: Full Name (Optional update to User model)
    if (name && typeof name === 'string' && name.trim() && name.trim() !== req.user.name) {
      await User.findByIdAndUpdate(userId, { name: name.trim() });
    }

    // 2. COMMON: Mobile Number (Mandatory)
    if (!mobileNumber || typeof mobileNumber !== 'string' || !mobileNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: Mobile Number.',
      });
    }
    if (!isValidPhoneNumber(mobileNumber.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Mobile Number (7 to 15 digits).',
      });
    }

    // 3. COMMON: Date of Birth (Mandatory)
    if (!dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: Date of Birth.',
      });
    }
    if (!isValidDOB(dateOfBirth)) {
      return res.status(400).json({
        success: false,
        message: 'Date of Birth must be a valid date in the past.',
      });
    }

    // 4. COMMON: Gender (Mandatory)
    const allowedGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
    if (!gender || typeof gender !== 'string' || !allowedGenders.includes(gender.trim())) {
      return res.status(400).json({
        success: false,
        message: `Please complete: Gender (select one of: ${allowedGenders.join(', ')}).`,
      });
    }

    // 5. COMMON: Address Fields (Mandatory: Address Line 1, City, State, Country, PIN/ZIP Code)
    if (!address || typeof address !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Please complete: Address information.',
      });
    }
    if (!address.addressLine1 || typeof address.addressLine1 !== 'string' || !address.addressLine1.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: Address Line 1.',
      });
    }
    if (!address.city || typeof address.city !== 'string' || !address.city.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: City.',
      });
    }
    if (!address.state || typeof address.state !== 'string' || !address.state.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: State.',
      });
    }
    if (!address.country || typeof address.country !== 'string' || !address.country.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: Country.',
      });
    }
    if (!address.pinCode || typeof address.pinCode !== 'string' || !address.pinCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete: PIN / ZIP Code.',
      });
    }

    // Base profile payload
    const profilePayload = {
      userId,
      mobileNumber: mobileNumber.trim(),
      dateOfBirth: new Date(dateOfBirth),
      gender: gender.trim(),
      profilePhoto: (profilePhoto && typeof profilePhoto === 'string') ? profilePhoto.trim() : '',
      address: {
        addressLine1: address.addressLine1.trim(),
        addressLine2: (address.addressLine2 && typeof address.addressLine2 === 'string') ? address.addressLine2.trim() : '',
        city: address.city.trim(),
        state: address.state.trim(),
        country: address.country.trim(),
        pinCode: address.pinCode.trim(),
      },
      profileCompleted: true,
    };

    // 6. ROLE-SPECIFIC VALIDATIONS & POPULATION
    if (role === 'doctor') {
      // Medical Registration Number
      if (!medicalRegistrationNumber || typeof medicalRegistrationNumber !== 'string' || !medicalRegistrationNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Medical Registration Number.',
        });
      }
      // Specialization
      if (!specialization || typeof specialization !== 'string' || !specialization.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Specialization.',
        });
      }
      if (specialization.trim() === 'Other' && (!otherSpecialization || typeof otherSpecialization !== 'string' || !otherSpecialization.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Specify Other Specialization.',
        });
      }
      // Qualification
      if (!qualification || typeof qualification !== 'string' || !qualification.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Qualification.',
        });
      }
      if (qualification.trim() === 'Other' && (!otherQualification || typeof otherQualification !== 'string' || !otherQualification.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Specify Other Qualification.',
        });
      }
      // Years of Experience (0 is valid)
      if (
        yearsOfExperience === undefined ||
        yearsOfExperience === null ||
        yearsOfExperience === '' ||
        isNaN(Number(yearsOfExperience)) ||
        Number(yearsOfExperience) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Years of Experience (0 or greater).',
        });
      }
      // Hospital / Clinic Name
      if (!hospitalClinicName || typeof hospitalClinicName !== 'string' || !hospitalClinicName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Hospital / Clinic Name.',
        });
      }
      // Hospital / Clinic Address
      if (!hospitalClinicAddress || typeof hospitalClinicAddress !== 'string' || !hospitalClinicAddress.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Hospital / Clinic Address.',
        });
      }

      profilePayload.medicalRegistrationNumber = medicalRegistrationNumber.trim();
      profilePayload.specialization = specialization.trim();
      profilePayload.otherSpecialization = specialization.trim() === 'Other' ? otherSpecialization.trim() : (otherSpecialization ? otherSpecialization.trim() : '');
      profilePayload.qualification = qualification.trim();
      profilePayload.otherQualification = qualification.trim() === 'Other' ? otherQualification.trim() : (otherQualification ? otherQualification.trim() : '');
      profilePayload.yearsOfExperience = Number(yearsOfExperience);
      profilePayload.hospitalClinicName = hospitalClinicName.trim();
      profilePayload.hospitalClinicAddress = hospitalClinicAddress.trim();
      profilePayload.professionalContactNumber = (professionalContactNumber && typeof professionalContactNumber === 'string') ? professionalContactNumber.trim() : '';

    } else if (role === 'pharmacist') {
      // Pharmacy Registration Number
      if (!pharmacyRegistrationNumber || typeof pharmacyRegistrationNumber !== 'string' || !pharmacyRegistrationNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Pharmacy Registration Number.',
        });
      }
      // Qualification
      if (!qualification || typeof qualification !== 'string' || !qualification.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Qualification.',
        });
      }
      if (qualification.trim() === 'Other' && (!otherQualification || typeof otherQualification !== 'string' || !otherQualification.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Specify Other Qualification.',
        });
      }
      // Specialization (optional for pharmacist, but if 'Other' then otherSpecialization required)
      if (specialization && typeof specialization === 'string' && specialization.trim() === 'Other' && (!otherSpecialization || typeof otherSpecialization !== 'string' || !otherSpecialization.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Specify Other Specialization.',
        });
      }
      // Years of Experience (0 is valid)
      if (
        yearsOfExperience === undefined ||
        yearsOfExperience === null ||
        yearsOfExperience === '' ||
        isNaN(Number(yearsOfExperience)) ||
        Number(yearsOfExperience) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Years of Experience (0 or greater).',
        });
      }
      // Pharmacy / Hospital Name
      if (!pharmacyHospitalName || typeof pharmacyHospitalName !== 'string' || !pharmacyHospitalName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Pharmacy / Hospital Name.',
        });
      }
      // Pharmacy / Hospital Address
      if (!pharmacyHospitalAddress || typeof pharmacyHospitalAddress !== 'string' || !pharmacyHospitalAddress.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Pharmacy / Hospital Address.',
        });
      }

      profilePayload.pharmacyRegistrationNumber = pharmacyRegistrationNumber.trim();
      profilePayload.qualification = qualification.trim();
      profilePayload.otherQualification = qualification.trim() === 'Other' ? otherQualification.trim() : (otherQualification ? otherQualification.trim() : '');
      profilePayload.specialization = (specialization && typeof specialization === 'string') ? specialization.trim() : '';
      profilePayload.otherSpecialization = (specialization && specialization.trim() === 'Other' && otherSpecialization) ? otherSpecialization.trim() : '';
      profilePayload.yearsOfExperience = Number(yearsOfExperience);
      profilePayload.pharmacyHospitalName = pharmacyHospitalName.trim();
      profilePayload.pharmacyHospitalAddress = pharmacyHospitalAddress.trim();
      profilePayload.professionalContactNumber = (professionalContactNumber && typeof professionalContactNumber === 'string') ? professionalContactNumber.trim() : '';

    } else if (role === 'patient') {
      // Emergency Contact is MANDATORY ONLY FOR PATIENTS
      if (!emergencyContact || typeof emergencyContact !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Emergency Contact information.',
        });
      }
      if (!emergencyContact.name || typeof emergencyContact.name !== 'string' || !emergencyContact.name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Emergency Contact Name.',
        });
      }
      const allowedRelationships = ['Parent', 'Spouse', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'];
      if (!emergencyContact.relationship || typeof emergencyContact.relationship !== 'string' || !allowedRelationships.includes(emergencyContact.relationship.trim())) {
        return res.status(400).json({
          success: false,
          message: `Please complete: Emergency Contact Relationship (select one of: ${allowedRelationships.join(', ')}).`,
        });
      }
      if (!emergencyContact.mobileNumber || typeof emergencyContact.mobileNumber !== 'string' || !emergencyContact.mobileNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please complete: Emergency Contact Mobile Number.',
        });
      }
      if (!isValidPhoneNumber(emergencyContact.mobileNumber.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid Emergency Contact Mobile Number (7 to 15 digits).',
        });
      }

      profilePayload.emergencyContact = {
        name: emergencyContact.name.trim(),
        relationship: emergencyContact.relationship.trim(),
        mobileNumber: emergencyContact.mobileNumber.trim(),
      };

      const allowedBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown', ''];
      profilePayload.bloodGroup = (bloodGroup && typeof bloodGroup === 'string' && allowedBloodGroups.includes(bloodGroup.trim())) ? bloodGroup.trim() : '';

      // Clean and normalize medical conditions (Optional)
      if (Array.isArray(medicalConditions)) {
        profilePayload.medicalConditions = medicalConditions
          .filter((c) => c && typeof c === 'object' && c.name && typeof c.name === 'string' && c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            sinceYear: (c.sinceYear !== undefined && c.sinceYear !== null && c.sinceYear !== '' && !isNaN(Number(c.sinceYear))) ? Number(c.sinceYear) : undefined,
            notes: (c.notes && typeof c.notes === 'string') ? c.notes.trim() : '',
          }));
      } else {
        profilePayload.medicalConditions = [];
      }

      // Clean and normalize current medications (Optional)
      if (Array.isArray(currentMedications)) {
        profilePayload.currentMedications = currentMedications
          .filter((m) => m && typeof m === 'object' && m.name && typeof m.name === 'string' && m.name.trim())
          .map((m) => ({
            name: m.name.trim(),
            dosage: (m.dosage && typeof m.dosage === 'string') ? m.dosage.trim() : '',
            frequency: (m.frequency && typeof m.frequency === 'string') ? m.frequency.trim() : '',
            notes: (m.notes && typeof m.notes === 'string') ? m.notes.trim() : '',
          }));
      } else {
        profilePayload.currentMedications = [];
      }

      // Clean and normalize previous surgeries (Optional)
      if (Array.isArray(previousSurgeries)) {
        profilePayload.previousSurgeries = previousSurgeries
          .filter((s) => s && typeof s === 'object' && s.surgeryName && typeof s.surgeryName === 'string' && s.surgeryName.trim())
          .map((s) => ({
            surgeryName: s.surgeryName.trim(),
            year: (s.year !== undefined && s.year !== null && s.year !== '' && !isNaN(Number(s.year))) ? Number(s.year) : undefined,
            hospital: (s.hospital && typeof s.hospital === 'string') ? s.hospital.trim() : '',
            notes: (s.notes && typeof s.notes === 'string') ? s.notes.trim() : '',
          }));
      } else {
        profilePayload.previousSurgeries = [];
      }

      // Mandatory Allergy Assessment Handling (Patient Role)
      const allergyStatus = req.body.allergyStatus;
      const bodyHasNoKnown = req.body.hasNoKnownAllergies;
      const bodyAllergies = req.body.allergies;

      const isExplicitNoAllergies = allergyStatus === 'none' || bodyHasNoKnown === true || bodyHasNoKnown === 'true';
      const isExplicitHasAllergies = allergyStatus === 'yes' || (bodyHasNoKnown === false && Array.isArray(bodyAllergies) && bodyAllergies.length > 0);

      // Check if updating existing completed profile vs completing new profile
      const existingProfile = await PatientProfile.findOne({ userId });
      const isNewCompletion = !existingProfile || !existingProfile.profileCompleted;

      if (isNewCompletion) {
        if (!isExplicitNoAllergies && !isExplicitHasAllergies) {
          return res.status(400).json({
            success: false,
            message: 'Please complete: Allergy Assessment (select No Known Allergies or Patient Has Known Allergies).',
          });
        }
      }

      if (isExplicitHasAllergies) {
        const parsedAllergies = Array.isArray(bodyAllergies)
          ? bodyAllergies.map((a) => (typeof a === 'string' ? a.trim() : (a && a.name) || '').trim()).filter(Boolean)
          : (typeof req.body.allergiesText === 'string' ? req.body.allergiesText.split(',').map((s) => s.trim()).filter(Boolean) : []);

        if (parsedAllergies.length === 0 && isNewCompletion) {
          return res.status(400).json({
            success: false,
            message: 'Please complete: Allergy details are required when Patient Has Known Allergies is selected.',
          });
        }
        profilePayload.hasNoKnownAllergies = false;
        profilePayload.allergies = parsedAllergies;
      } else if (isExplicitNoAllergies) {
        profilePayload.hasNoKnownAllergies = true;
        profilePayload.allergies = [];
      } else if (existingProfile) {
        profilePayload.hasNoKnownAllergies = existingProfile.hasNoKnownAllergies;
        profilePayload.allergies = existingProfile.allergies;
      }
    }

    // 7. Upsert Profile in MongoDB
    const updatedProfile = await ProfileModel.findOneAndUpdate(
      { userId },
      { $set: profilePayload },
      { new: true, upsert: true, runValidators: true }
    );

    const currentUser = await User.findById(userId).select('-password');

    return res.status(200).json({
      success: true,
      message: 'Profile completed and saved successfully',
      profileCompleted: true,
      profile: updatedProfile,
      user: {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        profileCompleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's medication history (Active & Inactive)
 * @route   GET /api/profile/medications
 * @access  Private (Patient)
 */
const getMyMedications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const profile = await PatientProfile.findOne({ userId });
    const allMeds = (profile && Array.isArray(profile.currentMedications)) ? profile.currentMedications : [];

    const activeMedications = allMeds.filter((m) => m.status !== 'INACTIVE');
    const inactiveMedications = allMeds.filter((m) => m.status === 'INACTIVE');

    return res.status(200).json({
      success: true,
      activeMedications,
      inactiveMedications,
      allMedications: allMeds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a patient-reported medication
 * @route   POST /api/profile/medications
 * @access  Private (Patient)
 */
const addPatientMedication = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, genericName, strength, dosage, frequency, duration, route, instructions, notes } = req.body;

    const medName = (name || genericName || '').trim();
    if (!medName) {
      return res.status(400).json({
        success: false,
        message: 'Medication name is required.',
      });
    }

    let profile = await PatientProfile.findOne({ userId });
    if (!profile) {
      profile = new PatientProfile({ userId });
    }

    if (!Array.isArray(profile.currentMedications)) {
      profile.currentMedications = [];
    }

    const newMed = {
      name: medName,
      genericName: (genericName || medName).trim(),
      strength: (strength || dosage || '').trim(),
      dosage: (dosage || strength || '').trim(),
      frequency: (frequency || '').trim(),
      duration: (duration || '').trim(),
      route: (route || '').trim(),
      instructions: (instructions || '').trim(),
      status: 'ACTIVE',
      source: 'PATIENT_REPORTED',
      prescriptionId: null,
      startedAt: new Date(),
      stoppedAt: null,
      notes: (notes || '').trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    profile.currentMedications.push(newMed);
    await profile.save();

    return res.status(201).json({
      success: true,
      message: 'Medication added successfully',
      medication: profile.currentMedications[profile.currentMedications.length - 1],
      currentMedications: profile.currentMedications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update status of a medication in patient profile (e.g. mark INACTIVE)
 * @route   PUT /api/profile/medications/:medId/status
 * @access  Private (Patient)
 */
const updateMyMedicationStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { medId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be ACTIVE or INACTIVE',
      });
    }

    const profile = await PatientProfile.findOne({ userId });
    if (!profile || !Array.isArray(profile.currentMedications)) {
      return res.status(404).json({
        success: false,
        message: 'Medication record not found.',
      });
    }

    let item = profile.currentMedications.id ? profile.currentMedications.id(medId) : null;
    if (!item && !isNaN(Number(medId))) {
      item = profile.currentMedications[Number(medId)];
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Medication record not found.',
      });
    }

    item.status = status;
    item.stoppedAt = status === 'INACTIVE' ? new Date() : null;
    item.updatedAt = new Date();

    await profile.save();

    return res.status(200).json({
      success: true,
      message: `Medication marked as ${status} successfully`,
      medication: item,
      currentMedications: profile.currentMedications,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  createOrUpdateMyProfile,
  checkUserProfileCompleted,
  getMyMedications,
  addPatientMedication,
  updateMyMedicationStatus,
};
