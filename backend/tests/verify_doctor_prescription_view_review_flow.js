const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const Prescription = require('../src/models/Prescription');
const { getPrescriptions, getPrescriptionById, checkWithMedwise, createPrescription } = require('../src/controllers/prescriptionController');

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

async function testExactFlow() {
  console.log('===========================================================');
  console.log('=== VERIFYING DOCTOR PRESCRIPTION VIEW -> REVIEW FLOW ===');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise');
    console.log('[Setup] Connected to DB.');

    const timestamp = Date.now();

    // 1. Create a doctor user & profile
    const docUser = await User.create({
      name: 'Dr. Test ViewReview',
      email: `test.vr.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
      profileCompleted: true,
    });

    await DoctorProfile.create({
      userId: docUser._id,
      name: docUser.name,
      mobileNumber: '+91 9998887776',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      medicalRegistrationNumber: `REG-${timestamp}`,
      specialization: 'Internal Medicine',
      qualification: 'MD',
      yearsOfExperience: 10,
      hospitalClinicName: 'MedWise General Hospital',
      hospitalClinicAddress: '123 Health Ave',
      address: {
        addressLine1: '123 Health Ave',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pinCode: '560001',
      },
    });

    // 2. Create a patient user & profile
    const patUser = await User.create({
      name: 'John Patient VR',
      email: `john.vr.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
      profileCompleted: true,
    });

    const mobile = `98${String(timestamp).slice(-8)}`;
    const patProfile = await PatientProfile.create({
      userId: patUser._id,
      name: patUser.name,
      mobileNumber: mobile,
      dateOfBirth: '1995-05-05',
      gender: 'Male',
      bloodGroup: 'O+',
      hasNoKnownAllergies: true,
      address: {
        addressLine1: '456 Residency Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pinCode: '560025',
      },
      emergencyContact: {
        name: 'Jane Patient',
        relationship: 'Spouse',
        mobileNumber: '+91 9800000000',
      },
    });

    const pid = `PID-${mobile}`;

    // 3. Create prescription via controller
    const createReq = {
      user: docUser,
      body: {
        patientPid: pid,
        clinicalDiagnosis: 'Hypertension and Chronic Headaches',
        doctorNotes: 'Monitor blood pressure twice daily.',
        medicines: [
          {
            medicineName: 'Amlodipine',
            dosage: '5mg',
            frequency: '1-0-0',
            duration: '30 days',
            route: 'Oral',
            instructions: 'Take after breakfast',
          },
          {
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
            instructions: 'Take as needed for pain',
          },
        ],
      },
    };

    const createRes = mockRes();
    await createPrescription(createReq, createRes, (err) => { if (err) throw err; });
    console.log('Step 1: Prescription Created via API -> status:', createRes.statusCode, 'rxId:', createRes.data.prescription.prescriptionId);

    const createdRx = createRes.data.prescription;
    const mongoRxId = String(createdRx._id);
    const humanRxId = createdRx.prescriptionId;

    // 4. STEP 1 IN UI FLOW — Fetch Prescription List (Doctor Prescriptions page)
    const listReq = { user: docUser };
    const listRes = mockRes();
    await getPrescriptions(listReq, listRes, (err) => { if (err) throw err; });
    console.log('Step 2: Doctor Prescriptions List -> found', listRes.data.prescriptions.length, 'prescriptions.');
    const foundInList = listRes.data.prescriptions.find((p) => String(p._id) === mongoRxId);
    if (!foundInList) throw new Error('Created prescription not found in Doctor Prescriptions list');
    console.log('        Found prescription in list with _id:', foundInList._id, 'and prescriptionId:', foundInList.prescriptionId);

    // 5. STEP 2 IN UI FLOW — View Prescription Detail using _id or humanRxId
    const viewReq1 = { user: docUser, params: { id: mongoRxId } };
    const viewRes1 = mockRes();
    await getPrescriptionById(viewReq1, viewRes1, (err) => { if (err) throw err; });
    console.log('Step 3: View Prescription Detail by Mongo _id -> status:', viewRes1.statusCode, 'patientName:', viewRes1.data.prescription.patientName);

    const viewReq2 = { user: docUser, params: { id: humanRxId } };
    const viewRes2 = mockRes();
    await getPrescriptionById(viewReq2, viewRes2, (err) => { if (err) throw err; });
    console.log('Step 4: View Prescription Detail by Human RX-ID -> status:', viewRes2.statusCode, 'patientName:', viewRes2.data.prescription.patientName);

    // 6. STEP 3 IN UI FLOW — Click REVIEW / MedWise Review (checkWithMedwise or analyze)
    const reviewReq = { user: docUser, params: { id: mongoRxId } };
    const reviewRes = mockRes();
    await checkWithMedwise(reviewReq, reviewRes, (err) => { if (err) throw err; });
    console.log('Step 5: Execute MedWise Review -> status:', reviewRes.statusCode, 'overallRecommendation:', reviewRes.data.prescription.medwiseAnalysis?.overallRecommendation?.status);
    if (!reviewRes.data.prescription.medwiseAnalysis) throw new Error('medwiseAnalysis missing after checkWithMedwise execution');

    // 7. STEP 4 IN UI FLOW — Fetch Detailed Report (MedwiseDetailedReport page)
    const reportReq = { user: docUser, params: { id: mongoRxId } };
    const reportRes = mockRes();
    await getPrescriptionById(reportReq, reportRes, (err) => { if (err) throw err; });
    console.log('Step 6: Fetch Detailed Report Page Data -> status:', reportRes.statusCode, 'medwiseAnalysis present:', !!reportRes.data.prescription.medwiseAnalysis);
    if (!reportRes.data.prescription.medwiseAnalysis) throw new Error('Detailed Report page API returned prescription without medwiseAnalysis');
    console.log('        Patient profile attached:', !!reportRes.data.prescription.patientProfile);
    console.log('        Patient hasNoKnownAllergies:', reportRes.data.prescription.patientProfile?.hasNoKnownAllergies);

    // Cleanup temporary test records
    await Prescription.deleteOne({ _id: createdRx._id });
    await DoctorProfile.deleteOne({ userId: docUser._id });
    await PatientProfile.deleteOne({ userId: patUser._id });
    await User.deleteMany({ _id: { $in: [docUser._id, patUser._id] } });
    console.log('\n[Cleanup] Temporary test records cleaned up successfully.');

    console.log('\n===========================================================');
    console.log('>>> DOCTOR PRESCRIPTION VIEW -> REVIEW FLOW VERIFIED! <<<');
    console.log('===========================================================');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testExactFlow();
