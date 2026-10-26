const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    patientPid: {
      type: String,
      trim: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
    },
    doctorSpecialization: {
      type: String,
      trim: true,
      default: 'General Medicine',
    },
    hospitalClinicName: {
      type: String,
      trim: true,
      default: '',
    },
    hospitalClinicLocation: {
      type: String,
      trim: true,
      default: '',
    },
    consultationDate: {
      type: Date,
      default: Date.now,
    },
    consultationType: {
      type: String,
      enum: ['In-person', 'Online'],
      default: 'In-person',
    },
    reasonForVisit: {
      type: String,
      trim: true,
      default: '',
    },
    clinicalNotes: {
      type: String,
      trim: true,
      default: '',
    },
    diagnosisNotes: {
      type: String,
      trim: true,
      default: '',
    },
    doctorRecommendations: {
      type: String,
      trim: true,
      default: '',
    },
    followUpDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Completed', 'Follow-up Needed', 'In Progress', 'Cancelled'],
      default: 'Completed',
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    vitals: {
      bloodPressure: {
        systolic: {
          type: Number,
        },
        diastolic: {
          type: Number,
        },
        unit: {
          type: String,
          default: 'mmHg',
        },
      },
      temperature: {
        type: Number,
      },
      temperatureUnit: {
        type: String,
        default: '°C',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Consultation', consultationSchema);
