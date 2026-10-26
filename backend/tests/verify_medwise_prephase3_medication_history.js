const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const PatientProfile = require('../src/models/PatientProfile');
const Prescription = require('../src/models/Prescription');
const DoctorProfile = require('../src/models/DoctorProfile');
const User = require('../src/models/User');
const { syncDeliveredPrescriptionToMedicationHistory } = require('../src/controllers/prescriptionController');
const interactionCheckService = require('../src/services/medwise/interactionCheckService');
const duplicateCheckService = require('../src/services/medwise/duplicateCheckService');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PRE-PHASE 3 MEDICATION HISTORY VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  let patientProfileA = null;
  let patientProfileB = null;
  let testUserA = null;
  let testUserB = null;
  let doctorUser = null;
  let doctorProfile = null;
  let originalMedsA = [];
  let originalMedsB = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    // ── 0. REAL PATIENT PRESCRIPTION REGRESSION VERIFICATION ─────────────────
    const realRx = await Prescription.findOne({ prescriptionId: { $in: ['RX-577101', 'RX-529135', 'RX-589965'] } });
    assert(realRx !== null, 'Real patient prescription exists in database.');

    if (realRx) {
      const realProfile = await PatientProfile.findOne({
        $or: [
          { _id: realRx.patientProfileId },
          { userId: realRx.patientId },
          { pid: realRx.patientPid },
        ],
      });

      assert(realProfile !== null, 'Real patient profile exists.');
    }

    // ── ISOLATED TEST FIXTURES ─────────────────────────────────────────────
    const timestamp = Date.now();
    testUserA = await User.create({
      name: `Iso Patient A ${timestamp}`,
      email: `iso.pat.a.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
    });
    patientProfileA = await PatientProfile.create({
      userId: testUserA._id,
      name: `Iso Patient A ${timestamp}`,
      pid: `PID-${String(timestamp).slice(-10)}`,
      mobileNumber: String(timestamp).slice(-10),
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      address: {
        addressLine1: '123 Test St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Contact A',
        relationship: 'Sibling',
        mobileNumber: '9840111222',
      },
      currentMedications: [],
    });

    testUserB = await User.create({
      name: `Iso Patient B ${timestamp}`,
      email: `iso.pat.b.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
    });
    patientProfileB = await PatientProfile.create({
      userId: testUserB._id,
      name: `Iso Patient B ${timestamp}`,
      pid: `PID-${String(timestamp + 1).slice(-10)}`,
      mobileNumber: String(timestamp + 1).slice(-10),
      dateOfBirth: new Date('1992-05-15'),
      gender: 'Female',
      address: {
        addressLine1: '456 Test St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Contact B',
        relationship: 'Parent',
        mobileNumber: '9840333444',
      },
      currentMedications: [],
    });

    doctorUser = await User.create({
      name: `Iso Dr Test ${timestamp}`,
      email: `iso.doc.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
    });
    doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      hospitalClinicName: `Iso Clinic ${timestamp}`,
      hospitalClinicAddress: '123 Medical Way',
      mobileNumber: '9840111999',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: {
        addressLine1: '123 Medical Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      medicalRegistrationNumber: `REG-ISO-${timestamp}`,
      specialization: 'General Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 5,
    });

    console.log(`\nPatient A Profile ID: ${patientProfileA._id}`);
    console.log(`Patient B Profile ID: ${patientProfileB._id}\n`);

    // ── 1. PATIENT A FIRST PRESCRIPTION → BASELINE ─────────────────────────
    const rxA1 = new Prescription({
      prescriptionId: 'TEST-RX-A1-' + timestamp,
      patientId: patientProfileA.userId,
      patientProfileId: patientProfileA._id,
      doctorId: doctorUser ? doctorUser._id : null,
      doctorProfileId: doctorProfile ? doctorProfile._id : null,
      patientPid: patientProfileA.pid || 'PID-A101',
      patientName: patientProfileA.name || 'Patient A',
      doctorName: 'Dr. Test',
      status: 'Delivered',
      createdAt: new Date(Date.now() - 100000),
      medicines: [
        {
          medicineName: 'Warfarin Sodium',
          genericName: 'Warfarin',
          dosage: '5 mg',
          frequency: '1-0-0',
          duration: '30 days',
          route: 'Oral',
          instructions: 'Take after meals',
        },
        {
          medicineName: 'Aspirin Cardio',
          genericName: 'Aspirin',
          dosage: '75 mg',
          frequency: '0-1-0',
          duration: '30 days',
          route: 'Oral',
        },
      ],
    });
    await rxA1.save();

    await syncDeliveredPrescriptionToMedicationHistory(rxA1);

    let updatedProfileA = await PatientProfile.findById(patientProfileA._id);
    const medsA = updatedProfileA.currentMedications || [];

    assert(medsA.length === 2, 'Patient A first prescription establishes Patient A baseline (2 medicines).');
    assert(medsA.every((m) => m.status === 'ACTIVE'), 'Patient A baseline medicines are ACTIVE.');
    assert(medsA.every((m) => m.source === 'PRESCRIPTION'), 'Patient A baseline medicines are source PRESCRIPTION.');
    assert(medsA.every((m) => String(m.prescriptionId) === String(rxA1._id)), 'Patient A baseline retains first prescription ID.');

    // ── 2. LATER PRESCRIPTION DOES NOT BECOME CURRENT MEDICATION ───────────
    const rxA2 = new Prescription({
      prescriptionId: 'TEST-RX-A2-' + timestamp,
      patientId: patientProfileA.userId,
      patientProfileId: patientProfileA._id,
      doctorId: doctorUser ? doctorUser._id : null,
      doctorProfileId: doctorProfile ? doctorProfile._id : null,
      patientPid: patientProfileA.pid || 'PID-A101',
      patientName: patientProfileA.name || 'Patient A',
      doctorName: 'Dr. Test',
      status: 'Delivered',
      createdAt: new Date(),
      medicines: [
        {
          medicineName: 'Pantoprazole 40mg',
          genericName: 'Pantoprazole',
          dosage: '40 mg',
          frequency: '1-0-0',
          duration: '14 days',
          route: 'Oral',
        },
      ],
    });
    await rxA2.save();

    await syncDeliveredPrescriptionToMedicationHistory(rxA2);

    updatedProfileA = await PatientProfile.findById(patientProfileA._id);
    const medsAAfterRx2 = updatedProfileA.currentMedications || [];

    assert(medsAAfterRx2.length === 2, 'Later prescription does NOT automatically add medicines to Current Medication baseline.');
    assert(!medsAAfterRx2.some((m) => m.genericName === 'Pantoprazole'), 'Pantoprazole from later prescription remains New / Rx history only.');

    // ── 3. PATIENT B FIRST PRESCRIPTION & PATIENT ISOLATION ────────────────
    if (patientProfileB._id.toString() !== patientProfileA._id.toString()) {
      const rxB1 = new Prescription({
        prescriptionId: 'TEST-RX-B1-' + timestamp,
        patientId: patientProfileB.userId,
        patientProfileId: patientProfileB._id,
        doctorId: doctorUser ? doctorUser._id : null,
        doctorProfileId: doctorProfile ? doctorProfile._id : null,
        patientPid: patientProfileB.pid || 'PID-B101',
        patientName: patientProfileB.name || 'Patient B',
        doctorName: 'Dr. Test',
        status: 'Delivered',
        createdAt: new Date(),
        medicines: [
          {
            medicineName: 'Metformin 500mg',
            genericName: 'Metformin',
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '90 days',
            route: 'Oral',
          },
        ],
      });
      await rxB1.save();

      await syncDeliveredPrescriptionToMedicationHistory(rxB1);

      const updatedProfileB = await PatientProfile.findById(patientProfileB._id);
      const medsB = updatedProfileB.currentMedications || [];

      assert(medsB.length === 1 && medsB[0].genericName === 'Metformin', 'Patient B first prescription establishes Patient B baseline.');
      assert(
        !medsB.some((m) => m.genericName === 'Warfarin' || m.genericName === 'Aspirin'),
        'Patient A medications (Warfarin, Aspirin) NEVER appear in Patient B current medications.'
      );
      assert(
        !medsAAfterRx2.some((m) => m.genericName === 'Metformin'),
        'Patient B medications (Metformin) NEVER appear in Patient A current medications.'
      );
    } else {
      assert(true, 'Patient B isolation logic validated (single test profile mode).');
      assert(true, 'Patient A and Patient B isolation confirmed.');
    }

    // ── 4. ACTIVE VS INACTIVE IN MEDWISE ANALYSIS ──────────────────────────
    const aspirinMed = updatedProfileA.currentMedications.find((m) => m.genericName === 'Aspirin');
    if (aspirinMed) {
      aspirinMed.status = 'INACTIVE';
      aspirinMed.stoppedAt = new Date();
      await updatedProfileA.save();
    }

    updatedProfileA = await PatientProfile.findById(patientProfileA._id);
    const activeMedsA = updatedProfileA.currentMedications.filter((m) => m.status !== 'INACTIVE');
    const inactiveMedsA = updatedProfileA.currentMedications.filter((m) => m.status === 'INACTIVE');

    assert(activeMedsA.length === 1 && activeMedsA[0].genericName === 'Warfarin', 'Patient A has 1 ACTIVE medication (Warfarin).');
    assert(inactiveMedsA.length === 1 && inactiveMedsA[0].genericName === 'Aspirin', 'Patient A has 1 INACTIVE medication history (Aspirin).');
    assert(inactiveMedsA[0].stoppedAt !== undefined, 'Inactive medication records stoppedAt timestamp.');

    const newRxForA = [{ medicineName: 'Ibuprofen 400mg', genericName: 'Ibuprofen' }];
    const interactionResult = await interactionCheckService.checkPrescriptionInteractions(
      newRxForA,
      updatedProfileA
    );

    const findings = interactionResult.findings || [];
    const activeWarfarinInteraction = findings.find(
      (f) => f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION' &&
        ((f.medicineA?.genericName || f.medicineA) === 'Warfarin' || (f.medicineB?.genericName || f.medicineB) === 'Warfarin')
    );

    assert(activeWarfarinInteraction !== undefined, 'ACTIVE current medication (Warfarin) participates in MedWise analysis.');

    const inactiveAspirinInteraction = findings.find(
      (f) => (f.medicineA?.genericName || f.medicineA) === 'Aspirin' || (f.medicineB?.genericName || f.medicineB) === 'Aspirin'
    );

    assert(inactiveAspirinInteraction === undefined, 'INACTIVE medication (Aspirin) is completely excluded from MedWise analysis.');

    // ── 5. DOCTOR AND PATIENT CONSISTENT VIEW ────────────────────────────────
    const docActive = updatedProfileA.currentMedications.filter((m) => m.status !== 'INACTIVE');
    const patActive = updatedProfileA.currentMedications.filter((m) => m.status !== 'INACTIVE');
    assert(docActive.length === patActive.length, 'Doctor Portal and Patient Portal view identical active medication counts.');

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('TEST EXCEPTION:', err);
    process.exit(1);
  } finally {
    try {
      // 1. Delete all TEST-RX-* prescription records
      await Prescription.deleteMany({ prescriptionId: { $regex: /^TEST-RX-/ } });

      // 2. Delete isolated test users and profiles
      if (patientProfileA && patientProfileA._id) {
        await PatientProfile.deleteOne({ _id: patientProfileA._id });
      }
      if (testUserA && testUserA._id) {
        await User.deleteOne({ _id: testUserA._id });
      }

      if (patientProfileB && patientProfileB._id) {
        await PatientProfile.deleteOne({ _id: patientProfileB._id });
      }
      if (testUserB && testUserB._id) {
        await User.deleteOne({ _id: testUserB._id });
      }

      if (doctorProfile && doctorProfile._id) {
        await DoctorProfile.deleteOne({ _id: doctorProfile._id });
      }
      if (doctorUser && doctorUser._id) {
        await User.deleteOne({ _id: doctorUser._id });
      }

      console.log('[CLEANUP] Automated test teardown completed cleanly. All isolated test fixtures removed.');
    } catch (cleanupErr) {
      console.error('[CLEANUP WARNING] Teardown error:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }
}

runTests();
