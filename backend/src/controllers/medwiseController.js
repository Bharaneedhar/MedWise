const Prescription = require('../models/Prescription');
const MedwiseEngine = require('../services/medwise/medwiseEngine');
const { resolveDoctorIdentity } = require('../utils/doctorIdentityResolver');

/**
 * @desc    Run MedWise Dosage Check on a specific prescription (Doctor Only)
 * @route   POST /api/medwise/prescriptions/:prescriptionId/dosage-check
 * @access  Private (Doctor Only)
 */
const checkPrescriptionDosage = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can execute MedWise prescription dosage analysis',
      });
    }

    const { prescriptionId } = req.params;

    let prescription;
    if (prescriptionId.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId });
    } else {
      prescription = await Prescription.findById(prescriptionId);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Verify prescribing doctor authorization
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to analyze dosage for this prescription record',
      });
    }

    // Execute MedWise dosage check engine
    const analysis = await MedwiseEngine.evaluatePrescriptionDosage(prescription);

    return res.status(200).json({
      success: true,
      message: 'MedWise dosage check completed successfully against master guidelines',
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Run MedWise Drug-Drug Interaction Check on a specific prescription (Doctor Only)
 * @route   POST /api/medwise/prescriptions/:prescriptionId/interaction-check
 * @access  Private (Doctor Only)
 */
const checkPrescriptionInteraction = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can execute MedWise prescription interaction analysis',
      });
    }

    const { prescriptionId } = req.params;

    let prescription;
    if (prescriptionId.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId });
    } else {
      prescription = await Prescription.findById(prescriptionId);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Verify prescribing doctor authorization
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to run interaction analysis for this prescription record',
      });
    }

    // Execute MedWise full analysis (dosage + interaction)
    const analysis = await MedwiseEngine.analyzeFullPrescription(prescription);

    return res.status(200).json({
      success: true,
      message: 'MedWise interaction check completed successfully against verified database records',
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Run MedWise Duplicate Medication Check on a specific prescription (Doctor Only)
 * @route   POST /api/medwise/prescriptions/:prescriptionId/duplicate-check
 * @access  Private (Doctor Only)
 */
const checkPrescriptionDuplicate = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can execute MedWise prescription duplicate analysis',
      });
    }

    const { prescriptionId } = req.params;

    let prescription;
    if (prescriptionId.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId });
    } else {
      prescription = await Prescription.findById(prescriptionId);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Verify prescribing doctor authorization
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to run duplicate analysis for this prescription record',
      });
    }

    // Execute full MedWise engine (populates dosage, interactions, duplicates)
    const analysis = await MedwiseEngine.analyzeFullPrescription(prescription);

    return res.status(200).json({
      success: true,
      message: 'MedWise duplicate medication check completed successfully against master database',
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Run MedWise Allergy & Safety Check on a specific prescription (Doctor Only)
 * @route   POST /api/medwise/prescriptions/:prescriptionId/allergy-safety-check
 * @access  Private (Doctor Only)
 */
const checkPrescriptionAllergySafety = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can execute MedWise prescription allergy/safety analysis',
      });
    }

    const { prescriptionId } = req.params;

    let prescription;
    if (prescriptionId.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId });
    } else {
      if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid prescription ID format',
        });
      }
      prescription = await Prescription.findById(prescriptionId);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Verify prescribing doctor authorization
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to run allergy/safety analysis for this prescription record',
      });
    }

    // Execute full MedWise engine (populates dosage, interactions, duplicates, allergySafety)
    const analysis = await MedwiseEngine.analyzeFullPrescription(prescription);

    return res.status(200).json({
      success: true,
      message: 'MedWise allergy and safety check completed successfully against master safety database',
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Run Full MedWise Prescription Analysis (Dosage + Interaction + Duplicate + Allergy/Safety) (Doctor Only)
 * @route   POST /api/medwise/prescriptions/:prescriptionId/analyze
 * @access  Private (Doctor Only)
 */
const analyzePrescription = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians can execute full MedWise prescription analysis',
      });
    }

    const { prescriptionId } = req.params;

    let prescription;
    if (prescriptionId.startsWith('RX-')) {
      prescription = await Prescription.findOne({ prescriptionId });
    } else {
      prescription = await Prescription.findById(prescriptionId);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription record not found',
      });
    }

    // Verify prescribing doctor authorization
    if (String(prescription.doctorId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to run full analysis for this prescription record',
      });
    }

    // Execute full MedWise engine (dosage + interactions + duplicates + allergySafety + audit + overallRecommendation)
    const analysis = await MedwiseEngine.analyzeFullPrescription(prescription);
    const checkedAt = new Date();

    analysis.checkedAt = checkedAt;
    analysis.isOutdated = false;

    // Attach analysis structure to prescription document
    prescription.medwiseAnalysis = analysis;

    // Synchronize medwiseChecks summary structure
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

    const resolvedPrescription = await resolveDoctorIdentity(prescription);

    return res.status(200).json({
      success: true,
      message: 'MedWise full prescription analysis completed successfully',
      analysis,
      prescription: resolvedPrescription,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkPrescriptionDosage,
  checkPrescriptionInteraction,
  checkPrescriptionDuplicate,
  checkPrescriptionAllergySafety,
  analyzePrescription,
};


