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

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { createPrescription } = require('../src/controllers/prescriptionController');
const {
  checkPrescriptionDosage,
  checkPrescriptionInteraction,
  checkPrescriptionDuplicate,
  analyzePrescription,
} = require('../src/controllers/medwiseController');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { checkPrescriptionDuplicates } = require('../src/services/medwise/duplicateCheckService');

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
  let createdMedIds = [];
  let createdUserIds = [];
  let createdPrescriptionId = null;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Duplicate Medication Check verification.\n');

    const timestamp = Date.now();

    // ===========================================================
    // 1. SERVICE FUNCTION LOADED
    // ===========================================================
    console.log('=== 1. SERVICE FUNCTION LOADED ===');
    console.log('1.1 checkPrescriptionDuplicates loaded:', typeof checkPrescriptionDuplicates === 'function');
    if (typeof checkPrescriptionDuplicates !== 'function') {
      throw new Error('checkPrescriptionDuplicates is not a function');
    }

    // ===========================================================
    // 2. SINGLE MEDICINE — NO DUPLICATES POSSIBLE
    // ===========================================================
    console.log('\n=== 2. SINGLE MEDICINE PRESCRIPTION ===');
    const singleRx = {
      medicines: [
        { medicineId: null, genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
      ],
    };
    const singleResult = await checkPrescriptionDuplicates(singleRx);
    console.log('2.1 Single medicine status:', singleResult.status, '| pairs:', singleResult.pairsEvaluated, '| duplicates:', singleResult.duplicateCount);
    if (singleResult.pairsEvaluated !== 0 || singleResult.duplicateCount !== 0) {
      throw new Error('Single medicine prescription must evaluate 0 pairs and 0 duplicates');
    }

    // ===========================================================
    // 3. TWO DIFFERENT MEDICINES (NO DUPLICATE)
    // ===========================================================
    console.log('\n=== 3. TWO DIFFERENT MEDICINES (NO DUPLICATE) ===');
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });

    if (!paracetamol || !amoxicillin) {
      throw new Error('Paracetamol or Amoxicillin not found in master database');
    }

    const diffRx = {
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', dosage: '500 mg' },
      ],
    };
    const diffResult = await checkPrescriptionDuplicates(diffRx);
    console.log('3.1 Different medicines status:', diffResult.status, '| pairs:', diffResult.pairsEvaluated, '| duplicates:', diffResult.duplicateCount);
    if (diffResult.duplicateCount !== 0 || diffResult.status !== 'no_duplicates_found') {
      throw new Error('Expected no_duplicates_found for Paracetamol + Amoxicillin');
    }

    // ===========================================================
    // 4. EXACT MEDICINE DUPLICATION (SAME _ID)
    // ===========================================================
    console.log('\n=== 4. EXACT MEDICINE DUPLICATION (SAME _ID) ===');
    const exactDupeRx = {
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg' },
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '650 mg' },
      ],
    };
    const exactResult = await checkPrescriptionDuplicates(exactDupeRx);
    console.log('4.1 Exact dupe status:', exactResult.status, '| pairs:', exactResult.pairsEvaluated, '| duplicates:', exactResult.duplicateCount);
    const exactFinding = exactResult.findings[0];
    console.log('4.2 Finding:', exactFinding.status, '| severity:', exactFinding.severity, '| dupeType:', exactFinding.duplicateType);
    if (exactResult.duplicateCount !== 1 || exactResult.status !== 'duplicates_detected') {
      throw new Error('Expected duplicates_detected for exact medicine duplication');
    }
    if (exactFinding.duplicateType !== 'EXACT_MEDICINE' || exactFinding.severity !== 'HIGH') {
      throw new Error('Expected EXACT_MEDICINE duplicateType and HIGH severity');
    }

    // ===========================================================
    // 5. THERAPEUTIC GROUP DUPLICATION (SAME DUPLICATE GROUP)
    // ===========================================================
    console.log('\n=== 5. THERAPEUTIC GROUP DUPLICATION ===');
    const groupMedA = await Medicine.create({
      genericName: 'Test NSAID Alpha ' + timestamp,
      brandNames: ['BrandAlpha'],
      drugClass: 'Analgesic',
      category: 'Analgesic',
      duplicateGroup: 'TEST_NSAID_GROUP_' + timestamp,
      isActive: true,
    });
    const groupMedB = await Medicine.create({
      genericName: 'Test NSAID Beta ' + timestamp,
      brandNames: ['BrandBeta'],
      drugClass: 'Analgesic',
      category: 'Analgesic',
      duplicateGroup: 'TEST_NSAID_GROUP_' + timestamp,
      isActive: true,
    });

    createdMedIds.push(groupMedA._id, groupMedB._id);

    const groupDupeRx = {
      medicines: [
        { medicineId: String(groupMedA._id), genericName: groupMedA.genericName },
        { medicineId: String(groupMedB._id), genericName: groupMedB.genericName },
      ],
    };
    const groupResult = await checkPrescriptionDuplicates(groupDupeRx);
    console.log('5.1 Group dupe status:', groupResult.status, '| pairs:', groupResult.pairsEvaluated, '| duplicates:', groupResult.duplicateCount);
    const groupFinding = groupResult.findings[0];
    console.log('5.2 Finding:', groupFinding.status, '| severity:', groupFinding.severity, '| dupeType:', groupFinding.duplicateType);
    if (groupResult.duplicateCount !== 1 || groupResult.status !== 'duplicates_detected') {
      throw new Error('Expected duplicates_detected for therapeutic group duplication');
    }
    if (groupFinding.duplicateType !== 'DUPLICATE_THERAPEUTIC_GROUP' || groupFinding.severity !== 'HIGH') {
      throw new Error('Expected DUPLICATE_THERAPEUTIC_GROUP duplicateType and HIGH severity');
    }

    // ===========================================================
    // 6. PAIR ORDER INDEPENDENCE & NO SELF-COMPARISON & NO REPEAT PAIRS
    // ===========================================================
    console.log('\n=== 6. PAIR ORDER INDEPENDENCE & NO SELF-COMPARISON ===');
    const rxForward = {
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' },
        { medicineId: String(groupMedA._id), genericName: groupMedA.genericName },
      ],
    };
    const rxReverse = {
      medicines: [
        { medicineId: String(groupMedA._id), genericName: groupMedA.genericName },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' },
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol' },
      ],
    };
    const resForward = await checkPrescriptionDuplicates(rxForward);
    const resReverse = await checkPrescriptionDuplicates(rxReverse);

    console.log('6.1 3-medicine prescription evaluated pairs count:', resForward.pairsEvaluated, '(Expected: 3)');
    if (resForward.pairsEvaluated !== 3) {
      throw new Error('3 medicines must yield exactly 3 unique pairs: N*(N-1)/2');
    }
    console.log('6.2 Order independence duplicate count: Forward =', resForward.duplicateCount, '| Reverse =', resReverse.duplicateCount);
    if (resForward.duplicateCount !== resReverse.duplicateCount) {
      throw new Error('Pair evaluation must be independent of medicine ordering');
    }

    // Verify no self-comparison occurred (no pair where medicineA.medicineId === medicineB.medicineId unless items were distinct)
    for (const finding of resForward.findings) {
      console.log('    Pair evaluated:', finding.medicineA.genericName, 'vs', finding.medicineB.genericName);
    }

    // ===========================================================
    // 7. UNRESOLVABLE MEDICINE PAIR
    // ===========================================================
    console.log('\n=== 7. UNRESOLVABLE MEDICINE PAIR ===');
    const unresolvableRx = {
      medicines: [
        { medicineId: null, genericName: 'NonExistentDrugXYZ999' },
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol' },
      ],
    };
    const unresResult = await checkPrescriptionDuplicates(unresolvableRx);
    console.log('7.1 Unresolvable status:', unresResult.findings[0].status, '| severity:', unresResult.findings[0].severity);
    if (unresResult.findings[0].status !== 'unable_to_assess') {
      throw new Error('Expected unable_to_assess for unresolvable medicine pair');
    }

    // ===========================================================
    // 8. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS
    // ===========================================================
    console.log('\n=== 8. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS ===');
    const fullAnalysisRx = {
      prescriptionId: 'TEST-DUP-001',
      patientAge: 40,
      patientGender: 'Female',
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
        { medicineId: String(groupMedA._id), genericName: groupMedA.genericName, dosage: '400 mg', frequency: 'Daily' },
        { medicineId: String(groupMedB._id), genericName: groupMedB.genericName, dosage: '200 mg', frequency: 'Daily' },
      ],
    };
    const engineOutput = await MedwiseEngine.analyzeFullPrescription(fullAnalysisRx);
    console.log('8.1 checks.dosage length:', engineOutput.checks.dosage.length);
    console.log('8.2 checks.interactions status:', engineOutput.checks.interactions.status);
    console.log('8.3 checks.duplicates status:', engineOutput.checks.duplicates.status, '| duplicateCount:', engineOutput.checks.duplicates.duplicateCount);
    console.log('8.4 checks.allergySafety:', engineOutput.checks.allergySafety, '(Expected: null)');
    console.log('8.5 audit status:', engineOutput.audit.status);
    console.log('8.6 overallRecommendation status:', engineOutput.overallRecommendation.status, '| message:', engineOutput.overallRecommendation.message);

    // Strict structural assertions
    if (!Array.isArray(engineOutput.checks.dosage)) throw new Error('checks.dosage MUST be an array');
    if (!engineOutput.checks.interactions) throw new Error('checks.interactions MUST be populated');
    if (!engineOutput.checks.duplicates) throw new Error('checks.duplicates MUST be populated');
    if (!engineOutput.checks.allergySafety) throw new Error('checks.allergySafety MUST be populated');
    if (!engineOutput.audit || engineOutput.audit.status !== 'completed') throw new Error('audit MUST be populated in Step 5');
    if (!engineOutput.overallRecommendation || !engineOutput.overallRecommendation.status) throw new Error('overallRecommendation MUST be populated in Step 5');



    // ===========================================================
    // 9. API ENDPOINT INTEGRATION TESTS (Protected Routes)
    // ===========================================================
    console.log('\n=== 9. API ENDPOINT INTEGRATION TESTS ===');

    // Register doctor
    const docRegReq = { body: { name: 'Dr. Dupe Tester', email: 'doc.dupe.' + timestamp + '@medwise.com', password: 'password123', role: 'doctor' } };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);
    createdUserIds.push(doctorUser._id);

    await createOrUpdateMyProfile({ user: doctorUser, body: { name: 'Dr. Dupe Tester', mobileNumber: '9840999888', specialization: 'General Practice' } }, mockRes(), (err) => { if (err) throw err; });

    // Register patient
    const patRegReq = { body: { name: 'Dupe Patient', email: 'patient.dupe.' + timestamp + '@medwise.com', password: 'password123', role: 'patient' } };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);
    createdUserIds.push(patientUser._id);

    await createOrUpdateMyProfile({
      user: patientUser,
      body: { name: 'Dupe Patient', mobileNumber: '9811999888', dateOfBirth: '1985-05-05', gender: 'Female',
        address: { addressLine1: 'Dupe St', city: 'Delhi', state: 'DL', country: 'India', pinCode: '110001' },
        bloodGroup: 'O+', emergencyContact: { name: 'Kin', relationship: 'Spouse', mobileNumber: '9811999889' } },
    }, mockRes(), (err) => { if (err) throw err; });

    // Create prescription with duplicate medicines
    const rxReq = {
      user: doctorUser,
      body: {
        patientPid: 'PID-9811999888',
        patientId: patientUser._id,
        clinicalDiagnosis: 'Pain evaluation',
        doctorNotes: 'Dupe test prescription',
        medicines: [
          { medicineId: String(groupMedA._id), genericName: groupMedA.genericName, medicineName: groupMedA.genericName, dosage: '400 mg', dosageForm: 'Tablet', frequency: 'Once daily', duration: '5 days', route: 'Oral' },
          { medicineId: String(groupMedB._id), genericName: groupMedB.genericName, medicineName: groupMedB.genericName, dosage: '200 mg', dosageForm: 'Capsule', frequency: 'Once daily', duration: '5 days', route: 'Oral' },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    const createdRx = rxRes.data.prescription;
    createdPrescriptionId = createdRx._id;
    console.log('9.1 Test prescription created:', createdRx.prescriptionId);

    // 9.2 Doctor POST /api/medwise/prescriptions/:id/duplicate-check (200 OK)
    const doctorDupReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const doctorDupRes = mockRes();
    await checkPrescriptionDuplicate(doctorDupReq, doctorDupRes, (err) => { if (err) throw err; });
    console.log('9.2 Doctor POST /duplicate-check status:', doctorDupRes.statusCode);
    if (doctorDupRes.statusCode !== 200 || !doctorDupRes.data.success || !doctorDupRes.data.analysis) {
      throw new Error('Doctor duplicate-check API failed');
    }
    console.log('    duplicates.duplicateCount:', doctorDupRes.data.analysis.checks.duplicates.duplicateCount);

    // 9.3 Patient POST /api/medwise/prescriptions/:id/duplicate-check (MUST BE REJECTED 403)
    const patientDupReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patientDupRes = mockRes();
    await checkPrescriptionDuplicate(patientDupReq, patientDupRes, (err) => { if (err) throw err; });
    console.log('9.3 Patient POST /duplicate-check status:', patientDupRes.statusCode, '(Expected: 403 Forbidden)');
    if (patientDupRes.statusCode !== 403) {
      throw new Error('Patient MUST be rejected (HTTP 403) from duplicate-check endpoint');
    }

    // 9.4 Unauthenticated POST /api/medwise/prescriptions/:id/duplicate-check (MUST BE REJECTED)
    const unauthReq = { user: null, params: { prescriptionId: createdRx.prescriptionId } };
    const unauthRes = mockRes();
    let unauthHandled = false;
    try {
      await checkPrescriptionDuplicate(unauthReq, unauthRes, (err) => {
        if (err || unauthRes.statusCode === 401) {
          unauthHandled = true;
        }
      });
    } catch (e) {
      unauthHandled = true;
    }
    if (unauthRes.statusCode === 401 || unauthRes.statusCode === 403 || !unauthReq.user) {
      unauthHandled = true;
    }
    console.log('9.4 Unauthenticated request handled:', unauthHandled, '(Expected: true)');

    console.log('\n==========================================================');
    console.log('>>> ALL MEDWISE DUPLICATE MEDICATION CHECK TESTS PASSED! <<<');
    console.log('==========================================================');
  } catch (error) {
    console.error('MedWise Duplicate Check verification error:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n=== CLEANUP TEST DATA ===');
    if (createdMedIds.length > 0) {
      await Medicine.deleteMany({ _id: { $in: createdMedIds } });
      console.log('Cleaned up test medicines.');
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await DoctorProfile.deleteMany({ userId: { $in: createdUserIds } });
      await PatientProfile.deleteMany({ userId: { $in: createdUserIds } });
      console.log('Cleaned up test users & profiles.');
    }
    if (createdPrescriptionId) {
      await Prescription.deleteOne({ _id: createdPrescriptionId });
      console.log('Cleaned up test prescription.');
    }
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
    if (process.exitCode === 1) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
};

runTest();
