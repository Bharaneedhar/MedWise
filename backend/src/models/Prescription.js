const mongoose = require('mongoose');

const medicineItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
  },
  genericName: {
    type: String,
    trim: true,
  },
  medicineName: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true,
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required (e.g. 500mg)'],
    trim: true,
  },
  dosageForm: {
    type: String,
    trim: true,
  },
  strength: {
    type: String,
    trim: true,
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required (e.g. Twice daily)'],
    trim: true,
  },
  duration: {
    type: String,
    required: [true, 'Duration is required (e.g. 5 days)'],
    trim: true,
  },
  route: {
    type: String,
    trim: true,
    default: 'Oral',
  },
  instructions: {
    type: String,
    trim: true,
    default: '',
  },
});

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorSpecialization: {
      type: String,
      trim: true,
      default: 'General Medicine',
    },
    doctorMedicalRegistrationNumber: {
      type: String,
      trim: true,
      default: '',
    },
    doctorQualification: {
      type: String,
      trim: true,
      default: '',
    },
    doctorHospitalClinicName: {
      type: String,
      trim: true,
      default: '',
    },
    doctorHospitalClinicAddress: {
      type: String,
      trim: true,
      default: '',
    },
    doctorProfessionalContactNumber: {
      type: String,
      trim: true,
      default: '',
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientPid: {
      type: String,
      required: true,
      trim: true,
    },
    patientAge: {
      type: Number,
      default: 0,
    },
    patientGender: {
      type: String,
      trim: true,
      default: '',
    },
    patientBloodGroup: {
      type: String,
      trim: true,
      default: '',
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
    },
    followUpDate: {
      type: Date,
    },
    clinicalDiagnosis: {
      type: String,
      trim: true,
      default: '',
    },
    doctorNotes: {
      type: String,
      trim: true,
      default: '',
    },
    medicines: {
      type: [medicineItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A prescription must contain at least one medicine',
      },
    },
    medwiseChecks: {
      status: {
        type: String,
        enum: ['Pending Review', 'Review Recommended', 'Critical Alerts', 'Cleared / Approved', 'Engine Offline'],
        default: 'Pending Review',
      },
      dosageCheck: {
        passed: { type: Boolean, default: true },
        message: { type: String, default: 'Dosage check pending clinical safety engine evaluation.' },
      },
      drugInteractionCheck: {
        passed: { type: Boolean, default: true },
        severity: { type: String, default: 'None' },
        message: { type: String, default: 'Drug interaction check pending clinical safety engine evaluation.' },
      },
      duplicateMedicationCheck: {
        passed: { type: Boolean, default: true },
        message: { type: String, default: 'Duplicate medication check pending evaluation.' },
      },
      allergySafetyCheck: {
        passed: { type: Boolean, default: true },
        message: { type: String, default: 'Allergy safety evaluation pending engine connection.' },
      },
      prescriptionAudit: {
        passed: { type: Boolean, default: true },
        message: { type: String, default: 'Prescription audit checks will be performed upon engine connection.' },
      },
      overallRecommendation: {
        type: String,
        default: 'Review Pending (Engine Offline)',
      },
      checkedAt: {
        type: Date,
      },
    },
    medwiseAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'Draft',
        'MedWise Review Required',
        'Review Recommended',
        'Approved',
        'Sent to Pharmacist',
        'Dispensed',
        'Delivered',
      ],
      default: 'Draft',
    },
    doctorDecision: {
      type: String,
      enum: ['Pending Decision', 'Approved', 'Modified and Approved', 'Rejected'],
      default: 'Pending Decision',
    },
    approvedAt: {
      type: Date,
    },
    pharmacistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dispensedAt: {
      type: Date,
    },
    deliveredByPharmacistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

prescriptionSchema.virtual('hospitalClinicName').get(function () {
  return this.doctorHospitalClinicName || '';
});

prescriptionSchema.virtual('hospitalClinicAddress').get(function () {
  return this.doctorHospitalClinicAddress || '';
});

prescriptionSchema.virtual('workplaceName').get(function () {
  return this.doctorHospitalClinicName || '';
});

prescriptionSchema.virtual('workplaceAddress').get(function () {
  return this.doctorHospitalClinicAddress || '';
});

prescriptionSchema.virtual('pharmacyHospitalName').get(function () {
  return this.doctorHospitalClinicName || '';
});

prescriptionSchema.virtual('pharmacyHospitalAddress').get(function () {
  return this.doctorHospitalClinicAddress || '';
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
