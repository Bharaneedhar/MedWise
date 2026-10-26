const mongoose = require('mongoose');

const activeIngredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Active ingredient name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    unit: {
      type: String,
      trim: true,
      default: 'mg',
    },
  },
  { _id: false }
);

const strengthSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      required: [true, 'Strength value is required'],
    },
    unit: {
      type: String,
      required: [true, 'Strength unit is required'],
      trim: true,
      default: 'mg',
    },
    dosageForm: {
      type: String,
      required: [true, 'Dosage form for strength is required'],
      trim: true,
    },
  },
  { _id: false }
);

const dosageGuidelineSchema = new mongoose.Schema(
  {
    population: {
      type: String,
      enum: ['Adult', 'Pediatric', 'Elderly', 'Renal Impairment', 'Hepatic Impairment'],
      required: true,
      default: 'Adult',
    },
    minimumDose: {
      type: Number,
      default: null,
    },
    minimumDoseUnit: {
      type: String,
      trim: true,
      default: 'mg',
    },
    maximumSingleDose: {
      type: Number,
      default: null,
    },
    maximumSingleDoseUnit: {
      type: String,
      trim: true,
      default: 'mg',
    },
    maximumDailyDose: {
      type: Number,
      default: null,
    },
    maximumDailyDoseUnit: {
      type: String,
      trim: true,
      default: 'mg',
    },
    frequencyGuidance: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    evidenceSource: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const medicineSchema = new mongoose.Schema(
  {
    genericName: {
      type: String,
      required: [true, 'Generic name is required'],
      trim: true,
      unique: true,
      index: true,
    },
    brandNames: {
      type: [String],
      default: [],
      index: true,
    },
    drugClass: {
      type: String,
      required: false,
      default: 'Unclassified',
      trim: true,
      index: true,
    },
    therapeuticCategory: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    activeIngredients: {
      type: [activeIngredientSchema],
      default: [],
    },
    dosageForms: {
      type: [String],
      default: [],
    },
    availableStrengths: {
      type: [strengthSchema],
      default: [],
    },
    routes: {
      type: [String],
      default: ['Oral'],
    },
    dosageGuidelines: {
      type: [dosageGuidelineSchema],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    contraindications: {
      type: [String],
      default: [],
    },
    duplicateGroup: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    allergyKeywords: {
      type: [String],
      default: [],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    normalizedName: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-validate hook: normalize and trim genericName
medicineSchema.pre('validate', function (next) {
  if (this.genericName && typeof this.genericName === 'string') {
    this.genericName = this.genericName.trim();
    if (!this.normalizedName) {
      this.normalizedName = this.genericName.trim().replace(/\s+/g, ' ').toLowerCase();
    }
  }
  next();
});

// Pre-save hook: enforce case-insensitive uniqueness on genericName
medicineSchema.pre('save', async function (next) {
  if (this.isModified('genericName') && this.genericName) {
    const trimmed = this.genericName.trim().replace(/\s+/g, ' ');
    const escapedWords = trimmed
      .split(' ')
      .map((w) => w.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'))
      .join('\\s+');
    const existing = await this.constructor.findOne({
      _id: { $ne: this._id },
      genericName: { $regex: new RegExp(`^${escapedWords}$`, 'i') },
    });
    if (existing) {
      const err = new Error(`Medicine with generic name '${trimmed}' already exists (matches '${existing.genericName}')`);
      err.name = 'MongoServerError';
      err.code = 11000;
      return next(err);
    }
  }
  next();
});

// Explicit indexes for search and lookup performance
medicineSchema.index({ 'activeIngredients.name': 1 });
medicineSchema.index({ genericName: 1, isActive: 1 });
medicineSchema.index({ brandNames: 1, isActive: 1 });

const Medicine = mongoose.model('Medicine', medicineSchema, 'medicines');

module.exports = Medicine;
