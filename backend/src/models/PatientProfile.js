const mongoose = require('mongoose');

const medicalConditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    sinceYear: {
      type: Number,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const currentMedicationSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
    },
    name: {
      type: String,
      trim: true,
    },
    genericName: {
      type: String,
      default: '',
      trim: true,
    },
    strength: {
      type: String,
      default: '',
      trim: true,
    },
    dosage: {
      type: String,
      default: '',
      trim: true,
    },
    frequency: {
      type: String,
      default: '',
      trim: true,
    },
    duration: {
      type: String,
      default: '',
      trim: true,
    },
    route: {
      type: String,
      default: '',
      trim: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    source: {
      type: String,
      enum: ['PATIENT_REPORTED', 'PRESCRIPTION'],
      default: 'PATIENT_REPORTED',
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    stoppedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }
);

const previousSurgerySchema = new mongoose.Schema(
  {
    surgeryName: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
    },
    hospital: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const patientProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      unique: true,
      index: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['Male', 'Female', 'Other', 'Prefer not to say'],
        message: '{VALUE} is not a valid gender option',
      },
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    address: {
      addressLine1: {
        type: String,
        required: [true, 'Address Line 1 is required'],
        trim: true,
      },
      addressLine2: {
        type: String,
        default: '',
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
      },
      pinCode: {
        type: String,
        required: [true, 'PIN/ZIP Code is required'],
        trim: true,
      },
    },
    emergencyContact: {
      name: {
        type: String,
        required: [true, 'Emergency contact name is required'],
        trim: true,
      },
      relationship: {
        type: String,
        required: [true, 'Emergency contact relationship is required'],
        enum: {
          values: ['Parent', 'Spouse', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'],
          message: '{VALUE} is not a valid relationship option',
        },
      },
      mobileNumber: {
        type: String,
        required: [true, 'Emergency contact mobile number is required'],
        trim: true,
      },
    },
    bloodGroup: {
      type: String,
      default: '',
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown', ''],
        message: '{VALUE} is not a valid blood group option',
      },
    },
    medicalConditions: {
      type: [medicalConditionSchema],
      default: [],
    },
    currentMedications: {
      type: [currentMedicationSchema],
      default: [],
    },
    previousSurgeries: {
      type: [previousSurgerySchema],
      default: [],
    },
    hasNoKnownAllergies: {
      type: Boolean,
      default: false,
    },
    allergies: {
      type: [String],
      default: [],
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const PatientProfile = mongoose.model('PatientProfile', patientProfileSchema);

module.exports = PatientProfile;
