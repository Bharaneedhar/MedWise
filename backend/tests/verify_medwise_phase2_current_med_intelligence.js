const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const Medicine = require('../src/models/Medicine');
const DrugInteraction = require('../src/models/DrugInteraction');
const { checkPrescriptionInteractions, buildPairKey } = require('../src/services/medwise/interactionCheckService');
const { checkPrescriptionDuplicates } = require('../src/services/medwise/duplicateCheckService');

async function runPhase2Tests() {
  console.log('=== RUNNING MEDWISE PHASE 2 CURRENT MEDICATION INTELLIGENCE TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAILED: ${testName}`);
      failed++;
    }
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Phase 2 Verification.\n');

    // Ensure test medicines exist or retrieve existing ones
    let warfarin = await Medicine.findOne({ genericName: { $regex: /^warfarin$/i } });
    if (!warfarin) {
      warfarin = await Medicine.create({
        genericName: 'Warfarin',
        brandNames: ['Coumadin'],
        drugClass: 'Anticoagulant',
        duplicateGroup: 'ANTICOAGULANT',
        isActive: true,
      });
    }

    let ibuprofen = await Medicine.findOne({ genericName: { $regex: /^ibuprofen$/i } });
    if (!ibuprofen) {
      ibuprofen = await Medicine.create({
        genericName: 'Ibuprofen',
        brandNames: ['Advil', 'Motrin'],
        drugClass: 'NSAID',
        duplicateGroup: 'NSAID',
        isActive: true,
      });
    }

    let amoxicillin = await Medicine.findOne({ genericName: { $regex: /^amoxicillin$/i } });
    if (!amoxicillin) {
      amoxicillin = await Medicine.create({
        genericName: 'Amoxicillin',
        brandNames: ['Amoxil'],
        drugClass: 'Penicillin Antibiotic',
        duplicateGroup: 'PENICILLIN_ANTIBIOTIC',
        isActive: true,
      });
    }

    let paracetamol = await Medicine.findOne({ genericName: { $regex: /^paracetamol$/i } });
    if (!paracetamol) {
      paracetamol = await Medicine.create({
        genericName: 'Paracetamol',
        brandNames: ['Tylenol', 'Panadol'],
        drugClass: 'Analgesic',
        duplicateGroup: 'ANALGESIC',
        isActive: true,
      });
    }

    // Ensure interaction record exists between Warfarin and Ibuprofen
    const pairKey = buildPairKey(String(warfarin._id), String(ibuprofen._id));
    let interactionRecord = await DrugInteraction.findOne({ interactionPairKey: pairKey });
    if (!interactionRecord) {
      interactionRecord = await DrugInteraction.create({
        medicineA: warfarin._id,
        medicineB: ibuprofen._id,
        interactionPairKey: pairKey,
        severity: 'Major',
        interactionType: 'Drug-Drug',
        description: 'Increased bleeding risk when Warfarin is co-administered with NSAIDs like Ibuprofen.',
        clinicalEffect: 'Increased risk of gastrointestinal hemorrhage.',
        recommendedAction: 'Avoid co-prescription or monitor INR closely.',
        evidenceSource: 'MedWise DrugInteraction Database',
        isActive: true,
      });
    }

    // -------------------------------------------------------------
    // TEST 1 & 7 & 8: Current Medication + New Medicine with Interaction
    // -------------------------------------------------------------
    const rx1 = {
      patientAge: 45,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(ibuprofen._id), genericName: 'Ibuprofen', medicineName: 'Ibuprofen 400mg' },
      ],
    };
    const profile1 = {
      hasNoKnownAllergies: true,
      allergies: [],
      currentMedications: [
        { name: 'Warfarin', genericName: 'Warfarin', dosage: '5mg' },
      ],
    };

    const res1 = await checkPrescriptionInteractions(rx1, { patientProfile: profile1 });
    const finding1 = res1.findings.find((f) => f.status === 'interaction_flagged');

    assert(Boolean(finding1), '1. Current Warfarin + New Ibuprofen interaction detected');
    assert(
      finding1?.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION',
      '7. sourceType is CURRENT_MEDICATION_TO_NEW_PRESCRIPTION'
    );
    assert(
      finding1?.reason && finding1?.potentialConcern && finding1?.clinicalConsideration && finding1?.evidenceSource,
      '8. Structured explanation fields (reason, potentialConcern, clinicalConsideration, evidenceSource) are present'
    );

    // -------------------------------------------------------------
    // TEST 2: Current Medication + New Medicine WITHOUT Interaction
    // -------------------------------------------------------------
    const rx2 = {
      patientAge: 30,
      patientGender: 'Female',
      medicines: [
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', medicineName: 'Amoxicillin 500mg' },
      ],
    };
    const profile2 = {
      hasNoKnownAllergies: true,
      allergies: [],
      currentMedications: [
        { name: 'Paracetamol', genericName: 'Paracetamol', dosage: '500mg' },
      ],
    };

    const res2 = await checkPrescriptionInteractions(rx2, { patientProfile: profile2 });
    const flagged2 = res2.findings.filter((f) => f.status === 'interaction_flagged');
    assert(flagged2.length === 0, '2. Current Paracetamol + New Amoxicillin produces 0 flagged interactions');

    // -------------------------------------------------------------
    // TEST 3: Current Medication + New Medicine Duplicate
    // -------------------------------------------------------------
    const rx3 = {
      patientAge: 40,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(ibuprofen._id), genericName: 'Ibuprofen', medicineName: 'Ibuprofen 400mg' },
      ],
    };
    const profile3 = {
      hasNoKnownAllergies: true,
      allergies: [],
      currentMedications: [
        { name: 'Ibuprofen', genericName: 'Ibuprofen', dosage: '200mg' },
      ],
    };

    const dupRes3 = await checkPrescriptionDuplicates(rx3, { patientProfile: profile3 });
    const dupFinding3 = dupRes3.findings.find((f) => f.status === 'duplicate_found');
    assert(Boolean(dupFinding3), '3. Current Ibuprofen + New Ibuprofen duplicate detected');
    assert(
      dupFinding3?.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION',
      '3. Duplicate sourceType is CURRENT_MEDICATION_TO_NEW_PRESCRIPTION'
    );

    // -------------------------------------------------------------
    // TEST 4: Multiple Current Medications × Multiple New Medicines
    // -------------------------------------------------------------
    const rx4 = {
      patientAge: 50,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(ibuprofen._id), genericName: 'Ibuprofen' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' },
      ],
    };
    const profile4 = {
      hasNoKnownAllergies: true,
      allergies: [],
      currentMedications: [
        { name: 'Warfarin', genericName: 'Warfarin' },
        { name: 'Paracetamol', genericName: 'Paracetamol' },
      ],
    };

    const res4 = await checkPrescriptionInteractions(rx4, { patientProfile: profile4 });
    // Total pairs = 1 (new-new) + 4 (current-new) = 5
    assert(res4.pairsEvaluated === 5, '4. Multiple current (2) × multiple new (2) evaluates 5 total pairs');

    // -------------------------------------------------------------
    // TEST 5: Existing New-Prescription Pairwise N(N-1)/2 Works
    // -------------------------------------------------------------
    const rx5 = {
      patientAge: 45,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(warfarin._id), genericName: 'Warfarin' },
        { medicineId: String(ibuprofen._id), genericName: 'Ibuprofen' },
      ],
    };
    const profile5 = { hasNoKnownAllergies: true, currentMedications: [] };
    const res5 = await checkPrescriptionInteractions(rx5, { patientProfile: profile5 });
    const finding5 = res5.findings.find((f) => f.status === 'interaction_flagged');
    assert(Boolean(finding5), '5. New Warfarin + New Ibuprofen pairwise interaction detected');
    assert(
      finding5?.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION',
      '5. Pairwise new-new sourceType is NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION'
    );

    // -------------------------------------------------------------
    // TEST 6: Reverse Medicine Order Order-Independence
    // -------------------------------------------------------------
    const rx6 = {
      patientAge: 45,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(warfarin._id), genericName: 'Warfarin' },
      ],
    };
    const profile6 = {
      hasNoKnownAllergies: true,
      currentMedications: [{ name: 'Ibuprofen', genericName: 'Ibuprofen' }],
    };
    const res6 = await checkPrescriptionInteractions(rx6, { patientProfile: profile6 });
    const finding6 = res6.findings.find((f) => f.status === 'interaction_flagged');
    assert(Boolean(finding6), '6. Reverse order (Current Ibuprofen + New Warfarin) detects interaction order-independently');

    console.log(`\nPHASE 2 TEST RESULTS: ${passed} Passed, ${failed} Failed.`);
    await mongoose.disconnect();

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runPhase2Tests();
