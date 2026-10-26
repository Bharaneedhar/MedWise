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
const { getMyConsultations } = require('../src/controllers/consultationController');

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

async function runTests() {
  console.log('=== STARTING PATIENT UPCOMING FOLLOW-UP VERIFICATION ===\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    const ts = Date.now();
    const docEmail = `doc_puf_${ts}@medwise.com`;
    const pat1Email = `pat1_puf_${ts}@medwise.com`;
    const pat2Email = `pat2_puf_${ts}@medwise.com`;

    // 1. Create Doctor
    const docUser = await User.create({
      name: `Dr. APJ Karthik ${ts}`,
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
      medicalRegistrationNumber: `REG-PUF-${ts}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 10,
      hospitalClinicName: 'Apollo Speciality Clinic',
      hospitalClinicAddress: 'Main St',
      licenseNumber: `LIC-PUF-${ts}`,
      profileCompleted: true,
    });

    // 2. Create Patient 1 (Anees)
    const pat1User = await User.create({
      name: `Anees ${ts}`,
      email: pat1Email,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: pat1User._id,
      mobileNumber: `98${String(ts).slice(-8)}`,
      dateOfBirth: '1995-03-15',
      gender: 'Male',
      address: { addressLine1: 'Pat Rd', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      emergencyContact: { name: 'Emergency', relationship: 'Parent', mobileNumber: '9876543210' },
      profileCompleted: true,
    });

    // 3. Create Patient 2 (Other Patient)
    const pat2User = await User.create({
      name: `Other Patient ${ts}`,
      email: pat2Email,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: pat2User._id,
      mobileNumber: `97${String(ts).slice(-8)}`,
      dateOfBirth: '1990-08-20',
      gender: 'Female',
      address: { addressLine1: 'Pat Rd 2', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      emergencyContact: { name: 'Emergency', relationship: 'Parent', mobileNumber: '9876543211' },
      profileCompleted: true,
    });

    console.log('[Setup] Created test Doctor & 2 Patient accounts.');

    // 4. Create Consultations for Patient 1 (Anees)
    const futureDate1 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // +5 days
    const futureDate2 = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000); // +12 days
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // -5 days

    // Consult A: Future follow-up (+5 days)
    const cA = await Consultation.create({
      patientId: pat1User._id,
      doctorId: docUser._id,
      patientName: pat1User.name,
      patientPid: 'PID-9876543210',
      doctorName: docUser.name,
      hospitalClinicName: 'Apollo Speciality Clinic',
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'Hypertension Follow-up',
      status: 'Follow-up Needed',
      followUpDate: futureDate1,
    });

    // Consult B: Far Future follow-up (+12 days)
    const cB = await Consultation.create({
      patientId: pat1User._id,
      doctorId: docUser._id,
      patientName: pat1User.name,
      patientPid: 'PID-9876543210',
      doctorName: docUser.name,
      hospitalClinicName: 'Apollo Speciality Clinic',
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'Cardiology Check',
      status: 'Follow-up Needed',
      followUpDate: futureDate2,
    });

    // Consult C: Past follow-up (-5 days)
    const cC = await Consultation.create({
      patientId: pat1User._id,
      doctorId: docUser._id,
      patientName: pat1User.name,
      patientPid: 'PID-9876543210',
      doctorName: docUser.name,
      hospitalClinicName: 'Apollo Speciality Clinic',
      consultationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      consultationType: 'In-person',
      reasonForVisit: 'Initial Assessment',
      status: 'Completed',
      followUpDate: pastDate,
    });

    // Consult D: Completed (No follow-up date)
    const cD = await Consultation.create({
      patientId: pat1User._id,
      doctorId: docUser._id,
      patientName: pat1User.name,
      patientPid: 'PID-9876543210',
      doctorName: docUser.name,
      hospitalClinicName: 'Apollo Speciality Clinic',
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'General Checkup',
      status: 'Completed',
      followUpDate: null,
    });

    // Consult E: Patient 2's Consultation (+3 days)
    const cE = await Consultation.create({
      patientId: pat2User._id,
      doctorId: docUser._id,
      patientName: pat2User.name,
      patientPid: 'PID-9776543211',
      doctorName: docUser.name,
      hospitalClinicName: 'Apollo Speciality Clinic',
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'Other Patient Follow-up',
      status: 'Follow-up Needed',
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    // -----------------------------------------------------------------
    // TEST 1: Fetch Consultations as Patient 1 (Anees)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Fetching Consultations as Patient 1 (Anees) ---');
    const reqPat1 = { user: pat1User };
    const resPat1 = mockRes();
    await getMyConsultations(reqPat1, resPat1, (err) => { if (err) throw err; });

    if (!resPat1.data?.success || !Array.isArray(resPat1.data.consultations)) {
      throw new Error(`TEST 1 FAIL: getMyConsultations failed! Msg: ${resPat1.data?.message}`);
    }

    const pat1Consultations = resPat1.data.consultations;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const upcomingFollowUps = pat1Consultations
      .filter((c) => c && c.followUpDate && new Date(c.followUpDate) >= startOfToday)
      .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

    console.log(`✓ Total consultations for Patient 1: ${pat1Consultations.length}`);
    console.log(`✓ Total upcoming follow-ups for Patient 1: ${upcomingFollowUps.length}`);

    // Verify 1: Exactly 2 upcoming follow-ups (cA and cB)
    if (upcomingFollowUps.length !== 2) {
      throw new Error(`TEST 1 FAIL: Expected 2 upcoming follow-ups, got ${upcomingFollowUps.length}`);
    }

    // Verify 2: Sorted by nearest date first (+5 days before +12 days)
    if (String(upcomingFollowUps[0]._id) !== String(cA._id)) {
      throw new Error('TEST 1 FAIL: Upcoming follow-ups are not sorted by nearest date first!');
    }
    console.log('✓ Sorted by nearest date first (Nearest: ' + upcomingFollowUps[0].followUpDate + ')');

    // Verify 3: Correct doctor and hospital clinic displayed
    if (upcomingFollowUps[0].doctorName !== docUser.name) {
      throw new Error(`TEST 1 FAIL: Doctor name mismatch. Expected ${docUser.name}, got ${upcomingFollowUps[0].doctorName}`);
    }
    if (upcomingFollowUps[0].hospitalClinicName !== 'Apollo Speciality Clinic') {
      throw new Error('TEST 1 FAIL: Hospital Clinic Name mismatch!');
    }
    console.log('✓ Correct Doctor Name (' + upcomingFollowUps[0].doctorName + ') and Clinic (' + upcomingFollowUps[0].hospitalClinicName + ')');

    // Verify 4: Consultation without followUpDate (cD) is excluded
    const containsNoFollowUp = upcomingFollowUps.some((c) => String(c._id) === String(cD._id));
    if (containsNoFollowUp) {
      throw new Error('TEST 1 FAIL: Consultation without followUpDate appeared in upcoming follow-ups!');
    }
    console.log('✓ Consultation without followUpDate correctly excluded');

    // Verify 5: Past follow-up (cC) is excluded
    const containsPastFollowUp = upcomingFollowUps.some((c) => String(c._id) === String(cC._id));
    if (containsPastFollowUp) {
      throw new Error('TEST 1 FAIL: Past follow-up appeared in upcoming follow-ups!');
    }
    console.log('✓ Past follow-ups correctly excluded');

    // -----------------------------------------------------------------
    // TEST 2: Verify Patient Isolation (Patient 2's follow-up not in Patient 1's list)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Patient Isolation Verification ---');
    const containsPat2FollowUp = pat1Consultations.some((c) => String(c._id) === String(cE._id));
    if (containsPat2FollowUp) {
      throw new Error('TEST 2 FAIL: Another patient\'s follow-up appeared in Anees\'s consultations!');
    }
    console.log('✓ Verified another patient\'s follow-up NEVER appears for Anees');

    // Clean up test data
    console.log('\nCleaning up test records...');
    await User.deleteMany({ _id: { $in: [docUser._id, pat1User._id, pat2User._id] } });
    await DoctorProfile.deleteMany({ userId: docUser._id });
    await PatientProfile.deleteMany({ userId: { $in: [pat1User._id, pat2User._id] } });
    await Consultation.deleteMany({ _id: { $in: [cA._id, cB._id, cC._id, cD._id, cE._id] } });

    console.log('\n==================================================');
    console.log('ALL PATIENT UPCOMING FOLLOW-UP TESTS PASSED!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB');
  }
}

runTests();
