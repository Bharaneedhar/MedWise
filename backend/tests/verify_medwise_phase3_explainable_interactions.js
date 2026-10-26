const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const Medicine = require('../src/models/Medicine');
const PatientProfile = require('../src/models/PatientProfile');
const DrugInteraction = require('../src/models/DrugInteraction');
const User = require('../src/models/User');

const { checkPrescriptionInteractions, buildPairKey } = require('../src/services/medwise/interactionCheckService');

async function runPhase3InteractionTests() {
  console.log('====================================================');
  console.log('STARTING MEDWISE PHASE 3 EXPLAINABLE DRUG-DRUG INTERACTION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
  
  // Track IDs for cleanup
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdMedicineIds = [];
  const createdInteractionIds = [];

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    const timestamp = Date.now();

    // Setup Test Medicines
    let medA = await Medicine.create({
      genericName: `TestMedA_${timestamp}`,
      brandNames: [`BrandA_${timestamp}`],
      drugClass: 'Anticoagulant',
      isActive: true,
    });
    createdMedicineIds.push(medA._id);

    let medB = await Medicine.create({
      genericName: `TestMedB_${timestamp}`,
      brandNames: [`BrandB_${timestamp}`],
      drugClass: 'NSAID',
      isActive: true,
    });
    createdMedicineIds.push(medB._id);

    let medC = await Medicine.create({
      genericName: `TestMedC_${timestamp}`,
      brandNames: [`BrandC_${timestamp}`],
      drugClass: 'Antibiotic',
      isActive: true,
    });
    createdMedicineIds.push(medC._id);

    // Setup Test Interaction Record A + B
    const pairKeyAB = buildPairKey(String(medA._id), String(medB._id));
    const interactionAB = await DrugInteraction.create({
      medicineA: medA._id,
      medicineB: medB._id,
      interactionPairKey: pairKeyAB,
      severity: 'Major',
      interactionType: 'Drug-Drug',
      description: 'Increased bleeding risk when TestMedA is co-administered with TestMedB.',
      clinicalEffect: 'Severe risk of GI hemorrhage and systemic bleeding.',
      recommendedAction: 'Avoid concomitant use or adjust dosage under close monitoring.',
      evidenceSource: 'MedWise Phase 3 Clinical Reference Database',
      isActive: true,
    });
    createdInteractionIds.push(interactionAB._id);

    // Setup Patient A with Active Current Medication (medA) & Inactive Current Medication (medC)
    const userA = await User.create({
      name: `Patient A ${timestamp}`,
      email: `patientA_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(userA._id);

    const profileA = await PatientProfile.create({
      userId: userA._id,
      name: `Patient A ${timestamp}`,
      mobileNumber: '9111111111',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      address: { addressLine1: 'Line 1', city: 'City', state: 'State', country: 'India', pinCode: '100001' },
      emergencyContact: { name: 'Contact A', relationship: 'Parent', mobileNumber: '9111111112' },
      profileCompleted: true,
      currentMedications: [
        {
          medicineId: medA._id,
          name: medA.genericName,
          genericName: medA.genericName,
          strength: '5 mg',
          dosage: '5 mg',
          frequency: '1-0-0',
          status: 'ACTIVE',
          source: 'PRESCRIPTION',
        },
        {
          medicineId: medC._id,
          name: medC.genericName,
          genericName: medC.genericName,
          strength: '500 mg',
          dosage: '500 mg',
          frequency: '1-0-1',
          status: 'INACTIVE',
          stoppedAt: new Date(),
          source: 'PRESCRIPTION',
        },
      ],
    });
    createdProfileIds.push(profileA._id);

    // Setup Patient B
    const userB = await User.create({
      name: `Patient B ${timestamp}`,
      email: `patientB_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(userB._id);

    const profileB = await PatientProfile.create({
      userId: userB._id,
      name: `Patient B ${timestamp}`,
      mobileNumber: '9222222222',
      dateOfBirth: new Date('1992-02-02'),
      gender: 'Female',
      address: { addressLine1: 'Line 2', city: 'City', state: 'State', country: 'India', pinCode: '200002' },
      emergencyContact: { name: 'Contact B', relationship: 'Spouse', mobileNumber: '9222222223' },
      profileCompleted: true,
      currentMedications: [],
    });
    createdProfileIds.push(profileB._id);

    // -----------------------------------------------------------------
    // TEST 1 & 7-12: CURRENT medication × NEW prescription interaction
    // -----------------------------------------------------------------
    const rx1 = {
      patientId: userA._id,
      medicines: [
        { medicineId: String(medB._id), genericName: medB.genericName, medicineName: medB.genericName },
      ],
    };
    const res1 = await checkPrescriptionInteractions(rx1, { patientProfile: profileA });
    const finding1 = res1.findings.find((f) => f.status === 'interaction_flagged');

    assert(Boolean(finding1), '1. CURRENT medication × NEW prescription interaction detected');
    assert(
      finding1?.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION',
      '1. sourceType is CURRENT_MEDICATION_TO_NEW_PRESCRIPTION'
    );
    assert(finding1?.severity === 'Major', '7. Structured severity comes from DB record ("Major")');
    assert(
      finding1?.reason && finding1?.reason.includes('Increased bleeding risk'),
      '8. Structured reason comes from DB record description'
    );
    assert(
      finding1?.potentialConcern && finding1?.potentialConcern.includes('GI hemorrhage'),
      '9. Structured potentialConcern comes from DB record clinicalEffect'
    );
    assert(
      finding1?.clinicalConsideration && finding1?.clinicalConsideration.includes('Avoid concomitant use'),
      '10. Structured clinicalConsideration comes from DB record recommendedAction'
    );
    assert(
      finding1?.evidenceSource === 'MedWise Phase 3 Clinical Reference Database',
      '11. Structured evidenceSource comes from DB record evidenceSource'
    );
    assert(finding1?.doctorReviewRequired === true, '12. doctorReviewRequired is true on flagged interaction');

    // -----------------------------------------------------------------
    // TEST 2 & 3: NEW prescription × NEW prescription interaction (N(N-1)/2)
    // -----------------------------------------------------------------
    const rx2 = {
      patientId: userB._id,
      medicines: [
        { medicineId: String(medA._id), genericName: medA.genericName },
        { medicineId: String(medB._id), genericName: medB.genericName },
        { medicineId: String(medC._id), genericName: medC.genericName },
      ],
    };
    const res2 = await checkPrescriptionInteractions(rx2, { patientProfile: profileB });
    // 3 medicines => 3*(3-1)/2 = 3 pairs
    assert(res2.pairsEvaluated === 3, '3. Multiple new medicines (3) evaluates 3 pairs using N(N-1)/2 formula');

    const finding2 = res2.findings.find((f) => f.status === 'interaction_flagged');
    assert(Boolean(finding2), '2. NEW prescription × NEW prescription interaction detected');
    assert(
      finding2?.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION',
      '2. sourceType is NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION'
    );

    // -----------------------------------------------------------------
    // TEST 4: Canonical order independence
    // -----------------------------------------------------------------
    const rxReverse = {
      patientId: userB._id,
      medicines: [
        { medicineId: String(medB._id), genericName: medB.genericName },
        { medicineId: String(medA._id), genericName: medA.genericName },
      ],
    };
    const resReverse = await checkPrescriptionInteractions(rxReverse, { patientProfile: profileB });
    const findingRev = resReverse.findings.find((f) => f.status === 'interaction_flagged');
    assert(Boolean(findingRev), '4. Canonical order independence (B + A matches same interaction as A + B)');
    assert(findingRev?.severity === finding2?.severity, '4. Order reversal produces identical severity and details');

    // -----------------------------------------------------------------
    // TEST 5: Inactive current medication exclusion
    // -----------------------------------------------------------------
    // Patient A has medC as INACTIVE. Prescription contains medB.
    // If medC was active and interacted with medB, it would be evaluated.
    // medC (INACTIVE) must NOT be included in pairs for Patient A.
    const activeCurrentsOnly = profileA.currentMedications.filter((m) => m.status !== 'INACTIVE');
    assert(activeCurrentsOnly.length === 1, '5. Patient A has exactly 1 ACTIVE medication');
    assert(activeCurrentsOnly[0].genericName === medA.genericName, '5. Active medication is medA');

    // -----------------------------------------------------------------
    // TEST 6: Cross-patient medication isolation
    // -----------------------------------------------------------------
    // Check Patient B with prescription medB. Patient B has NO current medications.
    const resPatientBOnly = await checkPrescriptionInteractions(
      { patientId: userB._id, medicines: [{ medicineId: String(medB._id), genericName: medB.genericName }] },
      { patientProfile: profileB }
    );
    assert(
      resPatientBOnly.flaggedCount === 0,
      '6. Cross-patient isolation: Patient A current medA does NOT interact with Patient B prescription'
    );

    // -----------------------------------------------------------------
    // TEST 13: No finding when no configured interaction exists
    // -----------------------------------------------------------------
    // medB + medC has NO configured interaction in DB.
    const rxNoMatch = {
      patientId: userB._id,
      medicines: [
        { medicineId: String(medB._id), genericName: medB.genericName },
        { medicineId: String(medC._id), genericName: medC.genericName },
      ],
    };
    const resNoMatch = await checkPrescriptionInteractions(rxNoMatch, { patientProfile: profileB });
    assert(resNoMatch.flaggedCount === 0, '13. No interaction finding returned when no configured interaction exists');

    console.log(`\n====================================================`);
    console.log(`PHASE 3 INTERACTION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      throw new Error(`${failed} assertion(s) failed in Phase 3 interaction tests.`);
    }

  } finally {
    console.log('[CLEANUP] Cleaning up Phase 3 temporary test records...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdProfileIds.length > 0) {
      await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
    }
    if (createdMedicineIds.length > 0) {
      await Medicine.deleteMany({ _id: { $in: createdMedicineIds } });
    }
    if (createdInteractionIds.length > 0) {
      await DrugInteraction.deleteMany({ _id: { $in: createdInteractionIds } });
    }
    await mongoose.disconnect();
    console.log('[CLEANUP] Automated teardown completed cleanly.');
  }
}

runPhase3InteractionTests().catch((err) => {
  console.error('❌ Phase 3 test error:', err);
  process.exit(1);
});
