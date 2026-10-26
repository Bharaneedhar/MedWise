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
  checkPrescriptionAllergySafety,
  analyzePrescription,
} = require('../src/controllers/medwiseController');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const { aggregatePrescriptionAudit } = require('../src/services/medwise/prescriptionAuditService');

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
  let createdUserIds = [];
  let createdPrescriptionId = null;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Prescription Audit verification.\n');

    const timestamp = Date.now();

    // ===========================================================
    // 1. SERVICE FUNCTION LOADED
    // ===========================================================
    console.log('=== 1. SERVICE FUNCTION LOADED ===');
    console.log('1.1 aggregatePrescriptionAudit loaded:', typeof aggregatePrescriptionAudit === 'function');
    if (typeof aggregatePrescriptionAudit !== 'function') {
      throw new Error('aggregatePrescriptionAudit is not a function');
    }

    // ===========================================================
    // 2. EMPTY / NO CONCERN RESULTS -> CLEARED
    // ===========================================================
    console.log('\n=== 2. NO CONCERN RESULTS ===');
    const emptyChecks = {
      dosage: [{ status: 'within_guidance', severity: 'info', genericName: 'Paracetamol', message: 'OK' }],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    };
    const emptyRes = aggregatePrescriptionAudit(emptyChecks);
    console.log('2.1 Audit findings length:', emptyRes.audit.findings.length);
    console.log('2.2 Recommendation status:', emptyRes.overallRecommendation.status, '| message:', emptyRes.overallRecommendation.message);
    if (emptyRes.audit.findings.length !== 0) throw new Error('Expected 0 audit findings for clear checks');
    if (emptyRes.overallRecommendation.status !== 'cleared' || emptyRes.overallRecommendation.severity !== 'info') {
      throw new Error('Expected cleared status and info severity for clear checks');
    }
    if (emptyRes.overallRecommendation.message !== 'MedWise review completed with no identified concerns.') {
      throw new Error('Unexpected cleared message string');
    }

    // ===========================================================
    // 3. DOSAGE REVIEW FINDING -> REVIEW REQUIRED (WARNING)
    // ===========================================================
    console.log('\n=== 3. DOSAGE REVIEW FINDING ===');
    const dosageCheckRx = {
      dosage: [{ status: 'review_required', severity: 'warning', genericName: 'Paracetamol', message: 'Exceeds single max dose.' }],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    };
    const dosageAuditRes = aggregatePrescriptionAudit(dosageCheckRx);
    console.log('3.1 Audit findings count:', dosageAuditRes.audit.findings.length, '| source:', dosageAuditRes.audit.findings[0].source);
    console.log('3.2 Recommendation status:', dosageAuditRes.overallRecommendation.status, '| severity:', dosageAuditRes.overallRecommendation.severity);
    if (dosageAuditRes.audit.findings.length !== 1 || dosageAuditRes.overallRecommendation.status !== 'review_required') {
      throw new Error('Dosage review finding must trigger review_required status');
    }

    // ===========================================================
    // 4. INTERACTION FINDING -> REVIEW REQUIRED
    // ===========================================================
    console.log('\n=== 4. DRUG INTERACTION FINDING ===');
    const intCheckRx = {
      dosage: [],
      interactions: {
        status: 'completed',
        findings: [{ status: 'interaction_flagged', severity: 'Moderate', message: 'Moderate interaction detected.', medicineA: { genericName: 'MedA' }, medicineB: { genericName: 'MedB' } }],
      },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    };
    const intAuditRes = aggregatePrescriptionAudit(intCheckRx);
    console.log('4.1 Audit findings count:', intAuditRes.audit.findings.length, '| source:', intAuditRes.audit.findings[0].source);
    console.log('4.2 Recommendation status:', intAuditRes.overallRecommendation.status, '| severity:', intAuditRes.overallRecommendation.severity);
    if (intAuditRes.audit.findings.length !== 1 || intAuditRes.overallRecommendation.status !== 'review_required') {
      throw new Error('Interaction finding must trigger review_required status');
    }

    // ===========================================================
    // 5. DUPLICATE FINDING -> REVIEW REQUIRED
    // ===========================================================
    console.log('\n=== 5. DUPLICATE MEDICATION FINDING ===');
    const dupCheckRx = {
      dosage: [],
      interactions: { status: 'completed', findings: [] },
      duplicates: {
        status: 'duplicates_detected',
        findings: [{ status: 'duplicate_found', severity: 'HIGH', duplicateType: 'EXACT_MEDICINE', message: 'Exact duplicate medicine.', medicineA: { genericName: 'MedA' }, medicineB: { genericName: 'MedA' } }],
      },
      allergySafety: { status: 'completed', findings: [] },
    };
    const dupAuditRes = aggregatePrescriptionAudit(dupCheckRx);
    console.log('5.1 Audit findings count:', dupAuditRes.audit.findings.length, '| source:', dupAuditRes.audit.findings[0].source);
    console.log('5.2 Recommendation status:', dupAuditRes.overallRecommendation.status, '| severity:', dupAuditRes.overallRecommendation.severity);
    if (dupAuditRes.audit.findings.length !== 1 || dupAuditRes.overallRecommendation.status !== 'review_required') {
      throw new Error('Duplicate finding must trigger review_required status');
    }

    // ===========================================================
    // 6. ALLERGY / SAFETY FINDING -> REVIEW REQUIRED
    // ===========================================================
    console.log('\n=== 6. ALLERGY / SAFETY FINDING ===');
    const allergyCheckRx = {
      dosage: [],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: {
        status: 'safety_concerns_detected',
        findings: [{ type: 'allergy', status: 'allergy_risk', severity: 'Life-Threatening', message: 'Life-threatening allergen match.', medicine: { genericName: 'Amoxicillin' } }],
      },
    };
    const allergyAuditRes = aggregatePrescriptionAudit(allergyCheckRx);
    console.log('6.1 Audit findings count:', allergyAuditRes.audit.findings.length, '| source:', allergyAuditRes.audit.findings[0].source);
    console.log('6.2 Recommendation status:', allergyAuditRes.overallRecommendation.status, '| severity:', allergyAuditRes.overallRecommendation.severity);
    if (allergyAuditRes.audit.findings.length !== 1 || allergyAuditRes.overallRecommendation.status !== 'review_required') {
      throw new Error('Allergy finding must trigger review_required status');
    }

    // ===========================================================
    // 7. CRITICAL / HIGH-RISK FINDING -> CRITICAL SEVERITY
    // ===========================================================
    console.log('\n=== 7. CRITICAL / HIGH-RISK SEVERITY ===');
    if (allergyAuditRes.overallRecommendation.severity !== 'critical') {
      throw new Error('Life-Threatening allergy finding MUST trigger critical severity');
    }
    console.log('7.1 Critical severity verified correctly:', allergyAuditRes.overallRecommendation.severity);

    // ===========================================================
    // 8. MULTIPLE FINDINGS & DEDUPING
    // ===========================================================
    console.log('\n=== 8. MULTIPLE FINDINGS & DEDUPING ===');
    const multiCheckRx = {
      dosage: [{ status: 'review_required', severity: 'warning', genericName: 'Paracetamol', message: 'Exceeds daily max.' }],
      interactions: {
        status: 'completed',
        findings: [{ status: 'interaction_flagged', severity: 'Contraindicated', message: 'Contraindicated pair.', medicineA: { genericName: 'Paracetamol' }, medicineB: { genericName: 'Warfarin' } }],
      },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    };
    const multiAuditRes = aggregatePrescriptionAudit(multiCheckRx);
    console.log('8.1 Total audit findings:', multiAuditRes.audit.summary.totalFindings, '| critical:', multiAuditRes.audit.summary.criticalFindings, '| warning:', multiAuditRes.audit.summary.warningFindings);
    console.log('8.2 Recommendation severity:', multiAuditRes.overallRecommendation.severity, '(Expected: critical)');
    if (multiAuditRes.audit.summary.totalFindings !== 2 || multiAuditRes.overallRecommendation.severity !== 'critical') {
      throw new Error('Multiple findings aggregation failed or critical severity not promoted');
    }

    // ===========================================================
    // 9 & 12. UNABLE TO ASSESS (DATA MISSING, NO SAFETY FAILURE)
    // ===========================================================
    console.log('\n=== 9 & 12. UNABLE TO ASSESS (MISSING INFO) ===');
    const unassessRx = {
      dosage: [{ status: 'within_guidance', severity: 'info', genericName: 'Paracetamol' }],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: {
        status: 'unable_to_assess',
        findings: [{ type: 'allergy', status: 'unable_to_assess', severity: 'UNKNOWN', message: 'Patient allergy info missing.', medicine: { genericName: 'Paracetamol' } }],
      },
    };
    const unassessAuditRes = aggregatePrescriptionAudit(unassessRx);
    console.log('9.1 Recommendation status:', unassessAuditRes.overallRecommendation.status, '| severity:', unassessAuditRes.overallRecommendation.severity);
    console.log('9.2 Message:', unassessAuditRes.overallRecommendation.message);
    if (unassessAuditRes.overallRecommendation.status !== 'unable_to_assess') {
      throw new Error('Missing allergy info with no other concerns MUST yield unable_to_assess status');
    }

    // ===========================================================
    // 10. MIXED FINDINGS — STRONGEST RECOMMENDATION WINS
    // ===========================================================
    console.log('\n=== 10. MIXED FINDINGS (PRIORITY RULES) ===');
    const mixedRx = {
      dosage: [{ status: 'unable_to_assess', severity: 'info', genericName: 'DrugX' }],
      interactions: {
        status: 'completed',
        findings: [{ status: 'interaction_flagged', severity: 'Major', message: 'Major interaction.', medicineA: { genericName: 'DrugX' }, medicineB: { genericName: 'DrugY' } }],
      },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    };
    const mixedAuditRes = aggregatePrescriptionAudit(mixedRx);
    console.log('10.1 Mixed findings recommendation status:', mixedAuditRes.overallRecommendation.status, '| severity:', mixedAuditRes.overallRecommendation.severity);
    if (mixedAuditRes.overallRecommendation.status !== 'review_required' || mixedAuditRes.overallRecommendation.severity !== 'critical') {
      throw new Error('Major interaction MUST override unable_to_assess to yield review_required with critical severity');
    }

    // ===========================================================
    // 13. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS
    // ===========================================================
    console.log('\n=== 13. FULL ENGINE analyzeFullPrescription STRUCTURE ASSERTIONS ===');
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });

    if (!paracetamol || !amoxicillin) {
      throw new Error('Paracetamol or Amoxicillin not found in master DB');
    }

    const fullEngineRx = {
      prescriptionId: 'TEST-AUDIT-001',
      patientAge: 35,
      patientGender: 'Male',
      medicines: [
        { medicineId: String(paracetamol._id), genericName: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily' },
        { medicineId: String(amoxicillin._id), genericName: 'Amoxicillin', dosage: '500 mg', frequency: 'Thrice daily' },
      ],
    };
    const engineOutput = await MedwiseEngine.analyzeFullPrescription(fullEngineRx);
    console.log('13.1 checks.dosage length:', engineOutput.checks.dosage.length);
    console.log('13.2 checks.interactions status:', engineOutput.checks.interactions.status);
    console.log('13.3 checks.duplicates status:', engineOutput.checks.duplicates.status);
    console.log('13.4 checks.allergySafety status:', engineOutput.checks.allergySafety.status);
    console.log('13.5 audit status:', engineOutput.audit.status, '| total findings:', engineOutput.audit.summary.totalFindings);
    console.log('13.6 overallRecommendation status:', engineOutput.overallRecommendation.status, '| message:', engineOutput.overallRecommendation.message);

    // Strict structural assertions
    if (!Array.isArray(engineOutput.checks.dosage)) throw new Error('checks.dosage MUST be an array');
    if (!engineOutput.checks.interactions) throw new Error('checks.interactions MUST be populated');
    if (!engineOutput.checks.duplicates) throw new Error('checks.duplicates MUST be populated');
    if (!engineOutput.checks.allergySafety) throw new Error('checks.allergySafety MUST be populated');
    if (!engineOutput.audit || engineOutput.audit.status !== 'completed') throw new Error('audit MUST be populated with status completed');
    if (!engineOutput.overallRecommendation || !engineOutput.overallRecommendation.status || !engineOutput.overallRecommendation.message) {
      throw new Error('overallRecommendation MUST be populated with status and message');
    }

    // ===========================================================
    // 14. API AUTHORIZATION TESTS
    // ===========================================================
    console.log('\n=== 14. API AUTHORIZATION TESTS ===');

    // Register doctor
    const docRegReq = { body: { name: 'Dr. Audit Tester', email: 'doc.audit.' + timestamp + '@medwise.com', password: 'password123', role: 'doctor' } };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);
    createdUserIds.push(doctorUser._id);

    await createOrUpdateMyProfile({ user: doctorUser, body: { name: 'Dr. Audit Tester', mobileNumber: '9840777666', specialization: 'Internal Medicine' } }, mockRes(), (err) => { if (err) throw err; });

    // Register patient
    const patRegReq = { body: { name: 'Audit Patient', email: 'patient.audit.' + timestamp + '@medwise.com', password: 'password123', role: 'patient' } };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);
    createdUserIds.push(patientUser._id);

    await createOrUpdateMyProfile({
      user: patientUser,
      body: { name: 'Audit Patient', mobileNumber: '9811777666', dateOfBirth: '1988-08-08', gender: 'Female',
        address: { addressLine1: 'Audit St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
        bloodGroup: 'B+', emergencyContact: { name: 'Kin', relationship: 'Parent', mobileNumber: '9811777667' } },
    }, mockRes(), (err) => { if (err) throw err; });

    // Create prescription
    const rxReq = {
      user: doctorUser,
      body: {
        patientPid: 'PID-9811777666',
        patientId: patientUser._id,
        clinicalDiagnosis: 'Fever evaluation',
        doctorNotes: 'Audit test prescription',
        medicines: [
          { medicineId: String(paracetamol._id), genericName: 'Paracetamol', medicineName: 'Paracetamol', dosage: '500 mg', dosageForm: 'Tablet', frequency: 'Twice daily', duration: '5 days', route: 'Oral' },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    const createdRx = rxRes.data.prescription;
    createdPrescriptionId = createdRx._id;
    console.log('14.1 Test prescription created:', createdRx.prescriptionId);

    // 14.2 Doctor POST /api/medwise/prescriptions/:id/analyze (200 OK)
    const docApiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const docApiRes = mockRes();
    await analyzePrescription(docApiReq, docApiRes, (err) => { if (err) throw err; });
    console.log('14.2 Doctor POST /analyze status:', docApiRes.statusCode);
    if (docApiRes.statusCode !== 200 || !docApiRes.data.success || !docApiRes.data.analysis) {
      throw new Error('Doctor analyze API failed');
    }
    console.log('     audit total findings:', docApiRes.data.analysis.audit.summary.totalFindings);
    console.log('     overallRecommendation status:', docApiRes.data.analysis.overallRecommendation.status);

    // 14.3 Patient POST /api/medwise/prescriptions/:id/analyze (MUST BE REJECTED 403)
    const patApiReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patApiRes = mockRes();
    await analyzePrescription(patApiReq, patApiRes, (err) => { if (err) throw err; });
    console.log('14.3 Patient POST /analyze status:', patApiRes.statusCode, '(Expected: 403 Forbidden)');
    if (patApiRes.statusCode !== 403) {
      throw new Error('Patient MUST be rejected (HTTP 403) from analyze endpoint');
    }

    // 14.4 Existing individual endpoints still pass authorization (dosage, interaction, duplicate, allergySafety)
    const dosageRes = mockRes();
    await checkPrescriptionDosage(docApiReq, dosageRes, (err) => { if (err) throw err; });
    if (dosageRes.statusCode !== 200) throw new Error('Dosage check authorization regression');

    const intRes = mockRes();
    await checkPrescriptionInteraction(docApiReq, intRes, (err) => { if (err) throw err; });
    if (intRes.statusCode !== 200) throw new Error('Interaction check authorization regression');

    const dupRes = mockRes();
    await checkPrescriptionDuplicate(docApiReq, dupRes, (err) => { if (err) throw err; });
    if (dupRes.statusCode !== 200) throw new Error('Duplicate check authorization regression');

    const allergyRes = mockRes();
    await checkPrescriptionAllergySafety(docApiReq, allergyRes, (err) => { if (err) throw err; });
    if (allergyRes.statusCode !== 200) throw new Error('Allergy check authorization regression');

    console.log('14.4 All individual endpoint authorization checks passed.');

    console.log('\n==========================================================');
    console.log('>>> ALL MEDWISE PRESCRIPTION AUDIT TESTS PASSED! <<<');
    console.log('==========================================================');
  } catch (error) {
    console.error('MedWise Prescription Audit verification error:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n=== CLEANUP TEST DATA ===');
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
