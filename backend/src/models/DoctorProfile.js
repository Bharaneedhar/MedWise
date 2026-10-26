const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
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
    medicalRegistrationNumber: {
      type: String,
      required: [true, 'Medical Registration Number is required'],
      trim: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
    },
    otherSpecialization: {
      type: String,
      default: '',
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
    yearsOfExperience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Years of experience cannot be negative'],
    },
    hospitalClinicName: {
      type: String,
      required: [true, 'Hospital / Clinic name is required'],
      trim: true,
    },
    hospitalClinicAddress: {
      type: String,
      required: [true, 'Hospital / Clinic address is required'],
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

doctorProfileSchema.virtual('workplaceName').get(function () {
  return this.hospitalClinicName || '';
});

doctorProfileSchema.virtual('workplaceAddress').get(function () {
  return this.hospitalClinicAddress || '';
});

doctorProfileSchema.virtual('pharmacyHospitalName').get(function () {
  return this.hospitalClinicName || '';
});

doctorProfileSchema.virtual('pharmacyHospitalAddress').get(function () {
  return this.hospitalClinicAddress || '';
});

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);

module.exports = DoctorProfile;
