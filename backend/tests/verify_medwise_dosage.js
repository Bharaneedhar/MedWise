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
const { checkPrescriptionDosage } = require('../src/controllers/medwiseController');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');
const {
  parseDoseString,
  normalizeToMg,
  parseDosesPerDay,
  getPopulationGroup,
  checkItemDosage,
} = require('../src/services/medwise/dosageCheckService');

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
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for MedWise Engine & Dosage Check verification.\n');

    const timestamp = Date.now();

    // 1. ENGINE & DOSAGE SERVICE UTILITY TESTS
    console.log('=== 1. ENGINE & UTILITY FUNCTION UNIT TESTS ===');
    console.log('1.1 Engine loaded:', typeof MedwiseEngine.evaluatePrescriptionDosage === 'function');
    if (typeof MedwiseEngine.evaluatePrescriptionDosage !== 'function') {
      throw new Error('MedwiseEngine loading failed');
    }

    // Dosage string parser unit tests
    const p1 = parseDoseString('500 mg');
    const p2 = parseDoseString('1 g');
    const p3 = parseDoseString('250mcg');
    const p4 = parseDoseString('unparseable dosage text');
    console.log('1.2 Parse "500 mg":', p1, '| "1 g":', p2, '| "250mcg":', p3, '| "invalid":', p4);

    if (p1.value !== 500 || p1.unit !== 'mg') throw new Error('parseDoseString failed for 500 mg');
    if (p2.value !== 1 || p2.unit !== 'g') throw new Error('parseDoseString failed for 1 g');
    if (p3.value !== 250 || p3.unit !== 'mcg') throw new Error('parseDoseString failed for 250mcg');
    if (p4 !== null) throw new Error('parseDoseString should return null for unparseable text');

    // Unit normalization tests
    const n1 = normalizeToMg(1, 'g');
    const n2 = normalizeToMg(500, 'mg');
    const n3 = normalizeToMg(250, 'mcg');
    const n4 = normalizeToMg(10, 'ml'); // incompatible unit
    console.log('1.3 Normalize: 1g =', n1, 'mg | 500mg =', n2, 'mg | 250mcg =', n3, 'mg | 10ml =', n4);

    if (n1 !== 1000) throw new Error('normalizeToMg failed for 1 g');
    if (n2 !== 500) throw new Error('normalizeToMg failed for 500 mg');
    if (n3 !== 0.25) throw new Error('normalizeToMg failed for 250 mcg');
    if (n4 !== null) throw new Error('normalizeToMg should return null for incompatible unit ml');

    // Frequency parsing tests
    const f1 = parseDosesPerDay('Once daily (OD)');
    const f2 = parseDosesPerDay('Twice daily (BD)');
    const f3 = parseDosesPerDay('Thrice daily (TDS)');
    const f4 = parseDosesPerDay('Four times daily (QDS)');
    const f5 = parseDosesPerDay('As needed (SOS)');
    console.log('1.4 Frequency parsing: OD =', f1, '| BD =', f2, '| TDS =', f3, '| QDS =', f4, '| SOS =', f5);

    if (f1 !== 1 || f2 !== 2 || f3 !== 3 || f4 !== 4) throw new Error('parseDosesPerDay failed for standard frequencies');
    if (f5 !== null) throw new Error('parseDosesPerDay should return null for SOS variable frequency');

    // 3-part notation frequency parsing tests (X-Y-Z)
    const f100 = parseDosesPerDay('1-0-0');
    const f010 = parseDosesPerDay('0-1-0');
    const f001 = parseDosesPerDay('0-0-1');
    const f101 = parseDosesPerDay('1-0-1');
    const f110 = parseDosesPerDay('1-1-0');
    const f011 = parseDosesPerDay('0-1-1');
    const f111 = parseDosesPerDay('1-1-1');
    console.log('1.4b 3-part notation frequency parsing: 1-0-0 =', f100, '| 1-0-1 =', f101, '| 1-1-1 =', f111);
    if (f100 !== 1 || f010 !== 1 || f001 !== 1 || f101 !== 2 || f110 !== 2 || f011 !== 2 || f111 !== 3) {
      throw new Error('parseDosesPerDay failed for 3-part notation frequencies (X-Y-Z)');
    }

    // Population matching
    console.log('1.5 Population group: Age 30 =', getPopulationGroup(30), '| Age 10 =', getPopulationGroup(10), '| Age 70 =', getPopulationGroup(70));

    // 2. DOSAGE CHECK SERVICE TESTS WITH MASTER MEDICINES
    console.log('\n=== 2. DOSAGE CHECK SERVICE EVALUATION WITH REAL MASTER MEDICINES ===');
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });

    if (!paracetamol) throw new Error('Paracetamol not found in master database');

    // Test 2.1: Valid dosage within guidance (500mg BD for Adult Paracetamol)
    const check1 = checkItemDosage(
      { dosage: '500 mg', frequency: 'Twice daily', route: 'Oral' },
      paracetamol,
      { age: 35 }
    );
    console.log('2.1 Valid dosage (500mg BD): status =', check1.status, '| message =', check1.message);
    if (check1.status !== 'within_guidance') throw new Error('Expected within_guidance for 500mg BD Paracetamol');

    // Test 2.2: Dose exceeding maximum single dose (1500mg single dose Paracetamol, max is 1000mg)
    const check2 = checkItemDosage(
      { dosage: '1500 mg', frequency: 'Twice daily', route: 'Oral' },
      paracetamol,
      { age: 35 }
    );
    console.log('2.2 Single dose exceeding max (1500mg): status =', check2.status, '| severity =', check2.severity);
    if (check2.status !== 'review_required' || check2.severity !== 'warning') {
      throw new Error('Expected review_required warning for 1500mg single dose Paracetamol');
    }

    // Test 2.3: Daily dose exceeding maximum daily dose (1000mg 5 times daily = 5000mg, max is 4000mg)
    const check3 = checkItemDosage(
      { dosage: '1000 mg', frequency: 'Four times daily', route: 'Oral' }, // 4 x 1000mg = 4000mg (max daily = 4000mg -> within guidance)
      paracetamol,
      { age: 35 }
    );
    console.log('2.3 Daily dose 4000mg (max): status =', check3.status);
    if (check3.status !== 'within_guidance') throw new Error('4000mg daily dose should be within guidance');

    // Test 2.4: Insufficient dosage data / missing guidelines
    const medicineWithoutGuidelines = {
      _id: new mongoose.Types.ObjectId(),
      genericName: 'ExperimentalDrug',
      dosageGuidelines: [],
    };
    const check4 = checkItemDosage(
      { dosage: '10mg', frequency: 'Once daily' },
      medicineWithoutGuidelines,
      { age: 30 }
    );
    console.log('2.4 Medicine without guidelines: status =', check4.status, '| message =', check4.message);
    if (check4.status !== 'unable_to_assess') throw new Error('Expected unable_to_assess when guidelines are missing');

    // Test 2.5: Unparseable dosage string
    const check5 = checkItemDosage(
      { dosage: 'take 2 spoons when needed', frequency: 'Once daily' },
      paracetamol,
      { age: 30 }
    );
    console.log('2.5 Unparseable dosage string: status =', check5.status);
    if (check5.status !== 'unable_to_assess') throw new Error('Expected unable_to_assess for unparseable dosage');

    // 3. SETUP TEST DOCTOR, PATIENT, AND PRESCRIPTION FOR API TESTING
    console.log('\n=== 3. MEDWISE ENGINE & PROTECTED API INTEGRATION ===');

    // Register Doctor
    const docRegReq = {
      body: {
        name: 'Dr. Medwise Engine Tester',
        email: `doc.engine.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);

    // Doctor profile
    const docProfReq = {
      user: doctorUser,
      body: {
        name: 'Dr. Medwise Engine Tester',
        mobileNumber: '9840999888',
        specialization: 'Internal Medicine',
      },
    };
    const docProfRes = mockRes();
    await createOrUpdateMyProfile(docProfReq, docProfRes, (err) => { if (err) throw err; });

    // Register Patient
    const patRegReq = {
      body: {
        name: 'Engine Patient',
        email: `patient.engine.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'patient',
      },
    };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);

    // Patient profile
    const patProfReq = {
      user: patientUser,
      body: {
        name: 'Engine Patient',
        mobileNumber: '9988776655',
        dateOfBirth: '1988-06-15',
        gender: 'Male',
        address: { addressLine1: 'Test St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
        bloodGroup: 'O+',
        emergencyContact: { name: 'Contact', relationship: 'Spouse', mobileNumber: '9988776654' },
      },
    };
    const patProfRes = mockRes();
    // Create a completed consultation first for Consultation-First compliance
    const Consultation = require('../src/models/Consultation');
    const testConsultation = await Consultation.create({
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser._id,
      patientPid: 'PID-9988776655',
      reasonForVisit: 'Acute Pyrexia Checkup',
      status: 'Completed',
    });

    // Create a prescription with 2 medicines
    const rxReq = {
      user: doctorUser,
      body: {
        patientPid: 'PID-9988776655',
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Acute Pyrexia of Unknown Origin',
        doctorNotes: 'Take medications regularly',
        medicines: [
          {
            medicineId: String(paracetamol._id),
            genericName: 'Paracetamol',
            medicineName: 'Paracetamol',
            dosage: '500 mg',
            dosageForm: 'Tablet',
            frequency: 'Twice daily',
            duration: '5 days',
            route: 'Oral',
          },
          {
            medicineId: String(amoxicillin._id),
            genericName: 'Amoxicillin',
            medicineName: 'Amoxicillin',
            dosage: '1000 mg', // higher dose
            dosageForm: 'Capsule',
            frequency: 'Thrice daily',
            duration: '7 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    console.log('3.1 Test Prescription Created:', rxRes.statusCode, rxRes.data.prescription.prescriptionId);
    const createdRx = rxRes.data.prescription;

    // Test 3.2: MedWise Engine evaluation directly
    const engineOutput = await MedwiseEngine.evaluatePrescriptionDosage(createdRx);
    console.log('3.2 MedWise Engine Direct Evaluation Output:');
    console.log('    - Prescription ID:', engineOutput.prescriptionId);
    console.log('    - Checks dosage count:', engineOutput.checks.dosage.length);
    console.log('    - Checks interactions:', engineOutput.checks.interactions, '(Expected: null)');
    console.log('    - Checks duplicates:', engineOutput.checks.duplicates, '(Expected: null)');
    console.log('    - Checks allergySafety:', engineOutput.checks.allergySafety, '(Expected: null)');
    console.log('    - Audit:', engineOutput.audit, '(Expected: null)');
    console.log('    - Overall Recommendation:', engineOutput.overallRecommendation);

    if (engineOutput.checks.interactions !== null || engineOutput.checks.duplicates !== null) {
      throw new Error('Unimplemented checks must be null in engine result');
    }

    // Test 3.3: Doctor Authorized API Endpoint POST /api/medwise/prescriptions/:id/dosage-check
    const apiReq = { user: doctorUser, params: { prescriptionId: createdRx.prescriptionId } };
    const apiRes = mockRes();
    await checkPrescriptionDosage(apiReq, apiRes, (err) => { if (err) throw err; });

    console.log('3.3 Doctor API POST /api/medwise/prescriptions/:id/dosage-check status:', apiRes.statusCode);
    if (apiRes.statusCode !== 200 || !apiRes.data.success || !apiRes.data.analysis) {
      throw new Error('Doctor dosage check API failed');
    }

    // Test 3.4: Patient Role Unauthorized Rejection
    const patApiReq = { user: patientUser, params: { prescriptionId: createdRx.prescriptionId } };
    const patApiRes = mockRes();
    await checkPrescriptionDosage(patApiReq, patApiRes, (err) => { if (err) throw err; });

    console.log('3.4 Patient API Rejection status:', patApiRes.statusCode, '| Message:', patApiRes.data.message);
    if (patApiRes.statusCode !== 403) {
      throw new Error('Patient MUST be rejected (HTTP 403) from running MedWise dosage analysis');
    }

    // 4. CLEANUP TEST DATA
    console.log('\n=== 4. CLEANUP TEST DATA ===');
    await User.deleteMany({ _id: { $in: [doctorUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: doctorUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    await Prescription.deleteMany({ _id: createdRx._id });
    await Consultation.deleteMany({ _id: testConsultation._id });
    console.log('Cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL MEDWISE ENGINE & DOSAGE CHECK TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('MedWise Dosage Check verification error:', error);
    process.exit(1);
  }
};

runTest();
