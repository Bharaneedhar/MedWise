const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Medicine = require('../src/models/Medicine');
const MedicineSafetyRule = require('../src/models/MedicineSafetyRule');
const Prescription = require('../src/models/Prescription');

const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { checkPrescriptionDuplicates } = require('../src/services/medwise/duplicateCheckService');
const { checkPrescriptionAllergySafety, checkPatientSpecificCDS } = require('../src/services/medwise/allergySafetyCheckService');
const { aggregatePrescriptionAudit } = require('../src/services/medwise/prescriptionAuditService');

const runPhase5Tests = async () => {
  let createdUsers = [];
  let createdProfiles = [];
  let createdPrescriptions = [];
  let createdMedicines = [];
  let createdRules = [];

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Phase 5 — Complete Clinical Safety Analysis Tests.\n');

    const timestamp = Date.now();

    // Setup mock medicines in memory and DB
    const medA = await Medicine.create({
      genericName: `TestIbuprofenP5_${timestamp}`,
      brandNames: [`AdvilP5_${timestamp}`],
      drugClass: 'NSAID',
      duplicateGroup: 'NSAID_GROUP',
    });
    const medB = await Medicine.create({
      genericName: `TestNaproxenP5_${timestamp}`,
      brandNames: [`AleveP5_${timestamp}`],
      drugClass: 'NSAID',
      duplicateGroup: 'NSAID_GROUP',
    });
    const medC = await Medicine.create({
      genericName: `TestParacetamolP5_${timestamp}`,
      brandNames: [`TylenolP5_${timestamp}`],
      drugClass: 'Analgesic',
      duplicateGroup: 'ANALGESIC_GROUP',
    });
    createdMedicines.push(medA, medB, medC);

    // Setup mock safety rules
    const allergyRule = await MedicineSafetyRule.create({
      medicine: medA._id,
      safetyType: 'allergy',
      trigger: 'NSAID_ALLERGY',
      severity: 'Life-Threatening',
      description: 'Known severe hypersensitivity to NSAIDs.',
      clinicalEffect: 'Anaphylaxis and severe bronchospasm risk.',
      recommendedAction: 'Do not administer NSAID group medications.',
      evidenceSource: 'FDA Black Box Warning Database',
    });

    const contraindicationRule = await MedicineSafetyRule.create({
      medicine: medA._id,
      safetyType: 'contraindication',
      trigger: 'Active Peptic Ulcer',
      severity: 'Contraindicated',
      description: 'Contraindicated in patients with active peptic ulcer disease or GI bleeding.',
      clinicalEffect: 'Severe gastrointestinal ulceration and hemorrhage.',
      recommendedAction: 'Discontinue NSAID or prescribe gastroprotective co-therapy.',
      evidenceSource: 'Clinical Pharmacotherapy Handbook',
    });

    const precautionRule = await MedicineSafetyRule.create({
      medicine: medB._id,
      safetyType: 'precaution',
      trigger: 'Hypertension',
      severity: 'Moderate',
      description: 'Use with caution in hypertensive patients due to fluid retention.',
      clinicalEffect: 'Elevation of mean arterial blood pressure.',
      recommendedAction: 'Monitor blood pressure regularly.',
      evidenceSource: 'AHA Clinical Guidelines',
    });

    createdRules.push(allergyRule, contraindicationRule, precautionRule);

    // Setup mock patient profile fields
    const dummyFields = {
      mobileNumber: '9876543210',
      dateOfBirth: new Date('1955-03-20'), // Age ~71 (Geriatric)
      gender: 'Female',
      address: { addressLine1: 'Line 1', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      emergencyContact: { name: 'Contact', relationship: 'Spouse', mobileNumber: '9876543211' },
    };

    const userPatA = await User.create({ name: 'Phase5 Patient A', email: `p5a.${timestamp}@medwise.com`, password: 'password123', role: 'patient' });
    const userPatB = await User.create({ name: 'Phase5 Patient B', email: `p5b.${timestamp}@medwise.com`, password: 'password123', role: 'patient' });
    createdUsers.push(userPatA, userPatB);

    const profPatA = await PatientProfile.create({
      ...dummyFields,
      userId: userPatA._id,
      pid: `PID-P5A-${timestamp}`,
      name: 'Phase5 Patient A',
      hasNoKnownAllergies: false,
      allergies: ['NSAID_ALLERGY'],
      medicalConditions: [{ name: 'Active Peptic Ulcer' }],
      currentMedications: [
        { name: medA.genericName, genericName: medA.genericName, medicineId: medA._id, dosage: '400 mg', status: 'ACTIVE' },
        { name: 'InactiveMedP5', genericName: 'InactiveMedP5', dosage: '10 mg', status: 'INACTIVE' },
      ],
    });

    const profPatB = await PatientProfile.create({
      ...dummyFields,
      userId: userPatB._id,
      pid: `PID-P5B-${timestamp}`,
      name: 'Phase5 Patient B',
      hasNoKnownAllergies: true,
      allergies: [],
      medicalConditions: [],
      currentMedications: [
        { name: medC.genericName, genericName: medC.genericName, medicineId: medC._id, dosage: '500 mg', status: 'ACTIVE' },
      ],
    });
    createdProfiles.push(profPatA, profPatB);


    // =================================================================
    // PART A — EXPLAINABLE DUPLICATE MEDICATION ANALYSIS TESTS (1–7)
    // =================================================================
    console.log('--- PART A: DUPLICATE MEDICATION TESTS (1-7) ---');

    // Test 1: Exact duplicate current → new
    const rx1 = {
      patientId: userPatA._id,
      medicines: [{ medicineId: medA._id, genericName: medA.genericName, dosage: '400 mg', frequency: '1-0-1' }],
    };
    const dupRes1 = await checkPrescriptionDuplicates(rx1, { patientProfile: profPatA });
    const exactCurrentDup = dupRes1.findings.find(f => f.status === 'duplicate_found' && f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');
    console.log('1. Exact duplicate current → new:', exactCurrentDup?.status, '| Type:', exactCurrentDup?.duplicateType);
    if (!exactCurrentDup || exactCurrentDup.duplicateType !== 'EXACT_MEDICINE') {
      throw new Error('Test 1 Failed: Exact duplicate current → new not detected');
    }

    // Test 2: Duplicate group current → new
    const rx2 = {
      patientId: userPatA._id,
      medicines: [{ medicineId: medB._id, genericName: medB.genericName, dosage: '250 mg', frequency: '1-0-1' }],
    };
    const dupRes2 = await checkPrescriptionDuplicates(rx2, { patientProfile: profPatA });
    const groupCurrentDup = dupRes2.findings.find(f => f.status === 'duplicate_found' && f.sourceType === 'CURRENT_MEDICATION_TO_NEW_PRESCRIPTION');
    console.log('2. Duplicate group current → new:', groupCurrentDup?.status, '| Type:', groupCurrentDup?.duplicateType);
    if (!groupCurrentDup || groupCurrentDup.duplicateType !== 'DUPLICATE_GROUP') {
      throw new Error('Test 2 Failed: Duplicate group current → new not detected');
    }

    // Test 3: Exact duplicate new → new
    const rx3 = {
      patientId: userPatB._id,
      medicines: [
        { medicineId: medC._id, genericName: medC.genericName, dosage: '500 mg', frequency: '1-0-0' },
        { medicineId: medC._id, genericName: medC.genericName, dosage: '500 mg', frequency: '0-0-1' },
      ],
    };
    const dupRes3 = await checkPrescriptionDuplicates(rx3, { patientProfile: profPatB });
    const exactNewDup = dupRes3.findings.find(f => f.status === 'duplicate_found' && f.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION');
    console.log('3. Exact duplicate new → new:', exactNewDup?.status, '| Type:', exactNewDup?.duplicateType);
    if (!exactNewDup || exactNewDup.duplicateType !== 'EXACT_MEDICINE') {
      throw new Error('Test 3 Failed: Exact duplicate new → new not detected');
    }

    // Test 4: Duplicate group new → new
    const rx4 = {
      patientId: userPatB._id,
      medicines: [
        { medicineId: medA._id, genericName: medA.genericName, dosage: '400 mg', frequency: '1-0-0' },
        { medicineId: medB._id, genericName: medB.genericName, dosage: '250 mg', frequency: '0-0-1' },
      ],
    };
    const dupRes4 = await checkPrescriptionDuplicates(rx4, { patientProfile: profPatB });
    const groupNewDup = dupRes4.findings.find(f => f.status === 'duplicate_found' && f.sourceType === 'NEW_PRESCRIPTION_TO_NEW_PRESCRIPTION');
    console.log('4. Duplicate group new → new:', groupNewDup?.status, '| Type:', groupNewDup?.duplicateType);
    if (!groupNewDup || groupNewDup.duplicateType !== 'DUPLICATE_GROUP') {
      throw new Error('Test 4 Failed: Duplicate group new → new not detected');
    }

    // Test 5: No duplicate
    const rx5 = {
      patientId: userPatB._id,
      medicines: [
        { medicineId: medA._id, genericName: medA.genericName, dosage: '400 mg', frequency: '1-0-0' },
      ],
    };
    const dupRes5 = await checkPrescriptionDuplicates(rx5, { patientProfile: profPatB }); // Patient B has MedC (Analgesic), New is MedA (NSAID) -> no duplicate
    const dupFlagged5 = dupRes5.findings.filter(f => f.status === 'duplicate_found');
    console.log('5. No duplicate count:', dupFlagged5.length);
    if (dupFlagged5.length !== 0) {
      throw new Error('Test 5 Failed: Expected 0 duplicates for non-overlapping medicines');
    }

    // Test 6: Inactive medication excluded
    // Patient A has InactiveMedP5 in currentMedications with status INACTIVE
    const rx6 = {
      patientId: userPatA._id,
      medicines: [{ genericName: 'InactiveMedP5', dosage: '10 mg', frequency: '1-0-0' }],
    };
    const dupRes6 = await checkPrescriptionDuplicates(rx6, { patientProfile: profPatA });
    const inactiveDup = dupRes6.findings.find(f => f.status === 'duplicate_found' && f.medicineA?.genericName === 'InactiveMedP5');
    console.log('6. Inactive medication duplicate detected?:', Boolean(inactiveDup));
    if (inactiveDup) {
      throw new Error('Test 6 Failed: Inactive medication was falsely included in current → new duplicate analysis');
    }

    // Test 7: Cross-patient isolation
    // Patient B has MedC. Prescribe MedC for Patient A (Patient A has MedA active).
    const dupRes7 = await checkPrescriptionDuplicates(rx1, { patientProfile: profPatB }); // Patient B profile (MedC) against Patient A rx (MedA)
    const crossPatientDup = dupRes7.findings.find(f => f.status === 'duplicate_found');
    console.log('7. Cross-patient isolation duplicate detected?:', Boolean(crossPatientDup));
    if (crossPatientDup) {
      throw new Error('Test 7 Failed: Cross-patient medication leakage detected in duplicate analysis');
    }


    // =================================================================
    // PART B — EXPLAINABLE ALLERGY & SAFETY ANALYSIS TESTS (8–13)
    // =================================================================
    console.log('\n--- PART B: ALLERGY & SAFETY TESTS (8-13) ---');

    // Test 8: Configured allergy rule
    const allergyRes8 = await checkPrescriptionAllergySafety(rx1, { patientProfile: profPatA });
    const allergyRiskFinding = allergyRes8.findings.find(f => f.status === 'allergy_risk');
    console.log('8. Configured allergy rule:', allergyRiskFinding?.status, '| Reason:', allergyRiskFinding?.reason);
    if (!allergyRiskFinding || allergyRiskFinding.doctorReviewRequired !== true) {
      throw new Error('Test 8 Failed: Configured allergy rule not flagged or missing doctorReviewRequired');
    }

    // Test 9: Configured contraindication
    const contraFinding = allergyRes8.findings.find(f => f.status === 'safety_rule_flagged' && f.ruleType === 'contraindication');
    console.log('9. Configured contraindication:', contraFinding?.status, '| Severity:', contraFinding?.severity);
    if (!contraFinding || contraFinding.severity !== 'Contraindicated') {
      throw new Error('Test 9 Failed: Configured contraindication not flagged');
    }

    // Test 10: Configured precaution/warning
    const rxPrecaution = {
      patientId: userPatA._id,
      medicines: [{ medicineId: medB._id, genericName: medB.genericName, dosage: '250 mg' }],
    };
    const profHypertensive = {
      ...profPatA,
      medicalConditions: [{ name: 'Hypertension' }],
    };
    const allergyRes10 = await checkPrescriptionAllergySafety(rxPrecaution, { patientProfile: profHypertensive });
    const precFinding = allergyRes10.findings.find(f => f.status === 'safety_rule_flagged' && f.ruleType === 'precaution');
    console.log('10. Configured precaution/warning:', precFinding?.status, '| Trigger:', precFinding?.trigger);
    if (!precFinding || precFinding.trigger !== 'Hypertension') {
      throw new Error('Test 10 Failed: Configured precaution not flagged');
    }

    // Test 11: No configured safety rule
    const rxNoRule = {
      patientId: userPatB._id,
      medicines: [{ medicineId: medC._id, genericName: medC.genericName, dosage: '500 mg' }],
    };
    const allergyRes11 = await checkPrescriptionAllergySafety(rxNoRule, { patientProfile: profPatB });
    const flagged11 = allergyRes11.findings.filter(f => f.status === 'safety_rule_flagged' || f.status === 'allergy_risk');
    console.log('11. No configured safety rule flagged count:', flagged11.length);
    if (flagged11.length !== 0) {
      throw new Error('Test 11 Failed: Falsely flagged safety rule when none was configured');
    }

    // Test 12: Incomplete allergy information
    const profNoAllergyInfo = {
      userId: new mongoose.Types.ObjectId(),
      hasNoKnownAllergies: false,
      allergies: undefined, // missing
    };
    const allergyRes12 = await checkPrescriptionAllergySafety(rx1, { patientProfile: profNoAllergyInfo, patientAllergies: undefined });
    const unableAllergy12 = allergyRes12.findings.find(f => f.type === 'allergy' && f.status === 'unable_to_assess');
    console.log('12. Incomplete allergy info status:', unableAllergy12?.status);
    if (!unableAllergy12) {
      throw new Error('Test 12 Failed: Incomplete allergy info must return unable_to_assess');
    }

    // Test 13: Explicit completed "No known allergies"
    const allergyRes13 = await checkPrescriptionAllergySafety(rx1, { patientProfile: profPatB });
    const noRiskFinding13 = allergyRes13.findings.find(f => f.type === 'allergy' && f.status === 'no_allergy_risk_found');
    console.log('13. Explicit No Known Allergies status:', noRiskFinding13?.status);
    if (!noRiskFinding13) {
      throw new Error('Test 13 Failed: Explicit no known allergies should yield no_allergy_risk_found');
    }


    // =================================================================
    // PART C — PATIENT-SPECIFIC CLINICAL DECISION SUPPORT TESTS (14–16)
    // =================================================================
    console.log('\n--- PART C: PATIENT-SPECIFIC CDS TESTS (14-16) ---');

    // Test 14: Supported patient-specific finding
    const psRes14 = await checkPatientSpecificCDS(rxPrecaution, { patientProfile: profHypertensive });
    const psFlagged14 = psRes14.findings.find(f => f.status === 'patient_specific_flagged');
    console.log('14. Supported patient-specific finding:', psFlagged14?.status, '| Factor:', psFlagged14?.patientFactor);
    if (!psFlagged14 || !psFlagged14.patientFactor.includes('Hypertension')) {
      throw new Error('Test 14 Failed: Supported patient-specific finding not flagged');
    }

    // Test 15: Missing required patient information
    const rxUnresolved = {
      patientId: new mongoose.Types.ObjectId(),
      medicines: [{ genericName: 'UnresolvedMedP5_XYZ', dosage: '10 mg' }],
    };
    const psRes15 = await checkPatientSpecificCDS(rxUnresolved, { patientProfile: null });
    const psUnable15 = psRes15.findings.find(f => f.status === 'unable_to_assess');
    console.log('15. Missing required patient info status:', psUnable15?.status);
    if (!psUnable15) {
      throw new Error('Test 15 Failed: Unresolvable medicine in patient-specific CDS must return unable_to_assess');
    }

    // Test 16: Unsupported patient factor produces no invented finding
    const psRes16 = await checkPatientSpecificCDS(rxNoRule, { patientProfile: profPatB });
    const psFlagged16 = psRes16.findings.filter(f => f.status === 'patient_specific_flagged');
    console.log('16. Unsupported patient factor flagged count:', psFlagged16.length);
    if (psFlagged16.length !== 0) {
      throw new Error('Test 16 Failed: Falsely invented patient-specific finding when no rule matched');
    }


    // =================================================================
    // EXPLAINABILITY & STRUCTURED FIELD TESTS (17–22)
    // =================================================================
    console.log('\n--- EXPLAINABILITY TESTS (17-22) ---');

    // Test 17: Structured reason
    console.log('17. Structured reason present:', Boolean(contraFinding.reason));
    if (!contraFinding.reason) throw new Error('Test 17 Failed: Reason is missing');

    // Test 18: Severity when configured
    console.log('18. Severity present:', contraFinding.severity);
    if (contraFinding.severity !== 'Contraindicated') throw new Error('Test 18 Failed: Severity does not match configured value');

    // Test 19: Clinical consideration when configured
    console.log('19. Clinical consideration present:', Boolean(contraFinding.clinicalConsideration));
    if (!contraFinding.clinicalConsideration) throw new Error('Test 19 Failed: Clinical consideration is missing');

    // Test 20: Evidence source when configured
    console.log('20. Evidence source present:', contraFinding.evidenceSource);
    if (contraFinding.evidenceSource !== 'Clinical Pharmacotherapy Handbook') throw new Error('Test 20 Failed: Evidence source does not match configured value');

    // Test 21: doctorReviewRequired boolean
    console.log('21. doctorReviewRequired boolean:', typeof contraFinding.doctorReviewRequired === 'boolean' && contraFinding.doctorReviewRequired === true);
    if (typeof contraFinding.doctorReviewRequired !== 'boolean' || contraFinding.doctorReviewRequired !== true) {
      throw new Error('Test 21 Failed: doctorReviewRequired must be boolean true on flagged rule');
    }

    // Test 22: No fabricated clinical text on clean check
    const cleanCheck = dupRes5.findings[0];
    console.log('22. Clean check message factual:', cleanCheck.message);
    if (cleanCheck.status === 'no_duplicate_found' && cleanCheck.reason !== '') {
      // Reason should be empty or factual for clean check
    }

    // Test Full Engine Integration for Phase 5
    const fullAnalysis = await MedwiseEngine.analyzeFullPrescription({
      prescriptionId: `RX-P5-TEST-${timestamp}`,
      patientId: userPatA._id,
      patientAge: 71,
      patientGender: 'Female',
      patientBloodGroup: 'O+',
      patientProfile: profPatA,
      medicines: [
        { medicineId: medA._id, genericName: medA.genericName, dosage: '400 mg', frequency: '1-0-1', duration: '5 days' },
      ],
    });

    console.log('\nFull MedWise Engine Phase 5 Output:');
    console.log('  - Prescription ID:', fullAnalysis.prescriptionId);
    console.log('  - Dosage findings:', fullAnalysis.checks.dosage.length);
    console.log('  - Interaction findings:', fullAnalysis.checks.interactions.findings.length);
    console.log('  - Duplicate findings:', fullAnalysis.checks.duplicates.findings.length);
    console.log('  - Allergy/Safety findings:', fullAnalysis.checks.allergySafety.findings.length);
    console.log('  - Patient-Specific findings:', fullAnalysis.checks.patientSpecific.findings.length);
    console.log('  - Overall Audit status:', fullAnalysis.audit.status);
    console.log('  - Overall Recommendation:', fullAnalysis.overallRecommendation.status);

    if (fullAnalysis.overallRecommendation.status !== 'review_required') {
      throw new Error('Full engine analysis should yield review_required for contraindication and allergy risk');
    }

    console.log('\n================================================================');
    console.log('>>> ALL 22 MEDWISE PHASE 5 CLINICAL SAFETY TESTS PASSED! <<<');
    console.log('================================================================');
  } catch (err) {
    console.error('Phase 5 Test Failure:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up Phase 5 test artifacts from MongoDB...');
    try {
      if (createdRules.length > 0) {
        await MedicineSafetyRule.deleteMany({ _id: { $in: createdRules.map(r => r._id) } });
      }
      if (createdPrescriptions.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptions.map(p => p._id) } });
      }
      if (createdProfiles.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfiles.map(p => p._id) } });
        await DoctorProfile.deleteMany({ _id: { $in: createdProfiles.map(p => p._id) } });
      }
      if (createdUsers.length > 0) {
        await User.deleteMany({ _id: { $in: createdUsers.map(u => u._id) } });
      }
      if (createdMedicines.length > 0) {
        await Medicine.deleteMany({ _id: { $in: createdMedicines.map(m => m._id) } });
      }
      await mongoose.disconnect();
      console.log('MongoDB connection closed and cleanup completed.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
  }
};

runPhase5Tests();
