const mongoose = require('mongoose');

const medicineSafetyRuleSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine reference is required'],
      index: true,
    },
    safetyType: {
      type: String,
      enum: ['allergy', 'contraindication', 'precaution', 'warning'],
      required: [true, 'Safety type is required'],
      index: true,
    },
    trigger: {
      type: String,
      required: [true, 'Trigger condition/allergen is required'],
      trim: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['Minor', 'Moderate', 'Severe', 'Life-Threatening', 'Contraindicated'],
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

medicineSafetyRuleSchema.index({ medicine: 1, safetyType: 1 });

module.exports = mongoose.model('MedicineSafetyRule', medicineSafetyRuleSchema);
