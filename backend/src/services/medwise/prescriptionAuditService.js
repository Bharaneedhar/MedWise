/**
 * Prescription Audit Service
 * Clinical Decision Support aggregation layer for MedWise Engine.
 *
 * Collects and normalizes outputs from:
 * 1. Prescription Structure & Completeness Validation (Phase 1 Explainable Audit)
 * 2. Dosage Check
 * 3. Drug-Drug Interaction Check
 * 4. Duplicate Medication Check
 * 5. Allergy / Safety Check
 *
 * Produces:
 * 1. Normalized Prescription Audit findings and summary
 * 2. Deterministic Overall Recommendation (cleared | review_required | unable_to_assess)
 *
 * Principles:
 * - Does NOT invent new clinical rules or facts.
 * - Derived purely from real prescription and patient data.
 * - unable_to_assess is reported for incomplete info, NOT a false safety failure.
 * - Decision support only — doctor remains responsible for final decision.
 */

/**
 * Systematically validate the structure and completeness of a prescription and patient record.
 * Phase 1 — Explainable Prescription Audit
 *
 * @param {Object} prescription
 * @param {Object} patientProfile
 * @returns {Array<Object>} Structured audit findings for missing/incomplete items
 */
const validatePrescriptionStructure = (prescription = {}, patientProfile = null) => {
  const findings = [];

  if (!prescription) return findings;

  const profile = patientProfile || prescription.patientProfile || null;

  // 1. Patient Identification
  const hasPatientId = Boolean(prescription.patientId);
  const hasPatientName = Boolean(prescription.patientName || (profile && profile.name));
  const hasPatientPid = Boolean(prescription.patientPid || (profile && profile.pid));

  if (!hasPatientId || !hasPatientName || !hasPatientPid) {
    findings.push({
      item: 'Patient Identification',
      field: 'patientId',
      status: 'Incomplete',
      reason: 'Patient identification or record details are incomplete.',
      clinicalConsideration: 'Ensure valid patient profile and identifier are linked to the prescription.',
      severity: 'HIGH',
      source: 'prescriptionAudit',
      type: 'patient_id_incomplete',
      findingType: 'patient_id_incomplete',
      doctorReviewRequired: false,
      message: 'Patient identification or record details are incomplete.',
    });
  }

  // 2. Patient Age / Required Demographic Data
  const ageVal = prescription.patientAge !== undefined && prescription.patientAge !== null ? prescription.patientAge : (profile && profile.age);
  const hasValidAge = typeof ageVal === 'number' && ageVal > 0;
  if (!hasValidAge) {
    findings.push({
      item: 'Patient Age',
      field: 'patientAge',
      status: 'Incomplete',
      reason: 'Patient age and date of birth are missing.',
      clinicalConsideration: 'Age is required for pediatric/geriatric dosage threshold calculations.',
      severity: 'HIGH',
      source: 'prescriptionAudit',
      type: 'patient_age_incomplete',
      findingType: 'patient_age_incomplete',
      doctorReviewRequired: false,
      message: 'Patient age and date of birth are missing.',
    });
  }

  const genderVal = prescription.patientGender || (profile && profile.gender);
  const hasValidGender = Boolean(genderVal && genderVal !== 'Unspecified' && genderVal !== '');
  if (!hasValidGender) {
    findings.push({
      item: 'Patient Gender',
      field: 'patientGender',
      status: 'Incomplete',
      reason: 'Patient gender is unspecified or missing.',
      clinicalConsideration: 'Gender specifies sex-specific clinical guidance and safety parameters.',
      severity: 'MODERATE',
      source: 'prescriptionAudit',
      type: 'patient_gender_incomplete',
      findingType: 'patient_gender_incomplete',
      doctorReviewRequired: false,
      message: 'Patient gender is unspecified or missing.',
    });
  }

  // 3. Allergy Assessment Completion
  const hasExplicitNoAllergies = Boolean(profile && profile.hasNoKnownAllergies === true);
  const hasAllergiesList = Boolean(profile && Array.isArray(profile.allergies) && profile.allergies.length > 0);
  const hasPrescriptionAllergies = Boolean(Array.isArray(prescription.patientAllergies) && prescription.patientAllergies.length > 0);

  const isAllergyAssessmentComplete = hasExplicitNoAllergies || hasAllergiesList || hasPrescriptionAllergies;

  if (!isAllergyAssessmentComplete) {
    findings.push({
      item: 'Allergy Assessment',
      field: 'allergies',
      status: 'Incomplete',
      reason: 'Patient allergy information has not been explicitly completed.',
      clinicalConsideration: 'Complete the allergy assessment before relying on the full safety evaluation.',
      severity: 'HIGH',
      source: 'prescriptionAudit',
      type: 'allergy_assessment_incomplete',
      findingType: 'allergy_assessment_incomplete',
      doctorReviewRequired: false,
      message: 'Patient allergy information has not been explicitly completed.',
    });
  }

  // 4. Medicine Items Audit
  const medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];

  medicines.forEach((med, idx) => {
    const medLabel = med.medicineName || med.genericName || `Item ${idx + 1}`;

    // Medicine Name
    if (!med.medicineName && !med.genericName) {
      findings.push({
        item: `Medicine Name (Item ${idx + 1})`,
        field: 'medicineName',
        status: 'Missing',
        reason: `Medicine name is not specified for item ${idx + 1}.`,
        clinicalConsideration: 'Complete medicine identification is required to evaluate active ingredient safety.',
        severity: 'CRITICAL',
        source: 'prescriptionAudit',
        type: 'medicine_name_missing',
        findingType: 'medicine_name_missing',
        doctorReviewRequired: false,
        message: `Medicine name is not specified for item ${idx + 1}.`,
      });
    }

    // Strength
    const strengthVal = med.strength || med.dosage;
    if (!strengthVal || String(strengthVal).trim() === '') {
      findings.push({
        item: `Strength (${medLabel})`,
        field: 'strength',
        status: 'Missing',
        reason: `Strength is not specified for ${medLabel}.`,
        clinicalConsideration: 'Strength specification is necessary to verify exact active pharmaceutical ingredient dose.',
        severity: 'MODERATE',
        source: 'prescriptionAudit',
        type: 'medicine_strength_missing',
        findingType: 'medicine_strength_missing',
        doctorReviewRequired: false,
        message: `Strength is not specified for ${medLabel}.`,
      });
    }

    // Dose / Quantity
    const doseVal = med.dose || med.quantity || (med.dosage && (typeof med.dosage === 'string' || typeof med.dosage === 'number') ? med.dosage : null);
    if (!doseVal || String(doseVal).trim() === '') {
      findings.push({
        item: `Dose (${medLabel})`,
        field: 'dose',
        status: 'Missing',
        reason: `Dose quantity per administration is not specified for ${medLabel}.`,
        clinicalConsideration: 'Single dose quantity is essential to verify single-dose safety limits.',
        severity: 'HIGH',
        source: 'prescriptionAudit',
        type: 'medicine_dose_missing',
        findingType: 'medicine_dose_missing',
        doctorReviewRequired: false,
        message: `Dose quantity per administration is not specified for ${medLabel}.`,
      });
    }

    // Frequency
    if (!med.frequency || String(med.frequency).trim() === '') {
      findings.push({
        item: `Frequency (${medLabel})`,
        field: 'frequency',
        status: 'Missing',
        reason: `Administration frequency is not specified for ${medLabel}.`,
        clinicalConsideration: 'Dosing frequency determines daily drug exposure and accumulation risk.',
        severity: 'HIGH',
        source: 'prescriptionAudit',
        type: 'medicine_frequency_missing',
        findingType: 'medicine_frequency_missing',
        doctorReviewRequired: false,
        message: `Administration frequency is not specified for ${medLabel}.`,
      });
    }

    // Duration
    if (!med.duration || String(med.duration).trim() === '') {
      findings.push({
        item: `Duration (${medLabel})`,
        field: 'duration',
        status: 'Missing',
        reason: `Treatment duration is not specified for ${medLabel}.`,
        clinicalConsideration: 'Treatment duration is required to prevent under-treatment or toxicity from prolonged therapy.',
        severity: 'MODERATE',
        source: 'prescriptionAudit',
        type: 'medicine_duration_missing',
        findingType: 'medicine_duration_missing',
        doctorReviewRequired: false,
        message: `Treatment duration is not specified for ${medLabel}.`,
      });
    }

    // Route
    if (!med.route || String(med.route).trim() === '') {
      findings.push({
        item: `Route (${medLabel})`,
        field: 'route',
        status: 'Missing',
        reason: `Route of administration is not specified for ${medLabel}.`,
        clinicalConsideration: 'Administration route (e.g. Oral, IV) affects drug bioavailability and safety profile.',
        severity: 'MODERATE',
        source: 'prescriptionAudit',
        type: 'medicine_route_missing',
        findingType: 'medicine_route_missing',
        doctorReviewRequired: false,
        message: `Route of administration is not specified for ${medLabel}.`,
      });
    }

    // Instructions
    const instructionsVal = med.instructions || med.directions;
    if (!instructionsVal || String(instructionsVal).trim() === '') {
      findings.push({
        item: `Instructions (${medLabel})`,
        field: 'instructions',
        status: 'Not Specified',
        reason: `Administration instructions are not specified for ${medLabel}.`,
        clinicalConsideration: 'Specific administration instructions (e.g. After meals) prevent gastrointestinal irritation or reduced absorption.',
        severity: 'LOW',
        source: 'prescriptionAudit',
        type: 'medicine_instructions_missing',
        findingType: 'medicine_instructions_missing',
        doctorReviewRequired: false,
        message: `Administration instructions are not specified for ${medLabel}.`,
      });
    }
  });

  return findings;
};

/**
 * Aggregate clinical check outputs into a normalized Prescription Audit and Overall Recommendation.
 *
 * @param {Object} checks - Object containing { dosage, interactions, duplicates, allergySafety, patientSpecific }
 * @param {Object} [options] - Additional options { prescription, patientProfile }
 * @returns {{ audit: Object, overallRecommendation: Object }}
 */
const aggregatePrescriptionAudit = (checks = {}, options = {}) => {
  const { dosage, interactions, duplicates, allergySafety } = checks;
  const prescription = options.prescription || checks.prescription || null;
  const patientProfile = options.patientProfile || checks.patientProfile || null;

  const auditFindings = [];
  const processedKeys = new Set();

  let hasUnableToAssess = false;

  // -----------------------------------------------------------------
  // 0. EXPLAINABLE PRESCRIPTION AUDIT STRUCTURE & COMPLETENESS
  // -----------------------------------------------------------------
  if (prescription) {
    const structureFindings = validatePrescriptionStructure(prescription, patientProfile);
    for (const f of structureFindings) {
      if (f.status === 'Incomplete' || f.status === 'Missing') {
        hasUnableToAssess = true;
      }
      auditFindings.push(f);
    }
  }

  // -----------------------------------------------------------------
  // 1. DOSAGE CHECK FINDINGS
  // -----------------------------------------------------------------
  if (Array.isArray(dosage)) {
    for (const item of dosage) {
      if (!item) continue;
      const key = `dosage_${item.medicineId || item.genericName}_${item.status}`;
      if (processedKeys.has(key)) continue;

      if (item.status === 'review_required') {
        processedKeys.add(key);
        auditFindings.push({
          item: `Dosage (${item.genericName || 'Medicine'})`,
          field: 'dosage',
          status: 'Flagged',
          reason: item.reason || item.message,
          clinicalConsideration: item.clinicalConsideration || 'Dosage limits exceeded or outside expected range.',
          source: 'dosage',
          type: 'dosage_review',
          findingType: 'dosage_review',
          severity: item.severity || 'warning',
          message: item.message || item.reason,
          medicine: {
            medicineId: item.medicineId || null,
            genericName: item.genericName || 'Unknown Medicine',
          },
          prescribedDose: item.prescribedDose || '',
          prescribedFrequency: item.prescribedFrequency || '',
          prescribedDuration: item.prescribedDuration || '',
          calculatedDailyDose: item.calculatedDailyDose != null ? `${item.calculatedDailyDose} ${item.calculatedDailyDoseUnit || 'mg'}` : null,
          applicablePopulation: item.applicablePopulation || null,
          guidelineRange: item.guidelineRange || null,
          evidenceSource: item.evidenceSource || '',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'unable_to_assess') {
        hasUnableToAssess = true;
        processedKeys.add(key);
        auditFindings.push({
          item: `Dosage (${item.genericName || 'Medicine'})`,
          field: 'dosage',
          status: 'Incomplete',
          reason: item.reason || item.message || `Unable to assess dosage for ${item.genericName || 'medicine'}.`,
          clinicalConsideration: item.clinicalConsideration || 'Dosage guidelines could not be verified due to missing patient or master data.',
          source: 'dosage',
          type: 'dosage_unassessable',
          findingType: 'dosage_unassessable',
          severity: 'info',
          message: item.message || item.reason || `Unable to assess dosage for ${item.genericName || 'medicine'}.`,
          medicine: {
            medicineId: item.medicineId || null,
            genericName: item.genericName || 'Unknown Medicine',
          },
          prescribedDose: item.prescribedDose || '',
          prescribedFrequency: item.prescribedFrequency || '',
          prescribedDuration: item.prescribedDuration || '',
          calculatedDailyDose: item.calculatedDailyDose != null ? `${item.calculatedDailyDose} ${item.calculatedDailyDoseUnit || 'mg'}` : null,
          applicablePopulation: item.applicablePopulation || null,
          guidelineRange: item.guidelineRange || null,
          evidenceSource: item.evidenceSource || '',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : false,
        });
      }
    }
  } else if (checks.dosage !== undefined) {
    hasUnableToAssess = true;
  }

  // -----------------------------------------------------------------
  // 2. DRUG-DRUG INTERACTION FINDINGS
  // -----------------------------------------------------------------
  if (interactions && Array.isArray(interactions.findings)) {
    if (interactions.status === 'unable_to_assess') {
      hasUnableToAssess = true;
    }

    for (const item of interactions.findings) {
      if (!item) continue;
      const medAName = (item.medicineA && item.medicineA.genericName) || 'MedA';
      const medBName = (item.medicineB && item.medicineB.genericName) || 'MedB';
      const key = `interaction_${medAName}_${medBName}_${item.status}`;
      if (processedKeys.has(key)) continue;

      if (item.status === 'interaction_flagged') {
        processedKeys.add(key);
        const isCritical = item.severity === 'Contraindicated' || item.severity === 'Major';
        auditFindings.push({
          item: `Drug Interaction (${medAName} + ${medBName})`,
          field: 'interactions',
          status: 'Flagged',
          reason: item.reason || item.message,
          potentialConcern: item.potentialConcern || item.message || '',
          clinicalConsideration: item.clinicalConsideration || 'Potential drug-drug interaction risk detected between active components.',
          source: 'interactions',
          sourceType: item.sourceType || 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION',
          type: 'drug_interaction',
          findingType: 'drug_interaction',
          severity: isCritical ? 'critical' : 'warning',
          rawSeverity: item.severity || 'Moderate',
          message: item.message,
          medicines: [item.medicineA, item.medicineB],
          evidenceSource: item.evidenceSource || 'MedWise DrugInteraction Database',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'unable_to_assess') {
        hasUnableToAssess = true;
        processedKeys.add(key);
        auditFindings.push({
          item: `Drug Interaction (${medAName} + ${medBName})`,
          field: 'interactions',
          status: 'Incomplete',
          reason: item.message || 'Unable to assess drug-drug interaction.',
          clinicalConsideration: 'Interaction verification could not be completed.',
          source: 'interactions',
          type: 'interaction_unassessable',
          findingType: 'interaction_unassessable',
          severity: 'info',
          message: item.message || 'Unable to assess drug-drug interaction.',
          medicines: [item.medicineA, item.medicineB],
          doctorReviewRequired: false,
        });
      }
    }
  } else if (checks.interactions !== undefined && checks.interactions !== null) {
    hasUnableToAssess = true;
  }

  // -----------------------------------------------------------------
  // 3. DUPLICATE MEDICATION FINDINGS
  // -----------------------------------------------------------------
  if (duplicates && Array.isArray(duplicates.findings)) {
    if (duplicates.status === 'unable_to_assess') {
      hasUnableToAssess = true;
    }

    for (const item of duplicates.findings) {
      if (!item) continue;
      const medAName = (item.medicineA && item.medicineA.genericName) || 'MedA';
      const medBName = (item.medicineB && item.medicineB.genericName) || 'MedB';
      const key = `duplicate_${medAName}_${medBName}_${item.status}`;
      if (processedKeys.has(key)) continue;

      if (item.status === 'duplicate_found') {
        processedKeys.add(key);
        auditFindings.push({
          item: `Duplicate Medication (${medAName} + ${medBName})`,
          field: 'duplicates',
          status: 'Flagged',
          reason: item.reason || item.message || item.recommendation,
          clinicalConsideration: item.clinicalConsideration || 'Duplicate active ingredient therapy identified in prescribed regimen.',
          source: 'duplicates',
          sourceType: item.sourceType || 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION',
          duplicateType: item.duplicateType || 'EXACT_MEDICINE',
          type: 'duplicate_medication',
          findingType: 'duplicate_medication',
          severity: 'warning',
          message: item.message || item.reason || item.recommendation,
          medicines: [item.medicineA, item.medicineB],
          evidenceSource: item.evidenceSource || 'MedWise Master Medicine Database',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'unable_to_assess') {
        hasUnableToAssess = true;
        processedKeys.add(key);
        auditFindings.push({
          item: `Duplicate Medication (${medAName} + ${medBName})`,
          field: 'duplicates',
          status: 'Incomplete',
          reason: item.reason || item.message || 'Unable to assess duplicate medication pair.',
          clinicalConsideration: item.clinicalConsideration || 'Therapeutic redundancy check could not be completed.',
          source: 'duplicates',
          type: 'duplicate_unassessable',
          findingType: 'duplicate_unassessable',
          severity: 'info',
          message: item.message || item.reason || 'Unable to assess duplicate medication pair.',
          medicines: [item.medicineA, item.medicineB],
          evidenceSource: item.evidenceSource || '',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : false,
        });
      }
    }
  } else if (checks.duplicates !== undefined && checks.duplicates !== null) {
    hasUnableToAssess = true;
  }

  // -----------------------------------------------------------------
  // 4. ALLERGY / SAFETY FINDINGS
  // -----------------------------------------------------------------
  if (allergySafety && Array.isArray(allergySafety.findings)) {
    if (allergySafety.status === 'unable_to_assess') {
      hasUnableToAssess = true;
    }

    for (const item of allergySafety.findings) {
      if (!item) continue;
      const medName = (item.medicine && item.medicine.genericName) || 'Medicine';
      const key = `allergySafety_${medName}_${item.type}_${item.status}_${item.matchedAllergen || item.trigger || ''}`;
      if (processedKeys.has(key)) continue;

      if (item.status === 'allergy_risk') {
        processedKeys.add(key);
        const isCritical = item.severity === 'Life-Threatening' || item.severity === 'Contraindicated' || item.severity === 'Severe';
        auditFindings.push({
          item: `Allergy Safety (${medName})`,
          field: 'allergies',
          status: 'Flagged',
          ruleType: item.ruleType || 'allergy',
          reason: item.reason || item.message,
          potentialConcern: item.potentialConcern || 'Hypersensitivity or allergen cross-reactivity risk identified.',
          clinicalConsideration: item.clinicalConsideration || 'Hypersensitivity or allergen cross-reactivity risk identified.',
          source: 'allergySafety',
          type: 'allergy_risk',
          findingType: 'allergy_risk',
          severity: isCritical ? 'critical' : 'warning',
          message: item.message || item.reason,
          medicine: item.medicine,
          matchedAllergen: item.matchedAllergen || null,
          evidenceSource: item.evidenceSource || 'MedWise Allergy Safety Database',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'safety_rule_flagged') {
        processedKeys.add(key);
        const isCritical = item.severity === 'Contraindicated' || item.severity === 'Life-Threatening' || item.severity === 'Severe';
        auditFindings.push({
          item: `Clinical Safety Rule (${medName})`,
          field: 'safetyRules',
          status: 'Flagged',
          ruleType: item.ruleType || item.type || 'safety_rule_flagged',
          reason: item.reason || item.message,
          potentialConcern: item.potentialConcern || 'Contraindication or safety rule trigger flagged for clinical review.',
          clinicalConsideration: item.clinicalConsideration || 'Contraindication or safety rule trigger flagged for clinical review.',
          source: 'allergySafety',
          type: item.type || 'safety_rule_flagged',
          findingType: item.type || 'safety_rule_flagged',
          severity: isCritical ? 'critical' : 'warning',
          message: item.message || item.reason,
          medicine: item.medicine,
          trigger: item.trigger || null,
          evidenceSource: item.evidenceSource || 'MedWise Clinical Safety Database',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'unable_to_assess') {
        hasUnableToAssess = true;
        processedKeys.add(key);
        auditFindings.push({
          item: `Allergy/Safety Assessment (${medName})`,
          field: 'allergies',
          status: 'Incomplete',
          ruleType: item.ruleType || item.type || 'safety_unassessable',
          reason: item.reason || item.message || `Unable to assess allergy/safety for ${medName}.`,
          clinicalConsideration: item.clinicalConsideration || 'Complete allergy and clinical history to verify safety.',
          source: 'allergySafety',
          type: 'safety_unassessable',
          findingType: 'safety_unassessable',
          severity: 'info',
          message: item.message || item.reason || `Unable to assess allergy/safety for ${medName}.`,
          medicine: item.medicine,
          evidenceSource: item.evidenceSource || '',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : false,
        });
      }
    }
  } else if (checks.allergySafety !== undefined && checks.allergySafety !== null) {
    hasUnableToAssess = true;
  }

  // -----------------------------------------------------------------
  // 5. PATIENT-SPECIFIC FINDINGS
  // -----------------------------------------------------------------
  const patientSpecific = checks.patientSpecific;
  if (patientSpecific && Array.isArray(patientSpecific.findings)) {
    if (patientSpecific.status === 'unable_to_assess') {
      hasUnableToAssess = true;
    }

    for (const item of patientSpecific.findings) {
      if (!item) continue;
      const medName = (item.medicine && item.medicine.genericName) || 'Medicine';
      const key = `patientSpecific_${medName}_${item.status}_${item.patientFactor || ''}_${item.reason || ''}`;
      if (processedKeys.has(key)) continue;

      if (item.status === 'patient_specific_flagged') {
        processedKeys.add(key);
        const isCritical = item.severity === 'Contraindicated' || item.severity === 'Life-Threatening' || item.severity === 'Severe';
        auditFindings.push({
          item: `Patient-Specific CDS (${medName})`,
          field: 'patientSpecific',
          status: 'Flagged',
          patientFactor: item.patientFactor || 'Patient Context',
          findingType: item.findingType || item.type || 'patient_specific_rule',
          ruleType: item.findingType || item.type || 'patient_specific_rule',
          reason: item.reason || item.message,
          potentialConcern: item.potentialConcern || '',
          clinicalConsideration: item.clinicalConsideration || 'Patient-specific clinical precaution flagged for review.',
          source: 'patientSpecific',
          type: 'patient_specific_rule',
          severity: isCritical ? 'critical' : 'warning',
          message: item.message || item.reason,
          medicine: item.medicine,
          evidenceSource: item.evidenceSource || 'MedWise Clinical Safety Database',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : true,
        });
      } else if (item.status === 'unable_to_assess') {
        hasUnableToAssess = true;
        processedKeys.add(key);
        auditFindings.push({
          item: `Patient-Specific Assessment (${medName})`,
          field: 'patientSpecific',
          status: 'Incomplete',
          patientFactor: item.patientFactor || 'Patient Context',
          reason: item.reason || item.message || `Unable to assess patient-specific CDS for ${medName}.`,
          clinicalConsideration: item.clinicalConsideration || 'Complete patient demographic and clinical history to verify safety.',
          source: 'patientSpecific',
          type: 'patient_specific_unassessable',
          findingType: 'patient_specific_unassessable',
          severity: 'info',
          message: item.message || item.reason || `Unable to assess patient-specific CDS for ${medName}.`,
          medicine: item.medicine,
          evidenceSource: item.evidenceSource || '',
          doctorReviewRequired: item.doctorReviewRequired !== undefined ? item.doctorReviewRequired : false,
        });
      }
    }
  } else if (checks.patientSpecific !== undefined && checks.patientSpecific !== null) {
    hasUnableToAssess = true;
  }

  // -----------------------------------------------------------------
  // 6. CALCULATE UNIFIED SUMMARY METRICS & STAGE COVERAGE
  // -----------------------------------------------------------------
  const criticalFindings = auditFindings.filter(
    (f) => (f.severity === 'critical' || f.severity === 'CRITICAL') && f.status !== 'Incomplete' && f.status !== 'Missing'
  ).length;
  const warningFindings = auditFindings.filter(
    (f) => (f.severity === 'warning' || f.severity === 'HIGH' || f.severity === 'MODERATE') && f.status !== 'Incomplete' && f.status !== 'Missing'
  ).length;
  const infoFindings = auditFindings.filter(
    (f) => (f.severity === 'info' || f.severity === 'LOW') && f.status !== 'Incomplete' && f.status !== 'Missing'
  ).length;

  const dosageFindings = auditFindings.filter((f) => f.source === 'dosage').length;
  const interactionFindings = auditFindings.filter((f) => f.source === 'interactions').length;
  const duplicateFindings = auditFindings.filter((f) => f.source === 'duplicates').length;
  const allergySafetyFindings = auditFindings.filter((f) => f.source === 'allergySafety' || f.field === 'allergies' || f.field === 'safetyRules').length;
  const patientSpecificFindings = auditFindings.filter((f) => f.source === 'patientSpecific' || f.field === 'patientSpecific').length;
  const incompleteAssessments = auditFindings.filter(
    (f) => f.status === 'Incomplete' || f.status === 'Missing' || (f.findingType && f.findingType.endsWith('_unassessable'))
  ).length;

  const hasDosageIncomplete = Array.isArray(dosage)
    ? dosage.some((d) => d && d.status === 'unable_to_assess')
    : checks.dosage !== undefined;
  const hasInteractionIncomplete = interactions
    ? interactions.status === 'unable_to_assess' || (Array.isArray(interactions.findings) && interactions.findings.some((i) => i && i.status === 'unable_to_assess'))
    : checks.interactions !== undefined;
  const hasDuplicateIncomplete = duplicates
    ? duplicates.status === 'unable_to_assess' || (Array.isArray(duplicates.findings) && duplicates.findings.some((d) => d && d.status === 'unable_to_assess'))
    : checks.duplicates !== undefined;
  const hasAllergyIncomplete = allergySafety
    ? allergySafety.status === 'unable_to_assess' || (Array.isArray(allergySafety.findings) && allergySafety.findings.some((a) => a && a.status === 'unable_to_assess'))
    : checks.allergySafety !== undefined;
  const hasPatientSpecificIncomplete = patientSpecific
    ? patientSpecific.status === 'unable_to_assess' || (Array.isArray(patientSpecific.findings) && patientSpecific.findings.some((p) => p && p.status === 'unable_to_assess'))
    : checks.patientSpecific !== undefined;

  const coverage = {
    patientContext: auditFindings.some((f) => f.type === 'patient_id_incomplete' || f.type === 'patient_age_incomplete' || f.type === 'patient_gender_incomplete')
      ? 'INCOMPLETE'
      : 'COMPLETED',
    prescriptionValidation: auditFindings.some((f) => f.type && f.type.startsWith('medicine_') && f.type.endsWith('_missing') && f.status === 'Missing')
      ? 'INCOMPLETE'
      : 'COMPLETED',
    dosageAnalysis: hasDosageIncomplete ? 'INCOMPLETE' : 'COMPLETED',
    drugInteraction: hasInteractionIncomplete ? 'INCOMPLETE' : 'COMPLETED',
    duplicateMedication: hasDuplicateIncomplete ? 'INCOMPLETE' : 'COMPLETED',
    allergySafety: hasAllergyIncomplete || auditFindings.some((f) => f.type === 'allergy_assessment_incomplete')
      ? 'INCOMPLETE'
      : 'COMPLETED',
    patientSpecificCDS: hasPatientSpecificIncomplete ? 'INCOMPLETE' : 'COMPLETED',
    overallAudit: 'COMPLETED',
  };

  const metadata = {
    analysisVersion: '2.0.0',
    executedAt: new Date(),
    stagesExecuted: 8,
    outcome: '',
  };

  const audit = {
    status: 'completed',
    findings: auditFindings,
    summary: {
      totalFindings: auditFindings.length,
      criticalFindings,
      warningFindings,
      infoFindings,
      dosageFindings,
      interactionFindings,
      currentPrescriptionPairsCount: interactions?.currentPrescriptionPairsCount !== undefined
        ? interactions.currentPrescriptionPairsCount
        : auditFindings.filter((f) => f.source === 'interactions' && f.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION').length,
      activePreviousPairsCount: interactions?.activePreviousPairsCount !== undefined
        ? interactions.activePreviousPairsCount
        : auditFindings.filter((f) => f.source === 'interactions' && f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION').length,
      duplicateFindings,
      allergySafetyFindings,
      patientSpecificFindings,
      incompleteAssessments,
    },
    coverage,
    metadata,
  };

  // -----------------------------------------------------------------
  // 7. DETERMINISTIC OVERALL RECOMMENDATION
  // -----------------------------------------------------------------
  // Core patient profile completeness check
  const profileIncomplete = auditFindings.some(
    (f) =>
      f.type === 'patient_id_incomplete' ||
      f.type === 'patient_age_incomplete' ||
      f.type === 'patient_gender_incomplete' ||
      f.type === 'allergy_assessment_incomplete'
  );

  let overallRecommendation;
  const reviewRequiredFindings = auditFindings.filter((f) => f.doctorReviewRequired === true && f.status !== 'Incomplete' && f.status !== 'Missing');

  if (profileIncomplete) {
    overallRecommendation = {
      status: 'unable_to_assess',
      severity: 'info',
      message: 'Analysis is incomplete because required patient profile information or allergy assessment is missing.',
    };
  } else if (criticalFindings > 0) {
    overallRecommendation = {
      status: 'review_required',
      severity: 'critical',
      message: 'Clinical review is required based on significant MedWise safety findings.',
    };
  } else if (warningFindings > 0 || reviewRequiredFindings.length > 0 || hasUnableToAssess || incompleteAssessments > 0) {
    overallRecommendation = {
      status: 'review_required',
      severity: warningFindings > 0 ? 'warning' : 'info',
      message: 'One or more clinical findings or unverified drug parameters require doctor review.',
    };
  } else {
    overallRecommendation = {
      status: 'cleared',
      severity: 'none',
      message: 'Prescription cleared with no clinically significant findings requiring doctor review.',
    };
  }

  metadata.outcome = overallRecommendation.status;

  return {
    audit,
    overallRecommendation,
  };
};

module.exports = {
  validatePrescriptionStructure,
  aggregatePrescriptionAudit,
};

