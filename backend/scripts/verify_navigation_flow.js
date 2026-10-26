const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const PatientProfile = require('../src/models/PatientProfile');
const { register, login, getMe } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');

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

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB successfully.\n');

    const timestamp = Date.now();

    // ==========================================
    // TEST 1 — DOCTOR FLOW (NO emergencyContact)
    // ==========================================
    console.log('=== TEST 1: NEW DOCTOR REGISTRATION & PROFILE FLOW ===');
    const docEmail = `flow.doc.${timestamp}@medwise.com`;
    const docRegReq = {
      body: {
        name: 'Dr. Sarah Jenkins',
        email: docEmail,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    console.log('1.1 Doctor Register:', docRegRes.statusCode, docRegRes.data.success);
    console.log('    user.profileCompleted:', docRegRes.data.user.profileCompleted, '(Expected: false)');
    if (docRegRes.data.user.profileCompleted !== false) throw new Error('Doctor should register with profileCompleted: false');

    const docId = docRegRes.data.user.id;
    const docUser = await User.findById(docId);

    // Login as incomplete Doctor
    const docLoginReq1 = { body: { email: docEmail, password: 'password123' } };
    const docLoginRes1 = mockRes();
    await login(docLoginReq1, docLoginRes1, (err) => { if (err) throw err; });
    console.log('1.2 Incomplete Doctor Login:', docLoginRes1.statusCode, docLoginRes1.data.user.profileCompleted, '(Expected: false -> redirect /complete-profile)');
    if (docLoginRes1.data.user.profileCompleted !== false) throw new Error('Doctor login should be incomplete');

    // Restore session (GET /api/auth/me)
    const docMeReq1 = { user: docUser };
    const docMeRes1 = mockRes();
    await getMe(docMeReq1, docMeRes1, (err) => { if (err) throw err; });
    console.log('1.3 Incomplete Doctor /api/auth/me session restore:', docMeRes1.data.user.profileCompleted, '(Expected: false)');
    if (docMeRes1.data.user.profileCompleted !== false) throw new Error('GET /api/auth/me should return profileCompleted: false');

    // Submit profile (PUT /api/profile/me) — Doctor has NO emergencyContact
    const docProfileReq = {
      user: docUser,
      body: {
        mobileNumber: '+91 9876543210',
        dateOfBirth: '1985-05-15',
        gender: 'Female',
        address: {
          addressLine1: '123 Medical Enclave',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          pinCode: '560001',
        },
        medicalRegistrationNumber: 'MCI-123456',
        specialization: 'Cardiology',
        qualification: 'MD',
        yearsOfExperience: 10,
        hospitalClinicName: 'Apollo Hospital',
        hospitalClinicAddress: 'Main Ring Road',
      },
    };
    const docProfileRes = mockRes();
    await createOrUpdateMyProfile(docProfileReq, docProfileRes, (err) => { if (err) throw err; });
    console.log('1.4 Complete Doctor Profile PUT:', docProfileRes.statusCode, docProfileRes.data.profileCompleted, '(Expected: true)');
    if (docProfileRes.data.profileCompleted !== true) throw new Error('Profile save should set profileCompleted: true');

    // Verify DB does not have emergencyContact
    const docSavedInDB = await DoctorProfile.findOne({ userId: docId });
    if (docSavedInDB.emergencyContact) throw new Error('DoctorProfile must not contain emergencyContact');
    console.log('1.4b Verified DoctorProfile in DB has zero emergency contact fields.');

    // Restore session (GET /api/auth/me) after profile completion
    const docMeRes2 = mockRes();
    await getMe(docMeReq1, docMeRes2, (err) => { if (err) throw err; });
    console.log('1.5 Completed Doctor /api/auth/me session restore:', docMeRes2.data.user.profileCompleted, '(Expected: true -> redirect /doctor/dashboard)');
    if (docMeRes2.data.user.profileCompleted !== true) throw new Error('GET /api/auth/me should return profileCompleted: true');

    // Login as completed Doctor
    const docLoginRes2 = mockRes();
    await login(docLoginReq1, docLoginRes2, (err) => { if (err) throw err; });
    console.log('1.6 Completed Doctor Login:', docLoginRes2.statusCode, docLoginRes2.data.user.profileCompleted, '(Expected: true -> redirect directly to /doctor/dashboard)');
    if (docLoginRes2.data.user.profileCompleted !== true) throw new Error('Completed Doctor login should return profileCompleted: true');

    // ==========================================
    // TEST 2 — PHARMACIST FLOW (NO emergencyContact)
    // ==========================================
    console.log('\n=== TEST 2: NEW PHARMACIST REGISTRATION & PROFILE FLOW ===');
    const pharmEmail = `flow.pharm.${timestamp}@medwise.com`;
    const pharmRegReq = {
      body: {
        name: 'Pharm. Alex Mercer',
        email: pharmEmail,
        password: 'password123',
        role: 'pharmacist',
      },
    };
    const pharmRegRes = mockRes();
    await register(pharmRegReq, pharmRegRes, (err) => { if (err) throw err; });
    console.log('2.1 Pharmacist Register:', pharmRegRes.statusCode, pharmRegRes.data.user.profileCompleted, '(Expected: false)');
    if (pharmRegRes.data.user.profileCompleted !== false) throw new Error('Pharmacist should register with profileCompleted: false');

    const pharmId = pharmRegRes.data.user.id;
    const pharmUser = await User.findById(pharmId);

    // Incomplete login
    const pharmLoginReq = { body: { email: pharmEmail, password: 'password123' } };
    const pharmLoginRes1 = mockRes();
    await login(pharmLoginReq, pharmLoginRes1, (err) => { if (err) throw err; });
    console.log('2.2 Incomplete Pharmacist Login:', pharmLoginRes1.data.user.profileCompleted, '(Expected: false -> redirect /complete-profile)');

    // Save profile — Pharmacist has NO emergencyContact
    const pharmProfileReq = {
      user: pharmUser,
      body: {
        mobileNumber: '+91 9123456780',
        dateOfBirth: '1990-08-20',
        gender: 'Male',
        address: {
          addressLine1: '45 Pharma Way',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600001',
        },
        pharmacyRegistrationNumber: 'PCI-987654',
        qualification: 'Pharm.D',
        yearsOfExperience: 5,
        pharmacyHospitalName: 'City Central Pharmacy',
        pharmacyHospitalAddress: 'Healthcare Hub',
      },
    };
    const pharmProfileRes = mockRes();
    await createOrUpdateMyProfile(pharmProfileReq, pharmProfileRes, (err) => { if (err) throw err; });
    console.log('2.3 Complete Pharmacist Profile PUT:', pharmProfileRes.statusCode, pharmProfileRes.data.profileCompleted, '(Expected: true)');

    // Verify DB does not have emergencyContact
    const pharmSavedInDB = await PharmacistProfile.findOne({ userId: pharmId });
    if (pharmSavedInDB.emergencyContact) throw new Error('PharmacistProfile must not contain emergencyContact');
    console.log('2.3b Verified PharmacistProfile in DB has zero emergency contact fields.');

    // Login as completed Pharmacist
    const pharmLoginRes2 = mockRes();
    await login(pharmLoginReq, pharmLoginRes2, (err) => { if (err) throw err; });
    console.log('2.4 Completed Pharmacist Login:', pharmLoginRes2.data.user.profileCompleted, '(Expected: true -> redirect directly to /pharmacist/dashboard)');
    if (pharmLoginRes2.data.user.profileCompleted !== true) throw new Error('Completed Pharmacist login should return profileCompleted: true');

    // ==========================================
    // TEST 3 — PATIENT FLOW (WITH emergencyContact & NO allergies)
    // ==========================================
    console.log('\n=== TEST 3: NEW PATIENT REGISTRATION & PROFILE FLOW ===');
    const patientEmail = `flow.patient.${timestamp}@medwise.com`;
    const patientRegReq = {
      body: {
        name: 'John Patient',
        email: patientEmail,
        password: 'password123',
        role: 'patient',
      },
    };
    const patientRegRes = mockRes();
    await register(patientRegReq, patientRegRes, (err) => { if (err) throw err; });
    console.log('3.1 Patient Register:', patientRegRes.statusCode, patientRegRes.data.user.profileCompleted, '(Expected: false)');
    if (patientRegRes.data.user.profileCompleted !== false) throw new Error('Patient should register with profileCompleted: false');

    const patientId = patientRegRes.data.user.id;
    const patientUser = await User.findById(patientId);

    // Incomplete login
    const patientLoginReq = { body: { email: patientEmail, password: 'password123' } };
    const patientLoginRes1 = mockRes();
    await login(patientLoginReq, patientLoginRes1, (err) => { if (err) throw err; });
    console.log('3.2 Incomplete Patient Login:', patientLoginRes1.data.user.profileCompleted, '(Expected: false -> redirect /complete-profile)');

    // Save profile — Patient HAS emergencyContact & dynamic arrays
    const patientProfileReq = {
      user: patientUser,
      body: {
        mobileNumber: '+91 9988776655',
        dateOfBirth: '1995-12-10',
        gender: 'Male',
        address: {
          addressLine1: '78 Garden Street',
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          pinCode: '500001',
        },
        emergencyContact: {
          name: 'Mary Patient',
          relationship: 'Sibling',
          mobileNumber: '+91 9988776654',
        },
        bloodGroup: 'B+',
        medicalConditions: [
          { name: 'Hypertension', sinceYear: 2022, notes: 'Controlled' }
        ],
        currentMedications: [
          { name: 'Amlodipine', dosage: '5mg', frequency: 'Daily', notes: 'Morning' }
        ],
        previousSurgeries: [
          { surgeryName: 'Appendectomy', year: 2019, hospital: 'General Hospital', notes: 'Complete' }
        ]
      },
    };
    const patientProfileRes = mockRes();
    await createOrUpdateMyProfile(patientProfileReq, patientProfileRes, (err) => { if (err) throw err; });
    console.log('3.3 Complete Patient Profile PUT:', patientProfileRes.statusCode, patientProfileRes.data.profileCompleted, '(Expected: true)');

    // Verify DB
    const patientSavedInDB = await PatientProfile.findOne({ userId: patientId });
    if (!patientSavedInDB.emergencyContact || !patientSavedInDB.emergencyContact.name) {
      throw new Error('PatientProfile must contain emergencyContact');
    }
    const patientJSON = patientSavedInDB.toJSON();
    if (patientJSON.allergies || patientJSON.allergyList) {
      throw new Error('PatientProfile must not contain allergy fields');
    }
    console.log('3.3b Verified PatientProfile in DB has emergencyContact and zero allergy fields.');

    // Login as completed Patient
    const patientLoginRes2 = mockRes();
    await login(patientLoginReq, patientLoginRes2, (err) => { if (err) throw err; });
    console.log('3.4 Completed Patient Login:', patientLoginRes2.data.user.profileCompleted, '(Expected: true -> redirect directly to /patient/dashboard)');
    if (patientLoginRes2.data.user.profileCompleted !== true) throw new Error('Completed Patient login should return profileCompleted: true');

    // Cleanup
    await User.deleteMany({ _id: { $in: [docId, pharmId, patientId] } });
    await DoctorProfile.deleteMany({ userId: docId });
    await PharmacistProfile.deleteMany({ userId: pharmId });
    await PatientProfile.deleteMany({ userId: patientId });
    console.log('\nCleanup successful.');

    console.log('\n======================================================');
    console.log('>>> ALL 3 ROLE NAVIGATION FLOW SIMULATIONS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Flow test error:', error);
    process.exit(1);
  }
};

runTest();
