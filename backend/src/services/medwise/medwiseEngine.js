const Medicine = require('../../models/Medicine');
const PatientProfile = require('../../models/PatientProfile');
const { checkItemDosage } = require('./dosageCheckService');
const { checkPrescriptionInteractions } = require('./interactionCheckService');
const { checkPrescriptionDuplicates } = require('./duplicateCheckService');
const { checkPrescriptionAllergySafety, checkPatientSpecificCDS } = require('./allergySafetyCheckService');
const { aggregatePrescriptionAudit } = require('./prescriptionAuditService');

/**
 * Escape special regex characters
 */
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

/**
 * MedWise Clinical Decision Support Engine
 */
class MedwiseEngine {
  /**
   * Evaluate dosage check for a prescription document
   * @param {Object} prescription - Populated/loaded prescription document from MongoDB
   * @returns {Promise<Object>} Central MedWise engine output structure
   */
  static async evaluatePrescriptionDosage(prescription) {
    if (!prescription || !Array.isArray(prescription.medicines)) {
      throw new Error('Invalid prescription object provided for MedWise evaluation');
    }

    const patientInfo = {
      age: prescription.patientAge,
      gender: prescription.patientGender,
    };

    const dosageResults = [];

    for (const item of prescription.medicines) {
      let medicine = null;

      // 1. Prefer database ObjectId lookup if available
      if (item.medicineId) {
        medicine = await Medicine.findById(item.medicineId).lean();
      }

      // 2. Fallback to genericName / medicineName lookup
      if (!medicine && (item.genericName || item.medicineName)) {
        const searchName = (item.genericName || item.medicineName).trim();
        const escaped = escapeRegex(searchName);
        medicine = await Medicine.findOne({
          isActive: true,
          $or: [
            { genericName: { $regex: new RegExp('^' + escaped + '$', 'i') } },
            { brandNames: { $regex: new RegExp('^' + escaped + '$', 'i') } },
          ],
        }).lean();
      }

      const finding = checkItemDosage(item, medicine, patientInfo);
      dosageResults.push(finding);
    }

    // Determine overall dosage recommendation text
    const hasReviewRequired = dosageResults.some((r) => r.status === 'review_required');
    let dosageSummaryNote = 'Dosage check evaluated against configured master guidelines.';
    if (hasReviewRequired) {
      dosageSummaryNote = 'Dosage check flagged items requiring physician clinical review.';
    }

    return {
      prescriptionId: prescription.prescriptionId || String(prescription._id),
      checks: {
        dosage: dosageResults,
        interactions: null,
        duplicates: null,
        allergySafety: null,
        patientSpecific: null,
      },
      audit: null,
      overallRecommendation: dosageSummaryNote,
    };
  }

  /**
   * Run full MedWise prescription analysis — executes all clinical checks,
   * performs prescription audit aggregation, and derives deterministic overall recommendation.
   *
   * @param {Object} prescription - Populated/loaded prescription document from MongoDB
   * @returns {Promise<Object>} Central MedWise engine output structure
   */
  static async analyzeFullPrescription(prescription) {
    if (!prescription || !Array.isArray(prescription.medicines)) {
      throw new Error('Invalid prescription object provided for MedWise full analysis');
    }

    const patientInfo = {
      age: prescription.patientAge,
      gender: prescription.patientGender,
    };

    // 1. Dosage Check
    const dosageResults = [];

    for (const item of prescription.medicines) {
      let medicine = null;

      if (item.medicineId) {
        medicine = await Medicine.findById(item.medicineId).lean();
      }

      if (!medicine && (item.genericName || item.medicineName)) {
        const searchName = (item.genericName || item.medicineName).trim();
        const escaped = escapeRegex(searchName);
        medicine = await Medicine.findOne({
          isActive: true,
          $or: [
            { genericName: { $regex: new RegExp('^' + escaped + '$', 'i') } },
            { brandNames: { $regex: new RegExp('^' + escaped + '$', 'i') } },
          ],
        }).lean();
      }

      dosageResults.push(checkItemDosage(item, medicine, patientInfo));
    }

    // 2. Interaction Check
    const interactionResult = await checkPrescriptionInteractions(prescription);

    // 3. Duplicate Medication Check
    const duplicateResult = await checkPrescriptionDuplicates(prescription);

    // 4. Allergy & Safety Check
    const allergySafetyResult = await checkPrescriptionAllergySafety(prescription);

    // 5. Load PatientProfile if available
    let patientProfile = prescription.patientProfile || null;
    if (
      (!patientProfile || typeof patientProfile === 'string' || !patientProfile.hasNoKnownAllergies) &&
      prescription.patientId
    ) {
      const loaded = await PatientProfile.findOne({ userId: prescription.patientId }).lean();
      if (loaded) patientProfile = loaded;
    }

    // 6. Patient-Specific Clinical Decision Support Check
    const patientSpecificResult = await checkPatientSpecificCDS(prescription, { patientProfile });

    // 7. Aggregate Prescription Audit & Derive Overall Recommendation
    const { audit, overallRecommendation } = aggregatePrescriptionAudit(
      {
        dosage: dosageResults,
        interactions: interactionResult,
        duplicates: duplicateResult,
        allergySafety: allergySafetyResult,
        patientSpecific: patientSpecificResult,
      },
      {
        prescription,
        patientProfile,
      }
    );

    return {
      prescriptionId: prescription.prescriptionId || String(prescription._id),
      checks: {
        dosage: dosageResults,
        interactions: interactionResult,
        duplicates: duplicateResult,
        allergySafety: allergySafetyResult,
        patientSpecific: patientSpecificResult,
      },
      audit,
      overallRecommendation,
    };
  }
}

module.exports = MedwiseEngine;



