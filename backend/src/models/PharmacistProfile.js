const mongoose = require('mongoose');

const pharmacistProfileSchema = new mongoose.Schema(
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
    pharmacyRegistrationNumber: {
      type: String,
      required: [true, 'Pharmacy Registration Number is required'],
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true,
    },
    otherQualification: {
      type: String,
      default: '',
      trim: true,
    },
    specialization: {
      type: String,
      default: '',
      trim: true,
    },
    otherSpecialization: {
      type: String,
      default: '',
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Years of experience cannot be negative'],
    },
    pharmacyHospitalName: {
      type: String,
      required: [true, 'Pharmacy / Hospital name is required'],
      trim: true,
    },
    pharmacyHospitalAddress: {
      type: String,
      required: [true, 'Pharmacy / Hospital address is required'],
      trim: true,
    },
    professionalContactNumber: {
      type: String,
      default: '',
      trim: true,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

pharmacistProfileSchema.virtual('workplaceName').get(function () {
  return this.pharmacyHospitalName || '';
});

pharmacistProfileSchema.virtual('workplaceAddress').get(function () {
  return this.pharmacyHospitalAddress || '';
});

pharmacistProfileSchema.virtual('hospitalClinicName').get(function () {
  return this.pharmacyHospitalName || '';
});

pharmacistProfileSchema.virtual('hospitalClinicAddress').get(function () {
  return this.pharmacyHospitalAddress || '';
});

const PharmacistProfile = mongoose.model('PharmacistProfile', pharmacistProfileSchema);

module.exports = PharmacistProfile;
