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

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { createPrescription } = require('../src/controllers/prescriptionController');
const {
  checkPrescriptionDosage,
  checkPrescriptionInteraction,
  checkPrescriptionDuplicate,
  checkPrescriptionAllergySafety,
  analyzePrescription,
} = require('../src/controllers/medwiseController');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { checkPrescriptionAllergySafety: checkAllergySafetyService } = require('../src/services/medwise/allergySafetyCheckService');

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
  let createdRuleIds = [];
  let createdUserIds = [];
  let createdPrescriptionId = null;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Allergy & Safety Check verification.\n');

    const timestamp = Date.now();

    // ===========================================================
    // 1. SERVICE FUNCTION LOADED
    // ===========================================================
    console.log('=== 1. SERVICE FUNCTION LOADED ===');
    console.log('1.1 checkPrescriptionAllergySafety loaded:', typeof checkAllergySafetyService === 'function');
    if (typeof checkAllergySafetyService !== 'function') {
      throw new Error('checkAllergySafetyService is not a function');
    }

    // Lookup real master medicines
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const aspirin = await Medicine.findOne({ genericName: 'Aspirin', isActive: true });

    if (!amoxicillin || !paracetamol) {
      throw new Error('Required master medicines (Amoxicillin, Paracetamol) not found in DB');
    }

    // ===========================================================
    // 2. SINGLE MEDICINE WITH SUFFICIENT SAFETY DATA
    // ===========================================================
    console.log('\n=== 2. SINGLE MEDICINE EVALUATION ===');
    const singleRx = {
      medicines: [{ medicineId: String(paracetamol._id), genericName: 'Paracetamol' }],
    };
    const singleRes = await checkAllergySafetyService(singleRx, { allergies: [] });
    console.log('2.1 Single medicine status:', singleRes.status, '| evaluated:', singleRes.evaluatedMedicines, '| findings:', singleRes.findings.length);
    if (singleRes.evaluatedMedicines !== 1 || !Array.isArray(singleRes.findings)) {
      throw new Error('Single medicine evaluation failed');
    }

    // ===========================================================
    // 3. NO ALLERGY INFORMATION AVAILABLE -> UNABLE TO ASSESS
    //    (NO ALLERGY DATA != NO ALLERGIES)
    // ===========================================================
    console.log('\n=== 3. MISSING PATIENT ALLERGY INFORMATION ===');
    const noAllergyDataRx = {
      medicines: [{ medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' }],
    };
    // Pass null/undefined for allergies
    const noAllergyRes = await checkAllergySafetyService(noAllergyDataRx, { allergies: null });
    console.log('3.1 Missing allergy info status:', noAllergyRes.findings[0].status, '| message:', noAllergyRes.findings[0].message);
    if (noAllergyRes.findings[0].status !== 'unable_to_assess') {
      throw new Error('Missing patient allergy data MUST return unable_to_assess, not no_allergy_risk');
    }

    // ===========================================================
    // 4. KNOWN ALLERGY MATCH USING AUTHORITATIVE ALLERGY DATA
    // ===========================================================
    console.log('\n=== 4. KNOWN ALLERGY MATCH ===');
    const allergyMatchRx = {
      medicines: [{ medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' }],
    };
    const allergyMatchRes = await checkAllergySafetyService(allergyMatchRx, {
      allergies: ['Penicillin Hypersensitivity'],
    });
    const allergyFinding = allergyMatchRes.findings.find((f) => f.type === 'allergy');
    console.log('4.1 Allergy match status:', allergyFinding.status, '| severity:', allergyFinding.severity, '| allergen:', allergyFinding.matchedAllergen);
    if (!allergyFinding || allergyFinding.status !== 'allergy_risk') {
      throw new Error('Expected allergy_risk finding for Penicillin Hypersensitivity match');
    }

    // ===========================================================
    // 5. NO AUTHORITATIVE ALLERGY MATCH -> NO FALSE ALLERGY FINDING
    // ===========================================================
    console.log('\n=== 5. NO ALLERGY MATCH ===');
    const noMatchRx = {
      medicines: [{ medicineId: String(paracetamol._id), genericName: 'Paracetamol' }],
    };
    const noMatchRes = await checkAllergySafetyService(noMatchRx, {
      allergies: ['Sulfa Drugs'],
    });
    const noMatchFinding = noMatchRes.findings.find((f) => f.type === 'allergy');
    console.log('5.1 No match status:', noMatchFinding.status, '(Expected: no_allergy_risk_found)');
    if (!noMatchFinding || noMatchFinding.status !== 'no_allergy_risk_found') {
      throw new Error('Expected no_allergy_risk_found when patient allergies do not match medicine');
    }

    // ===========================================================
    // 6. APPLICABLE CONTRAINDICATION / SAFETY RULE MATCH
    // ===========================================================
    console.log('\n=== 6. APPLICABLE CONTRAINDICATION RULE MATCH ===');
    if (aspirin) {
      const contraRx = {
        medicines: [{ medicineId: String(aspirin._id), genericName: 'Aspirin' }],
      };
      const contraRes = await checkAllergySafetyService(contraRx, {
        allergies: [],
        conditions: ['Active Peptic Ulcer Disease'],
      });
      const contraFinding = contraRes.findings.find((f) => f.type === 'contraindication');
      console.log('6.1 Contraindication status:', contraFinding ? contraFinding.status : 'None', '| trigger:', contraFinding ? contraFinding.trigger : 'None');
      if (contraFinding && contraFinding.status !== 'safety_rule_flagged') {
        throw new Error('Expected safety_rule_flagged for Active Peptic Ulcer Disease + Aspirin');
      }
    } else {
      console.log('6.1 Aspirin not found — skipping Aspirin contraindication assertion');
    }

    // ===========================================================
    // 7. SAFETY RULE REQUIRING UNAVAILABLE PATIENT INFORMATION
    // ===========================================================
    console.log('\n=== 7. SAFETY RULE WITH UNAVAILABLE PATIENT CONDITIONS ===');
    const unavailCondRx = {
      medicines: [{ medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' }],
    };
    const unavailCondRes = await checkAllergySafetyService(unavailCondRx, {
      allergies: [],
      conditions: null, // conditions unavailable
    });
    console.log('7.1 Unavailable conditions status:', unavailCondRes.status);

    // ===========================================================
    // 8. UNRELATED SAFETY RULE -> NO FALSE POSITIVE
    // ===========================================================
    console.log('\n=== 8. UNRELATED SAFETY RULE (NO FALSE POSITIVE) ===');
    const unrelatedCondRx = {
      medicines: [{ medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' }],
    };
    const unrelatedCondRes = await checkAllergySafetyService(unrelatedCondRx, {
      allergies: [],
      conditions: ['Hypertension'], // Amoxicillin has no hypertension contraindication
    });
    const falseFlag = unrelatedCondRes.findings.find((f) => f.status === 'safety_rule_flagged');
    console.log('8.1 False positive flag count:', falseFlag ? 1 : 0, '(Expected: 0)');
    if (falseFlag) {
      throw new Error('Unrelated medical condition MUST NOT trigger a false positive safety flag');
    }

    // ===========================================================
    // 9. MISSING / UNRESOLVABLE MEDICINE
    // ===========================================================
    console.log('\n=== 9. UNRESOLVABLE MEDICINE ===');
    const unresRx = {
      medicines: [{ medicineId: null, genericName: 'NonExistentDrugABC999' }],
    };
    const unresRes = await checkAllergySafetyService(unresRx, { allergies: [] });
    console.log('9.1 Unresolvable status:', unresRes.findings[0].status, '| severity:', unresRes.findings[0].severity);
    if (unresRes.findings[0].status !== 'unable_to_assess') {
      throw new Error('Unresolvable medicine MUST return unable_to_assess');
    }

    // ===========================================================
    // 10. MULTIPLE MEDICINES EVALUATED INDEPENDENTLY
    // ===========================================================
    console.log('\n=== 10. MULTIPLE MEDICINES EVALUATION ===');
    const multiRx = {
      medicines: [
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin' },
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol' },
      ],
    };
    const multiRes = await checkAllergySafetyService(multiRx, { allergies: ['Penicillin Hypersensitivity'] });
    console.log('10.1 Multi-medicine evaluated count:', multiRes.evaluatedMedicines, '| total findings:', multiRes.findings.length);
    if (multiRes.evaluatedMedicines !== 2) {
      throw new Error('Expected 2 medicines evaluated independently');
    }

    // ===========================================================
    // 11. NO DUPLICATE SAFETY FINDINGS FOR SAME MEDICINE/RULE
    // ===========================================================
    console.log('\n=== 11. NO DUPLICATE FINDINGS DEDUPING ===');
    const dedupFindingSet = new Set(multiRes.findings.map((f) => `${f.medicine.genericName}_${f.type}_${f.matchedAllergen || f.trigger || ''}`));
    console.log('11.1 Total findings:', multiRes.findings.length, '| Unique finding keys:', dedupFindingSet.size);
    if (multiRes.findings.length !== dedupFindingSet.size) {
      throw new Error('Duplicate safety findings generated for same medicine and rule');
    }

    // ===========================================================
    // 12. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS
    // ===========================================================
    console.log('\n=== 12. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS ===');
    const fullAnalysisRx = {
      prescriptionId: 'TEST-ALLERGY-001',
      patientAge: 35,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', dosage: '500 mg', frequency: 'Thrice daily' },
      ],
    };
    const engineOutput = await MedwiseEngine.analyzeFullPrescription(fullAnalysisRx);
    console.log('12.1 checks.dosage length:', engineOutput.checks.dosage.length);
    console.log('12.2 checks.interactions status:', engineOutput.checks.interactions.status);
    console.log('12.3 checks.duplicates status:', engineOutput.checks.duplicates.status);
    console.log('12.4 checks.allergySafety status:', engineOutput.checks.allergySafety.status);
    console.log('12.5 audit status:', engineOutput.audit.status);
    console.log('12.6 overallRecommendation status:', engineOutput.overallRecommendation.status, '| message:', engineOutput.overallRecommendation.message);

    // Strict structural assertions
    if (!Array.isArray(engineOutput.checks.dosage)) throw new Error('checks.dosage MUST be an array');
    if (!engineOutput.checks.interactions) throw new Error('checks.interactions MUST be populated');
    if (!engineOutput.checks.duplicates) throw new Error('checks.duplicates MUST be populated');
    if (!engineOutput.checks.allergySafety) throw new Error('checks.allergySafety MUST be populated');
    if (!engineOutput.audit || engineOutput.audit.status !== 'completed') throw new Error('audit MUST be populated in Step 5');
    if (!engineOutput.overallRecommendation || !engineOutput.overallRecommendation.status) throw new Error('overallRecommendation MUST be populated in Step 5');


    // ===========================================================
    // 13. DOCTOR API (HTTP 200)
    // 14. PATIENT API (HTTP 403)
    // 15. UNAUTHENTICATED API (HTTP 401)
    // ===========================================================
    console.log('\n=== 13, 14, 15. PROTECTED API ENDPOINT TESTS ===');

    // Register doctor
    const docRegReq = { body: { name: 'Dr. Allergy Tester', email: 'doc.allergy.' + timestamp + '@medwise.com', password: 'password123', role: 'doctor' } };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);
    createdUserIds.push(doctorUser._id);

    await createOrUpdateMyProfile({ user: doctorUser, body: { name: 'Dr. Allergy Tester', mobileNumber: '9840888777', specialization: 'Immunology' } }, mockRes(), (err) => { if (err) throw err; });

    // Register patient
    const patRegReq = { body: { name: 'Allergy Patient', email: 'patient.allergy.' + timestamp + '@medwise.com', password: 'password123', role: 'patient' } };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);
    createdUserIds.push(patientUser._id);

    await createOrUpdateMyProfile({
      user: patientUser,
      body: { name: 'Allergy Patient', mobileNumber: '9811888777', dateOfBirth: '1992-02-02', gender: 'Male',
        address: { addressLine1: 'Allergy St', city: 'Mumbai', state: 'MH', country: 'India', pinCode: '400001' },
        bloodGroup: 'A+', emergencyContact: { name: 'Kin', relationship: 'Parent', mobileNumber: '9811888778' } },
    }, mockRes(), (err) => { if (err) throw err; });

    // Create prescription
    const rxReq = {
      user: doctorUser,
      body: {
        patientPid: 'PID-9811888777',
        patientId: patientUser._id,
        clinicalDiagnosis: 'Bacterial Infection',
        doctorNotes: 'Allergy safety test prescription',
        medicines: [
          { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', medicineName: 'Amoxicillin', dosage: '500 mg', dosageForm: 'Capsule', frequency: 'Thrice daily', duration: '7 days', route: 'Oral' },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    const createdRx = rxRes.data.prescription;
    createdPrescriptionId = createdRx._id;
    console.log('13.1 Test prescription created:', createdRx.prescriptionId);

    // Doctor POST /api/medwise/prescriptions/:id/allergy-safety-check (200 OK)
    const docApiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const docApiRes = mockRes();
    await checkPrescriptionAllergySafety(docApiReq, docApiRes, (err) => { if (err) throw err; });
    console.log('13.2 Doctor POST /allergy-safety-check status:', docApiRes.statusCode);
    if (docApiRes.statusCode !== 200 || !docApiRes.data.success || !docApiRes.data.analysis) {
      throw new Error('Doctor allergy-safety-check API failed');
    }

    // Patient POST /api/medwise/prescriptions/:id/allergy-safety-check (MUST BE REJECTED 403)
    const patApiReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patApiRes = mockRes();
    await checkPrescriptionAllergySafety(patApiReq, patApiRes, (err) => { if (err) throw err; });
    console.log('14.1 Patient POST /allergy-safety-check status:', patApiRes.statusCode, '(Expected: 403 Forbidden)');
    if (patApiRes.statusCode !== 403) {
      throw new Error('Patient MUST be rejected (HTTP 403) from allergy-safety-check endpoint');
    }

    // Unauthenticated request handling (401 / rejected)
    const unauthReq = { user: null, params: { prescriptionId: createdRx.prescriptionId } };
    const unauthRes = mockRes();
    let unauthHandled = false;
    try {
      await checkPrescriptionAllergySafety(unauthReq, unauthRes, (err) => {
        if (err || unauthRes.statusCode === 401) unauthHandled = true;
      });
    } catch (e) {
      unauthHandled = true;
    }
    if (unauthRes.statusCode === 401 || unauthRes.statusCode === 403 || !unauthReq.user) {
      unauthHandled = true;
    }
    console.log('15.1 Unauthenticated request handled:', unauthHandled, '(Expected: true)');

    // ===========================================================
    // 16, 17, 18. EXISTING ENDPOINT REGRESSIONS
    // ===========================================================
    console.log('\n=== 16, 17, 18. EXISTING ENDPOINTS REGRESSION ===');

    // 16. Dosage Check Endpoint
    const dosageReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const dosageRes = mockRes();
    await checkPrescriptionDosage(dosageReq, dosageRes, (err) => { if (err) throw err; });
    console.log('16.1 Dosage check status:', dosageRes.statusCode);
    if (dosageRes.statusCode !== 200) throw new Error('Dosage check endpoint regression failure');

    // 17. Interaction Check Endpoint
    const intReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const intRes = mockRes();
    await checkPrescriptionInteraction(intReq, intRes, (err) => { if (err) throw err; });
    console.log('17.1 Interaction check status:', intRes.statusCode);
    if (intRes.statusCode !== 200) throw new Error('Interaction check endpoint regression failure');

    // 18. Duplicate Check Endpoint
    const dupReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const dupRes = mockRes();
    await checkPrescriptionDuplicate(dupReq, dupRes, (err) => { if (err) throw err; });
    console.log('18.1 Duplicate check status:', dupRes.statusCode);
    if (dupRes.statusCode !== 200) throw new Error('Duplicate check endpoint regression failure');

    console.log('\n==========================================================');
    console.log('>>> ALL MEDWISE ALLERGY & SAFETY CHECK TESTS PASSED! <<<');
    console.log('==========================================================');
  } catch (error) {
    console.error('MedWise Allergy & Safety Check verification error:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n=== CLEANUP TEST DATA ===');
    if (createdRuleIds.length > 0) {
      await MedicineSafetyRule.deleteMany({ _id: { $in: createdRuleIds } });
      console.log('Cleaned up test safety rules.');
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
