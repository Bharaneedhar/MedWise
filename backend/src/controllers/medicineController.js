const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

/**
 * Escape special characters for regex searching
 * @param {string} text
 * @returns {string}
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Search / list active medicines
 * GET /api/medicines
 * Query params: ?search=paracetamol
 * Protected: Requires authentication
 */
const searchMedicines = async (req, res) => {
  try {
    const { search } = req.query;

    const query = { isActive: true };

    if (search && search.trim().length > 0) {
      const sanitized = escapeRegex(search.trim());
      const regex = new RegExp(sanitized, 'i');

      query.$or = [
        { genericName: regex },
        { brandNames: regex },
        { 'activeIngredients.name': regex },
        { drugClass: regex },
        { therapeuticCategory: regex },
      ];
    }

    // Lightweight projection for autocomplete / search efficiency
    const medicines = await Medicine.find(query)
      .select('genericName brandNames drugClass therapeuticCategory dosageForms availableStrengths routes duplicateGroup')
      .sort({ genericName: 1 })
      .limit(search ? 25 : 60)
      .lean();

    // Map _id to id for clean API output
    const formatted = medicines.map((med) => ({
      id: med._id.toString(),
      _id: med._id,
      genericName: med.genericName,
      brandNames: med.brandNames || [],
      drugClass: med.drugClass,
      therapeuticCategory: med.therapeuticCategory || '',
      dosageForms: med.dosageForms || [],
      availableStrengths: med.availableStrengths || [],
      routes: med.routes || [],
      duplicateGroup: med.duplicateGroup || '',
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      medicines: formatted,
    });
  } catch (error) {
    console.error(`[Medicine Search Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve medicines',
    });
  }
};

/**
 * Get full medicine details by ID
 * GET /api/medicines/:id
 * Protected: Requires authentication
 */
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medicine ID format',
      });
    }

    const medicine = await Medicine.findById(id).lean();

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    return res.status(200).json({
      success: true,
      medicine: {
        ...medicine,
        id: medicine._id.toString(),
      },
    });
  } catch (error) {
    console.error(`[Medicine Detail Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve medicine details',
    });
  }
};

module.exports = {
  searchMedicines,
  getMedicineById,
};
