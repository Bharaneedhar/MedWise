const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');

const { checkWithMedwise } = require('../src/controllers/prescriptionController');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

async function runReportDataFlowTests() {
  console.log('========================================================================');
  console.log('STARTING MEDWISE FINAL CLINICAL REPORT & INTERACTION DATA-FLOW TEST SUITE');
  console.log('========================================================================\n');

  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdPrescriptionIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to MongoDB.');

    const timestamp = Date.now();

    // Setup Doctor User
    let doctorUser = await User.findOne({ role: 'doctor' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: `Dr. ReportVerifier_${timestamp}`,
        email: `report_doc_${timestamp}@gmail.com`,
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

    // -------------------------------------------------------------------------
    // TEST 1 — ANEES SCENARIO: CURRENT PARACETAMOL ↔ NEW WARFARIN
    // -------------------------------------------------------------------------
    console.log('Running Test 1: Anees Scenario (Current Paracetamol 500mg ↔ New Warfarin)...');

    // Find master medicine documents
    const paraMed = await Medicine.findOne({ genericName: /paracetamol/i });
    const warfMed = await Medicine.findOne({ genericName: /warfarin/i });

    assert(Boolean(paraMed), 'Test 1 Failed: Master Medicine Paracetamol not found in database');
    assert(Boolean(warfMed), 'Test 1 Failed: Master Medicine Warfarin not found in database');

    // Create test patient with Active Current Medication: Paracetamol 500mg
    const aneesPatientUser = await User.create({
      name: `Anees Fathima Test_${timestamp}`,
      email: `anees_test_${timestamp}@gmail.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(aneesPatientUser._id);

    const aneesProfile = await PatientProfile.create({
      userId: aneesPatientUser._id,
      mobileNumber: `979121${timestamp.toString().slice(-4)}`,
      dateOfBirth: new Date('1988-06-15'),
      gender: 'Female',
      bloodGroup: 'O+',
      address: {
        addressLine1: '12 Anna Salai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Emergency Person',
        relationship: 'Spouse',
        mobileNumber: '9876543210',
      },
      hasNoKnownAllergies: true,
      allergies: [],
      profileCompleted: true,
      currentMedications: [
        {
          medicineId: paraMed._id,
          name: 'Paracetamol',
          genericName: 'Paracetamol',
          strength: '500 mg',
          dosage: '500 mg',
          frequency: '1-0-1',
          duration: '5 days',
          route: 'Oral',
          status: 'ACTIVE',
          source: 'PATIENT_REPORTED',
        },
      ],
    });
    createdProfileIds.push(aneesProfile._id);

    // Create New Prescription: Warfarin
    const rxAnees = await Prescription.create({
      prescriptionId: `RX-ANEES-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: aneesPatientUser._id,
      patientName: aneesPatientUser.name,
      patientPid: `PID-979121${timestamp.toString().slice(-4)}`,
      patientAge: 38,
      patientGender: 'Female',
      patientBloodGroup: 'O+',
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
    createdPrescriptionIds.push(rxAnees._id);

    // Run MedWise Check
    const reqRxAnees = { user: doctorReqUser, params: { id: rxAnees._id.toString() } };
    let resRxAneesObj = null;
    const resRxAnees = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRxAneesObj = obj; return this; },
    };

    const nextErr = (err) => { if (err) throw err; };

    await checkWithMedwise(reqRxAnees, resRxAnees, nextErr);
    assert(resRxAnees.statusCode === 200, 'Test 1 Failed: checkWithMedwise failed for Anees prescription');

    const analysis = resRxAneesObj.prescription.medwiseAnalysis;
    assert(Boolean(analysis), 'Test 1 Failed: medwiseAnalysis is missing');

    // Verify interaction finding
    const interactionCheck = analysis.checks.interactions;
    assert(interactionCheck.flaggedCount >= 1, `Test 1 Failed: Expected at least 1 flagged interaction, got ${interactionCheck.flaggedCount}`);

    const pwFinding = interactionCheck.findings.find(
      (f) =>
        f.status === 'interaction_flagged' &&
        ((f.medicineA?.genericName === 'Paracetamol' && f.medicineB?.genericName === 'Warfarin') ||
          (f.medicineA?.genericName === 'Warfarin' && f.medicineB?.genericName === 'Paracetamol'))
    );

    assert(Boolean(pwFinding), 'Test 1 Failed: Paracetamol ↔ Warfarin interaction finding not found');
    assert(pwFinding.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION', `Test 1 Failed: Expected sourceType CURRENT_MEDICATION_TO_NEW_PRESCRIPTION, got '${pwFinding.sourceType}'`);
    assert(pwFinding.severity === 'Major', `Test 1 Failed: Expected severity Major, got '${pwFinding.severity}'`);
    assert(Boolean(pwFinding.reason), 'Test 1 Failed: Structured reason is missing');
    assert(Boolean(pwFinding.potentialConcern), 'Test 1 Failed: Structured potentialConcern is missing');
    assert(Boolean(pwFinding.clinicalConsideration), 'Test 1 Failed: Structured clinicalConsideration is missing');
    assert(Boolean(pwFinding.evidenceSource), 'Test 1 Failed: Structured evidenceSource is missing');

    // Verify overall recommendation is REVIEW RECOMMENDED (never unable_to_assess for complete profile)
    const outcomeStatus = analysis.overallRecommendation.status;
    assert(outcomeStatus === 'review_required', `Test 1 Failed: Expected overall outcome review_required, got '${outcomeStatus}'`);

    console.log('  PASSED: Anees Current Med (Paracetamol) ↔ New Presc (Warfarin) interaction correctly identified with full structured explanation & REVIEW RECOMMENDED outcome.\n');

    // -------------------------------------------------------------------------
    // TEST 2 — NEW ↔ NEW INTERACTION (PARACETAMOL ↔ IBUPROFEN)
    // -------------------------------------------------------------------------
    console.log('Running Test 2: New ↔ New Interaction (Paracetamol ↔ Ibuprofen)...');
    const ibupMed = await Medicine.findOne({ genericName: /ibuprofen/i });
    assert(Boolean(ibupMed), 'Test 2 Failed: Master Medicine Ibuprofen not found in database');

    const rxNewPair = await Prescription.create({
      prescriptionId: `RX-NEWPAIR-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: aneesPatientUser._id,
      patientName: aneesPatientUser.name,
      patientPid: `PID-979121${timestamp.toString().slice(-4)}`,
      patientAge: 38,
      patientGender: 'Female',
      patientAllergies: [],
      medicines: [
        {
          medicineId: paraMed._id,
          medicineName: 'Paracetamol 500mg',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          strength: '500 mg',
          frequency: '1-0-1',
          duration: '3 days',
          route: 'Oral',
        },
        {
          medicineId: ibupMed._id,
          medicineName: 'Ibuprofen 400mg',
          genericName: 'Ibuprofen',
          dosage: '400 mg',
          strength: '400 mg',
          frequency: '1-0-1',
          duration: '3 days',
          route: 'Oral',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rxNewPair._id);

    const reqRxNewPair = { user: doctorReqUser, params: { id: rxNewPair._id.toString() } };
    let resRxNewPairObj = null;
    const resRxNewPair = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRxNewPairObj = obj; return this; },
    };

    await checkWithMedwise(reqRxNewPair, resRxNewPair, nextErr);
    assert(resRxNewPair.statusCode === 200, 'Test 2 Failed: checkWithMedwise failed for New-New pair');

    const newPairAnalysis = resRxNewPairObj.prescription.medwiseAnalysis;
    const piFinding = newPairAnalysis.checks.interactions.findings.find(
      (f) =>
        f.status === 'interaction_flagged' &&
        ((f.medicineA?.genericName === 'Paracetamol' && f.medicineB?.genericName === 'Ibuprofen') ||
          (f.medicineA?.genericName === 'Ibuprofen' && f.medicineB?.genericName === 'Paracetamol'))
    );

    assert(Boolean(piFinding), 'Test 2 Failed: Paracetamol ↔ Ibuprofen interaction finding missing');
    assert(piFinding.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION', `Test 2 Failed: Expected NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION, got '${piFinding.sourceType}'`);
    assert(piFinding.severity === 'Minor', `Test 2 Failed: Expected severity Minor, got '${piFinding.severity}'`);
    assert(Boolean(piFinding.reason), 'Test 2 Failed: Structured reason missing');
    assert(Boolean(piFinding.potentialConcern), 'Test 2 Failed: Structured potentialConcern missing');
    assert(Boolean(piFinding.clinicalConsideration), 'Test 2 Failed: Structured clinicalConsideration missing');
    assert(Boolean(piFinding.evidenceSource), 'Test 2 Failed: Structured evidenceSource missing');

    console.log('  PASSED: New ↔ New interaction (Paracetamol ↔ Ibuprofen) correctly identified with full structured explanation.\n');

    // -------------------------------------------------------------------------
    // TEST 3 — DOSAGE ACCEPTED FOR UNLISTED GUIDELINE (WARFARIN)
    // -------------------------------------------------------------------------
    console.log('Running Test 3: Unlisted Dosage Guideline (Warfarin) yields ACCEPTED status + doctorReviewRequired: false...');
    const dosageFindings = analysis.checks.dosage;
    const warfDosageFinding = dosageFindings.find((d) => d.genericName === 'Warfarin');

    assert(Boolean(warfDosageFinding), 'Test 3 Failed: Warfarin dosage finding missing');
    assert(warfDosageFinding.status === 'accepted', `Test 3 Failed: Expected status accepted, got '${warfDosageFinding.status}'`);
    assert(warfDosageFinding.doctorReviewRequired === false, 'Test 3 Failed: doctorReviewRequired must be false for unverified dosage guidelines');

    console.log('  PASSED: Unverified dosage guideline yields status ACCEPTED with doctorReviewRequired: false.\n');

    // -------------------------------------------------------------------------
    // TEST 4 — UNIFIED AUDIT MAPS ALL STRUCTURED EXPLANATION FIELDS
    // -------------------------------------------------------------------------
    console.log('Running Test 4: Verify Unified Audit preserves all structured explanation fields...');
    const auditFindings = analysis.audit.findings;
    const auditInteractionFinding = auditFindings.find((f) => f.source === 'interactions' && f.status === 'Flagged');

    assert(Boolean(auditInteractionFinding), 'Test 4 Failed: Flagged interaction finding missing in audit.findings');
    assert(Boolean(auditInteractionFinding.reason), 'Test 4 Failed: Audit finding missing reason');
    assert(Boolean(auditInteractionFinding.potentialConcern), 'Test 4 Failed: Audit finding missing potentialConcern');
    assert(Boolean(auditInteractionFinding.clinicalConsideration), 'Test 4 Failed: Audit finding missing clinicalConsideration');
    assert(Boolean(auditInteractionFinding.evidenceSource), 'Test 4 Failed: Audit finding missing evidenceSource');
    assert(Boolean(auditInteractionFinding.rawSeverity), 'Test 4 Failed: Audit finding missing rawSeverity');
    assert(Boolean(auditInteractionFinding.sourceType), 'Test 4 Failed: Audit finding missing sourceType');

    console.log('  PASSED: Unified Audit maps all structured explanation fields without data loss.\n');

    console.log('========================================================================');
    console.log('ALL CLINICAL REPORT & INTERACTION DATA-FLOW TESTS COMPLETED SUCCESSFULLY!');
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
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Cleanup complete. Disconnecting MongoDB.');
      await mongoose.disconnect();
    }
  }
}

runReportDataFlowTests();
