const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const { register, login, getMe } = require('../src/controllers/authController');
const { getMyProfile, createOrUpdateMyProfile } = require('../src/controllers/profileController');

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

const formatPatientId = (mobile) => {
  if (!mobile) return 'PID-XXXXXXXXXX';
  const digits = String(mobile).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `PID-${last10}`;
};

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Patient Portal verification.\n');

    const timestamp = Date.now();
    const patientEmail = `portal.patient.${timestamp}@medwise.com`;

    // 1. REGISTER NEW PATIENT
    console.log('=== 1. PATIENT REGISTRATION & PROFILE INCOMPLETE STATE ===');
    const regReq = {
      body: {
        name: 'Abinaya S',
        email: patientEmail,
        password: 'password123',
        role: 'patient',
      },
    };
    const regRes = mockRes();
    await register(regReq, regRes, (err) => { if (err) throw err; });
    console.log('1.1 Patient Registered:', regRes.statusCode, regRes.data.user.email);
    console.log('    user.profileCompleted:', regRes.data.user.profileCompleted, '(Expected: false)');
    if (regRes.data.user.profileCompleted !== false) throw new Error('New patient profileCompleted must be false');

    const patientId = regRes.data.user.id;
    const patientUser = await User.findById(patientId);

    // 2. COMPLETE INITIAL PATIENT PROFILE
    console.log('\n=== 2. COMPLETE INITIAL PATIENT PROFILE ===');
    const initialMobile = '9876543210';
    const profileReq = {
      user: patientUser,
      body: {
        name: 'Abinaya S',
        mobileNumber: initialMobile,
        dateOfBirth: '1998-04-12',
        gender: 'Female',
        profilePhoto: 'https://example.com/patient.jpg',
        address: {
          addressLine1: 'Flat 302, Green Meadows',
          addressLine2: 'OMR Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600096',
        },
        bloodGroup: 'O+',
        medicalConditions: [
          { name: 'Asthma', sinceYear: 2019, notes: 'Mild, seasonal' },
          { name: 'Hypothyroidism', sinceYear: 2021, notes: 'Managed with Thyronorm' },
        ],
        currentMedications: [
          { name: 'Levothyroxine', dosage: '50mcg', frequency: 'Once daily before breakfast', notes: 'Empty stomach' },
          { name: 'Salbutamol Inhaler', dosage: '100mcg', frequency: 'As needed', notes: 'During episodes' },
        ],
        previousSurgeries: [
          { surgeryName: 'Tonsillectomy', year: 2015, hospital: 'Apollo Hospitals', notes: 'Full recovery' },
        ],
        emergencyContact: {
          name: 'Suresh Kumar',
          relationship: 'Parent',
          mobileNumber: '9876543211',
        },
      },
    };

    const profileRes = mockRes();
    await createOrUpdateMyProfile(profileReq, profileRes, (err) => { if (err) throw err; });
    console.log('2.1 Initial Profile Saved:', profileRes.statusCode, profileRes.data.profileCompleted);
    if (profileRes.data.profileCompleted !== true) throw new Error('Expected profileCompleted = true');

    // 3. FETCH PROFILE FOR PATIENT DASHBOARD & VERIFY PID
    console.log('\n=== 3. VERIFY DASHBOARD & PROFILE DATA RETRIEVAL ===');
    const getReq = { user: patientUser };
    const getRes = mockRes();
    await getMyProfile(getReq, getRes, (err) => { if (err) throw err; });
    const p = getRes.data.profile;

    const pid = formatPatientId(p.mobileNumber);
    console.log('3.1 Mobile Number:', p.mobileNumber);
    console.log('    Derived Patient ID:', pid, '(Expected: PID-9876543210)');
    if (pid !== 'PID-9876543210') throw new Error('PID derivation failed');

    console.log('3.2 Dashboard Summary Counts:');
    console.log('    - Active Medications:', p.currentMedications.length, '(Expected: 2)');
    console.log('    - Medical Conditions:', p.medicalConditions.length, '(Expected: 2)');
    console.log('    - Previous Surgeries:', p.previousSurgeries.length, '(Expected: 1)');
    console.log('    - Blood Group:', p.bloodGroup, '(Expected: O+)');
    if (p.currentMedications.length !== 2 || p.medicalConditions.length !== 2 || p.previousSurgeries.length !== 1) {
      throw new Error('Summary counts do not match stored data');
    }

    console.log('3.3 Emergency Contact in Profile:');
    console.log('    - Name:', p.emergencyContact.name);
    console.log('    - Relationship:', p.emergencyContact.relationship);
    console.log('    - Mobile:', p.emergencyContact.mobileNumber);
    if (!p.emergencyContact.name || !p.emergencyContact.mobileNumber) {
      throw new Error('Emergency contact missing from profile data');
    }

    // 4. EDIT PROFILE (TEST LIVE UPDATES)
    console.log('\n=== 4. EDIT PROFILE & VERIFY STATE SYNCHRONIZATION ===');
    const updatedMobile = '9123456789';
    const editReq = {
      user: patientUser,
      body: {
        name: 'Dr. Abinaya Sundaram',
        mobileNumber: updatedMobile,
        dateOfBirth: '1998-04-12',
        gender: 'Female',
        profilePhoto: 'https://example.com/new-photo.jpg',
        address: {
          addressLine1: 'Tower B, Suite 501',
          addressLine2: 'Tech Park Enclave',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          pinCode: '560100',
        },
        bloodGroup: 'AB+',
        medicalConditions: [
          { name: 'Asthma', sinceYear: 2019, notes: 'Controlled' },
          { name: 'Hypothyroidism', sinceYear: 2021, notes: 'Daily medication' },
          { name: 'Vitamin D Deficiency', sinceYear: 2024, notes: 'Weekly supplements' },
        ],
        currentMedications: [
          { name: 'Levothyroxine', dosage: '75mcg', frequency: 'Daily morning', notes: 'Thyroid support' },
          { name: 'Cholecalciferol', dosage: '60000IU', frequency: 'Once weekly', notes: 'With milk' },
        ],
        previousSurgeries: [
          { surgeryName: 'Tonsillectomy', year: 2015, hospital: 'Apollo Hospitals', notes: 'Full recovery' },
          { surgeryName: 'Wisdom Tooth Extraction', year: 2022, hospital: 'Dental Clinic', notes: 'Local anesthesia' },
        ],
        emergencyContact: {
          name: 'Meena Sundaram',
          relationship: 'Spouse',
          mobileNumber: '9988776655',
        },
      },
    };

    const editRes = mockRes();
    await createOrUpdateMyProfile(editReq, editRes, (err) => { if (err) throw err; });
    console.log('4.1 Profile Edited Status:', editRes.statusCode, editRes.data.message);
    if (editRes.statusCode !== 200) throw new Error('Profile edit failed');

    // Verify DB & updated PID
    const updatedProfile = await PatientProfile.findOne({ userId: patientId });
    const newPid = formatPatientId(updatedProfile.mobileNumber);
    console.log('4.2 Updated Mobile in DB:', updatedProfile.mobileNumber);
    console.log('    Updated Patient ID:', newPid, '(Expected: PID-9123456789)');
    if (newPid !== 'PID-9123456789') throw new Error('Updated PID does not match new mobile number');

    const updatedUser = await User.findById(patientId);
    console.log('4.3 Updated Name in DB:', updatedUser.name, '(Expected: Dr. Abinaya Sundaram)');
    if (updatedUser.name !== 'Dr. Abinaya Sundaram') throw new Error('User name update failed');

    // 5. SESSION RESTORATION AFTER EDIT
    console.log('\n=== 5. SESSION RESTORATION (GET /api/auth/me) ===');
    const meReq = { user: updatedUser };
    const meRes = mockRes();
    await getMe(meReq, meRes, (err) => { if (err) throw err; });
    console.log('5.1 /api/auth/me result:', meRes.data.user.name, '| profileCompleted:', meRes.data.user.profileCompleted);
    if (meRes.data.user.name !== 'Dr. Abinaya Sundaram' || meRes.data.user.profileCompleted !== true) {
      throw new Error('Auth session restoration failed after profile edit');
    }

    // Cleanup test records
    await User.findByIdAndDelete(patientId);
    await PatientProfile.findOneAndDelete({ userId: patientId });
    console.log('\nTest cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL PATIENT PORTAL FULL-STACK TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
};

runTest();
