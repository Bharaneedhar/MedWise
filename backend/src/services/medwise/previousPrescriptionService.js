/**
 * Previous Prescription Service
 * Time-based medication tracking across all previous prescriptions of a patient.
 *
 * Global Business Rules:
 *  1. Determines treatmentStartDate + prescribedDuration = treatmentEndDate for each medicine.
 *  2. Evaluates active status at individual medicine level against analysis evaluation time.
 *  3. Only ACTIVE previous medicines participate in:
 *     ACTIVE PREVIOUS PRESCRIPTION → NEW PRESCRIPTION interaction analysis.
 *  4. Completely generic across all patients and medicines (no hardcoded names).
 */

const mongoose = require('mongoose');
const Prescription = require('../../models/Prescription');
const PatientProfile = require('../../models/PatientProfile');

/**
 * Robust duration parser returning duration in days.
 * Handles "5 days", "10 Days", "2 weeks", "1 month", "90 days", raw numbers, etc.
 *
 * @param {string|number} duration - Prescribed duration string or number
 * @returns {number} Duration in days (>= 0)
 */
const parseDurationDays = (duration) => {
  if (typeof duration === 'number') {
    return Math.max(0, Math.round(duration));
  }
  if (!duration || typeof duration !== 'string') {
    return 0;
  }
  const str = duration.trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/i);
  if (!match) {
    const numMatch = str.match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) return 0;
    const val = parseFloat(numMatch[1]);
    if (str.includes('month')) return Math.round(val * 30);
    if (str.includes('week')) return Math.round(val * 7);
    if (str.includes('year')) return Math.round(val * 365);
    return Math.round(val);
  }
  const val = parseFloat(match[1]);
  const unit = match[2];
  if (unit.startsWith('w')) return Math.round(val * 7);
  if (unit.startsWith('m')) return Math.round(val * 30);
  if (unit.startsWith('y')) return Math.round(val * 365);
  // 'd', 'day', 'days' or unit-less number
  return Math.round(val);
};

/**
 * Calculate treatment date range and determine whether an individual medicine
 * is active at evaluation time.
 *
 * @param {Object} item - Medicine item
 * @param {Object} [prescription] - Parent prescription
 * @param {Date|string|number} [evaluationTime] - MedWise analysis time
 * @returns {{ isActive: boolean, startDate: Date|null, endDate: Date|null, durationDays: number, prescribedDuration: string }}
 */
const calculateMedicineActiveStatus = (item, prescription = {}, evaluationTime = new Date()) => {
  const rawStart =
    (item && (
      item.treatmentStartDate ||
      item.startDate ||
      item.startedAt ||
      item.createdAt
    )) ||
    (prescription && (
      prescription.treatmentStartDate ||
      prescription.prescriptionDate ||
      prescription.deliveredAt ||
      prescription.dispensedAt ||
      prescription.approvedAt ||
      prescription.createdAt
    ));

  const startDate = rawStart ? new Date(rawStart) : null;
  const durationStr = (item && (item.duration || item.prescribedDuration)) || '';
  const durationDays = parseDurationDays(durationStr);

  if (!startDate || isNaN(startDate.getTime()) || durationDays <= 0) {
    return {
      isActive: false,
      startDate,
      endDate: null,
      durationDays: 0,
      prescribedDuration: durationStr,
    };
  }

  // treatmentStartDate + prescribedDuration = treatmentEndDate
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const evalDate = evaluationTime instanceof Date ? evaluationTime : new Date(evaluationTime);

  const isActive = endDate.getTime() >= evalDate.getTime();

  return {
    isActive,
    startDate,
    endDate,
    durationDays,
    prescribedDuration: durationStr,
  };
};

/**
 * Query and retrieve active medications across ALL previous prescriptions
 * belonging strictly to the SAME patient.
 *
 * @param {Object} prescription - Current prescription being analyzed
 * @param {Object} [options] - Optional options { evaluationTime, patientProfile, patientId }
 * @returns {Promise<Array>} Array of active previous medication objects
 */
const getActivePreviousMedications = async (prescription, options = {}) => {
  const evalTime =
    options.evaluationTime ||
    options.checkedAt ||
    (prescription && prescription.medwiseChecks && prescription.medwiseChecks.checkedAt) ||
    new Date();

  let patientProfile = options.patientProfile || (prescription && prescription.patientProfile) || null;
  const rawPatientId =
    (prescription && prescription.patientId) ||
    (patientProfile && patientProfile.userId) ||
    options.patientId ||
    null;
  const rawProfileId =
    (prescription && prescription.patientProfileId) ||
    (patientProfile && patientProfile._id) ||
    options.patientProfileId ||
    null;

  // Fallback for purely mock in-memory patientProfile in unit tests
  if (!rawPatientId && !rawProfileId) {
    if (patientProfile && Array.isArray(patientProfile.currentMedications)) {
      return patientProfile.currentMedications.filter((m) => m.status !== 'INACTIVE');
    }
    return [];
  }

  // Load patientProfile if needed to gather all aliases/IDs
  if (!patientProfile && rawPatientId) {
    try {
      const getRawObjectId = (val) => {
        if (!val) return null;
        const str = typeof val === 'object' ? (val._id ? String(val._id) : String(val)) : String(val);
        return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
      };
      const validId = getRawObjectId(rawPatientId);
      if (validId) {
        patientProfile = await PatientProfile.findOne({
          $or: [{ userId: validId }, { _id: validId }],
        }).lean();
      }
    } catch (e) {
      // Ignore lookup error
    }
  }

  const patientIds = new Set();
  const profileIds = new Set();
  const pids = new Set();

  if (rawPatientId) patientIds.add(String(rawPatientId));
  if (rawProfileId) profileIds.add(String(rawProfileId));
  if (patientProfile) {
    if (patientProfile.userId) patientIds.add(String(patientProfile.userId));
    if (patientProfile._id) profileIds.add(String(patientProfile._id));
    if (patientProfile.pid) pids.add(String(patientProfile.pid));
  }
  if (prescription && prescription.patientPid) {
    pids.add(String(prescription.patientPid));
  }

  // Strict patient-only filter
  const orConditions = [];
  for (const id of patientIds) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      orConditions.push({ patientId: new mongoose.Types.ObjectId(id) });
    } else {
      orConditions.push({ patientId: id });
    }
  }
  for (const id of profileIds) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      orConditions.push({ patientProfileId: new mongoose.Types.ObjectId(id) });
    } else {
      orConditions.push({ patientProfileId: id });
    }
  }
  for (const pid of pids) {
    orConditions.push({ patientPid: pid });
  }

  if (orConditions.length === 0) {
    if (patientProfile && Array.isArray(patientProfile.currentMedications)) {
      return patientProfile.currentMedications.filter((m) => m.status !== 'INACTIVE');
    }
    return [];
  }

  const query = {
    $or: orConditions,
    status: { $nin: ['Cancelled', 'Rejected'] },
  };

  const currentRxId = prescription && prescription._id ? String(prescription._id) : null;
  const currentRxCode = prescription && prescription.prescriptionId ? String(prescription.prescriptionId) : null;

  if (currentRxId && mongoose.Types.ObjectId.isValid(currentRxId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(currentRxId) };
  }
  if (currentRxCode) {
    query.prescriptionId = { $ne: currentRxCode };
  }

  // Exclude prescriptions created strictly after the current prescription
  if (prescription && prescription.createdAt) {
    query.createdAt = { $lte: new Date(prescription.createdAt) };
  }

  let previousRxs = [];
  try {
    previousRxs = await Prescription.find(query)
      .sort({ createdAt: 1 })
      .lean();
  } catch (err) {
    console.error('Error fetching previous prescriptions:', err);
    previousRxs = [];
  }

  // Filter out current prescription if matched by other properties
  if (currentRxId || currentRxCode) {
    previousRxs = previousRxs.filter((rx) => {
      if (currentRxId && String(rx._id) === currentRxId) return false;
      if (currentRxCode && rx.prescriptionId === currentRxCode) return false;
      return true;
    });
  }

  const inactiveKeys = new Set();
  if (patientProfile && Array.isArray(patientProfile.currentMedications)) {
    for (const profileMed of patientProfile.currentMedications) {
      if (profileMed.status === 'INACTIVE') {
        const key = (profileMed.genericName || profileMed.name || '').trim().toLowerCase();
        if (key) inactiveKeys.add(key);
      }
    }
  }

  const seenCanonicalMeds = new Map();

  // Evaluate each medicine individually across all previous prescriptions
  for (const prevRx of previousRxs) {
    if (!Array.isArray(prevRx.medicines)) continue;

    for (const med of prevRx.medicines) {
      const canonicalKey = (med.genericName || med.medicineName || '').trim().toLowerCase();
      if (!canonicalKey || inactiveKeys.has(canonicalKey)) continue;

      const activeStatus = calculateMedicineActiveStatus(med, prevRx, evalTime);

      if (activeStatus.isActive) {
        // If medicine was re-prescribed, retain the one with later treatment end date
        const existing = seenCanonicalMeds.get(canonicalKey);
        if (!existing || (activeStatus.endDate && (!existing.treatmentEndDate || activeStatus.endDate > existing.treatmentEndDate))) {
          seenCanonicalMeds.set(canonicalKey, {
            medicineId: med.medicineId || null,
            name: med.medicineName || med.genericName,
            genericName: med.genericName || med.medicineName,
            dosage: med.dosage || '',
            frequency: med.frequency || '',
            duration: med.duration || '',
            route: med.route || 'Oral',
            instructions: med.instructions || '',
            prescriptionId: prevRx._id,
            prescriptionCode: prevRx.prescriptionId,
            treatmentStartDate: activeStatus.startDate,
            treatmentEndDate: activeStatus.endDate,
            durationDays: activeStatus.durationDays,
            source: 'PRESCRIPTION',
            status: 'ACTIVE',
          });
        }
      } else {
        // If this medicine has expired in this prescription, check if we previously recorded an active one;
        // if no active re-prescription exists, it is not active.
        // If an earlier prescription was active but a later one expired, the earlier one naturally expired too.
      }
    }
  }

  const activePreviousMedicines = Array.from(seenCanonicalMeds.values());

  // Also include any patient-reported medications from PatientProfile if they exist and are active
  if (patientProfile && Array.isArray(patientProfile.currentMedications)) {
    for (const profileMed of patientProfile.currentMedications) {
      if (profileMed.status === 'INACTIVE') continue;
      // If it already originated from an evaluated prescription, skip
      if (profileMed.prescriptionId && previousRxs.length > 0) continue;

      const canonicalKey = (profileMed.genericName || profileMed.name || '').trim().toLowerCase();
      if (!canonicalKey || seenCanonicalMeds.has(canonicalKey)) continue;

      if (profileMed.duration && profileMed.startedAt) {
        const activeStatus = calculateMedicineActiveStatus(profileMed, {}, evalTime);
        if (!activeStatus.isActive) continue;
      }

      activePreviousMedicines.push(profileMed);
      seenCanonicalMeds.set(canonicalKey, profileMed);
    }
  }

  return activePreviousMedicines;
};

module.exports = {
  parseDurationDays,
  calculateMedicineActiveStatus,
  getActivePreviousMedications,
};
