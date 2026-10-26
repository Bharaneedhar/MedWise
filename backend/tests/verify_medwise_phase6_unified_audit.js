const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const Medicine = require('../src/models/Medicine');
const MedicineSafetyRule = require('../src/models/MedicineSafetyRule');
const DrugInteraction = require('../src/models/DrugInteraction');
const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const Prescription = require('../src/models/Prescription');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');

async function runPhase6Tests() {
  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdMedicineIds = [];
  const createdInteractionIds = [];
  const createdSafetyRuleIds = [];
  const createdPrescriptionIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to DB for MedWise Phase 6 — Unified Audit & Evidence Tests.\n');

    const timestamp = Date.now();

    // -----------------------------------------------------------------
    // FIXTURE SETUP
    // -----------------------------------------------------------------
    // 1. Create Test Medicines
    const medA = await Medicine.create({
      genericName: `TestWarfarinP6_${timestamp}`,
      brandNames: [`WarfP6_${timestamp}`],
      category: 'Anticoagulant',
      drugClass: 'Anticoagulant',
      form: 'Tablet',
      defaultStrength: '5 mg',
      duplicateGroup: 'WARFARIN_GROUP_P6',
      dosageGuidelines: [
        {
          population: 'Adult',
          maximumSingleDose: 10,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 10,
          maximumDailyDoseUnit: 'mg',
          evidenceSource: 'FDA Warfarin Label Guidelines',
        },
      ],
    });
    createdMedicineIds.push(medA._id);

    const medB = await Medicine.create({
      genericName: `TestAspirinP6_${timestamp}`,
      brandNames: [`AspP6_${timestamp}`],
      category: 'NSAID',
      drugClass: 'NSAID',
      form: 'Tablet',
      defaultStrength: '100 mg',
      duplicateGroup: 'ASPIRIN_GROUP_P6',
      dosageGuidelines: [
        {
          population: 'Adult',
          maximumSingleDose: 325,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 1000,
          maximumDailyDoseUnit: 'mg',
          evidenceSource: 'FDA Aspirin Label Guidelines',
        },
      ],
    });
    createdMedicineIds.push(medB._id);

    const medC = await Medicine.create({
      genericName: `TestIbuprofenP6_${timestamp}`,
      brandNames: [`IbuP6_${timestamp}`],
      category: 'NSAID',
      drugClass: 'NSAID',
      form: 'Tablet',
      defaultStrength: '400 mg',
      duplicateGroup: 'NSAID_GROUP_P6',
      dosageGuidelines: [
        {
          population: 'Adult',
          maximumSingleDose: 800,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 3200,
          maximumDailyDoseUnit: 'mg',
          evidenceSource: 'FDA Ibuprofen Label Guidelines',
        },
      ],
    });
    createdMedicineIds.push(medC._id);

    // 2. Create Test Interaction
    const interactionDoc = await DrugInteraction.create({
      medicineA: medA._id,
      medicineB: medB._id,
      genericNameA: medA.genericName,
      genericNameB: medB.genericName,
      severity: 'Major',
      description: 'Increased risk of severe bleeding when anticoagulant is combined with NSAID/Antiplatelet.',
      clinicalEffect: 'Severe Gastrointestinal Hemorrhage',
      recommendedAction: 'Avoid concomitant use or monitor INR and occult blood closely.',
      evidenceSource: 'Clinical Pharmacotherapy Handbook P6',
    });
    createdInteractionIds.push(interactionDoc._id);

    // 3. Create Test Allergy / Safety Rule
    const safetyRuleDoc = await MedicineSafetyRule.create({
      medicine: medB._id,
      genericName: medB.genericName,
      safetyType: 'allergy',
      ruleType: 'allergy',
      allergen: 'Aspirin',
      trigger: 'Aspirin Allergy',
      severity: 'Contraindicated',
      reason: 'Known severe hypersensitivity to Aspirin/NSAIDs.',
      potentialConcern: 'Anaphylaxis or Severe Bronchospasm',
      clinicalConsideration: 'Select alternative non-NSAID analgesic.',
      evidenceSource: 'National Allergy Safety Registry P6',
    });
    createdSafetyRuleIds.push(safetyRuleDoc._id);

    // 4. Create Patient A & Patient B
    const userA = await User.create({
      name: `PatientA_P6_${timestamp}`,
      email: `patienta_p6_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(userA._id);

    const profileA = await PatientProfile.create({
      userId: userA._id,
      name: userA.name,
      pid: `PID-A6-${timestamp}`,
      mobileNumber: '9876543210',
      dateOfBirth: new Date('1985-05-15'),
      age: 41,
      gender: 'Male',
      bloodGroup: 'O+',
      allergies: ['Aspirin'],
      hasNoKnownAllergies: false,
      medicalConditions: [{ conditionName: 'Hypertension' }],
      address: {
        addressLine1: '123 Main Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Contact A',
        relationship: 'Spouse',
        mobileNumber: '9876543210',
      },
      currentMedications: [
        {
          name: medA.genericName,
          genericName: medA.genericName,
          medicineId: medA._id,
          dosage: '5 mg',
          frequency: '1-0-0',
          status: 'ACTIVE',
          source: 'PRESCRIPTION',
        },
      ],
    });
    createdProfileIds.push(profileA._id);

    const userB = await User.create({
      name: `PatientB_P6_${timestamp}`,
      email: `patientb_p6_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(userB._id);

    const profileB = await PatientProfile.create({
      userId: userB._id,
      name: userB.name,
      pid: `PID-B6-${timestamp}`,
      mobileNumber: '9876543211',
      dateOfBirth: new Date('1990-01-01'),
      age: 36,
      gender: 'Female',
      bloodGroup: 'A+',
      hasNoKnownAllergies: true,
      allergies: [],
      medicalConditions: [],
      address: {
        addressLine1: '456 Side Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Contact B',
        relationship: 'Sibling',
        mobileNumber: '9876543211',
      },
      currentMedications: [],
    });
    createdProfileIds.push(profileB._id);

    const doctorUser = await User.create({
      name: `Doctor_P6_${timestamp}`,
      email: `doctor_p6_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorUser._id);

    console.log('--- PHASE 6 UNIFIED AUDIT TESTS (1-22) ---');

    // -----------------------------------------------------------------
    // TEST PRESCRIPTION 1: Full Flagged Regimen (Interaction + Allergy + Duplicate)
    // -----------------------------------------------------------------
    const rx1 = await Prescription.create({
      prescriptionId: `RX-P6-1-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: userA._id,
      patientName: userA.name,
      patientPid: `PID-A6-${timestamp}`,
      patientAge: 41,
      patientGender: 'Male',
      patientProfile: profileA._id,
      medicines: [
        {
          medicineId: medB._id,
          medicineName: medB.genericName,
          genericName: medB.genericName,
          dosage: '500 mg',
          strength: '500 mg',
          frequency: 'Once daily',
          duration: '5 days',
          route: 'Oral',
          instructions: 'After meals',
        },
        {
          medicineId: medA._id,
          medicineName: medA.genericName,
          genericName: medA.genericName,
          dosage: '5 mg',
          strength: '5 mg',
          frequency: 'Once daily',
          duration: '5 days',
          route: 'Oral',
          instructions: 'Morning',
        },
      ],
      status: 'Draft',
    });
    createdPrescriptionIds.push(rx1._id);

    const analysis1 = await MedwiseEngine.analyzeFullPrescription(rx1);

    // 1. All clinical stages contribute to the unified audit
    console.log('1. Unified audit findings count:', analysis1.audit.findings.length);
    console.assert(analysis1.audit.findings.length > 0, 'FAIL: Unified audit findings empty');

    // 2. Findings remain structured
    const sampleFinding = analysis1.audit.findings[0];
    console.log('2. Sample finding structured keys:', Object.keys(sampleFinding));
    console.assert(sampleFinding.findingType && sampleFinding.reason && sampleFinding.status, 'FAIL: Finding structure incomplete');

    // 3. Interaction evidence preserved
    const interactionFinding = analysis1.audit.findings.find((f) => f.source === 'interactions');
    console.log('3. Interaction evidence source:', interactionFinding?.evidenceSource);
    console.assert(interactionFinding?.evidenceSource === 'Clinical Pharmacotherapy Handbook P6', 'FAIL: Interaction evidence not preserved');

    // 4. Dosage evidence preserved
    const dosageFinding = analysis1.audit.findings.find((f) => f.source === 'dosage');
    console.log('4. Dosage evidence source:', dosageFinding?.evidenceSource);
    console.assert(dosageFinding?.evidenceSource === 'FDA Aspirin Label Guidelines', 'FAIL: Dosage evidence not preserved');

    // 5. Duplicate evidence preserved
    const duplicateFinding = analysis1.audit.findings.find((f) => f.source === 'duplicates');
    console.log('5. Duplicate evidence source:', duplicateFinding?.evidenceSource);
    console.assert(duplicateFinding?.evidenceSource === 'MedWise Master Medicine Database', 'FAIL: Duplicate evidence not preserved');

    // 6. Allergy/safety evidence preserved
    const allergyFinding = analysis1.audit.findings.find((f) => f.source === 'allergySafety');
    console.log('6. Allergy evidence source:', allergyFinding?.evidenceSource);
    console.assert(allergyFinding?.evidenceSource === 'National Allergy Safety Registry P6', 'FAIL: Allergy evidence not preserved');

    // 7. Patient-specific findings preserved
    console.log('7. Patient-specific findings present in audit:', Boolean(analysis1.checks.patientSpecific));
    console.assert(analysis1.checks.patientSpecific !== null, 'FAIL: Patient-specific check missing');

    // 8. Finding counts are correct
    console.log('8. Summary breakdown counts:', analysis1.audit.summary);
    console.assert(typeof analysis1.audit.summary.totalFindings === 'number', 'FAIL: totalFindings missing');
    console.assert(typeof analysis1.audit.summary.dosageFindings === 'number', 'FAIL: dosageFindings count missing');
    console.assert(typeof analysis1.audit.summary.interactionFindings === 'number', 'FAIL: interactionFindings count missing');
    console.assert(typeof analysis1.audit.summary.duplicateFindings === 'number', 'FAIL: duplicateFindings count missing');

    // 9. Critical count is correct
    console.log('9. Critical findings count:', analysis1.audit.summary.criticalFindings);
    console.assert(analysis1.audit.summary.criticalFindings >= 1, 'FAIL: Critical findings count incorrect');

    // 10. Warning count is correct
    console.log('10. Warning findings count:', analysis1.audit.summary.warningFindings);
    console.assert(typeof analysis1.audit.summary.warningFindings === 'number', 'FAIL: Warning findings count incorrect');

    // 11. Incomplete assessment count is correct
    console.log('11. Incomplete assessment count:', analysis1.audit.summary.incompleteAssessments);
    console.assert(typeof analysis1.audit.summary.incompleteAssessments === 'number', 'FAIL: Incomplete assessment count incorrect');

    // 13. REVIEW RECOMMENDED outcome
    console.log('13. RX1 outcome status:', analysis1.overallRecommendation.status);
    console.assert(analysis1.overallRecommendation.status === 'review_required', 'FAIL: Outcome should be review_required');

    // -----------------------------------------------------------------
    // TEST PRESCRIPTION 2: CLEARED Regimen (Patient B, Single Safe Med)
    // -----------------------------------------------------------------
    const rx2 = await Prescription.create({
      prescriptionId: `RX-P6-2-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: userB._id,
      patientName: userB.name,
      patientPid: `PID-B6-${timestamp}`,
      patientAge: 36,
      patientGender: 'Female',
      patientProfile: profileB._id,
      medicines: [
        {
          medicineId: medC._id,
          medicineName: medC.genericName,
          genericName: medC.genericName,
          dosage: '400 mg',
          strength: '400 mg',
          frequency: 'Once daily',
          duration: '3 days',
          route: 'Oral',
          instructions: 'With water',
        },
      ],
      status: 'Draft',
    });
    createdPrescriptionIds.push(rx2._id);

    const analysis2 = await MedwiseEngine.analyzeFullPrescription(rx2);

    // 12. CLEARED outcome
    console.log('12. RX2 outcome status:', analysis2.overallRecommendation.status);
    console.log('12. RX2 findings:', JSON.stringify(analysis2.audit.findings, null, 2));
    console.assert(analysis2.overallRecommendation.status === 'cleared', 'FAIL: RX2 outcome should be cleared');

    // 16. No configured finding does not create a false finding
    console.log('16. RX2 total findings:', analysis2.audit.findings.length);
    console.assert(analysis2.audit.findings.length === 0, 'FAIL: Fabricated findings present in cleared prescription');

    // 17. No duplicate counting
    console.log('17. RX2 summary total matches findings array:', analysis2.audit.summary.totalFindings === analysis2.audit.findings.length);
    console.assert(analysis2.audit.summary.totalFindings === analysis2.audit.findings.length, 'FAIL: Summary total findings mismatch');

    // -----------------------------------------------------------------
    // TEST PRESCRIPTION 3: ANALYSIS INCOMPLETE (Missing Patient Age / Incomplete Allergy)
    // -----------------------------------------------------------------
    const rx3 = await Prescription.create({
      prescriptionId: `RX-P6-3-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: userA._id,
      patientName: userA.name,
      patientPid: `PID-A6-${timestamp}`,
      patientAge: 0, // Missing age
      patientGender: 'Unspecified', // Missing gender
      medicines: [
        {
          medicineId: medA._id,
          medicineName: medA.genericName,
          genericName: medA.genericName,
          dosage: '5 mg',
          strength: '5 mg',
          frequency: 'Once daily',
          duration: '5 days',
          route: 'Oral',
          instructions: 'Morning',
        },
      ],
      status: 'Draft',
    });
    createdPrescriptionIds.push(rx3._id);

    const analysis3 = await MedwiseEngine.analyzeFullPrescription(rx3);

    // 14. ANALYSIS INCOMPLETE outcome
    console.log('14. RX3 outcome status:', analysis3.overallRecommendation.status);
    console.assert(analysis3.overallRecommendation.status === 'unable_to_assess', 'FAIL: RX3 outcome should be unable_to_assess');

    // 15. Missing required patient data produces incomplete analysis
    console.log('15. RX3 patient context coverage:', analysis3.audit.coverage.patientContext);
    console.assert(analysis3.audit.coverage.patientContext === 'INCOMPLETE', 'FAIL: Coverage should be INCOMPLETE');

    // 18. Coverage states are accurate
    console.log('18. RX3 coverage structure keys:', Object.keys(analysis3.audit.coverage));
    console.assert(analysis3.audit.coverage.overallAudit === 'COMPLETED', 'FAIL: overallAudit coverage state missing');

    // 19. Evidence sources remain traceable
    console.log('19. Audit metadata version:', analysis3.audit.metadata.analysisVersion);
    console.assert(analysis3.audit.metadata.analysisVersion === '2.0.0', 'FAIL: Metadata version incorrect');

    // 20. Outdated analysis behavior remains correct
    rx1.medwiseAnalysis = analysis1;
    rx1.medwiseAnalysis.isOutdated = true;
    await rx1.save();
    const updatedRx1 = await Prescription.findById(rx1._id);
    console.log('20. Outdated flag set on prescription edit:', updatedRx1.medwiseAnalysis.isOutdated);
    console.assert(updatedRx1.medwiseAnalysis.isOutdated === true, 'FAIL: Outdated flag not preserved');

    // 21. Cross-patient isolation remains correct
    const patientBAnalysisOnMedA = await MedwiseEngine.analyzeFullPrescription(rx2);
    console.log('21. Patient B analysis has 0 findings from Patient A:', patientBAnalysisOnMedA.audit.findings.length);
    console.assert(patientBAnalysisOnMedA.audit.findings.length === 0, 'FAIL: Cross-patient isolation breach');

    // 22. Existing saved analysis remains compatible
    console.log('22. Saved analysis has audit and overallRecommendation:', Boolean(updatedRx1.medwiseAnalysis.audit && updatedRx1.medwiseAnalysis.overallRecommendation));
    console.assert(Boolean(updatedRx1.medwiseAnalysis.audit && updatedRx1.medwiseAnalysis.overallRecommendation), 'FAIL: Saved analysis structure incompatible');

    console.log('\n================================================================');
    console.log('>>> ALL 22 MEDWISE PHASE 6 UNIFIED AUDIT TESTS PASSED! <<<');
    console.log('================================================================\n');
  } catch (err) {
    console.error('TEST ERROR in Phase 6:', err);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up Phase 6 test artifacts from MongoDB...');
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdSafetyRuleIds.length > 0) {
        await MedicineSafetyRule.deleteMany({ _id: { $in: createdSafetyRuleIds } });
      }
      if (createdInteractionIds.length > 0) {
        await DrugInteraction.deleteMany({ _id: { $in: createdInteractionIds } });
      }
      if (createdMedicineIds.length > 0) {
        await Medicine.deleteMany({ _id: { $in: createdMedicineIds } });
      }
      await mongoose.disconnect();
      console.log('MongoDB connection closed and cleanup completed.');
    }
  }
}

runPhase6Tests();
