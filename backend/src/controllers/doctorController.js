const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const { resolveDoctorIdentity } = require('../utils/doctorIdentityResolver');

/**
 * Calculate age from Date of Birth
 */
const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return '';
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Format patient's 10-digit mobile number into unique Patient ID (PID)
 */
const formatPatientId = (mobile) => {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `PID-${last10}`;
};

/**
 * @desc    Get doctor dashboard summary stats & today's consultations
 * @route   GET /api/doctor/dashboard
 * @access  Private (Doctor)
 */
const getDoctorDashboard = async (req, res, next) => {
  try {
    const doctorId = req.user._id;

    // Today's start and end timestamps
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Today's Consultations
    const rawTodayConsultations = await Consultation.find({
      doctorId,
      consultationDate: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ consultationDate: 1 })
      .lean();

    const todayConsultations = await resolveDoctorIdentity(rawTodayConsultations);

    // 2. Distinct Patient IDs associated with this doctor
    const [consultationPatients, prescriptionPatients, appointmentPatients] = await Promise.all([
      Consultation.distinct('patientId', { doctorId }),
      Prescription.distinct('patientId', { doctorId }),
      Appointment.distinct('patientId', { doctorId }),
    ]);

    const allPatientIds = Array.from(
      new Set([
        ...consultationPatients.map(String),
        ...prescriptionPatients.map(String),
        ...appointmentPatients.map(String),
      ])
    );

    // 3. Today's Prescriptions Count
    const todayPrescriptionsCount = await Prescription.countDocuments({
      doctorId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 4. Pending MedWise Reviews Count
    const pendingMedwiseReviewsCount = await Prescription.countDocuments({
      doctorId,
      status: { $in: ['Draft', 'MedWise Review Required', 'Review Recommended'] },
    });

    return res.status(200).json({
      success: true,
      stats: {
        todayConsultationsCount: todayConsultations.length,
        activePatientsCount: allPatientIds.length,
        todayPrescriptionsCount,
        pendingMedwiseReviewsCount,
      },
      todayConsultations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patients associated with the doctor (with search support)
 * @route   GET /api/doctor/patients
 * @access  Private (Doctor)
 */
const getDoctorPatients = async (req, res, next) => {
  try {
    const doctorId = req.user._id;
    const { search, includePatientId, patientId } = req.query;
    const targetIncludeId = includePatientId || patientId;

    // 1. Find all patients who have an established relationship with this doctor
    const [consultationPatients, prescriptionPatients, appointmentPatients] = await Promise.all([
      Consultation.distinct('patientId', { doctorId }),
      Prescription.distinct('patientId', { doctorId }),
      Appointment.distinct('patientId', { doctorId }),
    ]);

    let associatedPatientIds = Array.from(
      new Set([
        ...consultationPatients.map(String),
        ...prescriptionPatients.map(String),
        ...appointmentPatients.map(String),
      ])
    );

    if (targetIncludeId) {
      associatedPatientIds.push(String(targetIncludeId));
      associatedPatientIds = Array.from(new Set(associatedPatientIds));
    }

    // Also support finding any patient if searching by PID / Mobile / Name to establish new care
    let userQuery = { role: 'patient' };

    if (search && search.trim()) {
      const searchClean = search.trim();
      const mobileSearch = searchClean.replace(/\D/g, '');

      userQuery.$or = [
        { name: { $regex: searchClean, $options: 'i' } },
        { email: { $regex: searchClean, $options: 'i' } },
      ];

      if (mobileSearch) {
        const matchingProfiles = await PatientProfile.find({
          mobileNumber: { $regex: mobileSearch, $options: 'i' },
        }).select('userId');
        const profileUserIds = matchingProfiles.map((p) => p.userId);
        userQuery.$or.push({ _id: { $in: profileUserIds } });
      }
    } else {
      // Default: show associated patients
      userQuery._id = { $in: associatedPatientIds };
    }

    const patientUsers = await User.find(userQuery).select('-password').lean();

    // Fetch corresponding profiles, latest consultations, and active prescriptions
    const patientCards = await Promise.all(
      patientUsers.map(async (pUser) => {
        const [profile, lastConsultation, lastPrescription] = await Promise.all([
          PatientProfile.findOne({ userId: pUser._id }).lean(),
          Consultation.findOne({ patientId: pUser._id, doctorId })
            .sort({ consultationDate: -1 })
            .lean(),
          Prescription.findOne({ patientId: pUser._id, doctorId })
            .sort({ createdAt: -1 })
            .lean(),
        ]);

        const mobile = profile?.mobileNumber || '';
        const pid = formatPatientId(mobile);

        return {
          patientId: pUser._id,
          name: pUser.name,
          email: pUser.email,
          mobileNumber: mobile,
          pid,
          age: profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : '',
          gender: profile?.gender || '',
          bloodGroup: profile?.bloodGroup || '',
          activeMedicationsCount: Array.isArray(profile?.currentMedications)
            ? profile.currentMedications.length
            : 0,
          medicalConditionsCount: Array.isArray(profile?.medicalConditions)
            ? profile.medicalConditions.length
            : 0,
          lastConsultationDate: lastConsultation?.consultationDate || null,
          lastConsultationReason: lastConsultation?.reasonForVisit || null,
          prescriptionStatus: lastPrescription?.status || 'No active prescription',
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: patientCards.length,
      patients: patientCards,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get complete longitudinal clinical record for a patient
 * @route   GET /api/doctor/patients/:patientId
 * @access  Private (Doctor)
 */
const getPatientClinicalRecord = async (req, res, next) => {
  try {
    const doctorId = req.user._id;
    const { patientId } = req.params;

    const patientUser = await User.findById(patientId).select('-password').lean();
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient clinical record not found',
      });
    }

    const [profile, rawConsultations, rawPrescriptions] = await Promise.all([
      PatientProfile.findOne({ userId: patientId }).lean(),
      Consultation.find({ patientId, doctorId }).sort({ consultationDate: -1, createdAt: -1 }).lean(),
      Prescription.find({ patientId, doctorId }).sort({ createdAt: -1 }).lean(),
    ]);

    const consultations = await resolveDoctorIdentity(rawConsultations);
    const prescriptions = await resolveDoctorIdentity(rawPrescriptions);

    const mobile = profile?.mobileNumber || '';
    const pid = formatPatientId(mobile);

    const longitudinalRecord = {
      patientId: patientUser._id,
      name: patientUser.name,
      email: patientUser.email,
      mobileNumber: mobile,
      pid,
      age: profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : '',
      dateOfBirth: profile?.dateOfBirth || null,
      gender: profile?.gender || '',
      profilePhoto: profile?.profilePhoto || '',
      address: profile?.address || {},
      // Health Information
      bloodGroup: profile?.bloodGroup || '',
      medicalConditions: profile?.medicalConditions || [],
      currentMedications: profile?.currentMedications || [],
      previousSurgeries: profile?.previousSurgeries || [],
      hasNoKnownAllergies: profile?.hasNoKnownAllergies === true,
      allergies: profile?.allergies || [],
      profileCompleted: profile?.profileCompleted === true,
      // Emergency Contact (for reference in safety critical events)
      emergencyContact: profile?.emergencyContact || {},
      // Longitudinal histories
      consultations,
      prescriptions,
    };

    return res.status(200).json({
      success: true,
      record: longitudinalRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get doctor clinical overview analytics & aggregate metrics
 * @route   GET /api/doctor/clinical-overview
 * @access  Private (Doctor)
 */
const getDoctorClinicalOverview = async (req, res, next) => {
  try {
    const doctorId = req.user._id;

    // 1. All consultations by this doctor
    const totalConsultations = await Consultation.countDocuments({ doctorId });

    // 2. Distinct patients
    const [consultationPatients, prescriptionPatients] = await Promise.all([
      Consultation.distinct('patientId', { doctorId }),
      Prescription.distinct('patientId', { doctorId }),
    ]);
    const totalPatients = Array.from(
      new Set([...consultationPatients.map(String), ...prescriptionPatients.map(String)])
    ).length;

    // 3. Prescriptions counts by status
    const [totalPrescriptions, approvedPrescriptions, pendingReviews, sentToPharmacy, dispensed] =
      await Promise.all([
        Prescription.countDocuments({ doctorId }),
        Prescription.countDocuments({ doctorId, status: 'Approved' }),
        Prescription.countDocuments({
          doctorId,
          status: { $in: ['Draft', 'MedWise Review Required', 'Review Recommended'] },
        }),
        Prescription.countDocuments({ doctorId, status: 'Sent to Pharmacist' }),
        Prescription.countDocuments({ doctorId, status: { $in: ['Dispensed', 'Delivered'] } }),
      ]);

    // 4. Recent consultations list
    const rawRecentConsultations = await Consultation.find({ doctorId })
      .sort({ consultationDate: -1 })
      .limit(5)
      .lean();

    // 5. Recent prescriptions list
    const rawRecentPrescriptions = await Prescription.find({ doctorId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentConsultations = await resolveDoctorIdentity(rawRecentConsultations);
    const recentPrescriptions = await resolveDoctorIdentity(rawRecentPrescriptions);

    return res.status(200).json({
      success: true,
      metrics: {
        totalPatients,
        totalConsultations,
        totalPrescriptions,
        approvedPrescriptions,
        pendingReviews,
        sentToPharmacy,
        dispensed,
      },
      recentConsultations,
      recentPrescriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get prescriptions grouped by MedWise Review categories
 * @route   GET /api/doctor/medwise-reviews
 * @access  Private (Doctor)
 */
const getDoctorMedwiseReviews = async (req, res, next) => {
  try {
    const doctorId = req.user._id;

    const rawPrescriptions = await Prescription.find({ doctorId })
      .sort({ createdAt: -1 })
      .lean();

    const prescriptions = await resolveDoctorIdentity(rawPrescriptions);

    const pendingReview = [];
    const reviewRecommended = [];
    const criticalAlerts = [];
    const clearedApproved = [];

    prescriptions.forEach((rx) => {
      const medwiseStatus = rx.medwiseChecks?.status || 'Pending Review';
      if (rx.status === 'Approved' || medwiseStatus === 'Cleared / Approved') {
        clearedApproved.push(rx);
      } else if (medwiseStatus === 'Critical Alerts') {
        criticalAlerts.push(rx);
      } else if (medwiseStatus === 'Review Recommended') {
        reviewRecommended.push(rx);
      } else {
        pendingReview.push(rx);
      }
    });

    return res.status(200).json({
      success: true,
      summary: {
        total: prescriptions.length,
        pendingCount: pendingReview.length,
        recommendedCount: reviewRecommended.length,
        criticalCount: criticalAlerts.length,
        approvedCount: clearedApproved.length,
      },
      categories: {
        pendingReview,
        reviewRecommended,
        criticalAlerts,
        clearedApproved,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update patient clinical profile (Doctor-authenticated)
 * @route   PUT /api/doctor/patients/:patientId/clinical-profile
 * @access  Private (Doctor)
 */
const updatePatientClinicalProfile = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const {
      dateOfBirth,
      gender,
      bloodGroup,
      hasNoKnownAllergies,
      allergies,
      medicalConditions,
      currentMedications,
    } = req.body;

    // Find PatientProfile by userId or profile _id
    let patientProfile = await PatientProfile.findOne({
      $or: [{ userId: patientId }, { _id: patientId }],
    });

    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile record not found in system',
      });
    }

    // Update supplied clinical fields
    if (dateOfBirth) {
      patientProfile.dateOfBirth = new Date(dateOfBirth);
    }
    if (gender) {
      patientProfile.gender = gender;
    }
    if (bloodGroup !== undefined) {
      patientProfile.bloodGroup = bloodGroup;
    }
    if (hasNoKnownAllergies !== undefined) {
      patientProfile.hasNoKnownAllergies = Boolean(hasNoKnownAllergies);
    }
    if (Array.isArray(allergies)) {
      patientProfile.allergies = allergies
        .map((a) => (typeof a === 'string' ? a.trim() : (a && a.name) || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(medicalConditions)) {
      patientProfile.medicalConditions = medicalConditions;
    }
    if (Array.isArray(currentMedications)) {
      patientProfile.currentMedications = currentMedications;
    }

    // Always mark profile as completed if DOB & gender are set
    if (patientProfile.dateOfBirth && patientProfile.gender) {
      patientProfile.profileCompleted = true;
    }

    await patientProfile.save();

    // Sync computed fields to all prescriptions belonging to this patient
    const patientAge = calculateAge(patientProfile.dateOfBirth);
    await Prescription.updateMany(
      { patientId: patientProfile.userId },
      {
        $set: {
          patientAge,
          patientGender: patientProfile.gender,
          patientBloodGroup: patientProfile.bloodGroup,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Patient clinical profile updated successfully in single source of truth',
      patientProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Doctor updates status of a patient's medication (e.g. mark INACTIVE during consultation)
 * @route   PUT /api/doctor/patients/:patientId/medications/:medId/status
 * @access  Private (Doctor)
 */
const updatePatientMedicationStatus = async (req, res, next) => {
  try {
    const doctorId = req.user._id;
    const { patientId, medId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be ACTIVE or INACTIVE',
      });
    }

    // Verify doctor-patient relationship authorization
    const [hasConsultation, hasPrescription] = await Promise.all([
      Consultation.exists({ doctorId, patientId }),
      Prescription.exists({ doctorId, patientId }),
    ]);

    if (!hasConsultation && !hasPrescription) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access: You do not have an established clinical relationship with this patient',
      });
    }

    const patientProfile = await PatientProfile.findOne({ userId: patientId });
    if (!patientProfile || !Array.isArray(patientProfile.currentMedications)) {
      return res.status(404).json({
        success: false,
        message: 'Patient medication record not found.',
      });
    }

    let item = patientProfile.currentMedications.id ? patientProfile.currentMedications.id(medId) : null;
    if (!item && !isNaN(Number(medId))) {
      item = patientProfile.currentMedications[Number(medId)];
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

    await patientProfile.save();

    return res.status(200).json({
      success: true,
      message: `Medication marked as ${status} successfully`,
      medication: item,
      currentMedications: patientProfile.currentMedications,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDoctorDashboard,
  getDoctorPatients,
  getPatientClinicalRecord,
  getDoctorClinicalOverview,
  getDoctorMedwiseReviews,
  updatePatientClinicalProfile,
  updatePatientMedicationStatus,
};
