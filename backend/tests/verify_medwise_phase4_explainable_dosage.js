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

const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const {
  parseDoseString,
  normalizeToMg,
  parseDosesPerDay,
  getPopulationGroup,
  checkItemDosage,
} = require('../src/services/medwise/dosageCheckService');
const { aggregatePrescriptionAudit } = require('../src/services/medwise/prescriptionAuditService');

const runPhase4Tests = async () => {
  let createdUsers = [];
  let createdProfiles = [];
  let createdPrescriptions = [];
  let createdMedicines = [];
  let createdHistory = [];

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Phase 4 — Explainable Dosage Analysis Tests.\n');

    const timestamp = Date.now();

    // -----------------------------------------------------------------
    // TEST 1: WITHIN-GUIDANCE DOSAGE ASSESSMENT
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Within-Guidance Dosage ---');
    const mockMed1 = {
      _id: new mongoose.Types.ObjectId(),
      genericName: 'TestParacetamolP4',
      dosageGuidelines: [
        {
          population: 'Adult',
          minimumDose: 250,
          minimumDoseUnit: 'mg',
          maximumSingleDose: 1000,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 4000,
          maximumDailyDoseUnit: 'mg',
          frequencyGuidance: 'Every 4 to 6 hours as needed',
          notes: 'Do not exceed 4000mg daily total exposure',
          evidenceSource: 'FDA Label Guidelines',
        },
      ],
    };

    const check1 = checkItemDosage(
      { dosage: '500 mg', frequency: '1-0-1', duration: '5 days' },
      mockMed1,
      { age: 35 }
    );
    console.log('1.1 Status:', check1.status, '| Reason:', check1.reason);
    if (check1.status !== 'within_guidance') throw new Error('Test 1 Failed: Expected within_guidance status');
    if (check1.doctorReviewRequired !== false) throw new Error('Test 1 Failed: Expected doctorReviewRequired = false');
    if (check1.calculatedDailyDose !== 1000) throw new Error('Test 1 Failed: Calculated daily dose should be 1000mg for 500mg 1-0-1');


    // -----------------------------------------------------------------
    // TEST 2: REVIEW-REQUIRED DOSAGE ASSESSMENT
    // -----------------------------------------------------------------
    console.log('--- TEST 2: Review-Required Dosage ---');
    const check2SingleExceeded = checkItemDosage(
      { dosage: '1500 mg', frequency: '1-0-0', duration: '3 days' },
      mockMed1,
      { age: 35 }
    );
    console.log('2.1 Single dose exceeded:', check2SingleExceeded.status, '| Reason:', check2SingleExceeded.reason);
    if (check2SingleExceeded.status !== 'review_required') throw new Error('Test 2.1 Failed: Expected review_required');
    if (check2SingleExceeded.doctorReviewRequired !== true) throw new Error('Test 2.1 Failed: Expected doctorReviewRequired = true');

    // Test 2.2 Daily dose exceeded (single dose within limit, daily dose exceeds max daily)
    const mockMedDailyMax = {
      _id: new mongoose.Types.ObjectId(),
      genericName: 'TestDailyMaxP4',
      dosageGuidelines: [
        {
          population: 'Adult',
          maximumSingleDose: 1000,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 1500,
          maximumDailyDoseUnit: 'mg',
        },
      ],
    };
    const check2DailyExceeded = checkItemDosage(
      { dosage: '1000 mg', frequency: '1-0-1', duration: '3 days' }, // 1000mg x 2 = 2000mg (max daily is 1500mg)
      mockMedDailyMax,
      { age: 35 }
    );
    console.log('2.2 Daily dose exceeded:', check2DailyExceeded.status, '| Reason:', check2DailyExceeded.reason);
    if (check2DailyExceeded.status !== 'review_required') throw new Error('Test 2.2 Failed: Expected review_required for 2000mg daily dose');
    if (check2DailyExceeded.doctorReviewRequired !== true) throw new Error('Test 2.2 Failed: Expected doctorReviewRequired = true');


    // -----------------------------------------------------------------
    // TEST 3: UNABLE-TO-ASSESS DOSAGE ASSESSMENT
    // -----------------------------------------------------------------
    console.log('--- TEST 3: Unable-To-Assess Dosage ---');
    const mockMedNoGuidelines = {
      _id: new mongoose.Types.ObjectId(),
      genericName: 'ExperimentalNoGuidelinesP4',
      dosageGuidelines: [],
    };
    const check3 = checkItemDosage(
      { dosage: '500 mg', frequency: '1-0-1' },
      mockMedNoGuidelines,
      { age: 35 }
    );
    console.log('3.1 Status:', check3.status, '| Reason:', check3.reason);
    if (check3.status !== 'unable_to_assess') throw new Error('Test 3 Failed: Expected unable_to_assess');
    if (check3.doctorReviewRequired !== false) throw new Error('Test 3 Failed: Expected doctorReviewRequired = false');


    // -----------------------------------------------------------------
    // TEST 4: NUMERIC DOSE PARSING
    // -----------------------------------------------------------------
    console.log('--- TEST 4: Numeric Dose Parsing ---');
    const parseMg = parseDoseString('500 mg');
    const parseG = parseDoseString('1.5 g');
    const parseMcg = parseDoseString('250 mcg');
    const parseMicrogram = parseDoseString('100 microgram');
    console.log('4.1 Parsed values:', parseMg, parseG, parseMcg, parseMicrogram);
    if (parseMg.value !== 500 || parseMg.unit !== 'mg') throw new Error('Test 4 Failed: 500 mg parsing');
    if (parseG.value !== 1.5 || parseG.unit !== 'g') throw new Error('Test 4 Failed: 1.5 g parsing');
    if (parseMcg.value !== 250 || parseMcg.unit !== 'mcg') throw new Error('Test 4 Failed: 250 mcg parsing');
    if (parseMicrogram.value !== 100 || parseMicrogram.unit !== 'mcg') throw new Error('Test 4 Failed: 100 microgram parsing');


    // -----------------------------------------------------------------
    // TEST 5: MG / G / MCG NORMALIZATION
    // -----------------------------------------------------------------
    console.log('--- TEST 5: mg/g/mcg Normalization ---');
    const normMg = normalizeToMg(500, 'mg');
    const normG = normalizeToMg(1, 'g');
    const normMcg = normalizeToMg(500, 'mcg');
    const normInvalid = normalizeToMg(10, 'drops');
    console.log('5.1 Normalized values:', normMg, 'mg,', normG, 'mg,', normMcg, 'mg,', normInvalid);
    if (normMg !== 500) throw new Error('Test 5 Failed: 500 mg');
    if (normG !== 1000) throw new Error('Test 5 Failed: 1 g');
    if (normMcg !== 0.5) throw new Error('Test 5 Failed: 500 mcg');
    if (normInvalid !== null) throw new Error('Test 5 Failed: invalid unit should return null');


    // -----------------------------------------------------------------
    // TEST 6: X-Y-Z FREQUENCY CALCULATION
    // -----------------------------------------------------------------
    console.log('--- TEST 6: X-Y-Z Frequency Calculation ---');
    const f100 = parseDosesPerDay('1-0-0');
    const f010 = parseDosesPerDay('0-1-0');
    const f001 = parseDosesPerDay('0-0-1');
    const f101 = parseDosesPerDay('1-0-1');
    const f110 = parseDosesPerDay('1-1-0');
    const f011 = parseDosesPerDay('0-1-1');
    const f111 = parseDosesPerDay('1-1-1');
    console.log('6.1 Frequencies:', { f100, f010, f001, f101, f110, f011, f111 });
    if (f100 !== 1 || f010 !== 1 || f001 !== 1) throw new Error('Test 6 Failed: Single daily frequencies');
    if (f101 !== 2 || f110 !== 2 || f011 !== 2) throw new Error('Test 6 Failed: Twice daily frequencies');
    if (f111 !== 3) throw new Error('Test 6 Failed: Thrice daily frequency');


    // -----------------------------------------------------------------
    // TEST 7: SINGLE-DOSE COMPARISON
    // -----------------------------------------------------------------
    console.log('--- TEST 7: Single-Dose Comparison ---');
    const checkMinSingle = checkItemDosage(
      { dosage: '100 mg', frequency: '1-0-0' }, // min is 250mg
      mockMed1,
      { age: 35 }
    );
    console.log('7.1 Below min single dose:', checkMinSingle.status, '| Reason:', checkMinSingle.reason);
    if (checkMinSingle.status !== 'review_required') throw new Error('Test 7 Failed: Expected review_required for below min dose');


    // -----------------------------------------------------------------
    // TEST 8: DAILY-DOSE COMPARISON
    // -----------------------------------------------------------------
    console.log('--- TEST 8: Daily-Dose Comparison ---');
    const checkMaxDaily = checkItemDosage(
      { dosage: '1000 mg', frequency: '1-1-1' }, // 3000mg daily -> within 4000mg max
      mockMed1,
      { age: 35 }
    );
    console.log('8.1 Daily dose within limit:', checkMaxDaily.status, '| Calculated daily:', checkMaxDaily.calculatedDailyDose);
    if (checkMaxDaily.calculatedDailyDose !== 3000) throw new Error('Test 8 Failed: Calculated daily dose should be 3000mg');
    if (checkMaxDaily.status !== 'within_guidance') throw new Error('Test 8 Failed: Expected within_guidance for 3000mg daily dose');


    // -----------------------------------------------------------------
    // TEST 9: POPULATION-SPECIFIC GUIDELINE MATCHING
    // -----------------------------------------------------------------
    console.log('--- TEST 9: Population-Specific Guideline Matching ---');
    const mockMedMultiPop = {
      _id: new mongoose.Types.ObjectId(),
      genericName: 'MultiPopMedP4',
      dosageGuidelines: [
        { population: 'Adult', maximumSingleDose: 1000, maximumSingleDoseUnit: 'mg' },
        { population: 'Pediatric', maximumSingleDose: 250, maximumSingleDoseUnit: 'mg' },
        { population: 'Elderly', maximumSingleDose: 500, maximumSingleDoseUnit: 'mg' },
      ],
    };

    const adultCheck = checkItemDosage({ dosage: '750 mg', frequency: '1-0-0' }, mockMedMultiPop, { age: 35 });
    const pediaCheck = checkItemDosage({ dosage: '500 mg', frequency: '1-0-0' }, mockMedMultiPop, { age: 10 });
    const elderCheck = checkItemDosage({ dosage: '400 mg', frequency: '1-0-0' }, mockMedMultiPop, { age: 72 });

    console.log('9.1 Adult check (750mg):', adultCheck.status, '| Pop:', adultCheck.applicablePopulation);
    console.log('9.2 Pediatric check (500mg > 250mg max):', pediaCheck.status, '| Pop:', pediaCheck.applicablePopulation);
    console.log('9.3 Elderly check (400mg <= 500mg max):', elderCheck.status, '| Pop:', elderCheck.applicablePopulation);

    if (adultCheck.status !== 'within_guidance' || adultCheck.applicablePopulation !== 'Adult') throw new Error('Test 9.1 Adult match failed');
    if (pediaCheck.status !== 'review_required' || pediaCheck.applicablePopulation !== 'Pediatric') throw new Error('Test 9.2 Pediatric match failed');
    if (elderCheck.status !== 'within_guidance' || elderCheck.applicablePopulation !== 'Elderly') throw new Error('Test 9.3 Elderly match failed');


    // -----------------------------------------------------------------
    // TEST 10: MISSING PATIENT INFORMATION
    // -----------------------------------------------------------------
    console.log('--- TEST 10: Missing Patient Information ---');
    const missingAgeCheck = checkItemDosage({ dosage: '500 mg', frequency: '1-0-0' }, mockMedMultiPop, { age: null });
    console.log('10.1 Missing age check status:', missingAgeCheck.status, '| Reason:', missingAgeCheck.reason);
    if (missingAgeCheck.status !== 'unable_to_assess') throw new Error('Test 10 Failed: Expected unable_to_assess when patient age is missing');


    // -----------------------------------------------------------------
    // TEST 11: MULTIPLE MEDICINES IN PRESCRIPTION
    // -----------------------------------------------------------------
    console.log('--- TEST 11: Multiple Medicines Evaluation ---');
    const multiMedResults = [
      checkItemDosage({ dosage: '500 mg', frequency: '1-0-1' }, mockMed1, { age: 35 }),
      checkItemDosage({ dosage: '1500 mg', frequency: '1-0-1' }, mockMed1, { age: 35 }),
    ];
    console.log('11.1 Med 1 status:', multiMedResults[0].status, '| Med 2 status:', multiMedResults[1].status);
    if (multiMedResults.length !== 2) throw new Error('Test 11 Failed: Expected 2 dosage findings');
    if (multiMedResults[0].status !== 'within_guidance' || multiMedResults[1].status !== 'review_required') {
      throw new Error('Test 11 Failed: Incorrect statuses for multi-medicine evaluation');
    }


    // -----------------------------------------------------------------
    // TEST 12: STRUCTURED EXPLANATION FIELDS
    // -----------------------------------------------------------------
    console.log('--- TEST 12: Structured Explanation Fields ---');
    const structCheck = checkItemDosage(
      { dosage: '500 mg', frequency: '1-0-1', duration: '7 days' },
      mockMed1,
      { age: 35 }
    );
    console.log('12.1 Structured keys present:', Object.keys(structCheck));
    const requiredKeys = [
      'genericName',
      'prescribedDose',
      'prescribedFrequency',
      'prescribedDuration',
      'calculatedDailyDose',
      'applicablePopulation',
      'guidelineRange',
      'status',
      'reason',
      'clinicalConsideration',
      'evidenceSource',
      'doctorReviewRequired',
    ];
    for (const key of requiredKeys) {
      if (!(key in structCheck)) {
        throw new Error(`Test 12 Failed: Missing required key "${key}" in dosage finding`);
      }
    }


    // -----------------------------------------------------------------
    // TEST 13 & 14: EVIDENCE SOURCE AND DOCTOR REVIEW REQUIRED
    // -----------------------------------------------------------------
    console.log('--- TEST 13 & 14: Evidence Source & Doctor Review Required ---');
    console.log('13.1 Evidence source:', structCheck.evidenceSource);
    console.log('14.1 Doctor review required:', structCheck.doctorReviewRequired);
    if (structCheck.evidenceSource !== 'FDA Label Guidelines') throw new Error('Test 13 Failed: Incorrect evidence source');
    if (typeof structCheck.doctorReviewRequired !== 'boolean') throw new Error('Test 14 Failed: doctorReviewRequired must be boolean');


    // -----------------------------------------------------------------
    // TEST 15: NO FABRICATED DOSAGE FINDINGS
    // -----------------------------------------------------------------
    console.log('--- TEST 15: No Fabricated Dosage Findings ---');
    const emptyMed = { _id: new mongoose.Types.ObjectId(), genericName: 'EmptyMedP4', dosageGuidelines: [] };
    const checkEmpty = checkItemDosage({ dosage: '100 mg', frequency: '1-0-0' }, emptyMed, { age: 30 });
    console.log('15.1 Status for missing guidelines:', checkEmpty.status);
    if (checkEmpty.status !== 'unable_to_assess') throw new Error('Test 15 Failed: Missing guideline must return unable_to_assess');


    // -----------------------------------------------------------------
    // TEST 16: CURRENT MEDICATION ISOLATION
    // -----------------------------------------------------------------
    console.log('--- TEST 16: Current Medication Patient Isolation ---');
    const userA = await User.create({ name: 'Patient A P4', email: `p4a.${timestamp}@medwise.com`, password: 'password123', role: 'patient' });
    const userB = await User.create({ name: 'Patient B P4', email: `p4b.${timestamp}@medwise.com`, password: 'password123', role: 'patient' });
    createdUsers.push(userA, userB);

    const dummyProfileFields = {
      mobileNumber: '9998887771',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      address: { addressLine1: 'Line 1', city: 'City', state: 'State', country: 'Country', pinCode: '600001' },
      emergencyContact: { name: 'Contact', relationship: 'Spouse', mobileNumber: '9998887772' },
    };

    const profA = await PatientProfile.create({ ...dummyProfileFields, userId: userA._id, pid: `PID-A-${timestamp}`, name: 'Patient A P4', currentMedications: [{ name: 'Aspirin', dosage: '75mg' }] });
    const profB = await PatientProfile.create({ ...dummyProfileFields, userId: userB._id, pid: `PID-B-${timestamp}`, name: 'Patient B P4', currentMedications: [{ name: 'Metformin', dosage: '500mg' }] });
    createdProfiles.push(profA, profB);

    console.log('16.1 Patient A current meds:', profA.currentMedications.map(m => m.name));
    console.log('16.2 Patient B current meds:', profB.currentMedications.map(m => m.name));
    if (profA.currentMedications.some(m => m.name === 'Metformin') || profB.currentMedications.some(m => m.name === 'Aspirin')) {
      throw new Error('Test 16 Failed: Cross-patient current medication leakage detected');
    }


    // -----------------------------------------------------------------
    // TEST 17: INACTIVE MEDICATION EXCLUSION
    // -----------------------------------------------------------------
    console.log('--- TEST 17: Inactive Medication Exclusion ---');
    const profHist = await PatientProfile.create({
      ...dummyProfileFields,
      userId: new mongoose.Types.ObjectId(),
      pid: `PID-HIST-${timestamp}`,
      name: 'History Patient P4',
      currentMedications: [
        { name: 'ActiveMed', dosage: '10mg', status: 'ACTIVE' },
        { name: 'InactiveMed', dosage: '20mg', status: 'INACTIVE' },
      ],
    });
    createdProfiles.push(profHist);

    const activeMedsOnly = (profHist.currentMedications || []).filter(m => m.status !== 'INACTIVE');
    console.log('17.1 Active meds found for patient:', activeMedsOnly.map(m => m.name));
    if (activeMedsOnly.length !== 1 || activeMedsOnly[0].name !== 'ActiveMed') {
      throw new Error('Test 17 Failed: Inactive medication was not excluded from active baseline');
    }

    console.log('\n================================================================');
    console.log('>>> ALL 17 MEDWISE PHASE 4 EXPLAINABLE DOSAGE TESTS PASSED! <<<');
    console.log('================================================================');
  } catch (err) {
    console.error('Phase 4 Test Failure:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up Phase 4 test artifacts from MongoDB...');
    try {
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

runPhase4Tests();
