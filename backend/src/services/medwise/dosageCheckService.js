/**
 * Dosage Check Service
 * Clinical Decision Support service for dosage evaluation against verified master database guidelines
 */

/**
 * Conservative numeric dosage parser
 * Extracts numeric dose and unit from dose strings (e.g. "500 mg", "1 g", "250mcg")
 */
const parseDoseString = (doseStr) => {
  if (!doseStr || typeof doseStr !== 'string') return null;
  const trimmed = doseStr.trim();
  const massMatch = trimmed.match(/^([\d.]+)\s*([a-zA-Zμmcg]+)/i);
  if (!massMatch) return null;

  const val = parseFloat(massMatch[1]);
  if (isNaN(val) || val <= 0) return null;

  let unit = massMatch[2].toLowerCase();
  if (unit === 'μg' || unit === 'microgram' || unit === 'micrograms') unit = 'mcg';
  if (unit === 'gram' || unit === 'grams') unit = 'g';
  if (unit === 'milligram' || unit === 'milligrams') unit = 'mg';

  return { value: val, unit };
};

/**
 * Safe unit normalizer to milligrams (mg)
 */
const normalizeToMg = (value, unit) => {
  if (value == null || isNaN(value)) return null;
  const u = String(unit).toLowerCase().trim();
  if (u === 'mg') return value;
  if (u === 'g') return value * 1000;
  if (u === 'mcg') return value / 1000;
  return null; // Incompatible or unhandled unit
};

/**
 * Parse doses per day from structured frequency text
 * Supports standard three-part notation (Morning-Afternoon-Night):
 * e.g., 1-0-0 = 1 dose/day, 1-0-1 = 2 doses/day, 1-1-1 = 3 doses/day
 */
const parseDosesPerDay = (freqStr) => {
  if (!freqStr || typeof freqStr !== 'string') return null;
  const f = freqStr.toLowerCase().trim();

  // Parse 3-part notation X-Y-Z (Morning-Afternoon-Night)
  const threePartMatch = f.match(/^(\d+)-(\d+)-(\d+)$/);
  if (threePartMatch) {
    const morning = parseInt(threePartMatch[1], 10);
    const afternoon = parseInt(threePartMatch[2], 10);
    const night = parseInt(threePartMatch[3], 10);
    return morning + afternoon + night;
  }

  if (f.includes('once daily') || f.includes('od') || f === 'once a day' || f === 'every 24 hours' || f === 'q24h') return 1;
  if (f.includes('twice daily') || f.includes('bd') || f.includes('bid') || f === 'twice a day' || f === 'every 12 hours' || f === 'q12h') return 2;
  if (f.includes('thrice daily') || f.includes('tds') || f.includes('tid') || f === 'three times daily' || f === 'three times a day' || f === 'every 8 hours' || f === 'q8h') return 3;
  if (f.includes('four times daily') || f.includes('qds') || f.includes('qid') || f === 'four times a day' || f === 'every 6 hours' || f === 'q6h') return 4;

  return null;
};

/**
 * Determine population group based on age
 */
const getPopulationGroup = (age) => {
  if (age == null || isNaN(age)) return 'Adult';
  if (age >= 65) return 'Elderly';
  if (age < 18) return 'Pediatric';
  return 'Adult';
};

/**
 * Evaluate single medicine item dosage against database dosage guidelines
 * @param {Object} item - Prescribed medicine item from prescription
 * @param {Object} medicine - Master Medicine document from MongoDB
 * @param {Object} patientInfo - Patient demographics { age, gender }
 */
const checkItemDosage = (item, medicine, patientInfo = {}) => {
  const medicineId = medicine?._id || item?.medicineId || null;
  const genericName = medicine?.genericName || item?.genericName || item?.medicineName || 'Unknown Medicine';
  const prescribedDoseText = item?.dosage || '';
  const prescribedFrequency = item?.frequency || '';
  const prescribedDuration = item?.duration || '';

  // Base result structure
  const baseResult = {
    check: 'dosage',
    medicineId,
    genericName,
    prescribedDose: prescribedDoseText,
    prescribedFrequency,
    prescribedDuration,
    calculatedDailyDose: null,
    calculatedDailyDoseUnit: 'mg',
    applicablePopulation: null,
    guidelineUsed: null,
    guidelineRange: null,
    status: 'unable_to_assess',
    severity: 'info',
    reason: '',
    message: '',
    clinicalConsideration: '',
    evidenceSource: '',
    doctorReviewRequired: false,
  };

  // Step 1: Check if verified dosage guidelines exist in Medicine Master
  const guidelines = medicine?.dosageGuidelines || [];

  if (guidelines.length === 0) {
    const parsedDose = parseDoseString(prescribedDoseText);
    const prescribedSingleMg = parsedDose ? normalizeToMg(parsedDose.value, parsedDose.unit) : null;
    const dosesPerDay = parseDosesPerDay(prescribedFrequency);
    const calculatedDailyMg = (prescribedSingleMg !== null && dosesPerDay !== null) ? prescribedSingleMg * dosesPerDay : null;
    const targetPopulation = (patientInfo.age != null && !isNaN(patientInfo.age)) ? getPopulationGroup(patientInfo.age) : null;

    const reasonText = 'No verified dosage guideline is configured in the Medicine Master. The dosage prescribed by the doctor is accepted as entered.';
    return {
      ...baseResult,
      calculatedDailyDose: calculatedDailyMg,
      applicablePopulation: targetPopulation,
      guidelineUsed: null,
      guidelineRange: null,
      status: 'accepted',
      severity: 'none',
      reason: reasonText,
      message: reasonText,
      clinicalConsideration: 'MedWise did not independently compare the dosage against a configured dosage guideline; the entered dosage is accepted for clinical review purposes.',
      evidenceSource: 'No verified dosage guideline available in Medicine Master.',
      doctorReviewRequired: false,
    };
  }

  // Step 2: Parse prescribed dosage for guideline matching
  const parsedDose = parseDoseString(prescribedDoseText);
  if (!parsedDose) {
    const reasonText = `Prescribed dosage "${prescribedDoseText}" could not be unambiguously parsed for numeric dose assessment.`;
    return {
      ...baseResult,
      status: 'unable_to_assess',
      severity: 'info',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  // Step 3: Normalize single dose to mg
  const prescribedSingleMg = normalizeToMg(parsedDose.value, parsedDose.unit);
  if (prescribedSingleMg === null) {
    const reasonText = `Prescribed unit "${parsedDose.unit}" is incompatible or unhandled for mass unit conversion.`;
    return {
      ...baseResult,
      status: 'unable_to_assess',
      severity: 'info',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  // Step 4: Match patient population guidelines
  if (patientInfo.age == null || isNaN(patientInfo.age)) {
    const reasonText = `Patient age is missing; population-specific dosage guidelines cannot be matched for ${genericName}.`;
    return {
      ...baseResult,
      status: 'unable_to_assess',
      severity: 'info',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  const targetPopulation = getPopulationGroup(patientInfo.age);

  let matchedGuideline = guidelines.find((g) => g.population === targetPopulation);
  if (!matchedGuideline && targetPopulation === 'Elderly') {
    matchedGuideline = guidelines.find((g) => g.population === 'Adult');
  }

  if (!matchedGuideline) {
    const dosesPerDay = parseDosesPerDay(prescribedFrequency);
    const calculatedDailyMg = (prescribedSingleMg !== null && dosesPerDay !== null) ? prescribedSingleMg * dosesPerDay : null;
    const reasonText = `No verified dosage guideline is configured in the Medicine Master for ${genericName} (${targetPopulation} population). The dosage prescribed by the doctor is accepted as entered.`;
    return {
      ...baseResult,
      calculatedDailyDose: calculatedDailyMg,
      applicablePopulation: targetPopulation,
      guidelineUsed: null,
      guidelineRange: null,
      status: 'accepted',
      severity: 'none',
      reason: reasonText,
      message: reasonText,
      clinicalConsideration: `MedWise did not independently compare the dosage against a configured dosage guideline for ${targetPopulation} population.`,
      evidenceSource: 'No verified dosage guideline available in Medicine Master.',
      doctorReviewRequired: false,
    };
  }

  baseResult.applicablePopulation = matchedGuideline.population;
  baseResult.guidelineUsed = matchedGuideline;
  baseResult.evidenceSource = matchedGuideline.evidenceSource || 'Master Medicine Database';
  baseResult.clinicalConsideration = matchedGuideline.notes || matchedGuideline.frequencyGuidance || '';

  // Format guideline range string
  const rangeParts = [];
  if (matchedGuideline.minimumDose != null) {
    rangeParts.push(`Min Dose: ${matchedGuideline.minimumDose} ${matchedGuideline.minimumDoseUnit || 'mg'}`);
  }
  if (matchedGuideline.maximumSingleDose != null) {
    rangeParts.push(`Max Single: ${matchedGuideline.maximumSingleDose} ${matchedGuideline.maximumSingleDoseUnit || 'mg'}`);
  }
  if (matchedGuideline.maximumDailyDose != null) {
    rangeParts.push(`Max Daily: ${matchedGuideline.maximumDailyDose} ${matchedGuideline.maximumDailyDoseUnit || 'mg'}`);
  }
  baseResult.guidelineRange = rangeParts.length > 0 ? rangeParts.join(' | ') : null;

  // Step 4: Evaluate Single-Dose limits
  let singleDoseExceeded = false;
  let singleDoseBelowMin = false;
  let maxSingleMg = null;
  let minSingleMg = null;

  if (matchedGuideline.maximumSingleDose != null) {
    maxSingleMg = normalizeToMg(matchedGuideline.maximumSingleDose, matchedGuideline.maximumSingleDoseUnit);
    if (maxSingleMg !== null && prescribedSingleMg > maxSingleMg) {
      singleDoseExceeded = true;
    }
  }

  if (matchedGuideline.minimumDose != null) {
    minSingleMg = normalizeToMg(matchedGuideline.minimumDose, matchedGuideline.minimumDoseUnit);
    if (minSingleMg !== null && prescribedSingleMg < minSingleMg) {
      singleDoseBelowMin = true;
    }
  }

  // Step 5: Evaluate Daily-Dose limits
  let dailyDoseExceeded = false;
  let calculatedDailyMg = null;
  let maxDailyMg = null;
  const dosesPerDay = parseDosesPerDay(prescribedFrequency);

  if (dosesPerDay !== null) {
    calculatedDailyMg = prescribedSingleMg * dosesPerDay;
    baseResult.calculatedDailyDose = calculatedDailyMg;
    baseResult.calculatedDailyDoseUnit = 'mg';

    if (matchedGuideline.maximumDailyDose != null) {
      maxDailyMg = normalizeToMg(matchedGuideline.maximumDailyDose, matchedGuideline.maximumDailyDoseUnit);
      if (maxDailyMg !== null && calculatedDailyMg > maxDailyMg) {
        dailyDoseExceeded = true;
      }
    }
  }

  // Step 6: Construct Final Decision
  if (singleDoseExceeded) {
    const reasonText = `Prescribed single dose (${parsedDose.value} ${parsedDose.unit}) exceeds configured maximum single dose (${matchedGuideline.maximumSingleDose} ${matchedGuideline.maximumSingleDoseUnit}) for ${matchedGuideline.population} population. Clinical review required.`;
    return {
      ...baseResult,
      status: 'review_required',
      severity: 'warning',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  if (dailyDoseExceeded) {
    const reasonText = `Calculated daily dose (${calculatedDailyMg} mg) exceeds configured maximum daily dose (${matchedGuideline.maximumDailyDose} ${matchedGuideline.maximumDailyDoseUnit}) for ${matchedGuideline.population} population. Clinical review required.`;
    return {
      ...baseResult,
      status: 'review_required',
      severity: 'warning',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  if (singleDoseBelowMin) {
    const reasonText = `Prescribed single dose (${parsedDose.value} ${parsedDose.unit}) is below configured minimum dose (${matchedGuideline.minimumDose} ${matchedGuideline.minimumDoseUnit}) for ${matchedGuideline.population} population. Clinical review recommended.`;
    return {
      ...baseResult,
      status: 'review_required',
      severity: 'warning',
      reason: reasonText,
      message: reasonText,
      doctorReviewRequired: true,
    };
  }

  // All defined checks passed
  let note = `Prescribed dosage falls within configured master dosage guidance for ${matchedGuideline.population} population.`;
  if (dosesPerDay === null && prescribedFrequency) {
    note += ` (Daily exposure calculation skipped for variable frequency: "${prescribedFrequency}").`;
  }

  return {
    ...baseResult,
    status: 'within_guidance',
    severity: 'info',
    reason: note,
    message: note,
    doctorReviewRequired: false,
  };
};

module.exports = {
  parseDoseString,
  normalizeToMg,
  parseDosesPerDay,
  getPopulationGroup,
  checkItemDosage,
};
