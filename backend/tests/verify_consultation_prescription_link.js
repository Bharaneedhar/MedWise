const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const { createConsultation, getConsultationById } = require('../src/controllers/consultationController');
const { createPrescription, getPrescriptionById } = require('../src/controllers/prescriptionController');

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
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdPrescriptionIds = [];

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Consultation-Prescription Linking Verification.\n');

    const timestamp = Date.now();

    // 1. SETUP TEST USERS & PATIENT PROFILES
    console.log('=== 1. CREATING TEST USERS & PATIENT PROFILES ===');
    const doctorA = await User.create({
      name: 'Dr. Alice Smith',
      email: `doc.alice.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorA._id);

    const doctorB = await User.create({
      name: 'Dr. Bob Jones',
      email: `doc.bob.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorB._id);

    const patientX = await User.create({
      name: 'Patient Xavier',
      email: `pat.x.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientX._id);

    const mobileX = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const pidX = `PID-${mobileX}`;

    const profileX = await PatientProfile.create({
      userId: patientX._id,
      patientPid: pidX,
      mobileNumber: mobileX,
      gender: 'Male',
      dateOfBirth: new Date('1980-05-15'),
    });
    createdProfileIds.push(profileX._id);

    const patientY = await User.create({
      name: 'Patient Yvonne',
      email: `pat.y.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientY._id);

    const mobileY = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const pidY = `PID-${mobileY}`;

    const profileY = await PatientProfile.create({
      userId: patientY._id,
      patientPid: pidY,
      mobileNumber: mobileY,
      gender: 'Female',
      dateOfBirth: new Date('1992-09-20'),
    });
    createdProfileIds.push(profileY._id);

    console.log('Users and Profiles created successfully.');

    // 2. CREATE A CLINICAL CONSULTATION (Doctor A -> Patient X)
    console.log('\n=== 2. CREATING CLINICAL CONSULTATION (Doctor A -> Patient X) ===');
    const consultReq = {
      user: doctorA,
      body: {
        patientId: patientX._id,
        patientPid: pidX,
        doctorSpecialization: 'Cardiology',
        hospitalClinicName: 'City General Hospital',
        hospitalClinicLocation: 'Metro City',
        consultationDate: new Date(),
        consultationType: 'In-person',
        reasonForVisit: 'Hypertension evaluation',
        clinicalNotes: 'Patient reports persistent headache and elevated blood pressure readings.',
        diagnosisAssessment: 'Essential Hypertension (Stage 1)',
        doctorRecommendations: 'Initiate antihypertensive therapy.',
        status: 'Completed',
      },
    };
    const consultRes = mockRes();
    await createConsultation(consultReq, consultRes, (err) => { if (err) throw err; });

    if (consultRes.statusCode !== 201) {
      throw new Error(`Consultation creation failed with status ${consultRes.statusCode}: ${JSON.stringify(consultRes.data)}`);
    }

    const consultationId = consultRes.data.consultation._id;
    createdConsultationIds.push(consultationId);
    console.log('Consultation created with ID:', consultationId);

    // 3. CREATE LINKED PRESCRIPTION (Doctor A -> Patient X, with consultationId)
    console.log('\n=== 3. CREATING LINKED PRESCRIPTION (Doctor A -> Patient X with consultationId) ===');
    const rxReq = {
      user: doctorA,
      body: {
        patientId: patientX._id,
        patientPid: pidX,
        patientName: 'Patient Xavier',
        patientAge: 45,
        patientGender: 'Male',
        consultationId: consultationId.toString(),
        clinicalDiagnosis: 'Essential Hypertension (Stage 1)',
        doctorNotes: 'Take medication with water in the morning.',
        medicines: [
          {
            medicineName: 'Amlodipine',
            dosage: '5mg',
            frequency: '1-0-0',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take once daily in the morning',
          },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });

    if (rxRes.statusCode !== 201) {
      throw new Error(`Prescription creation failed with status ${rxRes.statusCode}: ${JSON.stringify(rxRes.data)}`);
    }

    const prescriptionId = rxRes.data.prescription._id;
    createdPrescriptionIds.push(prescriptionId);
    console.log('Prescription created with ID:', prescriptionId);

    // 4. VERIFY BI-DIRECTIONAL DATABASE LINKING
    console.log('\n=== 4. VERIFYING BI-DIRECTIONAL DATABASE LINKING ===');
    const savedRx = await Prescription.findById(prescriptionId);
    const savedConsult = await Consultation.findById(consultationId);

    console.log('Prescription.consultationId:', savedRx.consultationId ? savedRx.consultationId.toString() : null);
    console.log('Consultation.prescriptionId:', savedConsult.prescriptionId ? savedConsult.prescriptionId.toString() : null);

    if (!savedRx.consultationId || savedRx.consultationId.toString() !== consultationId.toString()) {
      throw new Error('Bi-directional linking failed: Prescription.consultationId does not match Consultation ID');
    }

    if (!savedConsult.prescriptionId || savedConsult.prescriptionId.toString() !== prescriptionId.toString()) {
      throw new Error('Bi-directional linking failed: Consultation.prescriptionId does not match Prescription ID');
    }

    console.log('PASS: Bi-directional DB linking verified successfully.');

    // 5. VERIFY POPULATED GET ENDPOINTS
    console.log('\n=== 5. VERIFYING POPULATED GET ENDPOINTS ===');
    // 5.1 GET Prescription by ID
    const getRxReq = { user: doctorA, params: { prescriptionId: prescriptionId.toString() } };
    const getRxRes = mockRes();
    await getPrescriptionById(getRxReq, getRxRes, (err) => { if (err) throw err; });

    const popRx = getRxRes.data.prescription;
    console.log('GET Prescription consultationId populated object check:');
    console.log('  Reason for visit:', popRx.consultationId?.reasonForVisit);
    console.log('  Diagnosis assessment:', popRx.consultationId?.diagnosisAssessment);
    if (!popRx.consultationId || typeof popRx.consultationId !== 'object' || popRx.consultationId.reasonForVisit !== 'Hypertension evaluation') {
      throw new Error('GET Prescription by ID failed to populate consultationId');
    }

    // 5.2 GET Consultation by ID
    const getConsultReq = { user: doctorA, params: { consultationId: consultationId.toString() } };
    const getConsultRes = mockRes();
    await getConsultationById(getConsultReq, getConsultRes, (err) => { if (err) throw err; });

    const popConsult = getConsultRes.data.consultation;
    console.log('GET Consultation prescriptionId populated object check:');
    console.log('  Prescription ID string:', popConsult.prescriptionId?.prescriptionId);
    console.log('  Status:', popConsult.prescriptionId?.status);
    if (!popConsult.prescriptionId || typeof popConsult.prescriptionId !== 'object' || !popConsult.prescriptionId.prescriptionId) {
      throw new Error('GET Consultation by ID failed to populate prescriptionId');
    }

    console.log('PASS: Populated GET endpoints verified successfully.');

    // 6. VERIFY SECURITY / AUTHORIZATION REJECTIONS
    console.log('\n=== 6. VERIFYING SECURITY & AUTHORIZATION REJECTIONS ===');
    // 6.1 Doctor B attempting to create prescription with Doctor A's consultationId -> HTTP 403
    const badDoctorRxReq = {
      user: doctorB,
      body: {
        patientId: patientX._id,
        patientPid: pidX,
        patientName: 'Patient Xavier',
        consultationId: consultationId.toString(),
        medicines: [{ medicineName: 'Amlodipine', dosage: '5mg' }],
      },
    };
    const badDoctorRxRes = mockRes();
    await createPrescription(badDoctorRxReq, badDoctorRxRes, (err) => { if (err) throw err; });
    console.log('6.1 Doctor ownership rejection status:', badDoctorRxRes.statusCode, `(Expected: 403)`);
    if (badDoctorRxRes.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 when different doctor attempts to link consultation, got ${badDoctorRxRes.statusCode}`);
    }

    // 6.2 Doctor A attempting to create prescription for Patient Y using Patient X's consultationId -> HTTP 400
    const badPatientRxReq = {
      user: doctorA,
      body: {
        patientId: patientY._id,
        patientPid: pidY,
        patientName: 'Patient Yvonne',
        consultationId: consultationId.toString(),
        medicines: [{ medicineName: 'Amlodipine', dosage: '5mg' }],
      },
    };
    const badPatientRxRes = mockRes();
    await createPrescription(badPatientRxReq, badPatientRxRes, (err) => { if (err) throw err; });
    console.log('6.2 Patient mismatch rejection status:', badPatientRxRes.statusCode, `(Expected: 400)`);
    if (badPatientRxRes.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 when patient does not match consultation, got ${badPatientRxRes.statusCode}`);
    }

    console.log('PASS: Security & authorization checks enforced correctly.');

    // 7. VERIFY BACKWARD COMPATIBILITY (Unlinked Prescriptions)
    console.log('\n=== 7. VERIFYING BACKWARD COMPATIBILITY (UNLINKED PRESCRIPTIONS) ===');
    const unlinkedRxReq = {
      user: doctorA,
      body: {
        patientId: patientX._id,
        patientPid: pidX,
        patientName: 'Patient Xavier',
        medicines: [{ medicineName: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '5 days' }],
      },
    };
    const unlinkedRxRes = mockRes();
    await createPrescription(unlinkedRxReq, unlinkedRxRes, (err) => { if (err) throw err; });
    if (unlinkedRxRes.statusCode !== 201) {
      throw new Error(`Unlinked prescription creation failed with status ${unlinkedRxRes.statusCode}`);
    }

    const unlinkedRxId = unlinkedRxRes.data.prescription._id;
    createdPrescriptionIds.push(unlinkedRxId);
    console.log('Unlinked prescription created successfully with ID:', unlinkedRxId);

    const savedUnlinkedRx = await Prescription.findById(unlinkedRxId);
    if (savedUnlinkedRx.consultationId !== null && savedUnlinkedRx.consultationId !== undefined) {
      throw new Error('Unlinked prescription consultationId should be null or undefined');
    }

    console.log('PASS: Backward compatibility for unlinked prescriptions verified.');

    console.log('\n========================================================');
    console.log('ALL PHASE 4.4 CONSULTATION ↔ PRESCRIPTION TESTS PASSED!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    console.log('Cleaning up test documents from database...');
    try {
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
    process.exit(0);
  }
};

runTest();
