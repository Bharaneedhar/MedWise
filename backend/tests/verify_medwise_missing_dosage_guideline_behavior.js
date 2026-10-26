const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const DrugInteraction = require('../src/models/DrugInteraction');

const { checkWithMedwise } = require('../src/controllers/prescriptionController');
const { checkItemDosage } = require('../src/services/medwise/dosageCheckService');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

async function runMissingGuidelineBehaviorTests() {
  console.log('========================================================================');
  console.log('STARTING MEDWISE MISSING DOSAGE GUIDELINE BEHAVIOR TEST SUITE');
  console.log('========================================================================\n');

  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdPrescriptionIds = [];
  const createdMedicineIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to MongoDB.');

    const timestamp = Date.now();

    // Doctor User setup
    let doctorUser = await User.findOne({ role: 'doctor' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: `Dr. DosageVerifier_${timestamp}`,
        email: `dosage_doc_${timestamp}@gmail.com`,
        password: 'password123',
        role: 'doctor',
      });
      createdUserIds.push(doctorUser._id);
    }

    const doctorReqUser = {
      _id: doctorUser._id,
      name: doctorUser.name,
      email: doctorUser.email,
      role: 'doctor',
    };

    // Patient User setup
    const patientUser = await User.create({
      name: `Dosage Test Patient_${timestamp}`,
      email: `dosage_patient_${timestamp}@gmail.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientUser._id);

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: `98123${timestamp.toString().slice(-5)}`,
      dateOfBirth: new Date('1990-05-20'),
      gender: 'Male',
      bloodGroup: 'B+',
      address: {
        addressLine1: '100 Test St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Emergency Person',
        relationship: 'Parent',
        mobileNumber: '9876543210',
      },
      hasNoKnownAllergies: true,
      allergies: [],
      profileCompleted: true,
    });
    createdProfileIds.push(patientProfile._id);

    // -------------------------------------------------------------------------
    // TEST 1 — MEDICINE WITH VERIFIED DOSAGE GUIDELINE (PARACETAMOL)
    // -------------------------------------------------------------------------
    console.log('Running Test 1: Medicine with verified dosage guideline...');
    const paraMed = await Medicine.findOne({ genericName: /paracetamol/i });
    assert(Boolean(paraMed), 'Test 1 Failed: Paracetamol master medicine missing');
    assert(Array.isArray(paraMed.dosageGuidelines) && paraMed.dosageGuidelines.length > 0, 'Test 1 Failed: Paracetamol must have dosageGuidelines');

    const dosageValResult1 = checkItemDosage(
      { medicineId: paraMed._id, dosage: '500 mg', frequency: '1-0-1', duration: '3 days' },
      paraMed,
      { age: 36, gender: 'Male' }
    );
    assert(dosageValResult1.status === 'within_guidance', `Test 1 Failed: Expected within_guidance, got '${dosageValResult1.status}'`);
    assert(dosageValResult1.doctorReviewRequired === false, 'Test 1 Failed: doctorReviewRequired should be false for within_guidance');
    console.log('  PASSED: Medicine with verified dosage guideline evaluates normally to WITHIN GUIDANCE.\n');

    // -------------------------------------------------------------------------
    // TEST 2, 3, 4, 5, 6 — MEDICINE WITHOUT DOSAGE GUIDELINE (WARFARIN)
    // -------------------------------------------------------------------------
    console.log('Running Test 2-6: Medicine without dosage guideline (Warfarin) yields ACCEPTED and CLEARED outcome...');
    const warfMed = await Medicine.findOne({ genericName: /warfarin/i });
    assert(Boolean(warfMed), 'Test 2-6 Failed: Warfarin master medicine missing');

    const rxUnlistedDosage = await Prescription.create({
      prescriptionId: `RX-DOSAGE-ACCEPT-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser._id,
      patientName: patientUser.name,
      patientPid: `PID-98123${timestamp.toString().slice(-5)}`,
      patientAge: 36,
      patientGender: 'Male',
      patientAllergies: [],
      medicines: [
        {
          medicineId: warfMed._id,
          medicineName: 'Warfarin 5mg',
          genericName: 'Warfarin',
          dosage: '5 mg',
          strength: '5 mg',
          frequency: '0-0-1',
          duration: '30 days',
          route: 'Oral',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rxUnlistedDosage._id);

    const reqRxUnlisted = { user: doctorReqUser, params: { id: rxUnlistedDosage._id.toString() } };
    let resRxUnlistedObj = null;
    const resRxUnlisted = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRxUnlistedObj = obj; return this; },
    };

    const nextErr = (err) => { if (err) throw err; };

    await checkWithMedwise(reqRxUnlisted, resRxUnlisted, nextErr);
    assert(resRxUnlisted.statusCode === 200, 'Test 2-6 Failed: checkWithMedwise failed');

    const analysis2 = resRxUnlistedObj.prescription.medwiseAnalysis;
    const warfDosage2 = analysis2.checks.dosage.find((d) => d.genericName === 'Warfarin');

    // Test 2: status = accepted
    assert(warfDosage2.status === 'accepted', `Test 2 Failed: Expected status accepted, got '${warfDosage2.status}'`);
    assert(warfDosage2.doctorReviewRequired === false, 'Test 2 Failed: doctorReviewRequired must be false for accepted status');
    assert(warfDosage2.guidelineUsed === null, 'Test 2 Failed: guidelineUsed must be null for accepted status');
    assert(warfDosage2.guidelineRange === null, 'Test 2 Failed: guidelineRange must be null for accepted status');

    // Test 3: dosage stage = COMPLETED
    assert(analysis2.audit.coverage.dosageAnalysis === 'COMPLETED', `Test 3 Failed: Expected coverage COMPLETED, got '${analysis2.audit.coverage.dosageAnalysis}'`);

    // Test 4: No dosage_unassessable audit finding created
    const dosageUnassessableFinding = analysis2.audit.findings.find((f) => f.type === 'dosage_unassessable' || f.findingType === 'dosage_unassessable');
    assert(!dosageUnassessableFinding, 'Test 4 Failed: dosage_unassessable finding should NOT be created for accepted status');

    // Test 5: incompleteAssessments count is 0
    assert(analysis2.audit.summary.incompleteAssessments === 0, `Test 5 Failed: Expected incompleteAssessments === 0, got ${analysis2.audit.summary.incompleteAssessments}`);

    // Test 6: Final outcome is CLEARED (unlisted dosage does not cause REVIEW RECOMMENDED)
    assert(analysis2.overallRecommendation.status === 'cleared', `Test 6 Failed: Expected outcome cleared, got '${analysis2.overallRecommendation.status}'`);

    console.log('  PASSED: Unlisted dosage yields status ACCEPTED, coverage COMPLETED, 0 incomplete count, and CLEARED overall outcome.\n');

    // -------------------------------------------------------------------------
    // TEST 7 — MEDICINE WITHOUT DOSAGE GUIDELINE + VERIFIED DRUG INTERACTION
    // -------------------------------------------------------------------------
    console.log('Running Test 7: Medicine without dosage guideline + verified interaction (Paracetamol ↔ Warfarin)...');

    // Update patient profile to include active current medication Paracetamol
    await PatientProfile.updateOne(
      { _id: patientProfile._id },
      {
        $set: {
          currentMedications: [
            {
              medicineId: paraMed._id,
              name: 'Paracetamol',
              genericName: 'Paracetamol',
              strength: '500 mg',
              dosage: '500 mg',
              frequency: '1-0-1',
              duration: '5 days',
              status: 'ACTIVE',
            },
          ],
        },
      }
    );

    const rxInteractingUnlisted = await Prescription.create({
      prescriptionId: `RX-DOSAGE-INTERACTION-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser._id,
      patientName: patientUser.name,
      patientPid: `PID-98123${timestamp.toString().slice(-5)}`,
      patientAge: 36,
      patientGender: 'Male',
      patientAllergies: [],
      medicines: [
        {
          medicineId: warfMed._id,
          medicineName: 'Warfarin 5mg',
          genericName: 'Warfarin',
          dosage: '5 mg',
          strength: '5 mg',
          frequency: '0-0-1',
          duration: '30 days',
          route: 'Oral',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rxInteractingUnlisted._id);

    const reqRxInteracting = { user: doctorReqUser, params: { id: rxInteractingUnlisted._id.toString() } };
    let resRxInteractingObj = null;
    const resRxInteracting = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRxInteractingObj = obj; return this; },
    };

    await checkWithMedwise(reqRxInteracting, resRxInteracting, nextErr);
    assert(resRxInteracting.statusCode === 200, 'Test 7 Failed: checkWithMedwise failed');

    const analysis7 = resRxInteractingObj.prescription.medwiseAnalysis;
    const warfDosage7 = analysis7.checks.dosage.find((d) => d.genericName === 'Warfarin');
    assert(warfDosage7.status === 'accepted', 'Test 7 Failed: Warfarin dosage must still be accepted');

    const interactionFlagged7 = analysis7.checks.interactions.flaggedCount;
    assert(interactionFlagged7 >= 1, `Test 7 Failed: Drug interaction must still be detected (flaggedCount: ${interactionFlagged7})`);

    assert(analysis7.overallRecommendation.status === 'review_required', `Test 7 Failed: Drug interaction makes overall outcome review_required, got '${analysis7.overallRecommendation.status}'`);

    console.log('  PASSED: Dosage stage is ACCEPTED, but verified interaction independently triggers REVIEW RECOMMENDED.\n');

    // -------------------------------------------------------------------------
    // TEST 8, 9 — GENERIC CUSTOM MEDICINE (NO DOSAGE GUIDELINE)
    // -------------------------------------------------------------------------
    console.log('Running Test 8-9: Generic custom medicine without guideline (no hardcoding)...');
    const customMed = await Medicine.create({
      brandName: `CustomGenericMed_${timestamp}`,
      genericName: `CustomGenericMed_${timestamp}`,
      dosageForm: 'Tablet',
      strength: '100 mg',
      drugClass: 'Custom Class',
      dosageGuidelines: [],
    });
    createdMedicineIds.push(customMed._id);

    const customResult = checkItemDosage(
      { medicineId: customMed._id, genericName: customMed.genericName, dosage: '100 mg', frequency: '1-0-1', duration: '5 days' },
      customMed,
      { age: 40, gender: 'Male' }
    );

    assert(customResult.status === 'accepted', `Test 8-9 Failed: Expected accepted for custom unlisted medicine, got '${customResult.status}'`);
    assert(customResult.doctorReviewRequired === false, 'Test 8-9 Failed: doctorReviewRequired must be false for custom unlisted medicine');
    assert(customResult.reason.includes('No verified dosage guideline'), 'Test 8-9 Failed: Generic reason text missing');

    console.log('  PASSED: Generic custom medicine without dosage guideline evaluates cleanly to ACCEPTED without medicine-specific hardcoding.\n');

    console.log('========================================================================');
    console.log('ALL 11 MISSING DOSAGE GUIDELINE BEHAVIOR TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\nTEST SUITE ERROR:', error);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up test records...');
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdMedicineIds.length > 0) {
        await Medicine.deleteMany({ _id: { $in: createdMedicineIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Cleanup complete. Disconnecting MongoDB.');
      await mongoose.disconnect();
    }
  }
}

runMissingGuidelineBehaviorTests();
