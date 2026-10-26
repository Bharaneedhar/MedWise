const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const Consultation = require('../src/models/Consultation');
const {
  getMyConsultations,
  createConsultation,
  getConsultationById,
  updateConsultation,
} = require('../src/controllers/consultationController');

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
    console.log('Connected to DB for Consultations Module verification.\n');

    const timestamp = Date.now();

    // 1. CREATE TEST USERS (Doctor, Patient A, Patient B, Pharmacist)
    const docUser = await User.create({
      name: 'Dr. Sarah Jenkins',
      email: `consult.doc.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });

    const patientA = await User.create({
      name: 'Abinaya S',
      email: `consult.patientA.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });

    const patientB = await User.create({
      name: 'Ravi Kumar',
      email: `consult.patientB.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });

    const pharmUser = await User.create({
      name: 'Alex Pharmacist',
      email: `consult.pharm.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'pharmacist',
    });

    // 2. TEST EMPTY STATE (Patient A has 0 consultations)
    console.log('=== 1. TEST PATIENT WITH 0 CONSULTATIONS ===');
    const req1 = { user: patientA };
    const res1 = mockRes();
    await getMyConsultations(req1, res1, (err) => { if (err) throw err; });
    console.log('1.1 Empty State Count:', res1.data.count, '(Expected: 0)');
    console.log('    Consultations array:', res1.data.consultations.length);
    if (res1.data.count !== 0 || res1.data.consultations.length !== 0) {
      throw new Error('Initial consultations must be empty');
    }

    // 3. TEST DOCTOR CREATING A CONSULTATION FOR PATIENT A
    console.log('\n=== 2. TEST DOCTOR CREATING CONSULTATION FOR PATIENT A ===');
    const createReq = {
      user: docUser,
      body: {
        patientId: patientA._id,
        patientPid: 'PID-9876543210',
        doctorSpecialization: 'Cardiology',
        hospitalClinicName: 'Apollo Speciality Hospital',
        hospitalClinicLocation: 'Bengaluru, Karnataka',
        consultationDate: new Date('2026-08-20'),
        consultationType: 'In-person',
        reasonForVisit: 'Routine cardiac follow-up and blood pressure check',
        diagnosisNotes: 'Stage 1 hypertension, well controlled. Normal sinus rhythm.',
        doctorRecommendations: 'Continue Amlodipine 5mg once daily. Reduce sodium intake. Follow-up in 3 months.',
        followUpDate: new Date('2026-11-20'),
        status: 'Completed',
      },
    };
    const createRes = mockRes();
    await createConsultation(createReq, createRes, (err) => { if (err) throw err; });
    console.log('2.1 Consultation Created:', createRes.statusCode, createRes.data.message);
    if (createRes.statusCode !== 201) throw new Error('Failed to create consultation record');
    const consultationId = createRes.data.consultation._id;

    // 4. TEST PATIENT A FETCHING CONSULTATIONS
    console.log('\n=== 3. TEST PATIENT A FETCHING THEIR CONSULTATION ===');
    const req2 = { user: patientA };
    const res2 = mockRes();
    await getMyConsultations(req2, res2, (err) => { if (err) throw err; });
    console.log('3.1 Patient A Consultations count:', res2.data.count, '(Expected: 1)');
    const c = res2.data.consultations[0];
    console.log('    - Doctor:', c.doctorName);
    console.log('    - Specialization:', c.doctorSpecialization);
    console.log('    - Reason:', c.reasonForVisit);
    console.log('    - Diagnosis:', c.diagnosisNotes);
    console.log('    - Recommendations:', c.doctorRecommendations);
    console.log('    - Status:', c.status);
    console.log('    - Type:', c.consultationType);
    if (res2.data.count !== 1 || c.doctorName !== 'Dr. Sarah Jenkins' || c.status !== 'Completed') {
      throw new Error('Patient A consultation data mismatch');
    }

    // 5. TEST DATA ISOLATION (Patient B cannot see Patient A's consultation)
    console.log('\n=== 4. TEST DATA ISOLATION (PATIENT B) ===');
    const req3 = { user: patientB };
    const res3 = mockRes();
    await getMyConsultations(req3, res3, (err) => { if (err) throw err; });
    console.log('4.1 Patient B Consultations count:', res3.data.count, '(Expected: 0)');
    if (res3.data.count !== 0) throw new Error('Patient B must NOT see Patient A consultations');

    // 6. TEST AUTHORIZATION: PATIENT CANNOT CREATE CONSULTATIONS
    console.log('\n=== 5. TEST AUTHORIZATION (PATIENT CANNOT CREATE) ===');
    const patCreateReq = { user: patientA, body: { patientId: patientA._id, reasonForVisit: 'Test' } };
    const patCreateRes = mockRes();
    await createConsultation(patCreateReq, patCreateRes, (err) => { if (err) throw err; });
    console.log('5.1 Patient POST /api/consultations:', patCreateRes.statusCode, patCreateRes.data.message);
    if (patCreateRes.statusCode !== 403) throw new Error('Patients must NOT be allowed to create consultations');

    // 7. TEST PHARMACIST ACCESS RESTRICTION
    console.log('\n=== 6. TEST PHARMACIST ACCESS RESTRICTION ===');
    const pharmReq = { user: pharmUser };
    const pharmRes = mockRes();
    await getMyConsultations(pharmReq, pharmRes, (err) => { if (err) throw err; });
    console.log('6.1 Pharmacist GET /api/consultations/my:', pharmRes.statusCode, pharmRes.data.message);
    if (pharmRes.statusCode !== 403) throw new Error('Pharmacists must NOT access patient consultations');

    // 8. TEST GET BY ID AND UPDATE BY ID
    console.log('\n=== 7. TEST GET BY ID & UPDATE BY ID ===');
    const getByIdReq = { user: docUser, params: { id: consultationId.toString() } };
    const getByIdRes = mockRes();
    await getConsultationById(getByIdReq, getByIdRes, (err) => { if (err) throw err; });
    console.log('7.1 Doctor GET /api/consultations/:id:', getByIdRes.statusCode, getByIdRes.data.consultation.reasonForVisit);
    if (getByIdRes.statusCode !== 200 || !getByIdRes.data.consultation) throw new Error('GET /api/consultations/:id failed');

    const updateReq = {
      user: docUser,
      params: { id: consultationId.toString() },
      body: {
        reasonForVisit: 'Updated Hypertension Follow-up',
        clinicalNotes: 'Patient reports BP improved after lifestyle changes.',
        status: 'Completed',
      },
    };
    const updateRes = mockRes();
    await updateConsultation(updateReq, updateRes, (err) => { if (err) throw err; });
    console.log('7.2 Doctor PUT /api/consultations/:id:', updateRes.statusCode, updateRes.data.message);
    if (updateRes.statusCode !== 200 || updateRes.data.consultation.reasonForVisit !== 'Updated Hypertension Follow-up') {
      throw new Error('PUT /api/consultations/:id failed');
    }

    // Clean up
    await User.deleteMany({ _id: { $in: [docUser._id, patientA._id, patientB._id, pharmUser._id] } });
    await Consultation.deleteMany({ _id: consultationId });
    console.log('\nTest cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL CONSULTATIONS FULL-STACK TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
};

runTest();
