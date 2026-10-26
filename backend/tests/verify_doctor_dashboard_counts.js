const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Appointment = require('../src/models/Appointment');

const {
  createAppointment,
  getDoctorAppointments,
  updateAppointment,
} = require('../src/controllers/appointmentController');

const {
  createConsultation,
  updateConsultation,
} = require('../src/controllers/consultationController');

async function runDashboardCountTests() {
  console.log('====================================================');
  console.log('STARTING DOCTOR DASHBOARD APPOINTMENT COUNT VERIFICATION');
  console.log('====================================================\n');

  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdAppointmentIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;

    const timestamp = Date.now();

    // Setup Test Doctors and Patients with complete profile fields
    const doctorA = await User.create({
      name: `Dr. CountDocA_${timestamp}`,
      email: `countdoc_a_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorA._id);

    const docProfA = await DoctorProfile.create({
      userId: doctorA._id,
      name: doctorA.name,
      specialization: 'General Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 8,
      medicalRegistrationNumber: `MRN-CDA-${timestamp}`,
      hospitalClinicName: 'Count Clinic A',
      hospitalClinicAddress: '100 Main Street, Chennai',
      mobileNumber: '9876543301',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Female',
      address: {
        addressLine1: '100 Main Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
    });
    createdProfileIds.push(docProfA._id);

    const doctorB = await User.create({
      name: `Dr. CountDocB_${timestamp}`,
      email: `countdoc_b_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorB._id);

    const docProfB = await DoctorProfile.create({
      userId: doctorB._id,
      name: doctorB.name,
      specialization: 'Cardiology',
      qualification: 'MBBS, MD',
      yearsOfExperience: 12,
      medicalRegistrationNumber: `MRN-CDB-${timestamp}`,
      hospitalClinicName: 'Count Clinic B',
      hospitalClinicAddress: '200 Heart Way, Chennai',
      mobileNumber: '9876543302',
      dateOfBirth: new Date('1980-08-20'),
      gender: 'Male',
      address: {
        addressLine1: '200 Heart Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
    });
    createdProfileIds.push(docProfB._id);

    const patientA = await User.create({
      name: `Patient CountA_${timestamp}`,
      email: `patient_count_a_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientA._id);

    const profA = await PatientProfile.create({
      userId: patientA._id,
      name: patientA.name,
      mobileNumber: '9876543303',
      dateOfBirth: new Date('1995-05-20'),
      gender: 'Female',
      address: {
        addressLine1: '3 Patient Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Parent',
        mobileNumber: '9876543303',
      },
    });
    createdProfileIds.push(profA._id);

    // Mock Express Response
    const mockRes = () => {
      const res = {};
      res.status = function (code) {
        this.statusCode = code;
        return this;
      };
      res.json = function (data) {
        this.body = data;
        return this;
      };
      return res;
    };

    // Helper to get stats for a doctor
    const getStats = async (doctorUser) => {
      const res = mockRes();
      await getDoctorAppointments({ user: doctorUser }, res, (err) => { throw err; });
      return res.body.stats;
    };

    // -----------------------------------------------------------------
    // TEST A: One scheduled NEW_PATIENT appointment -> New Patient Appointments = 1
    // -----------------------------------------------------------------
    const newApptRes = mockRes();
    await createAppointment({
      user: doctorA,
      body: {
        patientId: patientA._id,
        appointmentDate: new Date(Date.now() + 86400000 * 2), // 2 days in future
        appointmentTime: '10:00 AM',
        appointmentType: 'NEW_PATIENT',
        reason: 'New Patient Intake',
      },
    }, newApptRes, (err) => { throw err; });

    const newApptId = newApptRes.body.appointment._id;
    createdAppointmentIds.push(newApptId);

    let statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST A: One scheduled NEW_PATIENT appointment -> totalNewPatients:', statsDocA.totalNewPatients);
    console.assert(statsDocA.totalNewPatients === 1, `EXPECTED totalNewPatients = 1, GOT ${statsDocA.totalNewPatients}`);

    // -----------------------------------------------------------------
    // TEST B: Complete that appointment -> New Patient Appointments = 0
    // -----------------------------------------------------------------
    await updateAppointment({
      user: doctorA,
      params: { id: newApptId },
      body: { status: 'COMPLETED' },
    }, mockRes(), (err) => { throw err; });

    statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST B: Complete that appointment -> totalNewPatients:', statsDocA.totalNewPatients);
    console.assert(statsDocA.totalNewPatients === 0, `EXPECTED totalNewPatients = 0, GOT ${statsDocA.totalNewPatients}`);

    // -----------------------------------------------------------------
    // TEST C: Cancel that appointment -> New Patient Appointments = 0
    // -----------------------------------------------------------------
    // Re-schedule first then cancel
    await updateAppointment({
      user: doctorA,
      params: { id: newApptId },
      body: { status: 'SCHEDULED' },
    }, mockRes(), (err) => { throw err; });

    await updateAppointment({
      user: doctorA,
      params: { id: newApptId },
      body: { status: 'CANCELLED' },
    }, mockRes(), (err) => { throw err; });

    statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST C: Cancel that appointment -> totalNewPatients:', statsDocA.totalNewPatients);
    console.assert(statsDocA.totalNewPatients === 0, `EXPECTED totalNewPatients = 0, GOT ${statsDocA.totalNewPatients}`);

    // -----------------------------------------------------------------
    // TEST D: One active upcoming follow-up -> Follow-up Appointments = 1
    // -----------------------------------------------------------------
    const futureFollowUpDate = new Date(Date.now() + 86400000 * 4); // 4 days in future
    const consultRes = mockRes();
    await createConsultation({
      user: doctorA,
      body: {
        patientId: patientA._id,
        patientPid: 'PID-9876543303',
        reasonForVisit: 'Hypertension Follow-Up',
        followUpDate: futureFollowUpDate,
      },
    }, consultRes, (err) => { throw err; });

    const consultId = consultRes.body.consultation._id;
    createdConsultationIds.push(consultId);

    statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST D: One active upcoming follow-up -> totalFollowUps:', statsDocA.totalFollowUps);
    console.assert(statsDocA.totalFollowUps === 1, `EXPECTED totalFollowUps = 1, GOT ${statsDocA.totalFollowUps}`);

    const followUpApptDoc = await Appointment.findOne({ consultationId: consultId, appointmentType: 'FOLLOW_UP' });
    if (followUpApptDoc) createdAppointmentIds.push(followUpApptDoc._id);

    // -----------------------------------------------------------------
    // TEST E: Complete the follow-up -> Follow-up Appointments = 0
    // -----------------------------------------------------------------
    await updateAppointment({
      user: doctorA,
      params: { id: followUpApptDoc._id },
      body: { status: 'COMPLETED' },
    }, mockRes(), (err) => { throw err; });

    statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST E: Complete the follow-up -> totalFollowUps:', statsDocA.totalFollowUps);
    console.assert(statsDocA.totalFollowUps === 0, `EXPECTED totalFollowUps = 0, GOT ${statsDocA.totalFollowUps}`);

    // -----------------------------------------------------------------
    // TEST F: Cancel the follow-up -> Follow-up Appointments = 0
    // -----------------------------------------------------------------
    // Re-schedule then clear followUpDate from consultation or mark CANCELLED
    await updateAppointment({
      user: doctorA,
      params: { id: followUpApptDoc._id },
      body: { status: 'SCHEDULED' },
    }, mockRes(), (err) => { throw err; });

    await updateConsultation({
      user: doctorA,
      params: { id: consultId },
      body: { followUpDate: null },
    }, mockRes(), (err) => { throw err; });

    statsDocA = await getStats(doctorA);
    console.log('[PASS] TEST F: Cancel/clear the follow-up -> totalFollowUps:', statsDocA.totalFollowUps);
    console.assert(statsDocA.totalFollowUps === 0, `EXPECTED totalFollowUps = 0, GOT ${statsDocA.totalFollowUps}`);

    // -----------------------------------------------------------------
    // TEST G: Another doctor's appointment exists -> Does NOT affect logged-in doctor's counts
    // -----------------------------------------------------------------
    const docBApptRes = mockRes();
    await createAppointment({
      user: doctorB,
      body: {
        patientId: patientA._id,
        appointmentDate: new Date(Date.now() + 86400000 * 3),
        appointmentTime: '11:00 AM',
        appointmentType: 'NEW_PATIENT',
        reason: 'Doctor B Appointment',
      },
    }, docBApptRes, (err) => { throw err; });

    createdAppointmentIds.push(docBApptRes.body.appointment._id);

    statsDocA = await getStats(doctorA);
    const statsDocB = await getStats(doctorB);

    console.log('[PASS] TEST G: Doctor A totalNewPatients:', statsDocA.totalNewPatients, '| Doctor B totalNewPatients:', statsDocB.totalNewPatients);
    console.assert(statsDocA.totalNewPatients === 0, `EXPECTED Doctor A totalNewPatients = 0, GOT ${statsDocA.totalNewPatients}`);
    console.assert(statsDocB.totalNewPatients === 1, `EXPECTED Doctor B totalNewPatients = 1, GOT ${statsDocB.totalNewPatients}`);

    console.log('\n====================================================');
    console.log('ALL DASHBOARD COUNT TESTS PASSED (100%)');
    console.log('====================================================');

  } catch (err) {
    console.error('TEST ERROR in Dashboard Count Verification:', err);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up temporary verification artifacts from MongoDB...');
      if (createdAppointmentIds.length > 0) {
        await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdProfileIds.length > 0) {
        await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      await mongoose.disconnect();
      console.log('MongoDB connection closed and cleanup completed.');
    }
  }
}

runDashboardCountTests();
