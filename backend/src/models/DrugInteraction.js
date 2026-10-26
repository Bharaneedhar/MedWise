const mongoose = require('mongoose');

const drugInteractionSchema = new mongoose.Schema(
  {
    medicineA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine A is required'],
      index: true,
    },
    medicineB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine B is required'],
      index: true,
    },
    interactionPairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    interactionType: {
      type: String,
      trim: true,
      default: 'Drug-Drug',
    },
    severity: {
      type: String,
      enum: ['Minor', 'Moderate', 'Major', 'Contraindicated'],
      default: 'Moderate',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    clinicalEffect: {
      type: String,
      trim: true,
      default: '',
    },
    recommendedAction: {
      type: String,
      trim: true,
      default: '',
    },
    evidenceSource: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to generate canonical order-independent pair key
drugInteractionSchema.pre('validate', function (next) {
  if (this.medicineA && this.medicineB) {
    const idA = String(this.medicineA);
    const idB = String(this.medicineB);

    if (idA === idB) {
      return next(new Error('Drug interaction cannot be defined between a medicine and itself'));
    }

    const sorted = [idA, idB].sort();
    this.interactionPairKey = `${sorted[0]}_${sorted[1]}`;
  }
  next();
});

// Compound indexes for fast lookup
drugInteractionSchema.index({ medicineA: 1, medicineB: 1 });

module.exports = mongoose.model('DrugInteraction', drugInteractionSchema);
