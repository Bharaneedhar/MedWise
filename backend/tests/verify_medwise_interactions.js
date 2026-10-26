const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Medicine = require('../src/models/Medicine');
const Prescription = require('../src/models/Prescription');
const DrugInteraction = require('../src/models/DrugInteraction');

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { createPrescription } = require('../src/controllers/prescriptionController');
const { checkPrescriptionDosage, checkPrescriptionInteraction, analyzePrescription } = require('../src/controllers/medwiseController');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { buildPairKey, checkPrescriptionInteractions } = require('../src/services/medwise/interactionCheckService');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Interaction Check verification.\n');

    const timestamp = Date.now();
    let insertedInteractionId = null;

    // ===========================================================
    // 1. UTILITY FUNCTION TESTS
    // ===========================================================
    console.log('=== 1. UTILITY FUNCTION UNIT TESTS ===');

    // 1.1 buildPairKey produces canonical (sorted) key
    const keyAB = buildPairKey('aaa', 'bbb');
    const keyBA = buildPairKey('bbb', 'aaa');
    console.log('1.1 buildPairKey AB:', keyAB, '| BA:', keyBA, '| equal:', keyAB === keyBA);
    if (keyAB !== keyBA) throw new Error('buildPairKey must produce order-independent canonical key');

    // 1.2 interactionCheckService loaded
    console.log('1.2 checkPrescriptionInteractions loaded:', typeof checkPrescriptionInteractions === 'function');
    if (typeof checkPrescriptionInteractions !== 'function') throw new Error('checkPrescriptionInteractions not a function');

    // 1.3 analyzeFullPrescription loaded
    console.log('1.3 MedwiseEngine.analyzeFullPrescription loaded:', typeof MedwiseEngine.analyzeFullPrescription === 'function');
    if (typeof MedwiseEngine.analyzeFullPrescription !== 'function') throw new Error('analyzeFullPrescription not a function');

    // 1.4 evaluatePrescriptionDosage still present (regression)
    console.log('1.4 MedwiseEngine.evaluatePrescriptionDosage still present:', typeof MedwiseEngine.evaluatePrescriptionDosage === 'function');
    if (typeof MedwiseEngine.evaluatePrescriptionDosage !== 'function') throw new Error('evaluatePrescriptionDosage regression failure');

    // ===========================================================
    // 2. SINGLE MEDICINE — NO PAIRS
    // ===========================================================
    console.log('\n=== 2. SINGLE MEDICINE — NO PAIRS ===');
    const singleRx = { medicines: [{ medicineId: null, genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' }] };
    const singleResult = await checkPrescriptionInteractions(singleRx);
    console.log('2.1 Single medicine result:', singleResult.status, '| pairs:', singleResult.pairsEvaluated, '| findings:', singleResult.findings.length);
    if (singleResult.status !== 'completed' || singleResult.pairsEvaluated !== 0 || singleResult.findings.length !== 0) {
      throw new Error('Single medicine prescription should return completed with 0 pairs and 0 findings');
    }

    // ===========================================================
    // 3. RESOLVE REAL MEDICINES FROM MASTER DATABASE
    // ===========================================================
    console.log('\n=== 3. MASTER MEDICINE LOOKUP ===');
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });
    const ibuprofen = await Medicine.findOne({ genericName: 'Ibuprofen', isActive: true });

    if (!paracetamol) throw new Error('Paracetamol not found in master database');
    if (!amoxicillin) throw new Error('Amoxicillin not found in master database');
    console.log('3.1 Paracetamol found:', paracetamol.genericName, '| Amoxicillin found:', amoxicillin.genericName);
    if (ibuprofen) console.log('3.2 Ibuprofen found:', ibuprofen.genericName);

    // ===========================================================
    // 4. DrugInteraction COLLECTION STATUS
    // ===========================================================
    console.log('\n=== 4. DrugInteraction COLLECTION STATUS ===');
    const totalInteractions = await DrugInteraction.countDocuments();
    console.log('4.1 Total DrugInteraction records in database:', totalInteractions);

    // ===========================================================
    // 5. SEED A TEST INTERACTION (Paracetamol + Amoxicillin)
    //    Only used for testing — removed in cleanup
    // ===========================================================
    console.log('\n=== 5. SEED TEST INTERACTION RECORD ===');
    const testKey = buildPairKey(String(paracetamol._id), String(amoxicillin._id));
    const existingTestInteraction = await DrugInteraction.findOne({ interactionPairKey: testKey });

    if (!existingTestInteraction) {
      const testInteraction = await DrugInteraction.create({
        medicineA: paracetamol._id,
        medicineB: amoxicillin._id,
        severity: 'Minor',
        description: 'TEST ONLY: Monitor for additive adverse effects.',
        clinicalEffect: 'TEST: Minor pharmacokinetic interaction in test scenario.',
        recommendedAction: 'TEST: No clinical action required in real practice for this pair.',
        evidenceSource: 'MedWise Verification Test Suite',
        isActive: true,
      });
      insertedInteractionId = testInteraction._id;
      console.log('5.1 Test interaction record seeded:', testKey, '| severity: Minor');
    } else {
      insertedInteractionId = null; // Already exists, do not delete
      console.log('5.1 Test interaction record already exists (skipping seed):', testKey);
    }

    // ===========================================================
    // 6. INTERACTION CHECK WITH KNOWN INTERACTION
    // ===========================================================
    console.log('\n=== 6. INTERACTION CHECK — FLAGGED PAIR ===');
    const flaggedRx = {
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', dosage: '500 mg', frequency: 'Thrice daily' },
      ],
    };
    const flaggedResult = await checkPrescriptionInteractions(flaggedRx);
    console.log('6.1 Status:', flaggedResult.status, '| pairs:', flaggedResult.pairsEvaluated, '| flagged:', flaggedResult.flaggedCount);
    console.log('6.2 Summary:', flaggedResult.summaryNote);
    if (flaggedResult.status !== 'completed') throw new Error('Expected completed status for evaluable pair');
    if (flaggedResult.pairsEvaluated !== 1) throw new Error('Expected 1 pair evaluated');
    if (flaggedResult.flaggedCount !== 1) throw new Error('Expected 1 flagged interaction');

    const flaggedFinding = flaggedResult.findings[0];
    console.log('6.3 Finding status:', flaggedFinding.status, '| severity:', flaggedFinding.severity);
    if (flaggedFinding.status !== 'interaction_flagged') throw new Error('Expected interaction_flagged status');
    if (flaggedFinding.severity !== 'Minor') throw new Error('Expected Minor severity for test interaction');

    // ===========================================================
    // 7. INTERACTION CHECK — NO INTERACTION IN DATABASE
    // ===========================================================
    console.log('\n=== 7. INTERACTION CHECK — NO INTERACTION FOUND ===');
    if (ibuprofen) {
      const noInteractionRx = {
        medicines: [
          { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
          { medicineId: String(ibuprofen._id), genericName: 'Ibuprofen', dosage: '400 mg', frequency: 'Twice daily' },
        ],
      };
      // Remove any existing test record for this pair
      const ibuprofenTestKey = buildPairKey(String(paracetamol._id), String(ibuprofen._id));
      const ibuprofenInteraction = await DrugInteraction.findOne({ interactionPairKey: ibuprofenTestKey });
      if (!ibuprofenInteraction) {
        const noInteractionResult = await checkPrescriptionInteractions(noInteractionRx);
        console.log('7.1 Status:', noInteractionResult.status, '| pairs:', noInteractionResult.pairsEvaluated, '| flagged:', noInteractionResult.flaggedCount);
        if (noInteractionResult.findings[0].status !== 'no_interaction_found') {
          throw new Error('Expected no_interaction_found for Paracetamol+Ibuprofen (no record seeded)');
        }
        console.log('7.2 Finding status:', noInteractionResult.findings[0].status, '(CORRECT — no record exists)');
      } else {
        console.log('7.1 Ibuprofen+Paracetamol interaction exists in DB — skipping no_interaction_found assertion');
      }
    } else {
      console.log('7.1 Ibuprofen not in master DB — skipping no_interaction_found test');
    }

    // ===========================================================
    // 8. FULL ENGINE analyzeFullPrescription OUTPUT STRUCTURE
    // ===========================================================
    console.log('\n=== 8. FULL ENGINE analyzeFullPrescription STRUCTURE ===');
    const fullAnalysisRx = {
      prescriptionId: 'TEST-FULL-001',
      patientAge: 35,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily', route: 'Oral' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', dosage: '500 mg', frequency: 'Thrice daily', route: 'Oral' },
      ],
    };
    const engineOutput = await MedwiseEngine.analyzeFullPrescription(fullAnalysisRx);
    console.log('8.1 prescriptionId:', engineOutput.prescriptionId);
    console.log('8.2 checks.dosage length:', engineOutput.checks.dosage.length);
    console.log('8.3 checks.interactions.status:', engineOutput.checks.interactions.status);
    console.log('8.4 checks.interactions.pairsEvaluated:', engineOutput.checks.interactions.pairsEvaluated);
    console.log('8.5 checks.interactions.flaggedCount:', engineOutput.checks.interactions.flaggedCount);
    console.log('8.6 checks.duplicates:', engineOutput.checks.duplicates ? engineOutput.checks.duplicates.status : null);
    console.log('8.7 checks.allergySafety:', engineOutput.checks.allergySafety, '(Expected: null)');
    console.log('8.8 overallRecommendation:', engineOutput.overallRecommendation);

    if (!Array.isArray(engineOutput.checks.dosage)) throw new Error('checks.dosage must be an array');
    if (!engineOutput.checks.interactions) throw new Error('checks.interactions must be populated');
    if (engineOutput.checks.interactions.status !== 'completed') throw new Error('Interaction check status must be completed');
    if (!engineOutput.checks.duplicates) throw new Error('checks.duplicates must be populated in Step 3');
    if (!engineOutput.checks.allergySafety) throw new Error('checks.allergySafety must be populated in Step 4');



    // ===========================================================
    // 9. API INTEGRATION TESTS (Protected Endpoints)
    // ===========================================================
    console.log('\n=== 9. PROTECTED API INTEGRATION TESTS ===');

    // Register test doctor
    const docRegReq = { body: { name: 'Dr. Interaction Tester', email: 'doc.interaction.' + timestamp + '@medwise.com', password: 'password123', role: 'doctor' } };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);

    await createOrUpdateMyProfile({ user: doctorUser, body: { name: 'Dr. Interaction Tester', mobileNumber: '9840111222', specialization: 'Internal Medicine' } }, mockRes(), (err) => { if (err) throw err; });

    // Register test patient
    const patRegReq = { body: { name: 'Interaction Patient', email: 'patient.interaction.' + timestamp + '@medwise.com', password: 'password123', role: 'patient' } };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);

    await createOrUpdateMyProfile({
      user: patientUser,
      body: { name: 'Interaction Patient', mobileNumber: '9811222333', dateOfBirth: '1990-01-01', gender: 'Female',
        address: { addressLine1: 'Test Lane', city: 'Mumbai', state: 'MH', country: 'India', pinCode: '400001' },
        bloodGroup: 'B+', emergencyContact: { name: 'Emergency', relationship: 'Parent', mobileNumber: '9811222334' } },
    }, mockRes(), (err) => { if (err) throw err; });

    // Create prescription with 2 medicines
    const rxReq = {
      user: doctorUser,
      body: {
        patientPid: 'PID-9811222333',
        patientId: patientUser._id,
        clinicalDiagnosis: 'Fever with respiratory infection',
        doctorNotes: 'Monitor patient',
        medicines: [
          { medicineId: String(paracetamol._id), genericName: 'Paracetamol', medicineName: 'Paracetamol', dosage: '500 mg', dosageForm: 'Tablet', frequency: 'Twice daily', duration: '5 days', route: 'Oral' },
          { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', medicineName: 'Amoxicillin', dosage: '500 mg', dosageForm: 'Capsule', frequency: 'Thrice daily', duration: '7 days', route: 'Oral' },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    const createdRx = rxRes.data.prescription;
    console.log('9.1 Test prescription created:', createdRx.prescriptionId);

    // 9.2 Doctor can run interaction-check endpoint
    const intApiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const intApiRes = mockRes();
    await checkPrescriptionInteraction(intApiReq, intApiRes, (err) => { if (err) throw err; });
    console.log('9.2 Doctor POST /interaction-check status:', intApiRes.statusCode);
    if (intApiRes.statusCode !== 200 || !intApiRes.data.success || !intApiRes.data.analysis) throw new Error('Doctor interaction-check API failed');
    console.log('    interactions.flaggedCount:', intApiRes.data.analysis.checks.interactions.flaggedCount);

    // 9.3 Doctor can run analyze endpoint
    const analyzeApiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const analyzeApiRes = mockRes();
    await analyzePrescription(analyzeApiReq, analyzeApiRes, (err) => { if (err) throw err; });
    console.log('9.3 Doctor POST /analyze status:', analyzeApiRes.statusCode);
    if (analyzeApiRes.statusCode !== 200 || !analyzeApiRes.data.success) throw new Error('Doctor full analyze API failed');

    // 9.4 Patient MUST be rejected from interaction-check (HTTP 403)
    const patIntApiReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patIntApiRes = mockRes();
    await checkPrescriptionInteraction(patIntApiReq, patIntApiRes, (err) => { if (err) throw err; });
    console.log('9.4 Patient POST /interaction-check rejection status:', patIntApiRes.statusCode);
    if (patIntApiRes.statusCode !== 403) throw new Error('Patient MUST be rejected (HTTP 403) from interaction-check');

    // 9.5 Patient MUST be rejected from full analyze (HTTP 403)
    const patAnalyzeApiReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patAnalyzeApiRes = mockRes();
    await analyzePrescription(patAnalyzeApiReq, patAnalyzeApiRes, (err) => { if (err) throw err; });
    console.log('9.5 Patient POST /analyze rejection status:', patAnalyzeApiRes.statusCode);
    if (patAnalyzeApiRes.statusCode !== 403) throw new Error('Patient MUST be rejected (HTTP 403) from full analyze');

    // 9.6 Dosage-check endpoint still works (Phase 2 Step 1 regression)
    const dosageApiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const dosageApiRes = mockRes();
    await checkPrescriptionDosage(dosageApiReq, dosageApiRes, (err) => { if (err) throw err; });
    console.log('9.6 REGRESSION Doctor POST /dosage-check status:', dosageApiRes.statusCode, '(Phase 2 Step 1 regression)');
    if (dosageApiRes.statusCode !== 200) throw new Error('REGRESSION: dosage-check API broken');

    // ===========================================================
    // 10. CLEANUP
    // ===========================================================
    console.log('\n=== 10. CLEANUP TEST DATA ===');
    await User.deleteMany({ _id: { $in: [doctorUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: doctorUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    await Prescription.deleteMany({ _id: createdRx._id });

    // Remove seeded test interaction only if WE created it
    if (insertedInteractionId) {
      await DrugInteraction.deleteOne({ _id: insertedInteractionId });
      console.log('Test interaction record removed.');
    }
    console.log('Cleanup complete.');

    console.log('\n==========================================================');
    console.log('>>> ALL MEDWISE INTERACTION CHECK TESTS PASSED! <<<');
    console.log('==========================================================');
    process.exit(0);
  } catch (error) {
    console.error('MedWise Interaction Check verification error:', error);
    process.exit(1);
  }
};

runTest();
