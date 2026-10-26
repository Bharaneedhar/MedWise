const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    patientPid: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
      index: true,
    },
    appointmentTime: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentType: {
      type: String,
      enum: ['NEW_PATIENT', 'FOLLOW_UP'],
      default: 'NEW_PATIENT',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    department: {
      type: String,
      trim: true,
      default: '',
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
