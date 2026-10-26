/**
 * Duplicate Check Service
 * Clinical Decision Support service for duplicate medication evaluation.
 * Phase 2 — Current Medication ↔ New Prescription Intelligence
 *
 * Checks for:
 * 1. Exact medicine duplication (same _id / same active ingredient / same generic name)
 * 2. Therapeutic group duplication (same non-empty duplicateGroup)
 *
 * Evaluates both:
 * - NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION
 * - CURRENT_MEDICATION_TO_NEW_PRESCRIPTION
 */

const Medicine = require('../../models/Medicine');
const PatientProfile = require('../../models/PatientProfile');
const { resolveMedicineForItem } = require('./interactionCheckService');

/**
 * Evaluate duplicate medications for all medicine pairs (New ↔ New and Current ↔ New).
 *
 * @param {Object} prescription - Populated/loaded prescription document from MongoDB
 * @param {Object} [options] - Optional context { patientProfile }
 * @returns {Promise<Object>} Duplicate check result block
 */
const checkPrescriptionDuplicates = async (prescription, options = {}) => {
  if (!prescription || !Array.isArray(prescription.medicines)) {
    return {
      status: 'unable_to_assess',
      pairsEvaluated: 0,
      duplicateCount: 0,
      findings: [],
      summaryNote: 'Prescription data unavailable for duplicate medication analysis.',
    };
  }

  const newItems = prescription.medicines;

  // Retrieve Patient Profile if available
  let patientProfile = options.patientProfile || prescription.patientProfile || null;
  if (!patientProfile && prescription.patientId) {
    patientProfile = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
  }

  const currentMedItems = (patientProfile && Array.isArray(patientProfile.currentMedications))
    ? patientProfile.currentMedications.filter((m) => m.status !== 'INACTIVE')
    : [];

  // Step 1: Resolve new items & current items in parallel
  const [resolvedNewMedicines, resolvedCurrentMedicines] = await Promise.all([
    Promise.all(newItems.map(resolveMedicineForItem)),
    Promise.all(currentMedItems.map(resolveMedicineForItem)),
  ]);

  const newResolvedList = newItems.map((item, idx) => ({
    item,
    medicine: resolvedNewMedicines[idx],
    displayName:
      (resolvedNewMedicines[idx] && resolvedNewMedicines[idx].genericName) ||
      item.genericName ||
      item.medicineName ||
      'Unknown Medicine',
    source: 'new',
  }));

  const currentResolvedList = currentMedItems.map((item, idx) => ({
    item,
    medicine: resolvedCurrentMedicines[idx],
    displayName:
      (resolvedCurrentMedicines[idx] && resolvedCurrentMedicines[idx].genericName) ||
      item.name ||
      item.genericName ||
      'Unknown Medicine',
    source: 'current',
  })).filter((c) => Boolean(c.medicine || (c.displayName && c.displayName !== 'Unknown Medicine')));

  // Step 2: Generate Pairs [medA, medB, sourceType]
  const pairs = [];

  // 2a. NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION pairs (N*(N-1)/2)
  for (let i = 0; i < newResolvedList.length; i++) {
    for (let j = i + 1; j < newResolvedList.length; j++) {
      pairs.push([newResolvedList[i], newResolvedList[j], 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION']);
    }
  }

  // 2b. CURRENT_MEDICATION_TO_NEW_PRESCRIPTION pairs
  for (const currItem of currentResolvedList) {
    for (const newItem of newResolvedList) {
      pairs.push([currItem, newItem, 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION']);
    }
  }

  if (pairs.length === 0) {
    return {
      status: 'completed',
      pairsEvaluated: 0,
      duplicateCount: 0,
      findings: [],
      summaryNote: 'Single medicine prescription and no current medications — no duplicate medication pairs to evaluate.',
    };
  }

  // Step 3: Build findings for each pair
  const findings = [];

  for (const [a, b, sourceType] of pairs) {
    const medA = a.medicine;
    const medB = b.medicine;

    if (medA && medA._id && medB && medB._id) {
      const isSameId = String(medA._id) === String(medB._id);
      const isSameName = (medA.genericName || '').trim().toLowerCase() === (medB.genericName || '').trim().toLowerCase();
      const groupA = (medA.duplicateGroup || '').trim().toUpperCase();
      const groupB = (medB.duplicateGroup || '').trim().toUpperCase();
      const isSameGroup = groupA.length > 0 && groupB.length > 0 && groupA === groupB;

      if (isSameId || isSameName) {
        findings.push({
          check: 'duplicate',
          sourceType,
          medicineA: { medicineId: String(medA._id), genericName: a.displayName, source: a.source },
          medicineB: { medicineId: String(medB._id), genericName: b.displayName, source: b.source },
          duplicateFound: true,
          status: 'duplicate_found',
          severity: 'HIGH',
          duplicateType: 'EXACT_MEDICINE',
          reason: `Duplicate entry detected between ${a.displayName} (${a.source}) and ${b.displayName} (${b.source}).`,
          potentialConcern: 'Therapeutic redundancy and accidental overdose risk from co-prescribing identical active ingredients.',
          clinicalConsideration: 'Review patient active therapy and consider adjusting or discontinuing redundant regimen.',
          evidenceSource: 'MedWise Master Medicine Database',
          recommendation: `Duplicate entry for ${a.displayName}. Review and remove redundant entry.`,
          message: `Duplicate medication detected: ${a.displayName} (${a.source}) and ${b.displayName} (${b.source}).`,
          doctorReviewRequired: true,
        });
      } else if (isSameGroup) {
        findings.push({
          check: 'duplicate',
          sourceType,
          medicineA: { medicineId: String(medA._id), genericName: a.displayName, source: a.source },
          medicineB: { medicineId: String(medB._id), genericName: b.displayName, source: b.source },
          duplicateFound: true,
          status: 'duplicate_found',
          severity: 'HIGH',
          duplicateType: 'DUPLICATE_GROUP',
          reason: `${a.displayName} (${a.source}) and ${b.displayName} (${b.source}) belong to the same therapeutic group (${medA.duplicateGroup}).`,
          potentialConcern: 'Therapeutic duplication within the same pharmacological class.',
          clinicalConsideration: 'Evaluate if dual agent therapy in the same class is clinically warranted.',
          evidenceSource: 'MedWise Master Medicine Database',
          recommendation: `Medicines from same therapeutic group (${medA.duplicateGroup}). Review for therapeutic duplication.`,
          message: `Therapeutic duplication detected: ${a.displayName} (${a.source}) and ${b.displayName} (${b.source}) share therapeutic group ${medA.duplicateGroup}.`,
          doctorReviewRequired: true,
        });
      } else {
        findings.push({
          check: 'duplicate',
          sourceType,
          medicineA: { medicineId: String(medA._id), genericName: a.displayName, source: a.source },
          medicineB: { medicineId: String(medB._id), genericName: b.displayName, source: b.source },
          duplicateFound: false,
          status: 'no_duplicate_found',
          severity: 'NONE',
          duplicateType: null,
          reason: '',
          potentialConcern: '',
          clinicalConsideration: '',
          evidenceSource: 'MedWise Master Medicine Database',
          recommendation: '',
          message: `No duplicate medication issue identified between ${a.displayName} (${a.source}) and ${b.displayName} (${b.source}).`,
          doctorReviewRequired: false,
        });
      }
    } else {
      findings.push({
        check: 'duplicate',
        sourceType,
        medicineA: {
          medicineId: medA && medA._id ? String(medA._id) : null,
          genericName: a.displayName,
          source: a.source,
        },
        medicineB: {
          medicineId: medB && medB._id ? String(medB._id) : null,
          genericName: b.displayName,
          source: b.source,
        },
        duplicateFound: false,
        status: 'unable_to_assess',
        severity: 'UNKNOWN',
        duplicateType: null,
        reason: '',
        potentialConcern: '',
        clinicalConsideration: '',
        evidenceSource: '',
        recommendation: '',
        message: `One or both medicines (${a.displayName}, ${b.displayName}) could not be resolved in the master database for duplicate evaluation.`,
        doctorReviewRequired: false,
      });
    }
  }

  const duplicateCount = findings.filter((f) => f.status === 'duplicate_found').length;

  let summaryNote = `Duplicate medication check completed. ${pairs.length} pair(s) evaluated, ${duplicateCount} duplicate(s) detected.`;

  if (duplicateCount > 0) {
    summaryNote += ' Duplicate medications detected — clinical review recommended.';
  } else {
    summaryNote += ' No duplicate medications detected in this prescription.';
  }

  return {
    status: duplicateCount > 0 ? 'duplicates_detected' : 'no_duplicates_found',
    pairsEvaluated: pairs.length,
    duplicateCount,
    findings,
    summaryNote,
  };
};

module.exports = {
  checkPrescriptionDuplicates,
};
