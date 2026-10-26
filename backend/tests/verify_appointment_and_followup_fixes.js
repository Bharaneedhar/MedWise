const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const Consultation = require('../src/models/Consultation');
const Appointment = require('../src/models/Appointment');

const { createConsultation } = require('../src/controllers/consultationController');
const { createAppointment, getDoctorAppointments } = require('../src/controllers/appointmentController');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runVerification() {
  console.log('=== STARTING APPOINTMENT DATE & FOLLOW-UP REQUIRED VERIFICATION ===\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    const ts = Date.now();
    const docEmail = `doc_fup_${ts}@medwise.com`;
    const patEmail = `pat_fup_${ts}@medwise.com`;
    const patMobile = `98${String(ts).slice(-8)}`;
    const expectedPid = `PID-${patMobile.slice(-10)}`;

    const docUser = await User.create({
      name: `Dr. Followup Tester ${ts}`,
      email: docEmail,
      password: 'password123',
      role: 'doctor',
    });
    await DoctorProfile.create({
      userId: docUser._id,
      mobileNumber: '9876543210',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: { addressLine1: 'Clinic St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-FUP-${ts}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 10,
      hospitalClinicName: 'City Hospital',
      hospitalClinicAddress: 'Main St',
      licenseNumber: `LIC-FUP-${ts}`,
      profileCompleted: true,
    });

    const patUser = await User.create({
      name: `Patient Followup ${ts}`,
      email: patEmail,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: patUser._id,
      mobileNumber: patMobile,
      dateOfBirth: '1992-05-20',
      gender: 'Female',
      address: { addressLine1: 'Pat Rd', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      emergencyContact: { name: 'Emergency', relationship: 'Parent', mobileNumber: '9876543210' },
      profileCompleted: true,
    });

    console.log('[Setup] Created test Doctor & Patient accounts.');

    // -----------------------------------------------------------------
    // TEST 1: Consultation with Follow-up Required = "Yes"
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Consultation with Follow-up Required = YES ---');
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reqYes = {
      user: docUser,
      body: {
        patientId: patUser._id.toString(),
        patientPid: expectedPid,
        consultationDate: new Date().toISOString().split('T')[0],
        consultationType: 'In-person',
        reasonForVisit: 'Hypertension follow-up evaluation',
        clinicalNotes: 'Blood pressure slightly elevated.',
        diagnosisNotes: 'Essential Hypertension',
        doctorRecommendations: 'Continue low sodium diet',
        followUpRequired: 'Yes',
        status: 'Follow-up Needed',
        followUpDate: futureDate,
      },
    };
    const resYes = mockRes();
    await createConsultation(reqYes, resYes, (err) => { if (err) throw err; });

    if (!resYes.data?.success || !resYes.data.consultation) {
      throw new Error(`TEST 1 FAIL: Failed to create consultation with Yes. Msg: ${resYes.data?.message}`);
    }

    const consultYes = resYes.data.consultation;
    if (consultYes.status !== 'Follow-up Needed') {
      throw new Error(`TEST 1 FAIL: Expected status 'Follow-up Needed', got: ${consultYes.status}`);
    }
    if (!consultYes.followUpDate) {
      throw new Error('TEST 1 FAIL: Expected followUpDate to be set!');
    }
    console.log('✓ Consultation created with status "Follow-up Needed" and saved followUpDate:', consultYes.followUpDate);

    // Verify auto-created Follow-Up appointment in MongoDB
    const followUpAppt = await Appointment.findOne({ consultationId: consultYes._id, appointmentType: 'FOLLOW_UP' });
    if (!followUpAppt) {
      throw new Error('TEST 1 FAIL: Follow-up appointment was not auto-created!');
    }
    console.log('✓ Auto-created follow-up appointment found in DB:', followUpAppt.appointmentId);

    // -----------------------------------------------------------------
    // TEST 2: Consultation with Follow-up Required = "No"
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Consultation with Follow-up Required = NO ---');
    const reqNo = {
      user: docUser,
      body: {
        patientId: patUser._id.toString(),
        patientPid: expectedPid,
        consultationDate: new Date().toISOString().split('T')[0],
        consultationType: 'In-person',
        reasonForVisit: 'Routine Wellness Checkup',
        clinicalNotes: 'All parameters normal.',
        diagnosisNotes: 'Healthy',
        doctorRecommendations: 'Annual review next year',
        followUpRequired: 'No',
        status: 'Completed',
        followUpDate: '',
      },
    };
    const resNo = mockRes();
    await createConsultation(reqNo, resNo, (err) => { if (err) throw err; });

    if (!resNo.data?.success || !resNo.data.consultation) {
      throw new Error(`TEST 2 FAIL: Failed to create consultation with No. Msg: ${resNo.data?.message}`);
    }

    const consultNo = resNo.data.consultation;
    if (consultNo.status !== 'Completed') {
      throw new Error(`TEST 2 FAIL: Expected status 'Completed', got: ${consultNo.status}`);
    }
    if (consultNo.followUpDate) {
      throw new Error('TEST 2 FAIL: Expected followUpDate to be null/undefined when No is selected!');
    }
    console.log('✓ Consultation created with status "Completed" and cleared followUpDate');

    const noFollowUpAppt = await Appointment.findOne({ consultationId: consultNo._id });
    if (noFollowUpAppt) {
      throw new Error('TEST 2 FAIL: Follow-up appointment should NOT exist when No is selected!');
    }
    console.log('✓ Verified no follow-up appointment was created in DB for Completed consultation');

    // -----------------------------------------------------------------
    // TEST 3: Doctor Appointments API Verification
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Doctor Appointments API Verification ---');
    const reqAppts = { user: docUser };
    const resAppts = mockRes();
    await getDoctorAppointments(reqAppts, resAppts, (err) => { if (err) throw err; });

    if (!resAppts.data?.success) {
      throw new Error(`TEST 3 FAIL: getDoctorAppointments failed! Msg: ${resAppts.data?.message}`);
    }

    const allAppts = resAppts.data.appointments || [];
    const followUps = resAppts.data.categorized?.followUps?.allScheduled || [];

    const foundInFollowUp = followUps.some((f) => String(f.patientId._id || f.patientId) === String(patUser._id));
    const foundInAll = allAppts.some((a) => String(a.patientId._id || a.patientId) === String(patUser._id));

    if (!foundInFollowUp && !foundInAll) {
      throw new Error('TEST 3 FAIL: Created follow-up appointment missing from doctor appointments response!');
    }
    console.log('✓ Follow-up appointment present in doctor appointments dashboard response');

    // Clean up test data
    console.log('\nCleaning up test records...');
    await User.deleteMany({ _id: { $in: [docUser._id, patUser._id] } });
    await DoctorProfile.deleteMany({ userId: docUser._id });
    await PatientProfile.deleteMany({ userId: patUser._id });
    await Consultation.deleteMany({ patientId: patUser._id });
    await Appointment.deleteMany({ patientId: patUser._id });

    console.log('\n==================================================');
    console.log('ALL APPOINTMENT & FOLLOW-UP VERIFICATION TESTS PASSED!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB');
  }
}

runVerification();
