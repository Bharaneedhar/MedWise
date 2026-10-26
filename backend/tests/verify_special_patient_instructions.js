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
const Prescription = require('../src/models/Prescription');

const { createPrescription, getPrescriptionById, updatePrescription } = require('../src/controllers/prescriptionController');
const { createConsultation } = require('../src/controllers/consultationController');

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
  console.log('=== STARTING SPECIAL PATIENT INSTRUCTIONS VERIFICATION ===\n');

  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdPrescriptionIds = [];

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    const ts = Date.now();
    const docUser = await User.create({
      name: `Dr. Instructions Tester ${ts}`,
      email: `doc_inst_${ts}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    const patUser = await User.create({
      name: `Patient Instructions ${ts}`,
      email: `pat_inst_${ts}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(docUser._id, patUser._id);

    const docProf = await DoctorProfile.create({
      userId: docUser._id,
      mobileNumber: '9876543210',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: { addressLine1: 'Clinic St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-INST-${ts}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 10,
      hospitalClinicName: 'City Hospital',
      hospitalClinicAddress: 'Main St',
      licenseNumber: `LIC-INST-${ts}`,
      profileCompleted: true,
    });
    const patMobile = `98${String(ts).slice(-8)}`;
    const patPid = `PID-${patMobile.slice(-10)}`;

    const patProf = await PatientProfile.create({
      userId: patUser._id,
      mobileNumber: patMobile,
      dateOfBirth: '1990-05-20',
      gender: 'Female',
      address: { addressLine1: 'Pat Rd', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      emergencyContact: { name: 'Emergency', relationship: 'Parent', mobileNumber: '9876543210' },
      profileCompleted: true,
    });
    createdProfileIds.push(docProf._id, patProf._id);

    // Create completed consultation first
    const reqCons = {
      user: docUser,
      body: {
        patientId: patUser._id.toString(),
        patientPid: patPid,
        consultationDate: '2026-10-09',
        consultationType: 'In-person',
        reasonForVisit: 'Hypertension evaluation',
        clinicalNotes: 'BP 135/85',
        diagnosisNotes: 'Essential Hypertension',
        doctorRecommendations: 'Medication and salt restriction',
        followUpRequired: 'No',
        status: 'Completed',
      },
    };
    const resCons = mockRes();
    await createConsultation(reqCons, resCons, (e) => { if (e) throw e; });
    const consultation = resCons.data?.consultation;
    if (!consultation) throw new Error('Setup fail: Could not create consultation');
    createdConsultationIds.push(consultation._id);

    console.log('[Setup] Created Doctor, Patient, and Completed Consultation.');

    // -----------------------------------------------------------------
    // TEST 1: Default instruction "Take after meals" & Independent Medication Instructions
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Default & Independent Medication Instructions ---');

    const reqRx1 = {
      user: docUser,
      body: {
        patientId: patUser._id.toString(),
        patientPid: patPid,
        consultationId: consultation._id.toString(),
        clinicalDiagnosis: 'Essential Hypertension',
        doctorNotes: 'Take regular medication',
        medicines: [
          {
            medicineName: 'Amlovas 5mg',
            dosage: '5mg',
            frequency: '1-0-0',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take after meals', // Default selection
          },
          {
            medicineName: 'Telmikind 40mg',
            dosage: '40mg',
            frequency: '0-0-1',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take at bedtime', // Different predefined option
          },
        ],
      },
    };

    const resRx1 = mockRes();
    await createPrescription(reqRx1, resRx1, (e) => { if (e) throw e; });
    const rx1 = resRx1.data?.prescription;
    if (!rx1 || !rx1.medicines || rx1.medicines.length !== 2) {
      throw new Error(`TEST 1 FAIL: Could not create prescription. Msg: ${resRx1.data?.message}`);
    }
    createdPrescriptionIds.push(rx1._id);

    if (rx1.medicines[0].instructions !== 'Take after meals') {
      throw new Error(`TEST 1 FAIL: Med 1 expected 'Take after meals', got '${rx1.medicines[0].instructions}'`);
    }
    if (rx1.medicines[1].instructions !== 'Take at bedtime') {
      throw new Error(`TEST 1 FAIL: Med 2 expected 'Take at bedtime', got '${rx1.medicines[1].instructions}'`);
    }
    console.log('✓ Medicine 1 defaulted to "Take after meals".');
    console.log('✓ Medicine 2 independently assigned "Take at bedtime".');

    // -----------------------------------------------------------------
    // TEST 2: Custom Text ("Other" mode) Persistence and Reopening
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Custom Instruction ("Other" mode) Persistence ---');

    const customText = 'Follow the specific instructions discussed during consultation.';
    const reqRx2 = {
      user: docUser,
      body: {
        patientId: patUser._id.toString(),
        patientPid: patPid,
        consultationId: consultation._id.toString(),
        clinicalDiagnosis: 'Essential Hypertension',
        medicines: [
          {
            medicineName: 'Pantocid 40mg',
            dosage: '40mg',
            frequency: '1-0-0',
            duration: '14 days',
            route: 'Oral',
            instructions: 'Take on an empty stomach',
          },
          {
            medicineName: 'Custom Herbal Tonic',
            dosage: '10ml',
            frequency: '0-1-0',
            duration: '7 days',
            route: 'Oral',
            instructions: customText, // Custom instruction from "Other" mode
          },
        ],
      },
    };

    const resRx2 = mockRes();
    await createPrescription(reqRx2, resRx2, (e) => { if (e) throw e; });
    const rx2 = resRx2.data?.prescription;
    if (!rx2) throw new Error(`TEST 2 FAIL: Could not create prescription with custom instruction.`);
    createdPrescriptionIds.push(rx2._id);

    if (rx2.medicines[1].instructions !== customText) {
      throw new Error(`TEST 2 FAIL: Expected custom instruction '${customText}', got '${rx2.medicines[1].instructions}'`);
    }
    console.log('✓ Custom instruction saved accurately in MongoDB:', rx2.medicines[1].instructions);

    // Reopen / Fetch from DB
    const reqGetRx2 = { user: docUser, params: { id: rx2._id.toString() } };
    const resGetRx2 = mockRes();
    await getPrescriptionById(reqGetRx2, resGetRx2, (e) => { if (e) throw e; });
    const reloadedRx2 = resGetRx2.data?.prescription;

    if (!reloadedRx2 || reloadedRx2.medicines[1].instructions !== customText) {
      throw new Error('TEST 2 FAIL: Custom instruction broke on reopening!');
    }
    console.log('✓ Reopened prescription preserved exact custom instruction text.');

    // -----------------------------------------------------------------
    // TEST 3: Editing one medication does not alter instructions of another
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Editing one medication preserves instructions of another ---');

    const updatedMed2Inst = 'Take with food';
    const reqEditRx1 = {
      user: docUser,
      params: { id: rx1._id.toString() },
      body: {
        clinicalDiagnosis: 'Essential Hypertension - Updated',
        medicines: [
          {
            medicineName: 'Amlovas 5mg',
            dosage: '5mg',
            frequency: '1-0-0',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take after meals', // Unchanged Med 1
          },
          {
            medicineName: 'Telmikind 40mg',
            dosage: '40mg',
            frequency: '0-0-1',
            duration: '30 days',
            route: 'Oral',
            instructions: updatedMed2Inst, // Edited Med 2
          },
        ],
      },
    };

    const resEditRx1 = mockRes();
    await updatePrescription(reqEditRx1, resEditRx1, (e) => { if (e) throw e; });
    const editedRx1 = resEditRx1.data?.prescription;

    if (!editedRx1) throw new Error('TEST 3 FAIL: Update prescription failed.');
    if (editedRx1.medicines[0].instructions !== 'Take after meals') {
      throw new Error('TEST 3 FAIL: Unedited Med 1 instructions were modified unintentionally!');
    }
    if (editedRx1.medicines[1].instructions !== updatedMed2Inst) {
      throw new Error(`TEST 3 FAIL: Med 2 instruction failed to update to '${updatedMed2Inst}'`);
    }
    console.log('✓ Unedited medication instructions remained intact while edited medication updated.');

  } finally {
    console.log('\n[Cleanup] Removing temporary test records...');
    if (createdPrescriptionIds.length > 0) await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
    if (createdConsultationIds.length > 0) await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
    if (createdProfileIds.length > 0) {
      await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
    }
    if (createdUserIds.length > 0) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('[Cleanup] Completed clean up of test records.');
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB.');
  }

  console.log('\n==================================================');
  console.log('ALL SPECIAL PATIENT INSTRUCTIONS TESTS PASSED!');
  console.log('==================================================\n');
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
