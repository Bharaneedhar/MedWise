/**
 * Interaction Check Service
 * Clinical Decision Support service for drug-drug interaction evaluation.
 * Phase 2 — Current Medication ↔ New Prescription Intelligence
 *
 * Uses ONLY verified records from the DrugInteraction MongoDB collection.
 * Does NOT fabricate interactions or infer interactions from external sources.
 *
 * Algorithm:
 *  1. Resolve medicines for new prescription items and patient profile current medications.
 *  2. Generate all NEW ↔ NEW pairs (N*(N-1)/2) and CURRENT ↔ NEW pairs.
 *  3. Build canonical interactionPairKey for each pair (sorted id concatenation).
 *  4. Batch query DrugInteraction collection for matching keys.
 *  5. Return structured findings per pair — with sourceType ('CURRENT_MEDICATION_TO_NEW_PRESCRIPTION' or 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION').
 */

const Medicine = require('../../models/Medicine');
const PatientProfile = require('../../models/PatientProfile');
const DrugInteraction = require('../../models/DrugInteraction');
const { getActivePreviousMedications } = require('./previousPrescriptionService');

/**
 * Escape special regex characters for safe use in RegExp
 */
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

/**
 * Build an order-independent canonical pair key matching the DrugInteraction model's hook
 */
const buildPairKey = (idA, idB) => {
  const parseKey = (val) => {
    if (!val) return '';
    if (typeof val === 'object') {
      return String(val.medicineId || val._id || val.genericName || val.name || '');
    }
    return String(val);
  };
  const sorted = [parseKey(idA), parseKey(idB)].sort();
  return sorted[0] + '_' + sorted[1];
};

/**
 * Resolve a medicine document from a prescription item or current medication object.
 * Prefers ObjectId lookup (medicineId), falls back to name search.
 * Returns null if medicine is not found in the master database.
 */
const resolveMedicineForItem = async (item) => {
  if (!item) return null;
  if (item.medicineId) {
    const found = await Medicine.findById(item.medicineId).lean();
    if (found) return found;
  }
  const searchName = (item.genericName || item.medicineName || item.name || '').trim();
  if (!searchName) return null;
  const escaped = escapeRegex(searchName);
  return Medicine.findOne({
    isActive: true,
    $or: [
      { genericName: { $regex: new RegExp('^' + escaped + '$', 'i') } },
      { brandNames: { $regex: new RegExp('^' + escaped + '$', 'i') } },
    ],
  }).lean();
};

/**
 * Evaluate drug-drug interactions for all medicine pairs (New ↔ New and Current ↔ New).
 *
 * @param {Object} prescription - Populated/loaded prescription document from MongoDB
 * @param {Object} [options] - Optional context { patientProfile }
 * @returns {Promise<Object>} Interaction check result block
 */
const checkPrescriptionInteractions = async (prescriptionInput, optionsInput = {}, extraOptions = {}) => {
  let prescription = Array.isArray(prescriptionInput) ? { medicines: prescriptionInput } : (prescriptionInput || {});
  let options = {};
  if (optionsInput && (optionsInput.currentMedications || optionsInput.userId || optionsInput._id)) {
    options = { patientProfile: optionsInput, ...extraOptions };
  } else {
    options = { ...optionsInput, ...extraOptions };
  }

  if (options.prescription) {
    prescription = { ...(options.prescription.toObject ? options.prescription.toObject() : options.prescription), ...prescription };
  }

  if (!prescription || !Array.isArray(prescription.medicines)) {
    return {
      status: 'unable_to_assess',
      pairsEvaluated: 0,
      currentPrescriptionPairsCount: 0,
      activePreviousPairsCount: 0,
      flaggedCount: 0,
      findings: [],
      summaryNote: 'Prescription data unavailable for interaction analysis.',
    };
  }

  const newItems = prescription.medicines;

  // Retrieve Patient Profile if available
  let patientProfile = options.patientProfile || prescription.patientProfile || null;
  if (!patientProfile && prescription.patientId) {
    patientProfile = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
  }

  // Step 0: Dynamically evaluate ACTIVE previous medications across ALL previous prescriptions
  // for this SAME patient based on treatmentStartDate + duration >= evaluationTime
  const activePreviousMedItems = await getActivePreviousMedications(prescription, {
    ...options,
    patientProfile,
  });

  // Step 1: Resolve new items & active previous items in parallel
  const [resolvedNewMedicines, resolvedCurrentMedicines] = await Promise.all([
    Promise.all(newItems.map(resolveMedicineForItem)),
    Promise.all(activePreviousMedItems.map(resolveMedicineForItem)),
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

  const currentResolvedList = activePreviousMedItems.map((item, idx) => ({
    item,
    medicine: resolvedCurrentMedicines[idx],
    displayName:
      (resolvedCurrentMedicines[idx] && resolvedCurrentMedicines[idx].genericName) ||
      item.genericName ||
      item.name ||
      item.medicineName ||
      'Unknown Medicine',
    source: 'current',
  })).filter((c) => Boolean(c.medicine || (c.displayName && c.displayName !== 'Unknown Medicine')));

  // Step 2: Generate Pairs
  // Pair tuple: [medA, medB, sourceType]
  const pairs = [];

  // 2a. SECTION A: NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION pairs (N*(N-1)/2)
  for (let i = 0; i < newResolvedList.length; i++) {
    for (let j = i + 1; j < newResolvedList.length; j++) {
      const medA = newResolvedList[i];
      const medB = newResolvedList[j];
      const idA = medA.medicine?._id ? String(medA.medicine._id) : null;
      const idB = medB.medicine?._id ? String(medB.medicine._id) : null;
      if (idA && idB && idA === idB) continue;
      if (medA.displayName.trim().toLowerCase() === medB.displayName.trim().toLowerCase()) continue;

      pairs.push([medA, medB, 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION']);
    }
  }

  // 2b. SECTION B: CURRENT_MEDICATION_TO_NEW_PRESCRIPTION pairs (Active Previous ↔ New)
  for (const currItem of currentResolvedList) {
    for (const newItem of newResolvedList) {
      const idA = currItem.medicine?._id ? String(currItem.medicine._id) : null;
      const idB = newItem.medicine?._id ? String(newItem.medicine._id) : null;
      if (idA && idB && idA === idB) continue;
      if (currItem.displayName.trim().toLowerCase() === newItem.displayName.trim().toLowerCase()) continue;

      pairs.push([currItem, newItem, 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION']);
    }
  }

  const currentPairs = pairs.filter(([, , st]) => st === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION');
  const activePreviousPairs = pairs.filter(([, , st]) => st === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');

  if (pairs.length === 0) {
    return {
      status: 'completed',
      pairsEvaluated: 0,
      currentPrescriptionPairsCount: 0,
      activePreviousPairsCount: 0,
      flaggedCount: 0,
      findings: [],
      summaryNote: 'Single medicine prescription and no active previous medications — no drug-drug interaction pairs to evaluate.',
    };
  }

  // Step 3: Separate evaluable pairs (both medicines resolved in master DB)
  const evaluablePairs = pairs.filter(
    ([a, b]) => a.medicine && a.medicine._id && b.medicine && b.medicine._id
  );

  // Build pairKey -> array of [a, b, sourceType]
  const pairKeyMap = new Map();
  for (const [a, b, sourceType] of evaluablePairs) {
    const key = buildPairKey(String(a.medicine._id), String(b.medicine._id));
    pairKeyMap.set(key, [a, b, sourceType]);
  }

  // Step 4: Batch query DrugInteraction collection
  const interactionRecords = await DrugInteraction.find({
    interactionPairKey: { $in: Array.from(pairKeyMap.keys()) },
    isActive: true,
  }).lean();

  const interactionLookup = new Map();
  for (const record of interactionRecords) {
    interactionLookup.set(record.interactionPairKey, record);
  }

  // Step 5: Build findings list
  const findings = [];

  // Evaluable pairs — check against database records
  for (const [a, b, sourceType] of evaluablePairs) {
    const key = buildPairKey(String(a.medicine._id), String(b.medicine._id));
    const record = interactionLookup.get(key) || null;

    if (record) {
      findings.push({
        check: 'interaction',
        sourceType,
        medicineA: { medicineId: String(a.medicine._id), genericName: a.displayName, source: a.source },
        medicineB: { medicineId: String(b.medicine._id), genericName: b.displayName, source: b.source },
        interactionFound: true,
        severity: record.severity,
        interactionType: record.interactionType || 'Drug-Drug',
        reason: record.description || record.clinicalEffect || `Verified ${record.severity} interaction between ${a.displayName} and ${b.displayName}.`,
        potentialConcern: record.clinicalEffect || record.description || `Potential interaction risk between ${a.displayName} and ${b.displayName}.`,
        clinicalConsideration: record.recommendedAction || 'Clinical review required before co-prescribing.',
        evidenceSource: record.evidenceSource || 'MedWise DrugInteraction Database',
        doctorReviewRequired: true,
        status: 'interaction_flagged',
        message: (
          'Verified ' + record.severity + ' drug-drug interaction identified between ' +
          a.displayName + ' (' + (a.source === 'current' ? 'Current' : 'New') + ') and ' +
          b.displayName + ' (' + (b.source === 'current' ? 'Current' : 'New') + '). ' +
          (record.clinicalEffect || '') + ' Clinical review required.'
        ).trim(),
      });
    } else {
      findings.push({
        check: 'interaction',
        sourceType,
        medicineA: { medicineId: String(a.medicine._id), genericName: a.displayName, source: a.source },
        medicineB: { medicineId: String(b.medicine._id), genericName: b.displayName, source: b.source },
        interactionFound: false,
        severity: null,
        interactionType: null,
        reason: '',
        potentialConcern: '',
        clinicalConsideration: '',
        evidenceSource: 'MedWise DrugInteraction Database',
        status: 'no_interaction_found',
        message:
          'No verified interaction record found in MedWise database for ' +
          a.displayName + ' (' + a.source + ') and ' + b.displayName + ' (' + b.source + ').',
      });
    }
  }

  // Unresolvable pairs
  for (const [a, b, sourceType] of pairs) {
    if (!(a.medicine && a.medicine._id) || !(b.medicine && b.medicine._id)) {
      findings.push({
        check: 'interaction',
        sourceType,
        medicineA: {
          medicineId: (a.medicine && a.medicine._id) ? String(a.medicine._id) : null,
          genericName: a.displayName,
          source: a.source,
        },
        medicineB: {
          medicineId: (b.medicine && b.medicine._id) ? String(b.medicine._id) : null,
          genericName: b.displayName,
          source: b.source,
        },
        interactionFound: false,
        severity: null,
        interactionType: null,
        reason: '',
        potentialConcern: '',
        clinicalConsideration: '',
        evidenceSource: '',
        status: 'unable_to_assess',
        message:
          'One or both medicines (' + a.displayName + ', ' + b.displayName +
          ') could not be resolved in the master database for interaction analysis.',
      });
    }
  }

  const flaggedCount = findings.filter((f) => f.status === 'interaction_flagged').length;
  const hasMajorOrContraindicated = findings.some(
    (f) =>
      f.interactionFound &&
      (f.severity === 'Major' || f.severity === 'Contraindicated')
  );

  let summaryNote =
    'Drug-drug interaction check completed. ' +
    pairs.length + ' pair(s) evaluated (' +
    currentPairs.length + ' current prescription, ' +
    activePreviousPairs.length + ' active previous prescription), ' +
    flaggedCount + ' flagged.';

  if (hasMajorOrContraindicated) {
    summaryNote += ' Major or contraindicated interactions identified — urgent clinical review required.';
  } else if (flaggedCount > 0) {
    summaryNote += ' Flagged interactions require physician clinical review.';
  } else if (flaggedCount === 0 && evaluablePairs.length > 0) {
    summaryNote += ' No verified interactions found in MedWise database for this combination.';
  }

  return {
    status: 'completed',
    pairsEvaluated: pairs.length,
    currentPrescriptionPairsCount: currentPairs.length,
    activePreviousPairsCount: activePreviousPairs.length,
    flaggedCount,
    findings,
    summaryNote,
  };
};

module.exports = {
  buildPairKey,
  resolveMedicineForItem,
  checkPrescriptionInteractions,
};
