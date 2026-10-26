/**
 * Allergy / Safety Check Service
 * Clinical Decision Support service for evaluating patient allergies and
 * authoritative medicine safety rules (contraindications, precautions, warnings).
 *
 * Principles:
 * 1. Uses ONLY authoritative database records (Medicine, MedicineSafetyRule).
 * 2. NO ALLERGY DATA !== NO ALLERGIES. If patient allergy info is unavailable,
 *    returns unable_to_assess rather than assuming safety.
 * 3. Does NOT fabricate clinical claims or infer diagnoses unsupported by data.
 * 4. Decision support only — doctor remains responsible for final decision.
 */

const Medicine = require('../../models/Medicine');
const MedicineSafetyRule = require('../../models/MedicineSafetyRule');
const PatientProfile = require('../../models/PatientProfile');
const { resolveMedicineForItem } = require('./interactionCheckService');

/**
 * Check if a text string matches any target keyword case-insensitively
 */
const isKeywordMatched = (sourceText, keywords) => {
  if (!sourceText || !Array.isArray(keywords)) return false;
  const src = sourceText.trim().toLowerCase();
  return keywords.some((kw) => {
    if (!kw) return false;
    const target = kw.trim().toLowerCase();
    return src.includes(target) || target.includes(src);
  });
};

/**
 * Evaluate allergy and safety rules for a prescription document.
 *
 * @param {Object} prescription - Prescription document or object with medicines array
 * @param {Object} [options] - Optional override parameters (patientProfile, allergies, conditions)
 * @returns {Promise<Object>} Allergy & Safety check result block
 */
const checkPrescriptionAllergySafety = async (prescription, options = {}) => {
  if (!prescription || !Array.isArray(prescription.medicines)) {
    return {
      status: 'unable_to_assess',
      evaluatedMedicines: 0,
      findings: [],
      summaryNote: 'Prescription data unavailable for allergy/safety analysis.',
    };
  }

  const items = prescription.medicines;
  if (items.length === 0) {
    return {
      status: 'completed',
      evaluatedMedicines: 0,
      findings: [],
      summaryNote: 'Prescription contains no medicines to evaluate.',
    };
  }

  // Retrieve Patient Profile if available and not passed in options
  let patientProfile = options.patientProfile || null;
  if (!patientProfile && prescription.patientId) {
    patientProfile = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
  }

  // Determine patient allergy information availability
  const providedAllergies =
    options.allergies !== undefined
      ? options.allergies
      : options.patientAllergies !== undefined
      ? options.patientAllergies
      : (prescription && prescription.patientAllergies !== undefined)
      ? prescription.patientAllergies
      : (patientProfile && patientProfile.hasNoKnownAllergies)
      ? []
      : (patientProfile && Array.isArray(patientProfile.allergies) && patientProfile.allergies.length >= 0)
      ? patientProfile.allergies
      : null;

  const hasAllergyData = Array.isArray(providedAllergies);
  const patientAllergiesList = hasAllergyData
    ? providedAllergies.map((a) => (typeof a === 'string' ? a.trim() : (a && a.name) || '').trim()).filter(Boolean)
    : [];

  // Determine patient medical conditions availability
  const providedConditions =
    options.conditions !== undefined
      ? options.conditions
      : (patientProfile && Array.isArray(patientProfile.medicalConditions))
      ? patientProfile.medicalConditions.map((c) => (c.name || '').trim())
      : null;

  const hasConditionsData = Array.isArray(providedConditions);
  const patientConditionsList = hasConditionsData
    ? providedConditions.filter(Boolean)
    : [];

  // Step 1: Resolve all medicine documents in parallel
  const resolvedMedicines = await Promise.all(items.map(resolveMedicineForItem));

  const findings = [];
  const processedRuleKeys = new Set(); // Prevent duplicate findings for same medicine+rule

  // Step 2: Evaluate each medicine
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const med = resolvedMedicines[i];
    const displayName = (med && med.genericName) || item.genericName || item.medicineName || 'Unknown Medicine';

    // Handle Unresolvable Medicine
    if (!med || !med._id) {
      findings.push({
        type: 'unable_to_assess',
        status: 'unable_to_assess',
        severity: 'UNKNOWN',
        medicine: {
          medicineId: null,
          genericName: displayName,
        },
        message: `Medicine record for ${displayName} could not be resolved in master database for allergy/safety analysis.`,
        evidenceSource: '',
      });
      continue;
    }

    const medIdStr = String(med._id);

    // --- A. ALLERGY CHECK ---
    if (!hasAllergyData) {
      // Missing patient allergy data -> NO ALLERGY DATA != NO ALLERGIES
      findings.push({
        type: 'allergy',
        status: 'unable_to_assess',
        severity: 'UNKNOWN',
        medicine: {
          medicineId: medIdStr,
          genericName: med.genericName,
        },
        message: `Patient allergy records unavailable — unable to verify allergy safety for ${med.genericName}.`,
        evidenceSource: '',
      });
    } else {
      // Patient allergy info IS available -> Evaluate matching
      // Query allergy-type MedicineSafetyRules for this medicine
      const allergyRules = await MedicineSafetyRule.find({
        medicine: med._id,
        safetyType: 'allergy',
        isActive: true,
      }).lean();

      let allergyMatchFound = false;

      // 1. Check against MedicineSafetyRule triggers
      for (const rule of allergyRules) {
        if (isKeywordMatched(rule.trigger, patientAllergiesList)) {
          const ruleKey = `${medIdStr}_allergy_${rule.trigger}`;
          if (!processedRuleKeys.has(ruleKey)) {
            processedRuleKeys.add(ruleKey);
            allergyMatchFound = true;
            findings.push({
              type: 'allergy',
              ruleType: 'allergy',
              status: 'allergy_risk',
              severity: rule.severity || 'Life-Threatening',
              medicine: {
                medicineId: medIdStr,
                genericName: med.genericName,
              },
              matchedAllergen: rule.trigger,
              reason: rule.description || `Patient allergy (${rule.trigger}) matches prescribed medicine ${med.genericName}.`,
              message: rule.description || `Patient allergy (${rule.trigger}) matches prescribed medicine ${med.genericName}.`,
              potentialConcern: rule.clinicalEffect || 'Hypersensitivity reaction risk.',
              clinicalConsideration: rule.recommendedAction || 'Do not administer; evaluate alternative therapy.',
              evidenceSource: rule.evidenceSource || 'MedWise Allergy Safety Database',
              doctorReviewRequired: true,
            });
          }
        }
      }

      // 2. Check against Medicine.allergyKeywords
      const allergyKeywords = Array.isArray(med.allergyKeywords) ? med.allergyKeywords : [];
      for (const kw of allergyKeywords) {
        if (isKeywordMatched(kw, patientAllergiesList)) {
          const kwKey = `${medIdStr}_allergy_kw_${kw}`;
          if (!processedRuleKeys.has(kwKey)) {
            processedRuleKeys.add(kwKey);
            allergyMatchFound = true;
            findings.push({
              type: 'allergy',
              ruleType: 'allergy',
              status: 'allergy_risk',
              severity: 'Life-Threatening',
              medicine: {
                medicineId: medIdStr,
                genericName: med.genericName,
              },
              matchedAllergen: kw,
              reason: `Patient reported allergy matching ${kw} for prescribed medicine ${med.genericName}.`,
              message: `Patient reported allergy matching ${kw} for prescribed medicine ${med.genericName}.`,
              potentialConcern: 'Allergic reaction risk flagged from active ingredient keyword match.',
              clinicalConsideration: 'Discontinue or select non-cross-reactive alternative.',
              evidenceSource: 'MedWise Master Medicine Database',
              doctorReviewRequired: true,
            });
          }
        }
      }

      // 3. Direct generic name or active ingredient match against patient allergies
      if (isKeywordMatched(med.genericName, patientAllergiesList)) {
        const genKey = `${medIdStr}_allergy_generic`;
        if (!processedRuleKeys.has(genKey)) {
          processedRuleKeys.add(genKey);
          allergyMatchFound = true;
          findings.push({
            type: 'allergy',
            ruleType: 'allergy',
            status: 'allergy_risk',
            severity: 'Life-Threatening',
            medicine: {
              medicineId: medIdStr,
              genericName: med.genericName,
            },
            matchedAllergen: med.genericName,
            reason: `Patient reported direct hypersensitivity to ${med.genericName}.`,
            message: `Patient reported direct hypersensitivity to ${med.genericName}.`,
            potentialConcern: 'Direct drug hypersensitivity.',
            clinicalConsideration: 'Prescribe non-cross-reactive active ingredient.',
            evidenceSource: 'Patient Clinical Profile',
            doctorReviewRequired: true,
          });
        }
      }

      // 4. If allergy data checked and no match found
      if (!allergyMatchFound) {
        const isNoKnown = Boolean(patientProfile && patientProfile.hasNoKnownAllergies);
        const allergyMsg = isNoKnown || patientAllergiesList.length === 0
          ? `Allergy assessment completed for ${med.genericName}. Patient has no known allergies; no allergy-related finding identified.`
          : `Allergy assessment completed for ${med.genericName}. No allergy-related finding identified against patient's recorded allergies (${patientAllergiesList.join(', ')}).`;

        findings.push({
          type: 'allergy',
          ruleType: 'allergy',
          status: 'no_allergy_risk_found',
          severity: 'NONE',
          medicine: {
            medicineId: medIdStr,
            genericName: med.genericName,
          },
          matchedAllergen: null,
          reason: allergyMsg,
          message: allergyMsg,
          potentialConcern: '',
          clinicalConsideration: '',
          evidenceSource: 'MedWise Clinical Safety Database',
          doctorReviewRequired: false,
        });
      }
    }

    // --- B. SAFETY RULES CHECK (Contraindication, Precaution, Warning) ---
    const otherSafetyRules = await MedicineSafetyRule.find({
      medicine: med._id,
      safetyType: { $ne: 'allergy' },
      isActive: true,
    }).lean();

    for (const rule of otherSafetyRules) {
      const ruleKey = `${medIdStr}_${rule.safetyType}_${rule.trigger}`;
      if (processedRuleKeys.has(ruleKey)) continue;

      if (!hasConditionsData) {
        // Patient medical conditions unavailable -> unable to assess rule
        processedRuleKeys.add(ruleKey);
        findings.push({
          type: rule.safetyType,
          ruleType: rule.safetyType,
          status: 'unable_to_assess',
          severity: 'UNKNOWN',
          medicine: {
            medicineId: medIdStr,
            genericName: med.genericName,
          },
          trigger: rule.trigger,
          reason: `Patient clinical conditions unavailable — unable to evaluate ${rule.safetyType} rule '${rule.trigger}' for ${med.genericName}.`,
          message: `Patient clinical conditions unavailable — unable to evaluate ${rule.safetyType} rule '${rule.trigger}' for ${med.genericName}.`,
          potentialConcern: rule.clinicalEffect || '',
          clinicalConsideration: rule.recommendedAction || '',
          evidenceSource: rule.evidenceSource || 'MedWise Clinical Safety Database',
          doctorReviewRequired: false,
        });
      } else {
        // Check if patient conditions satisfy trigger
        const isTriggerMatched = isKeywordMatched(rule.trigger, patientConditionsList);

        if (isTriggerMatched) {
          processedRuleKeys.add(ruleKey);
          findings.push({
            type: rule.safetyType,
            ruleType: rule.safetyType,
            status: 'safety_rule_flagged',
            severity: rule.severity || 'Moderate',
            medicine: {
              medicineId: medIdStr,
              genericName: med.genericName,
            },
            trigger: rule.trigger,
            reason: rule.description || `${rule.severity} ${rule.safetyType}: ${rule.trigger}.`,
            message: `${rule.severity} ${rule.safetyType}: ${rule.description || rule.trigger}. ${rule.clinicalEffect || ''}`.trim(),
            potentialConcern: rule.clinicalEffect || '',
            clinicalConsideration: rule.recommendedAction || '',
            evidenceSource: rule.evidenceSource || 'MedWise Clinical Safety Database',
            doctorReviewRequired: true,
          });
        }
      }
    }
  }

  // Determine Overall Status & Summary
  const hasRiskOrFlag = findings.some((f) => f.status === 'allergy_risk' || f.status === 'safety_rule_flagged');
  const hasUnableToAssess = findings.some((f) => f.status === 'unable_to_assess');

  let status = 'completed';
  if (hasRiskOrFlag) {
    status = 'safety_concerns_detected';
  } else if (hasUnableToAssess) {
    status = 'unable_to_assess';
  }

  let summaryNote = `Allergy and safety check evaluated for ${items.length} medicine(s).`;
  if (hasRiskOrFlag) {
    summaryNote += ' Safety concerns or allergy risks identified — clinical review required.';
  } else if (hasUnableToAssess) {
    summaryNote += ' Partial or complete patient clinical data unavailable for full allergy/safety verification.';
  } else {
    summaryNote += ' No allergy or safety concerns identified from available patient clinical data.';
  }

  return {
    status,
    evaluatedMedicines: items.length,
    findings,
    summaryNote,
  };
};

/**
 * Evaluate Patient-Specific Clinical Decision Support (Stage 7).
 *
 * Checks patient demographics (Age, Gender, Blood Group) and Medical Conditions
 * against database configured rules without inventing unsupported clinical claims.
 *
 * @param {Object} prescription
 * @param {Object} [options]
 * @returns {Promise<Object>} Patient-specific CDS check result block
 */
const checkPatientSpecificCDS = async (prescription, options = {}) => {
  if (!prescription || !Array.isArray(prescription.medicines)) {
    return {
      status: 'unable_to_assess',
      evaluatedMedicines: 0,
      findings: [],
      summaryNote: 'Prescription data unavailable for patient-specific CDS evaluation.',
    };
  }

  const items = prescription.medicines;
  if (items.length === 0) {
    return {
      status: 'completed',
      evaluatedMedicines: 0,
      findings: [],
      summaryNote: 'Prescription contains no medicines to evaluate for patient-specific CDS.',
    };
  }

  let patientProfile = options.patientProfile || null;
  if (!patientProfile && prescription.patientId) {
    patientProfile = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
  }

  const patientAge = prescription.patientAge !== undefined && prescription.patientAge !== null ? prescription.patientAge : (patientProfile && patientProfile.age);
  const patientGender = prescription.patientGender || (patientProfile && patientProfile.gender);
  const patientBloodGroup = prescription.patientBloodGroup || (patientProfile && patientProfile.bloodGroup);
  const rawConditions = patientProfile && Array.isArray(patientProfile.medicalConditions) ? patientProfile.medicalConditions.map((c) => (c.name || '').trim()) : null;

  const resolvedMedicines = await Promise.all(items.map(resolveMedicineForItem));
  const findings = [];
  const processedRuleKeys = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const med = resolvedMedicines[i];
    const displayName = (med && med.genericName) || item.genericName || item.medicineName || 'Unknown Medicine';

    if (!med || !med._id) {
      findings.push({
        type: 'unable_to_assess',
        status: 'unable_to_assess',
        severity: 'UNKNOWN',
        medicine: { medicineId: null, genericName: displayName },
        patientFactor: 'Prescribed Medicine',
        reason: `Medicine ${displayName} could not be resolved in database for patient-specific CDS.`,
        message: `Medicine ${displayName} could not be resolved in database for patient-specific CDS.`,
        doctorReviewRequired: false,
      });
      continue;
    }

    const medIdStr = String(med._id);

    // Fetch active safety rules for medicine
    const safetyRules = await MedicineSafetyRule.find({
      medicine: med._id,
      isActive: true,
    }).lean();

    for (const rule of safetyRules) {
      const ruleKey = `ps_${medIdStr}_${rule.safetyType}_${rule.trigger}`;
      if (processedRuleKeys.has(ruleKey)) continue;

      let matchedFactor = null;

      // 1. Check against medical conditions
      if (Array.isArray(rawConditions) && isKeywordMatched(rule.trigger, rawConditions)) {
        matchedFactor = `Medical Condition (${rule.trigger})`;
      }

      // 2. Check against patient age (Geriatric / Pediatric)
      if (!matchedFactor && typeof patientAge === 'number') {
        const triggerLower = rule.trigger.toLowerCase();
        if (patientAge >= 65 && (triggerLower.includes('geriatric') || triggerLower.includes('elderly') || triggerLower.includes('senile'))) {
          matchedFactor = `Age (${patientAge} years - Geriatric)`;
        } else if (patientAge < 18 && (triggerLower.includes('pediatric') || triggerLower.includes('child') || triggerLower.includes('infant'))) {
          matchedFactor = `Age (${patientAge} years - Pediatric)`;
        }
      }

      // 3. Check against patient gender
      if (!matchedFactor && patientGender && patientGender !== 'Unspecified') {
        const triggerLower = rule.trigger.toLowerCase();
        if (triggerLower.includes(patientGender.toLowerCase()) || (patientGender.toLowerCase() === 'female' && (triggerLower.includes('pregnancy') || triggerLower.includes('lactation')))) {
          matchedFactor = `Gender (${patientGender})`;
        }
      }

      // 4. Check against blood group
      if (!matchedFactor && patientBloodGroup && patientBloodGroup !== 'Unknown') {
        const triggerLower = rule.trigger.toLowerCase();
        if (triggerLower.includes(patientBloodGroup.toLowerCase())) {
          matchedFactor = `Blood Group (${patientBloodGroup})`;
        }
      }

      if (matchedFactor) {
        processedRuleKeys.add(ruleKey);
        findings.push({
          check: 'patient_specific',
          status: 'patient_specific_flagged',
          patientFactor: matchedFactor,
          findingType: rule.safetyType,
          type: rule.safetyType,
          severity: rule.severity || 'Moderate',
          medicine: {
            medicineId: medIdStr,
            genericName: med.genericName,
          },
          reason: rule.description || `Configured ${rule.safetyType} rule triggered for ${med.genericName} by ${matchedFactor}.`,
          message: rule.description || `Configured ${rule.safetyType} rule triggered for ${med.genericName} by ${matchedFactor}.`,
          potentialConcern: rule.clinicalEffect || '',
          clinicalConsideration: rule.recommendedAction || '',
          evidenceSource: rule.evidenceSource || 'MedWise Clinical Safety Database',
          doctorReviewRequired: true,
        });
      }
    }
  }

  const hasFlagged = findings.some((f) => f.status === 'patient_specific_flagged');
  const hasUnable = findings.some((f) => f.status === 'unable_to_assess');

  let status = 'completed';
  if (hasFlagged) {
    status = 'patient_specific_concerns_detected';
  } else if (hasUnable) {
    status = 'unable_to_assess';
  }

  let summaryNote = `Patient-specific CDS evaluated for ${items.length} medicine(s).`;
  if (hasFlagged) {
    summaryNote += ' Patient-specific clinical precautions flagged — physician review required.';
  } else {
    summaryNote += ' No patient-specific clinical risks identified from available patient profile data.';
  }

  return {
    status,
    evaluatedMedicines: items.length,
    findings,
    summaryNote,
  };
};

module.exports = {
  checkPrescriptionAllergySafety,
  checkPatientSpecificCDS,
};
