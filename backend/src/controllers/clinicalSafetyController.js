const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const DrugInteraction = require('../models/DrugInteraction');
const MedicineSafetyRule = require('../models/MedicineSafetyRule');

/**
 * Validate MongoDB ObjectId string
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Get interactions involving a specific medicine (Protected read-only API)
 * @route   GET /api/medicines/:id/interactions
 * @access  Private (Authenticated users)
 */
const getMedicineInteractions = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medicine ID format',
      });
    }

    const medicine = await Medicine.findById(id).select('genericName isActive');
    if (!medicine || medicine.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    const interactions = await DrugInteraction.find({
      $or: [{ medicineA: id }, { medicineB: id }],
      isActive: true,
    })
      .populate('medicineA', 'genericName brandNames drugClass')
      .populate('medicineB', 'genericName brandNames drugClass')
      .lean();

    return res.status(200).json({
      success: true,
      medicineId: id,
      genericName: medicine.genericName,
      count: interactions.length,
      interactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get safety rules/warnings for a specific medicine (Protected read-only API)
 * @route   GET /api/medicines/:id/safety
 * @access  Private (Authenticated users)
 */
const getMedicineSafetyRules = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medicine ID format',
      });
    }

    const medicine = await Medicine.findById(id).select('genericName warnings contraindications allergyKeywords isActive');
    if (!medicine || medicine.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    const safetyRules = await MedicineSafetyRule.find({
      medicine: id,
      isActive: true,
    }).lean();

    return res.status(200).json({
      success: true,
      medicineId: id,
      genericName: medicine.genericName,
      warnings: medicine.warnings || [],
      contraindications: medicine.contraindications || [],
      allergyKeywords: medicine.allergyKeywords || [],
      safetyRulesCount: safetyRules.length,
      safetyRules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dosage guidelines for a specific medicine (Protected read-only API)
 * @route   GET /api/medicines/:id/dosage-guidelines
 * @access  Private (Authenticated users)
 */
const getMedicineDosageGuidelines = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medicine ID format',
      });
    }

    const medicine = await Medicine.findById(id).select('genericName dosageGuidelines availableStrengths dosageForms isActive');
    if (!medicine || medicine.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    return res.status(200).json({
      success: true,
      medicineId: id,
      genericName: medicine.genericName,
      availableStrengths: medicine.availableStrengths || [],
      dosageForms: medicine.dosageForms || [],
      count: medicine.dosageGuidelines?.length || 0,
      dosageGuidelines: medicine.dosageGuidelines || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMedicineInteractions,
  getMedicineSafetyRules,
  getMedicineDosageGuidelines,
};
