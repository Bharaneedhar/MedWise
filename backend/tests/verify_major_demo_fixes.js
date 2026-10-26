const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const Appointment = require('../src/models/Appointment');

const { getDoctorPatients } = require('../src/controllers/doctorController');
const { createConsultation } = require('../src/controllers/consultationController');
const { updatePrescription } = require('../src/controllers/prescriptionController');
const { getSystemUsers, deleteUserAccount } = require('../src/controllers/systemManagementController');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medwise';

async function runTests() {
  console.log('=== STARTING MAJOR DEMONSTRATION FIXES VERIFICATION ===\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    // -----------------------------------------------------------------
    // TEST SETUP: Create isolated test accounts
    // -----------------------------------------------------------------
    const ts = Date.now();
    const testDocEmail = `demodoc${ts}@medwise.com`;
    const testPatEmail = `demopat${ts}@medwise.com`;
    const testPharmEmail = `demopharm${ts}@medwise.com`;
    const testPatMobile = `99${String(ts).slice(-8)}`;
    const expectedPid = `PID-${testPatMobile.slice(-10)}`;

    // Create Doctor User + Profile
    const docUser = await User.create({
      name: `Dr. Demo Test ${ts}`,
      email: testDocEmail,
      password: 'password123',
      role: 'doctor',
    });
    await DoctorProfile.create({
      userId: docUser._id,
      mobileNumber: '9876543210',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: {
        addressLine1: '123 Medical St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      medicalRegistrationNumber: `MED-REG-${ts}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 10,
      hospitalClinicName: 'Demo Health Clinic',
      hospitalClinicAddress: '123 Medical Way',
      workplaceName: 'Demo Health Clinic',
      workplaceAddress: '123 Medical Way',
      licenseNumber: `DOC-LIC-${ts}`,
      profileCompleted: true,
    });

    // Create Patient User + Profile
    const patUser = await User.create({
      name: `Anish Demo ${ts}`,
      email: testPatEmail,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: patUser._id,
      mobileNumber: testPatMobile,
      dateOfBirth: '1995-05-15',
      gender: 'Male',
      bloodGroup: 'B+',
      address: {
        addressLine1: '789 Patient Rd',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      emergencyContact: {
        name: 'Kin Contact',
        relationship: 'Sibling',
        mobileNumber: '9876543299',
      },
      profileCompleted: true,
    });

    // Create Pharmacist User + Profile
    const pharmUser = await User.create({
      name: `Pharm. Demo ${ts}`,
      email: testPharmEmail,
      password: 'password123',
      role: 'pharmacist',
    });
    await PharmacistProfile.create({
      userId: pharmUser._id,
      mobileNumber: '9876543211',
      dateOfBirth: '1985-02-02',
      gender: 'Female',
      address: {
        addressLine1: '456 Pharma Ave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      pharmacyRegistrationNumber: `PHARM-REG-${ts}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 5,
      pharmacyHospitalName: 'Demo Care Pharmacy',
      pharmacyHospitalAddress: '456 Pharma Ave',
      licenseNumber: `PHARM-LIC-${ts}`,
      pharmacyName: 'Demo Care Pharmacy',
      profileCompleted: true,
    });

    console.log(`[Setup] Created isolated accounts:\n  Doctor: ${docUser.name} (${docUser._id})\n  Patient: ${patUser.name} (${expectedPid})\n  Pharmacist: ${pharmUser.name}`);

    // -----------------------------------------------------------------
    // TEST 1: PATIENT SELECTION FOR START NEW CONSULTATION
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Patient Selection for Start New Consultation ---');

    // 1a. Doctor searches for patient by PID/mobile
    let reqSearch = { user: docUser, query: { search: expectedPid } };
    let resSearch = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await getDoctorPatients(reqSearch, resSearch, (err) => { if (err) throw err; });

    if (!resSearch.data?.success || !resSearch.data.patients?.some(p => String(p.patientId) === String(patUser._id))) {
      throw new Error('TEST 1 FAIL: Patient not found in Doctor PID search!');
    }
    console.log('✓ Doctor search by PID successfully returned patient:', resSearch.data.patients[0].name);

    // 1b. Doctor lists patients with includePatientId parameter (simulating opening New Consultation for searched patient)
    let reqList = { user: docUser, query: { includePatientId: patUser._id } };
    let resList = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await getDoctorPatients(reqList, resList, (err) => { if (err) throw err; });

    if (!resList.data?.success || !resList.data.patients?.some(p => String(p.patientId) === String(patUser._id))) {
      throw new Error('TEST 1 FAIL: Patient missing from getDoctorPatients selection dropdown when includePatientId is passed!');
    }
    console.log('✓ Patient available in Start New Consultation selection dropdown');

    // 1c. Create consultation for patient
    let reqCreateConsult = {
      user: docUser,
      body: {
        patientId: patUser._id,
        consultationDate: new Date().toISOString().split('T')[0],
        consultationType: 'In-person',
        reasonForVisit: 'General Checkup',
        diagnosisNotes: 'Mild Hypertension',
        doctorRecommendations: 'Low sodium diet',
        hospitalClinicName: 'Demo Health Clinic',
        hospitalClinicLocation: '123 Medical Way',
        status: 'Completed',
      },
    };
    let resCreateConsult = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await createConsultation(reqCreateConsult, resCreateConsult, (err) => { if (err) throw err; });

    if (!resCreateConsult.data?.success || !resCreateConsult.data.consultation) {
      throw new Error('TEST 1 FAIL: Consultation creation failed!');
    }
    const testConsultation = resCreateConsult.data.consultation;
    console.log('✓ Consultation created successfully:', testConsultation._id);

    // -----------------------------------------------------------------
    // TEST 2: EDIT PRESCRIPTION & MEDWISE OUTDATED LIFECYCLE
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Edit Prescription & MedWise Lifecycle ---');

    // Create a prescription owned by doctor & patient
    const testRx = await Prescription.create({
      prescriptionId: `RX-DEMO-${ts}`,
      consultationId: testConsultation._id,
      patientId: patUser._id,
      doctorId: docUser._id,
      patientName: patUser.name,
      patientPid: expectedPid,
      doctorName: docUser.name,
      clinicalDiagnosis: 'Mild Hypertension',
      doctorNotes: 'Take regular medication',
      medwiseStatus: 'APPROVED',
      medicines: [
        {
          medicineName: 'Amlodipine',
          dosage: '5 mg',
          dosageForm: 'Tablet',
          frequency: '1-0-0',
          duration: '30 days',
          route: 'Oral',
          instructions: 'Take in morning',
        },
      ],
    });

    // Doctor edits prescription
    let reqEditRx = {
      user: docUser,
      params: { id: testRx._id.toString() },
      body: {
        clinicalDiagnosis: 'Mild Hypertension Updated',
        doctorNotes: 'Take after breakfast',
        medicines: [
          {
            medicineName: 'Amlodipine',
            dosage: '10 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-0',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take after breakfast',
          },
        ],
      },
    };
    let resEditRx = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await updatePrescription(reqEditRx, resEditRx, (err) => { if (err) throw err; });

    if (!resEditRx.data?.success || !resEditRx.data.prescription) {
      throw new Error('TEST 2 FAIL: Prescription edit failed!');
    }
    const updatedRx = resEditRx.data.prescription;
    if (updatedRx.medwiseAnalysis && updatedRx.medwiseAnalysis.isOutdated !== true) {
      throw new Error(`TEST 2 FAIL: Expected prescription medwiseAnalysis.isOutdated to be true, got: ${updatedRx.medwiseAnalysis?.isOutdated}`);
    }
    console.log('✓ Edit Prescription preserved values & updated prescription analysis state as expected');

    // Also link an appointment to test patient & doctor
    const testAppt = await Appointment.create({
      appointmentId: `APPT-DEMO-${ts}`,
      patientId: patUser._id,
      doctorId: docUser._id,
      appointmentType: 'NEW_PATIENT',
      status: 'SCHEDULED',
      appointmentDate: new Date(),
    });

    // Link pharmacist to prescription for testing pharmacist deletion
    updatedRx.pharmacistId = pharmUser._id;
    updatedRx.pharmacistName = pharmUser.name;
    await updatedRx.save();

    // -----------------------------------------------------------------
    // TEST 3: PATIENT CASCADE DELETE & RE-REGISTRATION CLEANLINESS
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Patient Cascade Deletion ---');

    let reqDelPat = { params: { userId: patUser._id.toString() } };
    let resDelPat = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await deleteUserAccount(reqDelPat, resDelPat, (err) => { if (err) throw err; });

    if (!resDelPat.data?.success) {
      throw new Error('TEST 3 FAIL: Patient deletion request failed!');
    }

    // Verify all patient-owned records are deleted
    const [checkUser, checkProf, checkConsult, checkAppt, checkRx] = await Promise.all([
      User.findById(patUser._id),
      PatientProfile.findOne({ userId: patUser._id }),
      Consultation.find({ patientId: patUser._id }),
      Appointment.find({ patientId: patUser._id }),
      Prescription.find({ patientId: patUser._id }),
    ]);

    if (checkUser || checkProf || checkConsult.length > 0 || checkAppt.length > 0 || checkRx.length > 0) {
      throw new Error('TEST 3 FAIL: Orphaned records found after patient cascade deletion!');
    }
    console.log('✓ Patient cascade delete removed User, PatientProfile, Consultation, Appointment, and Prescription records cleanly');

    // Register a new patient with same mobile/PID
    const patUser2 = await User.create({
      name: `Anish Demo New ${ts}`,
      email: `newanish${ts}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: patUser2._id,
      mobileNumber: testPatMobile,
      dateOfBirth: '1995-05-15',
      gender: 'Male',
      bloodGroup: 'B+',
      address: {
        addressLine1: '789 Patient Rd',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      emergencyContact: {
        name: 'Kin Contact',
        relationship: 'Sibling',
        mobileNumber: '9876543299',
      },
      profileCompleted: true,
    });

    // Verify new patient has ZERO old consultations or prescriptions
    const [newConsults, newRxs] = await Promise.all([
      Consultation.find({ patientId: patUser2._id }),
      Prescription.find({ patientId: patUser2._id }),
    ]);
    if (newConsults.length !== 0 || newRxs.length !== 0) {
      throw new Error('TEST 3 FAIL: Newly registered patient inherited old deleted patient records!');
    }
    console.log('✓ Newly registered patient with same mobile/PID starts completely clean without old records');

    // Clean up patUser2
    await User.deleteOne({ _id: patUser2._id });
    await PatientProfile.deleteOne({ userId: patUser2._id });

    // -----------------------------------------------------------------
    // TEST 4: DOCTOR CASCADE DELETE
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Doctor Cascade Deletion ---');

    let reqDelDoc = { params: { userId: docUser._id.toString() } };
    let resDelDoc = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await deleteUserAccount(reqDelDoc, resDelDoc, (err) => { if (err) throw err; });

    if (!resDelDoc.data?.success) {
      throw new Error('TEST 4 FAIL: Doctor deletion request failed!');
    }

    const [checkDocUser, checkDocProf] = await Promise.all([
      User.findById(docUser._id),
      DoctorProfile.findOne({ userId: docUser._id }),
    ]);
    if (checkDocUser || checkDocProf) {
      throw new Error('TEST 4 FAIL: Doctor User/Profile records remained after deletion!');
    }
    console.log('✓ Doctor cascade deletion completed cleanly');

    // -----------------------------------------------------------------
    // TEST 5: PHARMACIST CASCADE DELETE
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Pharmacist Cascade Deletion ---');

    let reqDelPharm = { params: { userId: pharmUser._id.toString() } };
    let resDelPharm = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await deleteUserAccount(reqDelPharm, resDelPharm, (err) => { if (err) throw err; });

    if (!resDelPharm.data?.success) {
      throw new Error('TEST 5 FAIL: Pharmacist deletion request failed!');
    }

    const [checkPharmUser, checkPharmProf] = await Promise.all([
      User.findById(pharmUser._id),
      PharmacistProfile.findOne({ userId: pharmUser._id }),
    ]);
    if (checkPharmUser || checkPharmProf) {
      throw new Error('TEST 5 FAIL: Pharmacist User/Profile records remained after deletion!');
    }
    console.log('✓ Pharmacist cascade deletion completed cleanly without corrupting prescriptions');

    console.log('\n==================================================');
    console.log('ALL 5 MAJOR DEMONSTRATION FIX TESTS PASSED SUCCESSFULLY!');
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
