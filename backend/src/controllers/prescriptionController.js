const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const User = require('../models/User');

const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const PharmacistProfile = require('../models/PharmacistProfile');
const Consultation = require('../models/Consultation');
const MedwiseEngine = require('../services/medwise/medwiseEngine');
const { findOrCreateMedicineMaster } = require('../services/medicineMasterService');
const { resolveDoctorIdentity } = require('../utils/doctorIdentityResolver');

const STOP_WORDS = new Set(['hospital', 'clinic', 'center', 'pharmacy', 'health', 'healthcare', 'medical', 'care', 'inc', 'ltd', 'pvt', 'and', '&']);

/**
 * Compare facility names and addresses for workplace/organization relationship
 */
const areFacilitiesRelated = (facilityA, facilityB, addressA, addressB) => {
  if (!facilityA || !facilityB) return true;
  const normA = facilityA.trim().toLowerCase();
  const normB = facilityB.trim().toLowerCase();
  if (normA === normB) return true;

  const getTokens = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w) && isNaN(w));

  const tokensA = getTokens(normA);
  const tokensB = getTokens(normB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  } else if (tokensA.some((t) => tokensB.includes(t))) {
    return true;
  }

  // Check address/location relationship if addresses are available
  if (addressA && addressB) {
    const normAddrA = addressA.trim().toLowerCase();
    const normAddrB = addressB.trim().toLowerCase();
    if (normAddrA === normAddrB) return true;
    const tokensAddrA = getTokens(normAddrA);
    const tokensAddrB = getTokens(normAddrB);
    if (tokensAddrA.length > 0 && tokensAddrB.length > 0) {
      const matchCount = tokensAddrA.filter((t) => tokensAddrB.includes(t)).length;
      if (matchCount >= 2) return true;
    }
  }

  return false;
};

/**
 * Check if a pharmacist is authorized for a prescription based on workplace/facility context.
 */
const checkPharmacistFacilityAccess = async (pharmacistUserId, prescription, pharmacistProfileCache = null) => {
  const pharmacistProfile = pharmacistProfileCache || (await PharmacistProfile.findOne({ userId: pharmacistUserId }));
  if (!pharmacistProfile) return true;

  const pharmFacility = (pharmacistProfile.pharmacyHospitalName || pharmacistProfile.workplaceName || '').trim();
  const pharmAddress = (pharmacistProfile.pharmacyHospitalAddress || pharmacistProfile.workplaceAddress || '').trim();
  if (!pharmFacility && !pharmAddress) return true;

  // Historical access if this pharmacist was the dispenser or deliverer
  const dispenserId = prescription.pharmacistId?._id || prescription.pharmacistId;
  const delivererId = prescription.deliveredByPharmacistId?._id || prescription.deliveredByPharmacistId;
  const isDispenser = dispenserId && String(dispenserId) === String(pharmacistUserId);
  const isDeliverer = delivererId && String(delivererId) === String(pharmacistUserId);
  if (isDispenser || isDeliverer) {
    return true;
  }

  const rxFacility = (prescription.doctorHospitalClinicName || prescription.workplaceName || prescription.hospitalClinicName || '').trim();
  const rxAddress = (prescription.doctorHospitalClinicAddress || prescription.workplaceAddress || prescription.hospitalClinicAddress || '').trim();

  // If facilities match or are related by name/organization/address, authorized
  if (areFacilitiesRelated(pharmFacility, rxFacility, pharmAddress, rxAddress)) {
    return true;
  }

  // Facility security: If the prescription originated from a facility that has dedicated in-house registered pharmacists,
  // then only pharmacists belonging to that specific facility are authorized (protecting multi-facility boundaries).
  // However, if the prescribing clinic/facility has no in-house registered pharmacy/pharmacists in the network,
  // eligible licensed pharmacists can view and fulfill the prescription.
  if (rxFacility) {
    const allPharmProfiles = await PharmacistProfile.find({}, 'pharmacyHospitalName pharmacyHospitalAddress').lean();
    const hasDedicatedFacilityPharmacist = allPharmProfiles.some((p) => {
      const pFacility = (p.pharmacyHospitalName || '').trim();
      const pAddress = (p.pharmacyHospitalAddress || '').trim();
      return areFacilitiesRelated(pFacility, rxFacility, pAddress, rxAddress);
    });

    if (hasDedicatedFacilityPharmacist) {
      return false;
    }
  }

  return true;
};

/**
 * Format patient's 10-digit mobile number into unique Patient ID (PID)
 */
const formatPatientId = (mobile) => {
  if (!mobile) return 'PID-XXXXXXXXXX';
  const digits = String(mobile).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `PID-${last10}`;
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dob) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Generate unique human-readable prescription ID
 * Guarantees uniqueness by checking the database and retrying until a non-existent ID is found.
 */
const generatePrescriptionId = async () => {
  let isUnique = false;
  let rxId = '';
  let attempts = 0;

  while (!isUnique && attempts < 100) {
    attempts++;
    const num = Math.floor(100000 + Math.random() * 900000);
    rxId = `RX-${num}`;
    const exists = await Prescription.exists({ prescriptionId: rxId });
    if (!exists) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    rxId = `RX-${Date.now().toString().slice(-6)}`;
  }
  return rxId;
};

/**
 * @desc    Lookup patient by PID (doctor-authenticated)
 * @route   GET /api/prescriptions/patient-by-pid/:pid
 * @access  Private (Doctor)
 */
const lookupPatientByPid = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can lookup patient records for prescriptions',
      });
    }

    const { pid } = req.params;

    // Validate PID format
    if (!pid || !pid.startsWith('PID-') || pid.length !== 14) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Patient ID format. Expected: PID-XXXXXXXXXX (10 digits)',
      });
    }

    const mobileDigits = pid.substring(4); // strip "PID-"

    // Find patient profile by mobile number
    const patientProfile = await PatientProfile.findOne({ mobileNumber: mobileDigits });

    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: `No patient found with Patient ID: ${pid}`,
      });
    }

    // Fetch the patient user record
    const patientUser = await User.findById(patientProfile.userId).select('-password');

    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: `No active patient account found for ${pid}`,
      });
    }

    // Authorization: Check if doctor has an existing clinical relationship
    // (consultation or prescription) with this patient.
    // If no prior relationship, allow it — the first prescription creates the relationship.
    // This is standard clinical workflow: a doctor can prescribe for any registered patient.

    const patientAge = calculateAge(patientProfile.dateOfBirth);
    const bloodGroupVal = patientProfile.bloodGroup && patientProfile.bloodGroup !== 'Unknown' ? patientProfile.bloodGroup : '';

    return res.status(200).json({
      success: true,
      patient: {
        userId: patientUser._id,
        name: patientUser.name,
        pid: pid,
        age: patientAge,
        gender: patientProfile.gender || '',
        bloodGroup: bloodGroupVal,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get prescriptions for authenticated user (Doctor or Patient)
 * @route   GET /api/prescriptions
 * @access  Private (Doctor / Patient)
 */
const getPrescriptions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    let query = {};
    if (role === 'doctor') {
      query.doctorId = userId;
      if (req.query.patientId) {
        query.patientId = req.query.patientId;
      }
      if (req.query.patientPid) {
        query.patientPid = req.query.patientPid;
      }
    } else if (role === 'patient') {
      query.patientId = userId;
    } else if (role === 'pharmacist') {
      let allowedStatus = req.query && req.query.status
        ? req.query.status
        : { $in: ['Sent to Pharmacist', 'Doctor Approved', 'Approved', 'Dispensed', 'Delivered'] };

      if (typeof allowedStatus === 'string') {
        const trimmedStatus = allowedStatus.trim();
        const upper = trimmedStatus.toUpperCase();
        if (['TO_DISPENSE', 'TO DISPENSE', 'PENDING', 'SENT TO PHARMACIST', 'DOCTOR APPROVED', 'APPROVED'].includes(upper)) {
          allowedStatus = { $in: ['Sent to Pharmacist', 'Doctor Approved', 'Approved'] };
        } else {
          allowedStatus = trimmedStatus;
        }
      }

      query.status = allowedStatus;

      const pharmacistProfile = await PharmacistProfile.findOne({ userId: userId });
      const pharmFacility = (pharmacistProfile?.pharmacyHospitalName || pharmacistProfile?.workplaceName || '').trim();
      const pharmAddress = (pharmacistProfile?.pharmacyHospitalAddress || pharmacistProfile?.workplaceAddress || '').trim();

      let prescriptions = await Prescription.find(query)
        .populate('pharmacistId', 'name email')
        .populate('deliveredByPharmacistId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      if (pharmFacility || pharmAddress) {
        const allPharmProfiles = await PharmacistProfile.find({}, 'pharmacyHospitalName pharmacyHospitalAddress').lean();
        prescriptions = prescriptions.filter((rx) => {
          const isDispenser = rx.pharmacistId && String(rx.pharmacistId._id || rx.pharmacistId) === String(userId);
          const isDeliverer = rx.deliveredByPharmacistId && String(rx.deliveredByPharmacistId._id || rx.deliveredByPharmacistId) === String(userId);
          if (isDispenser || isDeliverer) return true;

          const rxFacility = (rx.doctorHospitalClinicName || rx.workplaceName || rx.hospitalClinicName || '').trim();
          const rxAddress = (rx.doctorHospitalClinicAddress || rx.workplaceAddress || rx.hospitalClinicAddress || '').trim();

          if (areFacilitiesRelated(pharmFacility, rxFacility, pharmAddress, rxAddress)) {
            return true;
          }

          if (rxFacility) {
            const hasDedicated = allPharmProfiles.some((p) => {
              const pFacility = (p.pharmacyHospitalName || '').trim();
              const pAddress = (p.pharmacyHospitalAddress || '').trim();
              return areFacilitiesRelated(pFacility, rxFacility, pAddress, rxAddress);
            });
            if (hasDedicated) {
              return false;
            }
          }

          return true;
        });
      }

      const resolvedPrescriptions = await resolveDoctorIdentity(prescriptions);
      return res.status(200).json({
        success: true,
        count: resolvedPrescriptions.length,
        prescriptions: resolvedPrescriptions,
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to prescription records',
      });
    }

    const prescriptions = await Prescription.find(query)
      .populate('pharmacistId', 'name email')
      .populate('deliveredByPharmacistId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const resolvedPrescriptions = await resolveDoctorIdentity(prescriptions);

    return res.status(200).json({
      success: true,
      count: resolvedPrescriptions.length,
      prescriptions: resolvedPrescriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single prescription by ID
 * @route   GET /api/prescriptions/:id
 * @access  Private (Doctor / Patient / Pharmacist)
 */
const getPrescriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const role = req.user.role;

    let prescription;
    const queryBuilder = id.startsWith('RX-')
      ? Prescription.findOne({ prescriptionId: id })
      : Prescription.findById(id);

    prescription = await queryBuilder
      .populate('consultationId')
      .populate('pharmacistId', 'name email')
      .populate('deliveredByPharmacistId', 'name email')
      .lean();

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Authorization check
    if (
      role === 'doctor' &&
      String(prescription.doctorId) !== String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this clinical prescription',
      });
    }

    if (
      role === 'patient' &&
      String(prescription.patientId) !== String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this clinical prescription',
      });
    }

    if (role === 'pharmacist') {
      const allowedStatuses = ['Sent to Pharmacist', 'Dispensed', 'Delivered'];
      if (!allowedStatuses.includes(prescription.status)) {
        return res.status(403).json({
          success: false,
          message: 'Pharmacists can only view prescriptions that have been sent to the pharmacy',
        });
      }

      const isFacilityAuthorized = await checkPharmacistFacilityAccess(userId, prescription);
      if (!isFacilityAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access: Prescription belongs to an unrelated pharmacy/hospital/clinic context',
        });
      }
    }

    if (prescription && prescription.patientId) {
      const patientProfile = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
      if (patientProfile) {
        prescription.patientProfile = patientProfile;
      }
    }

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new prescription (Doctor Only) — uses PID-based patient lookup
 * @route   POST /api/prescriptions
 * @access  Private (Doctor)
 */
const createPrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can author prescriptions',
      });
    }

    const {
      patientPid,
      patientId: patientIdFromBody,
      consultationId,
      clinicalDiagnosis,
      doctorNotes,
      medicines,
      followUpDate,
    } = req.body;

    // Determine patient — prefer PID-based lookup for security
    let patientUser = null;
    let patientProfile = null;

    if (patientPid && patientPid.startsWith('PID-') && patientPid.length === 14) {
      const mobileDigits = patientPid.substring(4);
      patientProfile = await PatientProfile.findOne({ mobileNumber: mobileDigits });
      if (patientProfile) {
        patientUser = await User.findById(patientProfile.userId);
      }
    }

    if (!patientUser && patientIdFromBody) {
      // Fallback: direct patientId (for backward compatibility with tests)
      patientUser = await User.findById(patientIdFromBody);
      if (patientUser) {
        patientProfile = await PatientProfile.findOne({ userId: patientUser._id });
      }
    }

    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient not found. Please verify the Patient ID (PID).',
      });
    }

    // ENFORCE CONSULTATION-FIRST WORKFLOW:
    // A completed consultation authored by the prescribing doctor for this patient must exist.
    let targetConsultation = null;
    if (consultationId) {
      targetConsultation = await Consultation.findById(consultationId);
      if (!targetConsultation) {
        return res.status(404).json({
          success: false,
          message: 'Linked clinical consultation record not found',
        });
      }
      if (targetConsultation.doctorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You can only create prescriptions for consultations authored by you',
        });
      }
      if (targetConsultation.patientId.toString() !== patientUser._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Consultation patient mismatch. Prescription patient must match consultation patient.',
        });
      }
      if (!['Completed', 'Follow-up Needed'].includes(targetConsultation.status)) {
        return res.status(400).json({
          success: false,
          message: 'A completed clinical consultation is required before creating a prescription.',
        });
      }
    } else {
      targetConsultation = await Consultation.findOne({
        doctorId: req.user._id,
        patientId: patientUser._id,
        status: { $in: ['Completed', 'Follow-up Needed'] },
      }).sort({ consultationDate: -1, createdAt: -1 });

      if (!targetConsultation) {
        return res.status(400).json({
          success: false,
          message: 'A completed clinical consultation is required before creating a prescription for this patient.',
        });
      }
    }

    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one medication to the prescription',
      });
    }

    // Validate medicine entries
    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i];
      if (!m.medicineName || !m.medicineName.trim()) {
        return res.status(400).json({
          success: false,
          message: `Medicine #${i + 1}: Name is required.`,
        });
      }
      if (!m.dosage || !m.dosage.trim()) {
        return res.status(400).json({
          success: false,
          message: `Medicine #${i + 1}: Dosage is required (e.g. 500mg).`,
        });
      }
      if (!m.frequency || !m.frequency.trim()) {
        return res.status(400).json({
          success: false,
          message: `Medicine #${i + 1}: Frequency is required (e.g. Twice daily).`,
        });
      }
      if (!m.duration || !m.duration.trim()) {
        return res.status(400).json({
          success: false,
          message: `Medicine #${i + 1}: Duration is required (e.g. 5 days).`,
        });
      }
    }

    // Fetch doctor profile for embedding credentials into the prescription
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    const docSpecialization = doctorProfile?.specialization || 'General Medicine';
    const docMedRegNum = doctorProfile?.medicalRegistrationNumber || '';
    const docQualification = doctorProfile?.qualification || '';
    const docHospitalName = doctorProfile?.hospitalClinicName || '';
    const docHospitalAddress = doctorProfile?.hospitalClinicAddress || '';
    const docProfContact = doctorProfile?.professionalContactNumber || '';

    // Compute patient demographics from backend (never trust frontend)
    const computedPid = formatPatientId(patientProfile?.mobileNumber);
    const patientAge = calculateAge(patientProfile?.dateOfBirth);
    const patientGender = patientProfile?.gender || '';
    const patientBloodGroup = patientProfile?.bloodGroup || 'Unknown';

    const prescriptionId = await generatePrescriptionId();

    // Resolve Medicine Master records for all medicines (reuses existing or dynamically creates new)
    const resolvedMedicines = [];
    for (const m of medicines) {
      const masterMed = await findOrCreateMedicineMaster({
        medicineId: m.medicineId,
        medicineName: m.medicineName,
        genericName: m.genericName,
        dosageForm: m.dosageForm,
        strength: m.strength,
        dosage: m.dosage,
        route: m.route,
      });

      resolvedMedicines.push({
        medicineId: masterMed ? masterMed._id : (m.medicineId || undefined),
        genericName: masterMed ? masterMed.genericName : (m.genericName ? m.genericName.trim() : m.medicineName.trim()),
        medicineName: m.medicineName.trim(),
        dosage: m.dosage.trim(),
        dosageForm: m.dosageForm ? m.dosageForm.trim() : (masterMed?.dosageForms?.[0] || undefined),
        strength: m.strength ? m.strength.trim() : m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        route: m.route ? m.route.trim() : (masterMed?.routes?.[0] || 'Oral'),
        instructions: m.instructions ? m.instructions.trim() : '',
      });
    }

    const newPrescription = await Prescription.create({
      prescriptionId,
      doctorId: req.user._id,
      doctorName: req.user.name,
      doctorSpecialization: docSpecialization,
      doctorMedicalRegistrationNumber: docMedRegNum,
      doctorQualification: docQualification,
      doctorHospitalClinicName: docHospitalName,
      doctorHospitalClinicAddress: docHospitalAddress,
      doctorProfessionalContactNumber: docProfContact,
      patientId: patientUser._id,
      patientName: patientUser.name,
      patientPid: computedPid,
      patientAge,
      patientGender,
      patientBloodGroup,
      consultationId: targetConsultation ? targetConsultation._id : (consultationId || undefined),
      followUpDate: followUpDate || undefined,
      clinicalDiagnosis: clinicalDiagnosis ? clinicalDiagnosis.trim() : '',
      doctorNotes: doctorNotes ? doctorNotes.trim() : '',
      medicines: resolvedMedicines,
      status: 'Draft',
      doctorDecision: 'Pending Decision',
    });

    // Bi-directional link: save prescriptionId on linked Consultation
    if (targetConsultation) {
      targetConsultation.prescriptionId = newPrescription._id;
      await targetConsultation.save();
    }

    const resolvedPrescription = await resolveDoctorIdentity(newPrescription);

    return res.status(201).json({
      success: true,
      message: 'Prescription drafted successfully',
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Simulate/Trigger MedWise Clinical Checks on a prescription
 * @route   POST /api/prescriptions/:id/check-medwise
 * @access  Private (Doctor)
 */
const checkWithMedwise = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can trigger MedWise clinical safety checks',
      });
    }

    const { id } = req.params;

    let prescription;
    if (id.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId: id });
    } else {
      prescription = await Prescription.findById(id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found',
      });
    }

    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to run safety checks on this prescription',
      });
    }

    // Execute full MedWise engine (dosage + interactions + duplicates + allergySafety + audit + overallRecommendation)
    const analysis = await MedwiseEngine.analyzeFullPrescription(prescription);
    const checkedAt = new Date();

    analysis.checkedAt = checkedAt;
    analysis.isOutdated = false;

    prescription.medwiseAnalysis = analysis;

    const recMessage = typeof analysis.overallRecommendation === 'object'
      ? analysis.overallRecommendation.message
      : String(analysis.overallRecommendation || '');

    const recStatus = typeof analysis.overallRecommendation === 'object'
      ? analysis.overallRecommendation.status
      : '';

    const recSeverity = typeof analysis.overallRecommendation === 'object'
      ? analysis.overallRecommendation.severity
      : '';

    let checkStatusSummary = 'Pending Review';
    if (recStatus === 'cleared') {
      checkStatusSummary = 'Cleared / Approved';
    } else if (recStatus === 'review_required' && recSeverity === 'critical') {
      checkStatusSummary = 'Critical Alerts';
    } else if (recStatus === 'review_required') {
      checkStatusSummary = 'Review Recommended';
    }

    prescription.medwiseChecks = {
      status: checkStatusSummary,
      dosageCheck: {
        passed: !analysis.checks.dosage?.some((d) => d.status === 'review_required'),
        message: analysis.checks.dosage?.[0]?.message || 'Dosage check evaluated.',
      },
      drugInteractionCheck: {
        passed: analysis.checks.interactions?.flaggedCount === 0,
        severity: analysis.checks.interactions?.flaggedCount > 0 ? 'Flagged' : 'None',
        message: analysis.checks.interactions?.summaryNote || 'Drug interaction check evaluated.',
      },
      duplicateMedicationCheck: {
        passed: analysis.checks.duplicates?.duplicateCount === 0,
        message: analysis.checks.duplicates?.summaryNote || 'Duplicate medication check evaluated.',
      },
      allergySafetyCheck: {
        passed: !analysis.checks.allergySafety?.findings?.some(
          (f) => f.status === 'allergy_risk' || f.status === 'safety_rule_flagged'
        ),
        message: analysis.checks.allergySafety?.summaryNote || 'Allergy safety check evaluated.',
      },
      prescriptionAudit: {
        passed: analysis.audit?.summary?.criticalFindings === 0,
        message: `Prescription audit completed with ${analysis.audit?.summary?.totalFindings || 0} finding(s).`,
      },
      overallRecommendation: recMessage,
      checkedAt,
      checkedBy: req.user.name,
    };

    if (prescription.status === 'Draft') {
      prescription.status = 'MedWise Review Required';
    }

    await prescription.save();

    const rxObj = prescription.toObject ? prescription.toObject() : prescription;
    if (rxObj && rxObj.patientId) {
      const pProf = await PatientProfile.findOne({ userId: rxObj.patientId }).lean();
      if (pProf) {
        rxObj.patientProfile = pProf;
      }
    }

    const resolvedPrescription = await resolveDoctorIdentity(rxObj);

    return res.status(200).json({
      success: true,
      message: 'MedWise clinical checks completed successfully',
      medwiseChecks: prescription.medwiseChecks,
      analysis,
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an unapproved prescription (Doctor Only)
 * @route   PUT /api/prescriptions/:id
 * @access  Private (Doctor)
 */
const updatePrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can modify prescriptions',
      });
    }

    const { id } = req.params;
    let prescription;
    if (id.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId: id });
    } else {
      prescription = await Prescription.findById(id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found',
      });
    }

    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this prescription',
      });
    }

    // Lifecycle check: Cannot modify a prescription that has already been dispensed or delivered
    if (['Dispensed', 'Delivered'].includes(prescription.status) || prescription.dispensedAt) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a prescription that has already been dispensed or delivered.',
      });
    }

    const { clinicalDiagnosis, doctorNotes, medicines, followUpDate } = req.body;

    if (medicines !== undefined) {
      if (!Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide at least one medication',
        });
      }

      for (let i = 0; i < medicines.length; i++) {
        const m = medicines[i];
        if (!m.medicineName || !m.medicineName.trim()) {
          return res.status(400).json({
            success: false,
            message: `Medicine #${i + 1}: Name is required.`,
          });
        }
        if (!m.dosage || !m.dosage.trim()) {
          return res.status(400).json({
            success: false,
            message: `Medicine #${i + 1}: Dosage is required (e.g. 500mg).`,
          });
        }
      }

      // Resolve Medicine Master records for all medicines (reuses existing or dynamically creates new)
      const resolvedMedicines = [];
      for (const m of medicines) {
        const masterMed = await findOrCreateMedicineMaster({
          medicineId: m.medicineId,
          medicineName: m.medicineName,
          genericName: m.genericName,
          dosageForm: m.dosageForm,
          strength: m.strength,
          dosage: m.dosage,
          route: m.route,
        });

        resolvedMedicines.push({
          medicineId: masterMed ? masterMed._id : (m.medicineId || undefined),
          genericName: masterMed ? masterMed.genericName : (m.genericName ? m.genericName.trim() : m.medicineName.trim()),
          medicineName: m.medicineName.trim(),
          dosage: m.dosage.trim(),
          dosageForm: m.dosageForm ? m.dosageForm.trim() : (masterMed?.dosageForms?.[0] || undefined),
          strength: m.strength ? m.strength.trim() : m.dosage.trim(),
          frequency: m.frequency ? m.frequency.trim() : '1-0-1',
          duration: m.duration ? m.duration.trim() : '5 days',
          route: m.route ? m.route.trim() : (masterMed?.routes?.[0] || 'Oral'),
          instructions: m.instructions ? m.instructions.trim() : '',
        });
      }

      // Replace medicines array completely (prevents duplicates)
      prescription.medicines = resolvedMedicines;
    }

    if (clinicalDiagnosis !== undefined) {
      prescription.clinicalDiagnosis = clinicalDiagnosis.trim();
    }
    if (doctorNotes !== undefined) {
      prescription.doctorNotes = doctorNotes.trim();
    }
    if (followUpDate !== undefined) {
      prescription.followUpDate = followUpDate || undefined;
    }

    // Reset doctor approval & decision state on edit
    if (prescription.status !== 'Draft') {
      prescription.status = 'MedWise Review Required';
    }
    prescription.doctorDecision = 'Pending Decision';

    // Mark previous MedWise analysis as outdated if it exists
    if (prescription.medwiseAnalysis) {
      prescription.medwiseAnalysis.isOutdated = true;
      prescription.markModified('medwiseAnalysis');
    }
    if (prescription.medwiseChecks) {
      prescription.medwiseChecks.status = 'Pending Review';
      prescription.markModified('medwiseChecks');
    }

    await prescription.save();

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      message: 'Prescription updated successfully',
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a prescription (Doctor Author Only)
 * @route   DELETE /api/prescriptions/:id
 * @access  Private (Doctor)
 */
const deletePrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can delete prescriptions',
      });
    }

    const { id } = req.params;
    let prescription;
    if (id.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId: id });
    } else {
      prescription = await Prescription.findById(id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Ownership check: Only authoring doctor can delete
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to delete another doctor\'s prescription',
      });
    }

    const rxObjectId = prescription._id;
    const rxPidStr = prescription.prescriptionId;

    // Remove bi-directional link on linked Consultation (do NOT delete Consultation!)
    await Consultation.updateMany(
      { prescriptionId: rxObjectId },
      { $set: { prescriptionId: null } }
    );

    // Safely remove any currentMedications entry on PatientProfile that was sourced from this prescription
    if (prescription.patientId) {
      const patientProfile = await PatientProfile.findOne({ userId: prescription.patientId });
      if (patientProfile && Array.isArray(patientProfile.currentMedications)) {
        const origLen = patientProfile.currentMedications.length;
        patientProfile.currentMedications = patientProfile.currentMedications.filter(
          (med) => !med.prescriptionId || String(med.prescriptionId) !== String(rxObjectId)
        );
        if (patientProfile.currentMedications.length !== origLen) {
          await patientProfile.save();
        }
      }
    }

    // Delete prescription document (includes embedded medwiseAnalysis & audit findings)
    await Prescription.deleteOne({ _id: rxObjectId });

    return res.status(200).json({
      success: true,
      message: `Prescription ${rxPidStr || ''} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Doctor approves a prescription
 * @route   PUT /api/prescriptions/:id/approve
 * @access  Private (Doctor)
 */
const approvePrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only the prescribing doctor can approve this prescription',
      });
    }

    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found',
      });
    }

    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to approve this prescription',
      });
    }

    if (!prescription.medwiseAnalysis) {
      return res.status(400).json({
        success: false,
        message: 'MedWise analysis required before approval. Please run CHECK WITH MEDWISE first.',
      });
    }

    if (prescription.medwiseAnalysis.isOutdated) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve prescription with outdated MedWise analysis. Please re-run MedWise analysis.',
      });
    }

    prescription.doctorDecision = 'Approved';
    prescription.approvedAt = new Date();
    prescription.status = 'Sent to Pharmacist';
    await prescription.save();

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      message: 'Prescription approved successfully and sent to pharmacist dispensing queue',
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pharmacist dispenses a prescription
 * @route   PUT /api/prescriptions/:id/dispense
 * @access  Private (Pharmacist)
 */
const dispensePrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacist') {
      return res.status(403).json({
        success: false,
        message: 'Only registered pharmacists can dispense prescriptions',
      });
    }

    const { id } = req.params;
    let prescription;
    if (id.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId: id });
    } else {
      prescription = await Prescription.findById(id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Facility authorization check
    const isFacilityAuthorized = await checkPharmacistFacilityAccess(req.user._id, prescription);
    if (!isFacilityAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access: Prescription belongs to an unrelated pharmacy/hospital/clinic context',
      });
    }

    // Strict status transition check
    if (!['Sent to Pharmacist', 'Doctor Approved', 'Approved'].includes(prescription.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot dispense prescription in '${prescription.status}' status. Must be in 'Sent to Pharmacist' status.`,
      });
    }

    prescription.status = 'Dispensed';
    prescription.pharmacistId = req.user._id;
    prescription.dispensedAt = new Date();
    await prescription.save();

    await prescription.populate('pharmacistId', 'name email');
    await prescription.populate('deliveredByPharmacistId', 'name email');

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      message: 'Prescription successfully dispensed',
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pharmacist marks a prescription as delivered
 * @route   PUT /api/prescriptions/:id/deliver
 * @access  Private (Pharmacist)
 */
const deliverPrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacist') {
      return res.status(403).json({
        success: false,
        message: 'Only registered pharmacists can mark prescriptions as delivered',
      });
    }

    const { id } = req.params;
    let prescription;
    if (id.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId: id });
    } else {
      prescription = await Prescription.findById(id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Facility authorization check
    const isFacilityAuthorized = await checkPharmacistFacilityAccess(req.user._id, prescription);
    if (!isFacilityAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access: Prescription belongs to an unrelated pharmacy/hospital/clinic context',
      });
    }

    // Strict status transition check
    if (prescription.status !== 'Dispensed') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark prescription as delivered in '${prescription.status}' status. Must be in 'Dispensed' status.`,
      });
    }

    prescription.status = 'Delivered';
    prescription.deliveredByPharmacistId = req.user._id;
    prescription.deliveredAt = new Date();
    await prescription.save();

    await syncDeliveredPrescriptionToMedicationHistory(prescription);

    await prescription.populate('pharmacistId', 'name email');
    await prescription.populate('deliveredByPharmacistId', 'name email');

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      message: 'Prescription marked as delivered successfully',
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync delivered prescription medicines to patient's medication history idempotently
 */
const syncDeliveredPrescriptionToMedicationHistory = async (prescription) => {
  try {
    if (!prescription || prescription.status !== 'Delivered' || !prescription.patientId) {
      return;
    }

    const getRawObjectId = (val) => {
      if (!val) return null;
      const str = typeof val === 'object' ? (val._id ? String(val._id) : String(val)) : String(val);
      return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
    };

    const patientId = getRawObjectId(prescription.patientId);
    const profileId = getRawObjectId(prescription.patientProfileId);

    const orConditions = [];
    if (profileId) {
      orConditions.push({ _id: profileId });
    }
    if (patientId) {
      orConditions.push({ userId: patientId });
      orConditions.push({ _id: patientId });
    }



    if (orConditions.length === 0) return;

    const patientProfile = await PatientProfile.findOne({ $or: orConditions });

    if (!patientProfile) {
      return;
    }

    // Query all legitimate non-test prescriptions for this patient sorted by createdAt ascending
    const patientPrescriptions = await Prescription.find({
      $or: [
        { patientProfileId: patientProfile._id },
        { patientId: patientProfile.userId },
        { patientId: patientProfile._id },
      ],
      prescriptionId: { $not: /^TEST-RX-/ },
      status: { $in: ['Delivered', 'Dispensed', 'Approved', 'Sent to Pharmacist', 'Review Recommended', 'Cleared'] }
    }).sort({ createdAt: 1 }).lean();

    const firstLegitimateRx = patientPrescriptions.length > 0 ? patientPrescriptions[0] : null;
    const isFirstRx = firstLegitimateRx && String(firstLegitimateRx._id) === String(prescription._id);
    const hasExistingRxMeds = (patientProfile.currentMedications || []).some(m => m.source === 'PRESCRIPTION');

    // ONLY establish/sync baseline if this is the patient's FIRST legitimate prescription
    // OR if patient profile currently has no prescription-derived medications
    if (!isFirstRx && hasExistingRxMeds) {
      // Later prescription — do NOT automatically convert into Current Medication!
      return;
    }

    if (!Array.isArray(patientProfile.currentMedications)) {
      patientProfile.currentMedications = [];
    }


    const medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];
    let updated = false;

    for (const med of medicines) {
      const medName = (med.genericName || med.medicineName || '').trim();
      if (!medName) continue;

      const existingIndex = patientProfile.currentMedications.findIndex((c) => {
        if (c.prescriptionId && String(c.prescriptionId) === String(prescription._id)) {
          const cGenName = (c.genericName || c.name || '').trim().toLowerCase();
          const mGenName = (med.genericName || med.medicineName || '').trim().toLowerCase();
          return cGenName && mGenName && cGenName === mGenName;
        }
        const cGenName = (c.genericName || '').trim().toLowerCase();
        const cName = (c.name || '').trim().toLowerCase();
        const mGenName = (med.genericName || '').trim().toLowerCase();
        const mName = (med.medicineName || '').trim().toLowerCase();

        const matchGen = Boolean(mGenName && ((cGenName && cGenName === mGenName) || (cName && cName === mGenName)));
        const matchName = Boolean(mName && ((cGenName && cGenName === mName) || (cName && cName === mName)));

        return matchGen || matchName;
      });


      if (existingIndex >= 0) {
        const existing = patientProfile.currentMedications[existingIndex];
        existing.status = 'ACTIVE';
        existing.stoppedAt = null;
        if (!existing.prescriptionId) {
          existing.prescriptionId = prescription._id;
        }
        if (!existing.source) {
          existing.source = 'PRESCRIPTION';
        }
        existing.updatedAt = new Date();
        updated = true;
      } else {
        patientProfile.currentMedications.push({
          medicineId: med.medicineId || null,
          name: med.medicineName || med.genericName,
          genericName: med.genericName || med.medicineName,
          strength: med.strength || med.dosage || '',
          dosage: med.dosage || med.dose || med.strength || '',
          frequency: med.frequency || '',
          duration: med.duration || '',
          route: med.route || '',
          instructions: med.instructions || med.directions || '',
          status: 'ACTIVE',
          source: 'PRESCRIPTION',
          prescriptionId: prescription._id,
          startedAt: prescription.deliveredAt || new Date(),
          stoppedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        updated = true;
      }

    }

    if (updated) {
      await patientProfile.save();
    }
  } catch (err) {
    console.error('Error syncing delivered prescription to medication history:', err.message);
  }
};

module.exports = {
  lookupPatientByPid,
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  checkWithMedwise,
  updatePrescription,
  deletePrescription,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
  syncDeliveredPrescriptionToMedicationHistory,
};