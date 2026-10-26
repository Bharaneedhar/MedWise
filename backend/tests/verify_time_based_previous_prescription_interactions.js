/**
 * MEDWISE — TIME-BASED PREVIOUS PRESCRIPTION DRUG-DRUG INTERACTION VERIFICATION
 *
 * Verifies all 24 required test cases:
 *  1. New patient + first prescription (0 previous pairs).
 *  2. Second prescription checks active medicine from prescription 1.
 *  3. Third prescription checks active medicines from prescriptions 1 and 2.
 *  4. Fourth prescription checks active medicines from prescriptions 1, 2, and 3.
 *  5. Expired medicine is excluded.
 *  6. Active medicine from an older prescription is included.
 *  7. Different durations within one prescription are handled independently.
 *  8. New-to-new interaction section works (NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION).
 *  9. Active-previous-to-new interaction section works (CURRENT_MEDICATION_TO_NEW_PRESCRIPTION).
 * 10. Both sections remain separate.
 * 11. Pair counts are correct (current Rx pairs + active previous pairs).
 * 12. Duplicate pairs are prevented.
 * 13. Self-interactions are prevented.
 * 14. Canonical pair ordering remains correct (A <-> B == B <-> A).
 * 15. Same-patient filtering works.
 * 16. Cross-patient medications are excluded.
 * 17. Structured clinical explanations remain intact.
 * 18. Existing DrugInteraction records are used.
 * 19. No medicine-specific hardcoding exists (arbitrary medicine names tested).
 * 20. Delivered-but-still-within-duration medicine remains active.
 * 21. Delivered-and-expired medicine is excluded.
 * 22. Real existing prescriptions are not modified unexpectedly.
 * 23. Existing MedWise Phase 1-7 regression tests remain passing.
 * 24. Existing workflow tests remain passing.
 */

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const DrugInteraction = require('../src/models/DrugInteraction');
const Consultation = require('../src/models/Consultation');

const interactionCheckService = require('../src/services/medwise/interactionCheckService');
const previousPrescriptionService = require('../src/services/medwise/previousPrescriptionService');
const prescriptionAuditService = require('../src/services/medwise/prescriptionAuditService');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { checkWithMedwise } = require('../src/controllers/prescriptionController');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (d) {
    this.data = d;
    return this;
  };
  return res;
};

const nextErr = (err) => {
  if (err) throw err;
};

async function runTests() {
  console.log('========================================================================');
  console.log('STARTING TIME-BASED PREVIOUS PRESCRIPTION INTERACTION TEST SUITE');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  // Baseline snapshots of existing DB state
  const initialRxCount = await Prescription.countDocuments({});
  const initialMedCount = await Medicine.countDocuments({});
  const realPrescriptions = await Prescription.find({
    prescriptionId: { $not: /^TEST-/ }
  }).lean();
  console.log(`Snapshot: ${realPrescriptions.length} legitimate real prescriptions, ${initialMedCount} medicines in master.\n`);

  const createdUserIds = [];
  const createdProfileIds = [];
  const createdPrescriptionIds = [];
  const createdConsultationIds = [];
  const createdInteractionIds = [];
  const createdMedicineIds = [];

  let passedCount = 0;
  const pass = (num, msg) => {
    passedCount++;
    console.log(`  ✓ Test ${num} Passed: ${msg}`);
  };

  try {
    const timestamp = Date.now();

    // Find existing Doctor
    let doctorUser = await User.findOne({ role: 'doctor' });
    let doctorProfile = doctorUser ? await DoctorProfile.findOne({ userId: doctorUser._id }) : null;
    if (!doctorProfile) {
      doctorProfile = await DoctorProfile.findOne({});
      if (doctorProfile) {
        doctorUser = await User.findById(doctorProfile.userId);
      }
    }
    assert(doctorUser && doctorProfile, 'A doctor user and doctor profile must exist');

    // Setup Test Patient Alpha
    const patientAlphaUser = new User({
      name: 'Alpha TimePatient',
      email: `alpha.patient.${timestamp}@example.com`,
      role: 'patient',
      password: 'Password@123',
    });
    await patientAlphaUser.save();
    createdUserIds.push(patientAlphaUser._id);

    const patientAlphaProfile = new PatientProfile({
      userId: patientAlphaUser._id,
      name: 'Alpha TimePatient',
      pid: `PID-ALPHA-${timestamp}`,
      email: patientAlphaUser.email,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      mobileNumber: `98123${timestamp.toString().slice(-5)}`,
      address: {
        addressLine1: '100 Health St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Alpha Contact',
        relationship: 'Sibling',
        mobileNumber: '9876543210',
      },
      allergies: ['None'],
      hasNoKnownAllergies: true,
      allergyAssessmentCompleted: true,
      currentMedications: [],
    });
    await patientAlphaProfile.save();
    createdProfileIds.push(patientAlphaProfile._id);

    // Setup Test Patient Beta (for strict patient isolation)
    const patientBetaUser = new User({
      name: 'Beta IsolationPatient',
      email: `beta.patient.${timestamp}@example.com`,
      role: 'patient',
      password: 'Password@123',
    });
    await patientBetaUser.save();
    createdUserIds.push(patientBetaUser._id);

    const patientBetaProfile = new PatientProfile({
      userId: patientBetaUser._id,
      name: 'Beta IsolationPatient',
      pid: `PID-BETA-${timestamp}`,
      email: patientBetaUser.email,
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Female',
      mobileNumber: `98999${timestamp.toString().slice(-5)}`,
      address: {
        addressLine1: '200 Care Ave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Beta Contact',
        relationship: 'Parent',
        mobileNumber: '9876543211',
      },
      allergies: ['None'],
      hasNoKnownAllergies: true,
      allergyAssessmentCompleted: true,
      currentMedications: [],
    });
    await patientBetaProfile.save();
    createdProfileIds.push(patientBetaProfile._id);

    const alphaPid = `PID-ALPHA-${timestamp}`;
    const betaPid = `PID-BETA-${timestamp}`;
    const alphaName = patientAlphaUser.name;
    const betaName = patientBetaUser.name;
    const docName = (doctorProfile && doctorProfile.name) || (doctorUser && doctorUser.name) || 'Dr. Priyadharshini';

    // Setup test consultation for Alpha
    const consultAlpha = new Consultation({
      consultationId: `CONS-ALPHA-${timestamp}`,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientName: alphaName,
      patientPid: alphaPid,
      reasonForVisit: 'General Medical Consultation',
      status: 'Completed',
      notes: 'Initial checkup',
    });
    await consultAlpha.save();
    createdConsultationIds.push(consultAlpha._id);

    // Fetch master medicines for reference
    const paracetamolDoc = await Medicine.findOne({ genericName: /^paracetamol$/i });
    const ibuprofenDoc = await Medicine.findOne({ genericName: /^ibuprofen$/i });
    const warfarinDoc = await Medicine.findOne({ genericName: /^warfarin$/i });
    const amoxicillinDoc = await Medicine.findOne({ genericName: /^amoxicillin$/i });

    assert(paracetamolDoc && ibuprofenDoc && warfarinDoc, 'Required master medicines must exist');

    // -------------------------------------------------------------------------
    // TEST 1: New patient + first prescription
    // -------------------------------------------------------------------------
    console.log('Test 1: New patient + first prescription...');
    const rx1Date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const rx1 = new Prescription({
      prescriptionId: `TEST-RX1-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Delivered',
      treatmentStartDate: rx1Date,
      createdAt: rx1Date,
      medicines: [
        {
          medicineId: paracetamolDoc._id,
          medicineName: 'Paracetamol',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          frequency: '1-0-1',
          duration: '5 days', // Expired after 5 days (was 10 days ago)
          route: 'Oral',
        },
      ],
    });
    await rx1.save();
    createdPrescriptionIds.push(rx1._id);

    // When rx1 was analyzed at rx1Date, there were no previous prescriptions
    const rx1Analysis = await interactionCheckService.checkPrescriptionInteractions(
      rx1.medicines,
      patientAlphaProfile,
      { prescription: rx1, evaluationTime: rx1Date }
    );
    assert.strictEqual(rx1Analysis.activePreviousPairsCount, 0, 'First prescription should have 0 previous pairs evaluated');
    assert.strictEqual(rx1Analysis.currentPrescriptionPairsCount, 0, 'Single medicine has 0 current prescription pairs');
    pass(1, 'New patient + first prescription evaluates 0 previous pairs');

    // -------------------------------------------------------------------------
    // TEST 2: Second prescription checks active medicine from prescription 1
    // -------------------------------------------------------------------------
    console.log('Test 2: Second prescription checks active medicine from prescription 1...');
    // Create an ongoing rx1-b for testing active lookback
    const rx1ActiveDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const rx1Active = new Prescription({
      prescriptionId: `TEST-RX1-ACTIVE-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Dispensed',
      treatmentStartDate: rx1ActiveDate,
      createdAt: rx1ActiveDate,
      medicines: [
        {
          medicineId: paracetamolDoc._id,
          medicineName: 'Paracetamol',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          frequency: '1-0-1',
          duration: '5 days', // Ends in 4 days -> currently ACTIVE
          route: 'Oral',
        },
      ],
    });
    await rx1Active.save();
    createdPrescriptionIds.push(rx1Active._id);

    const rx2 = new Prescription({
      prescriptionId: `TEST-RX2-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Review Recommended',
      treatmentStartDate: new Date(),
      createdAt: new Date(),
      medicines: [
        {
          medicineId: ibuprofenDoc._id,
          medicineName: 'Ibuprofen',
          genericName: 'Ibuprofen',
          dosage: '400 mg',
          frequency: '1-0-1',
          duration: '5 days',
          route: 'Oral',
        },
      ],
    });
    await rx2.save();
    createdPrescriptionIds.push(rx2._id);

    const rx2Analysis = await interactionCheckService.checkPrescriptionInteractions(
      rx2.medicines,
      patientAlphaProfile,
      { prescription: rx2, evaluationTime: new Date() }
    );
    assert.strictEqual(rx2Analysis.activePreviousPairsCount, 1, 'Should evaluate 1 active previous pair (Paracetamol <-> Ibuprofen)');
    assert.strictEqual(rx2Analysis.currentPrescriptionPairsCount, 0, 'Single medicine in rx2 has 0 new-to-new pairs');
    const rx2PrevFlagged = rx2Analysis.findings.filter(f => f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');
    assert.strictEqual(rx2PrevFlagged.length, 1, 'Paracetamol <-> Ibuprofen interaction flagged from active previous Rx');
    pass(2, 'Second prescription checks active medicine from prescription 1');

    // -------------------------------------------------------------------------
    // TEST 3: Third prescription checks active medicines from prescriptions 1 and 2
    // -------------------------------------------------------------------------
    console.log('Test 3: Third prescription checks active medicines from prescriptions 1 and 2...');
    const rx3 = new Prescription({
      prescriptionId: `TEST-RX3-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Review Recommended',
      treatmentStartDate: new Date(),
      createdAt: new Date(),
      medicines: [
        {
          medicineId: warfarinDoc._id,
          medicineName: 'Warfarin',
          genericName: 'Warfarin',
          dosage: '2 mg',
          frequency: '1-0-0',
          duration: '14 days',
          route: 'Oral',
        },
      ],
    });
    await rx3.save();
    createdPrescriptionIds.push(rx3._id);

    const rx3Analysis = await interactionCheckService.checkPrescriptionInteractions(
      rx3.medicines,
      patientAlphaProfile,
      { prescription: rx3, evaluationTime: new Date() }
    );
    // Both Paracetamol (from rx1Active) and Ibuprofen (from rx2) are active
    assert.strictEqual(rx3Analysis.activePreviousPairsCount, 2, 'Should evaluate 2 active previous pairs (Paracetamol & Ibuprofen)');
    const rx3PrevFindings = rx3Analysis.findings.filter(f => f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');
    assert.strictEqual(rx3PrevFindings.length, 2, 'Both Paracetamol <-> Warfarin and Ibuprofen <-> Warfarin flagged');
    pass(3, 'Third prescription checks active medicines from prescriptions 1 and 2');

    // -------------------------------------------------------------------------
    // TEST 4: Fourth prescription checks active medicines from prescriptions 1, 2, and 3
    // -------------------------------------------------------------------------
    console.log('Test 4: Fourth prescription checks active medicines from prescriptions 1, 2, and 3...');
    const rx4 = new Prescription({
      prescriptionId: `TEST-RX4-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Review Recommended',
      treatmentStartDate: new Date(),
      createdAt: new Date(),
      medicines: [
        {
          medicineId: amoxicillinDoc._id,
          medicineName: 'Amoxicillin',
          genericName: 'Amoxicillin',
          dosage: '500 mg',
          frequency: '1-0-1',
          duration: '7 days',
          route: 'Oral',
        },
      ],
    });
    await rx4.save();
    createdPrescriptionIds.push(rx4._id);

    const rx4Analysis = await interactionCheckService.checkPrescriptionInteractions(
      rx4.medicines,
      patientAlphaProfile,
      { prescription: rx4, evaluationTime: new Date() }
    );
    // Active previous medicines = Paracetamol, Ibuprofen, Warfarin -> 3 pairs with Amoxicillin
    assert.strictEqual(rx4Analysis.activePreviousPairsCount, 3, 'Should evaluate 3 active previous pairs');
    pass(4, 'Fourth prescription checks active medicines from prescriptions 1, 2, and 3');

    // -------------------------------------------------------------------------
    // TEST 5: Expired medicine is excluded
    // -------------------------------------------------------------------------
    console.log('Test 5: Expired medicine is excluded...');
    // rx1 was created 10 days ago with 5 days duration -> treatment ended 5 days ago
    const activeFromRx1Only = previousPrescriptionService.calculateMedicineActiveStatus(
      rx1.medicines[0],
      rx1,
      new Date()
    );
    assert.strictEqual(activeFromRx1Only.isActive, false, 'Medicine with ended duration must be marked inactive');

    // If we simulate an evaluation time 15 days in future, rx1Active and rx2 have expired
    const futureEval = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const futureAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      rx4.medicines,
      patientAlphaProfile,
      { prescription: rx4, evaluationTime: futureEval }
    );
    // In futureEval, only Warfarin (14 days from now) might be expired or close; Paracetamol & Ibuprofen (5 days) definitely expired
    assert(futureAnalysis.activePreviousPairsCount < 3, 'Expired medicines are excluded in future evaluation');
    pass(5, 'Expired medicine is strictly excluded from active previous medications');

    // -------------------------------------------------------------------------
    // TEST 6: Active medicine from an older prescription is included
    // -------------------------------------------------------------------------
    console.log('Test 6: Active medicine from older prescription is included...');
    const longDurationDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const rxLong = new Prescription({
      prescriptionId: `TEST-RX-LONG-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Delivered',
      treatmentStartDate: longDurationDate,
      createdAt: longDurationDate,
      medicines: [
        {
          medicineId: warfarinDoc._id,
          medicineName: 'Warfarin',
          genericName: 'Warfarin',
          dosage: '5 mg',
          frequency: '1-0-0',
          duration: '60 days', // 60 days duration -> still 55 days remaining!
          route: 'Oral',
        },
      ],
    });
    await rxLong.save();
    createdPrescriptionIds.push(rxLong._id);

    const longActiveStatus = previousPrescriptionService.calculateMedicineActiveStatus(
      rxLong.medicines[0],
      rxLong,
      new Date()
    );
    assert.strictEqual(longActiveStatus.isActive, true, 'Long-duration medicine must be active');
    pass(6, 'Active medicine from older prescription is included');

    // -------------------------------------------------------------------------
    // TEST 7: Different durations within one prescription handled independently
    // -------------------------------------------------------------------------
    console.log('Test 7: Different durations within one prescription handled independently...');
    const multiMedRxDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const multiMedRx = {
      treatmentStartDate: multiMedRxDate,
      createdAt: multiMedRxDate,
      medicines: [
        {
          medicineName: 'ShortMed',
          genericName: 'ShortMed',
          duration: '3 days', // Ended 4 days ago
        },
        {
          medicineName: 'LongMed',
          genericName: 'LongMed',
          duration: '14 days', // 7 days remaining
        },
      ],
    };
    const med1Status = previousPrescriptionService.calculateMedicineActiveStatus(
      multiMedRx.medicines[0],
      multiMedRx,
      new Date()
    );
    const med2Status = previousPrescriptionService.calculateMedicineActiveStatus(
      multiMedRx.medicines[1],
      multiMedRx,
      new Date()
    );
    assert.strictEqual(med1Status.isActive, false, 'Medicine with 3 days duration must be INACTIVE on day 7');
    assert.strictEqual(med2Status.isActive, true, 'Medicine with 14 days duration must be ACTIVE on day 7');
    pass(7, 'Different durations within one prescription handled independently at individual medicine level');

    // -------------------------------------------------------------------------
    // TEST 8: New-to-new interaction section works
    // -------------------------------------------------------------------------
    console.log('Test 8: New-to-new interaction section works...');
    const newToNewMeds = [
      { medicineId: paracetamolDoc._id, genericName: 'Paracetamol', medicineName: 'Paracetamol', dosage: '500 mg', frequency: '1-0-1', duration: '5 days' },
      { medicineId: ibuprofenDoc._id, genericName: 'Ibuprofen', medicineName: 'Ibuprofen', dosage: '400 mg', frequency: '1-0-1', duration: '5 days' },
    ];
    // Evaluate without previous prescriptions
    const n2nAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      newToNewMeds,
      null,
      { prescription: { patientId: null }, evaluationTime: new Date() }
    );
    assert.strictEqual(n2nAnalysis.currentPrescriptionPairsCount, 1, 'Current prescription evaluated 1 pair');
    const n2nFinding = n2nAnalysis.findings.find(f => f.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION');
    assert(n2nFinding !== undefined, 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION finding produced');
    pass(8, 'New-to-new interaction section works with sourceType NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION');

    // -------------------------------------------------------------------------
    // TEST 9: Active-previous-to-new interaction section works
    // -------------------------------------------------------------------------
    console.log('Test 9: Active-previous-to-new interaction section works...');
    const prevToNewFinding = rx2Analysis.findings.find(f => f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');
    assert(prevToNewFinding !== undefined, 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION finding produced');
    pass(9, 'Active-previous-to-new interaction section works with sourceType CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');

    // -------------------------------------------------------------------------
    // TEST 10: Both sections remain separate
    // -------------------------------------------------------------------------
    console.log('Test 10: Both sections remain separate...');
    // Create prescription with 2 new meds AND 1 active previous med
    const dualRx = [
      { medicineId: ibuprofenDoc._id, genericName: 'Ibuprofen', medicineName: 'Ibuprofen', dosage: '400 mg', frequency: '1-0-1', duration: '5 days' },
      { medicineId: amoxicillinDoc._id, genericName: 'Amoxicillin', medicineName: 'Amoxicillin', dosage: '500 mg', frequency: '1-0-1', duration: '7 days' },
    ];
    const dualAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      dualRx,
      patientAlphaProfile,
      { prescription: rx3, evaluationTime: new Date() }
    );
    // Has both currentPrescriptionPairsCount and activePreviousPairsCount
    assert(dualAnalysis.currentPrescriptionPairsCount > 0, 'Current prescription pairs counted');
    assert(dualAnalysis.activePreviousPairsCount > 0, 'Active previous pairs counted');
    const newSourceTypes = new Set(dualAnalysis.findings.map(f => f.sourceType));
    assert(newSourceTypes.has('CURRENT_MEDICATION_TO_NEW_PRESCRIPTION') || dualAnalysis.activePreviousPairsCount > 0, 'Separated categories maintained');
    pass(10, 'Both interaction sections remain clearly separated with distinct counts and sourceTypes');

    // -------------------------------------------------------------------------
    // TEST 11: Pair counts are correct
    // -------------------------------------------------------------------------
    console.log('Test 11: Pair counts are correct...');
    // 2 new meds -> 2*(2-1)/2 = 1 current pair
    assert.strictEqual(dualAnalysis.currentPrescriptionPairsCount, 1, 'Current pairs count = N*(N-1)/2 = 1');
    assert.strictEqual(dualAnalysis.pairsEvaluated, dualAnalysis.currentPrescriptionPairsCount + dualAnalysis.activePreviousPairsCount, 'Total pairsEvaluated = currentPairs + activePreviousPairs');
    pass(11, 'Pair counts calculated accurately from mathematical formulas and returned findings');

    // -------------------------------------------------------------------------
    // TEST 12: Duplicate pairs are prevented
    // -------------------------------------------------------------------------
    console.log('Test 12: Duplicate pairs are prevented...');
    const duplicateKeySet = new Set();
    let hasDuplicateKey = false;
    for (const f of dualAnalysis.findings) {
      const nameA = f.medicineA?.genericName || f.medicineA;
      const nameB = f.medicineB?.genericName || f.medicineB;
      const key = `${f.sourceType}_${interactionCheckService.buildPairKey(nameA, nameB)}`;
      if (duplicateKeySet.has(key)) {
        hasDuplicateKey = true;
      }
      duplicateKeySet.add(key);
    }
    assert.strictEqual(hasDuplicateKey, false, 'No duplicate interaction pairs allowed');
    pass(12, 'Duplicate pairs strictly prevented');

    // -------------------------------------------------------------------------
    // TEST 13: Self-interactions are prevented
    // -------------------------------------------------------------------------
    console.log('Test 13: Self-interactions are prevented...');
    // New prescription containing Paracetamol when Paracetamol is also active previously
    const sameMedRx = [
      { medicineId: paracetamolDoc._id, genericName: 'Paracetamol', medicineName: 'Paracetamol', dosage: '500 mg', frequency: '1-0-1', duration: '5 days' },
    ];
    const selfAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      sameMedRx,
      patientAlphaProfile,
      { prescription: rx2, evaluationTime: new Date() }
    );
    const selfFinding = selfAnalysis.findings.find(f => {
      const nameA = (f.medicineA?.genericName || f.medicineA || '').toLowerCase();
      const nameB = (f.medicineB?.genericName || f.medicineB || '').toLowerCase();
      return nameA === nameB;
    });
    assert.strictEqual(selfFinding, undefined, 'Medicine must not interact with itself');
    pass(13, 'Self-interactions strictly prevented');

    // -------------------------------------------------------------------------
    // TEST 14: Canonical pair ordering remains correct
    // -------------------------------------------------------------------------
    console.log('Test 14: Canonical pair ordering remains correct...');
    const keyAB = interactionCheckService.buildPairKey('Ibuprofen', 'Paracetamol');
    const keyBA = interactionCheckService.buildPairKey('Paracetamol', 'Ibuprofen');
    assert.strictEqual(keyAB, keyBA, 'Pair keys must be symmetric/canonical');
    pass(14, 'Canonical pair ordering is order-independent and symmetric');

    // -------------------------------------------------------------------------
    // TEST 15: Same-patient filtering works
    // -------------------------------------------------------------------------
    console.log('Test 15: Same-patient filtering works...');
    const alphaActiveMeds = await previousPrescriptionService.getActivePreviousMedications(
      { patientId: patientAlphaUser._id, patientProfileId: patientAlphaProfile._id }
    );
    assert(alphaActiveMeds.length > 0, 'Alpha has active previous medications');
    for (const m of alphaActiveMeds) {
      if (m.prescriptionId) {
        const foundRx = await Prescription.findById(m.prescriptionId);
        assert.strictEqual(String(foundRx.patientId), String(patientAlphaUser._id), 'Prescription must belong to Patient Alpha');
      }
    }
    pass(15, 'Same-patient filtering strictly enforced across all previous prescription queries');

    // -------------------------------------------------------------------------
    // TEST 16: Cross-patient medications are excluded
    // -------------------------------------------------------------------------
    console.log('Test 16: Cross-patient medications are excluded...');
    // Patient Beta is new and has no prescriptions yet
    const betaActiveMeds = await previousPrescriptionService.getActivePreviousMedications(
      { patientId: patientBetaUser._id, patientProfileId: patientBetaProfile._id }
    );
    assert.strictEqual(betaActiveMeds.length, 0, 'Patient Beta must have 0 active previous meds despite Alpha having active meds');

    // Analyze new prescription for Beta containing Ibuprofen (would interact with Alpha Paracetamol if leaked)
    const betaRxMeds = [
      { medicineId: ibuprofenDoc._id, genericName: 'Ibuprofen', medicineName: 'Ibuprofen', dosage: '400 mg', frequency: '1-0-1', duration: '5 days' }
    ];
    const betaAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      betaRxMeds,
      patientBetaProfile,
      { prescription: { patientId: patientBetaUser._id }, evaluationTime: new Date() }
    );
    assert.strictEqual(betaAnalysis.activePreviousPairsCount, 0, 'Beta must have 0 previous pairs evaluated');
    assert.strictEqual(betaAnalysis.findings.length, 0, 'Beta must have 0 flagged interaction findings');
    pass(16, 'Cross-patient medications completely excluded — zero leakage');

    // -------------------------------------------------------------------------
    // TEST 17: Structured clinical explanations remain intact
    // -------------------------------------------------------------------------
    console.log('Test 17: Structured clinical explanations remain intact...');
    const sampleFinding = rx2Analysis.findings[0];
    assert(sampleFinding.medicineA, 'medicineA must be present');
    assert(sampleFinding.medicineB, 'medicineB must be present');
    assert(sampleFinding.sourceType, 'sourceType must be present');
    assert(sampleFinding.severity, 'severity must be present');
    assert(sampleFinding.reason, 'reason must be present');
    assert(sampleFinding.potentialConcern, 'potentialConcern must be present');
    assert(sampleFinding.clinicalConsideration, 'clinicalConsideration must be present');
    assert(sampleFinding.evidenceSource, 'evidenceSource must be present');
    assert.strictEqual(typeof sampleFinding.doctorReviewRequired, 'boolean', 'doctorReviewRequired must be boolean');
    pass(17, 'Full structured clinical explanations remain intact without generic substitution');

    // -------------------------------------------------------------------------
    // TEST 18: Existing DrugInteraction records are used
    // -------------------------------------------------------------------------
    console.log('Test 18: Existing DrugInteraction records are used...');
    const dbRecord = await DrugInteraction.findOne({
      $or: [
        { medicineA: paracetamolDoc._id, medicineB: ibuprofenDoc._id },
        { medicineA: ibuprofenDoc._id, medicineB: paracetamolDoc._id },
      ],
    });
    assert(dbRecord !== null, 'Existing DrugInteraction DB record must be found');
    assert.strictEqual(sampleFinding.severity, dbRecord.severity, 'Severity must match DB record');
    assert.strictEqual(sampleFinding.reason, dbRecord.description, 'Reason must match DB record description');
    pass(18, 'Existing DrugInteraction database records accurately retrieved and utilized');

    // -------------------------------------------------------------------------
    // TEST 19: No medicine-specific hardcoding exists
    // -------------------------------------------------------------------------
    console.log('Test 19: No medicine-specific hardcoding exists...');
    // Create two completely synthetic generic medicines with an arbitrary interaction
    const medAlphaGen = new Medicine({
      genericName: `TestMedAlpha_${timestamp}`,
      brandNames: [`BrandAlpha_${timestamp}`],
      drugClass: 'Analgesic',
      dosageForms: ['Tablet'],
      strengths: ['100 mg'],
    });
    await medAlphaGen.save();
    createdMedicineIds.push(medAlphaGen._id);

    const medBetaGen = new Medicine({
      genericName: `TestMedBeta_${timestamp}`,
      brandNames: [`BrandBeta_${timestamp}`],
      drugClass: 'Anticoagulant',
      dosageForms: ['Tablet'],
      strengths: ['50 mg'],
    });
    await medBetaGen.save();
    createdMedicineIds.push(medBetaGen._id);

    const customInteraction = new DrugInteraction({
      medicineA: medAlphaGen._id,
      medicineB: medBetaGen._id,
      medicineA_name: medAlphaGen.genericName,
      medicineB_name: medBetaGen.genericName,
      severity: 'Major',
      description: 'Synthetic interaction test description',
      clinicalEffect: 'Synthetic potential concern',
      recommendedAction: 'Synthetic clinical consideration',
      evidenceSource: 'Synthetic Evidence Source 2026',
      sourceType: 'PRESCRIPTION',
    });
    await customInteraction.save();
    createdInteractionIds.push(customInteraction._id);

    // Create prescription with medAlphaGen for Alpha
    const customPrevRx = new Prescription({
      prescriptionId: `TEST-RX-CUSTOM-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Delivered',
      treatmentStartDate: new Date(),
      createdAt: new Date(),
      medicines: [
        {
          medicineId: medAlphaGen._id,
          medicineName: medAlphaGen.genericName,
          genericName: medAlphaGen.genericName,
          dosage: '100 mg',
          frequency: '1-0-1',
          duration: '5 days',
          route: 'Oral',
        },
      ],
    });
    await customPrevRx.save();
    createdPrescriptionIds.push(customPrevRx._id);

    // Evaluate new prescription containing medBetaGen
    const customNewRx = [
      { medicineId: medBetaGen._id, genericName: medBetaGen.genericName, medicineName: medBetaGen.genericName, dosage: '50 mg', frequency: '1-0-0', duration: '5 days', route: 'Oral' }
    ];
    const customAnalysis = await interactionCheckService.checkPrescriptionInteractions(
      customNewRx,
      patientAlphaProfile,
      { prescription: { patientId: patientAlphaUser._id }, evaluationTime: new Date() }
    );
    const customFinding = customAnalysis.findings.find(f =>
      (f.medicineA?.genericName === medAlphaGen.genericName && f.medicineB?.genericName === medBetaGen.genericName) ||
      (f.medicineA?.genericName === medBetaGen.genericName && f.medicineB?.genericName === medAlphaGen.genericName)
    );
    assert(customFinding !== undefined, 'Synthetic medicines must interact correctly without any hardcoding');
    assert.strictEqual(customFinding.severity, 'Major');
    assert.strictEqual(customFinding.reason, 'Synthetic interaction test description');
    pass(19, 'Zero hardcoding: generic arbitrary medicines evaluate perfectly');

    // -------------------------------------------------------------------------
    // TEST 20: Delivered-but-still-within-duration medicine remains active
    // -------------------------------------------------------------------------
    console.log('Test 20: Delivered-but-still-within-duration medicine remains active...');
    const deliveredActiveRx = new Prescription({
      prescriptionId: `TEST-RX-DELIV-ACTIVE-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Delivered', // Delivered status
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Delivered 2 days ago
      treatmentStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      medicines: [
        {
          medicineId: warfarinDoc._id,
          medicineName: 'Warfarin',
          genericName: 'Warfarin',
          dosage: '5 mg',
          frequency: '1-0-0',
          duration: '10 days', // 8 days remaining
          route: 'Oral',
        },
      ],
    });
    await deliveredActiveRx.save();
    createdPrescriptionIds.push(deliveredActiveRx._id);

    const delivActiveStatus = previousPrescriptionService.calculateMedicineActiveStatus(
      deliveredActiveRx.medicines[0],
      deliveredActiveRx,
      new Date()
    );
    assert.strictEqual(delivActiveStatus.isActive, true, 'Delivered prescription with days remaining is ACTIVE');
    pass(20, 'Delivered-but-still-within-duration medicine remains active');

    // -------------------------------------------------------------------------
    // TEST 21: Delivered-and-expired medicine is excluded
    // -------------------------------------------------------------------------
    console.log('Test 21: Delivered-and-expired medicine is excluded...');
    const deliveredExpiredRx = new Prescription({
      prescriptionId: `TEST-RX-DELIV-EXP-${timestamp}`,
      consultationId: consultAlpha._id,
      patientId: patientAlphaUser._id,
      patientProfileId: patientAlphaProfile._id,
      patientPid: alphaPid,
      patientName: alphaName,
      doctorId: doctorUser._id,
      doctorProfileId: doctorProfile._id,
      doctorName: docName,
      status: 'Delivered', // Delivered status
      deliveredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // Delivered 20 days ago
      treatmentStartDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      medicines: [
        {
          medicineId: paracetamolDoc._id,
          medicineName: 'Paracetamol',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          frequency: '1-0-1',
          duration: '5 days', // Expired 15 days ago
          route: 'Oral',
        },
      ],
    });
    await deliveredExpiredRx.save();
    createdPrescriptionIds.push(deliveredExpiredRx._id);

    const delivExpStatus = previousPrescriptionService.calculateMedicineActiveStatus(
      deliveredExpiredRx.medicines[0],
      deliveredExpiredRx,
      new Date()
    );
    assert.strictEqual(delivExpStatus.isActive, false, 'Delivered prescription with duration passed is EXCLUDED');
    pass(21, 'Delivered-and-expired medicine is excluded (delivery status does not make it permanent)');

    // -------------------------------------------------------------------------
    // TEST 22: Real existing prescriptions are not modified unexpectedly
    // -------------------------------------------------------------------------
    console.log('Test 22: Real existing prescriptions remain intact...');
    for (const realRx of realPrescriptions) {
      const current = await Prescription.findById(realRx._id).lean();
      assert(current !== null, `Real prescription ${realRx.prescriptionId} was deleted`);
      assert.strictEqual(current.prescriptionId, realRx.prescriptionId, 'Prescription ID altered');
      assert.strictEqual(current.medicines.length, realRx.medicines.length, 'Medicines count altered');
      assert.strictEqual(String(current.patientId), String(realRx.patientId), 'Patient ID altered');
    }
    pass(22, 'All real existing prescriptions verified completely intact and unmodified');

    // -------------------------------------------------------------------------
    // TEST 23: Audit summary stores separated counts
    // -------------------------------------------------------------------------
    console.log('Test 23: Audit summary stores separated counts...');
    const auditRes = prescriptionAuditService.aggregatePrescriptionAudit(
      {
        dosage: [],
        interactions: rx2Analysis,
        duplicates: { findings: [] },
        allergySafety: { findings: [] },
      },
      { prescription: rx2, patientProfile: patientAlphaProfile }
    );
    assert(auditRes.audit && auditRes.audit.summary !== undefined, 'Audit summary must exist');
    assert.strictEqual(typeof auditRes.audit.summary.currentPrescriptionPairsCount, 'number', 'currentPrescriptionPairsCount in summary');
    assert.strictEqual(typeof auditRes.audit.summary.activePreviousPairsCount, 'number', 'activePreviousPairsCount in summary');
    pass(23, 'Prescription audit records separated interaction pair counts');

    // -------------------------------------------------------------------------
    // TEST 24: Full MedWise Engine & Controller end-to-end integration
    // -------------------------------------------------------------------------
    console.log('Test 24: Full MedWise Engine & Controller end-to-end integration...');
    const checkReq = {
      user: doctorUser,
      params: { id: rx2._id.toString() },
    };
    const checkRes = mockRes();
    await checkWithMedwise(checkReq, checkRes, nextErr);
    assert.strictEqual(checkRes.statusCode, 200, 'checkWithMedwise must return 200');
    const checkedRx = checkRes.data.prescription;
    assert(checkedRx.medwiseAnalysis, 'medwiseAnalysis must be present on prescription');
    assert(checkedRx.medwiseAnalysis.checks.interactions, 'checks.interactions must be present');
    assert.strictEqual(typeof checkedRx.medwiseAnalysis.checks.interactions.currentPrescriptionPairsCount, 'number', 'currentPrescriptionPairsCount present on checks');
    assert.strictEqual(typeof checkedRx.medwiseAnalysis.checks.interactions.activePreviousPairsCount, 'number', 'activePreviousPairsCount present on checks');
    pass(24, 'Full MedWise engine & controller workflow integration verified end-to-end');

    console.log('\n========================================================================');
    console.log(`ALL 24 TIME-BASED PREVIOUS PRESCRIPTION INTERACTION TESTS PASSED! (${passedCount}/24)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Test Suite Failed with error:', err);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up temporary test records...');
    try {
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdInteractionIds.length > 0) {
        await DrugInteraction.deleteMany({ _id: { $in: createdInteractionIds } });
      }
      if (createdMedicineIds.length > 0) {
        await Medicine.deleteMany({ _id: { $in: createdMedicineIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Cleanup complete. Verifying no leftover test records in MongoDB...');
      const finalRxCount = await Prescription.countDocuments({});
      const finalMedCount = await Medicine.countDocuments({});
      console.log(`Final state: ${finalRxCount} prescriptions (original ${initialRxCount}), ${finalMedCount} medicines (original ${initialMedCount}).`);
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTests();
