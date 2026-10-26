const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

// In-process lock map to prevent race conditions during concurrent medicine creation
const pendingCreations = new Map();

/**
 * Safely normalize a medicine name:
 * - Trims leading and trailing whitespace
 * - Collapses consecutive whitespace characters (spaces, tabs, newlines) into a single space
 *
 * @param {string} name
 * @returns {string}
 */
const normalizeMedicineName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
};

/**
 * Format canonical medicine name:
 * - Normalizes spacing
 * - Formats words to Title Case while respecting hyphenated components (e.g., 'Co-Amoxiclav')
 *
 * @param {string} name
 * @returns {string}
 */
const formatCanonicalName = (name) => {
  const cleaned = normalizeMedicineName(name);
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Build safe regex for medicine name matching:
 * - Escapes regex special characters
 * - Allows matching across variable whitespace between words
 *
 * @param {string} text
 * @returns {RegExp}
 */
const buildSafeRegex = (text) => {
  const cleaned = normalizeMedicineName(text);
  const escapedWords = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'));
  return new RegExp(`^${escapedWords.join('\\s+')}$`, 'i');
};

/**
 * Look up existing Medicine in Medicine Master:
 * - Direct lookup by medicineId (if valid ObjectId)
 * - Normalized key match
 * - Exact case-insensitive match on genericName or brandNames
 * - Safe plural/alias variations (ONLY matched if the counterpart exists in DB)
 *
 * @param {string} rawName
 * @param {string|mongoose.Types.ObjectId} [existingMedicineId]
 * @returns {Promise<Object|null>}
 */
const findExistingMedicine = async (rawName, existingMedicineId = null) => {
  // 1. Direct ID lookup if valid ObjectId provided
  if (existingMedicineId && mongoose.Types.ObjectId.isValid(existingMedicineId)) {
    const byId = await Medicine.findOne({ _id: existingMedicineId, isActive: true });
    if (byId) return byId;
  }

  const cleanName = normalizeMedicineName(rawName);
  if (!cleanName) return null;

  const normKey = cleanName.toLowerCase();
  const exactRegex = buildSafeRegex(cleanName);

  // 2. Exact match via normalized key, genericName regex, or brandNames regex
  let existing = await Medicine.findOne({
    isActive: true,
    $or: [
      { normalizedName: normKey },
      { genericName: { $regex: exactRegex } },
      { brandNames: { $regex: exactRegex } },
    ],
  });

  if (existing) return existing;

  // 3. Safe plural/alias matching without destructive string stripping
  // Check if user entered plural form while singular exists in DB
  if (cleanName.length > 5 && normKey.endsWith('es')) {
    const singular = cleanName.slice(0, -2);
    const singularRegex = buildSafeRegex(singular);
    existing = await Medicine.findOne({
      isActive: true,
      $or: [
        { normalizedName: singular.toLowerCase() },
        { genericName: { $regex: singularRegex } },
        { brandNames: { $regex: singularRegex } },
      ],
    });
    if (existing) return existing;
  }

  if (cleanName.length > 4 && normKey.endsWith('s')) {
    const singular = cleanName.slice(0, -1);
    const singularRegex = buildSafeRegex(singular);
    existing = await Medicine.findOne({
      isActive: true,
      $or: [
        { normalizedName: singular.toLowerCase() },
        { genericName: { $regex: singularRegex } },
        { brandNames: { $regex: singularRegex } },
      ],
    });
    if (existing) return existing;
  }

  // Check if user entered singular while plural exists in DB
  if (cleanName.length > 3) {
    const pluralCandidate = `${cleanName}s`;
    const pluralCandidateRegex = new RegExp(`^${cleanName.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}s$`, 'i');
    existing = await Medicine.findOne({
      isActive: true,
      $or: [
        { normalizedName: pluralCandidate.toLowerCase() },
        { genericName: { $regex: pluralCandidateRegex } },
        { brandNames: { $regex: pluralCandidateRegex } },
      ],
    });
    if (existing) return existing;
  }

  return null;
};

/**
 * Find existing medicine or dynamically create a new Medicine Master record.
 *
 * Concurrency & duplicate safety:
 * - Employs in-process mutex per normalized medicine name
 * - Employs database-level unique index and duplicate error fallback
 * - Guarantees only ONE Medicine Master record is created
 *
 * Clinical rules guarantee:
 * - NO invented dosage guidelines
 * - NO invented drug-drug interactions
 * - NO invented contraindications / allergy rules
 *
 * @param {Object} itemData
 * @param {string} [itemData.medicineId]
 * @param {string} [itemData.medicineName]
 * @param {string} [itemData.genericName]
 * @param {string} [itemData.dosageForm]
 * @param {string} [itemData.route]
 * @returns {Promise<Object>}
 */
const findOrCreateMedicineMaster = async (itemData = {}) => {
  const { medicineId, medicineName, genericName, dosageForm, route } = itemData;
  const targetName = genericName || medicineName;

  if (!targetName && !medicineId) {
    throw new Error('Medicine name or ID is required to resolve Medicine Master record.');
  }

  // 1. Initial backend duplicate check
  const existing = await findExistingMedicine(targetName, medicineId);
  if (existing) {
    return existing;
  }

  const cleanName = normalizeMedicineName(targetName);
  const normKey = cleanName.toLowerCase();

  // 2. If a concurrent creation for this exact medicine is currently in flight, wait for it
  if (pendingCreations.has(normKey)) {
    try {
      await pendingCreations.get(normKey);
    } catch (_) {
      // Ignore worker error and re-query
    }
    const resolvedExisting = await findExistingMedicine(targetName, medicineId);
    if (resolvedExisting) {
      return resolvedExisting;
    }
  }

  // 3. Register pending creation lock
  let resolveLock;
  let rejectLock;
  const lockPromise = new Promise((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });
  pendingCreations.set(normKey, lockPromise);

  try {
    // Double check after acquiring lock
    const doubleCheck = await findExistingMedicine(targetName, medicineId);
    if (doubleCheck) {
      resolveLock(doubleCheck);
      return doubleCheck;
    }

    const canonicalName = formatCanonicalName(targetName);
    if (!canonicalName) {
      throw new Error('Valid medicine name is required to create Medicine Master record.');
    }

    const newMedicinePayload = {
      genericName: canonicalName,
      normalizedName: canonicalName.toLowerCase(),
      brandNames: [],
      drugClass: 'Unclassified',
      therapeuticCategory: '',
      description: '',
      dosageForms: dosageForm && dosageForm.trim() ? [dosageForm.trim()] : ['Tablet'],
      routes: route && route.trim() ? [route.trim()] : ['Oral'],
      availableStrengths: [],
      dosageGuidelines: [],
      warnings: [],
      contraindications: [],
      activeIngredients: [],
      duplicateGroup: '',
      allergyKeywords: [],
      isActive: true,
    };

    let createdDoc;
    try {
      createdDoc = await Medicine.create(newMedicinePayload);
    } catch (err) {
      // Handle MongoDB E11000 duplicate key race
      if (
        err.code === 11000 ||
        err.name === 'MongoServerError' ||
        (err.message && err.message.includes('already exists'))
      ) {
        createdDoc = await findExistingMedicine(canonicalName);
        if (createdDoc) {
          resolveLock(createdDoc);
          return createdDoc;
        }
      }
      throw err;
    }

    resolveLock(createdDoc);
    return createdDoc;
  } catch (err) {
    rejectLock(err);
    throw err;
  } finally {
    pendingCreations.delete(normKey);
  }
};

module.exports = {
  normalizeMedicineName,
  formatCanonicalName,
  findExistingMedicine,
  findOrCreateMedicineMaster,
};
