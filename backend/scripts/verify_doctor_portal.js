const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const {
  getDoctorDashboard,
  getDoctorPatients,
  getPatientClinicalRecord,
  getDoctorClinicalOverview,
  getDoctorMedwiseReviews,
} = require('../src/controllers/doctorController');
const {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  checkWithMedwise,
  approvePrescription,
} = require('../src/controllers/prescriptionController');
const { createConsultation } = require('../src/controllers/consultationController');

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
    console.log('Connected to DB for Doctor Portal full-stack test suite.\n');

    const timestamp = Date.now();

    // 1. REGISTER AND COMPLETE DOCTOR PROFILE
    console.log('=== 1. DOCTOR REGISTRATION & PROFILE CREDENTIALS ===');
    const docRegReq = {
      body: {
        name: 'Dr. Vikram Sethi',
        email: `doc.sethi.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);
    console.log('1.1 Doctor Registered:', doctorUser.name, '| Role:', doctorUser.role);

    // Complete doctor profile
    const docProfReq = {
      user: doctorUser,
      body: {
        name: 'Dr. Vikram Sethi',
        mobileNumber: '9840123456',
        dateOfBirth: '1982-05-15',
        gender: 'Male',
        profilePhoto: 'https://example.com/dr-sethi.jpg',
        address: {
          addressLine1: '45, Cathedral Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600086',
        },
        medicalRegistrationNumber: 'MCI-TN-45892',
        specialization: 'Cardiology',
        qualification: 'MBBS, MD, DM',
        yearsOfExperience: 14,
        hospitalClinicName: 'MedWise Heart Institute',
        hospitalClinicAddress: '100, Anna Salai, Chennai',
        professionalContactNumber: '+91 44 2811 0000',
      },
    };
    const docProfRes = mockRes();
    await createOrUpdateMyProfile(docProfReq, docProfRes, (err) => { if (err) throw err; });
    console.log('1.2 Doctor Profile Completed:', docProfRes.statusCode, docProfRes.data.profile.specialization);

    // 2. CREATE A PATIENT WITH CLINICAL PROFILE
    console.log('\n=== 2. SETUP TEST PATIENT IN WORKSPACE ===');
    const patRegReq = {
      body: {
        name: 'Ananya Sharma',
        email: `ananya.patient.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'patient',
      },
    };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);

    const patProfReq = {
      user: patientUser,
      body: {
        name: 'Ananya Sharma',
        mobileNumber: '9876543210',
        dateOfBirth: '1995-09-20',
        gender: 'Female',
        address: {
          addressLine1: 'Flat 4B, Sky Towers',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600028',
        },
        bloodGroup: 'B+',
        medicalConditions: [{ name: 'Hypertension', sinceYear: 2022, notes: 'Mild' }],
        currentMedications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' }],
        previousSurgeries: [],
        emergencyContact: { name: 'Raj Sharma', relationship: 'Spouse', mobileNumber: '9876543219' },
      },
    };
    const patProfRes = mockRes();
    await createOrUpdateMyProfile(patProfReq, patProfRes, (err) => { if (err) throw err; });
    console.log('2.1 Patient Created & Profile Saved: PID-9876543210 (B+)');

    // 3. DOCTOR CREATES CONSULTATION FOR PATIENT
    console.log('\n=== 3. DOCTOR CREATES CONSULTATION ===');
    const consultReq = {
      user: doctorUser,
      body: {
        patientId: patientUser._id,
        patientPid: 'PID-9876543210',
        doctorSpecialization: 'Cardiology',
        hospitalClinicName: 'MedWise Heart Institute',
        consultationDate: new Date(),
        consultationType: 'In-person',
        reasonForVisit: 'Cardiovascular check-up and BP evaluation',
        diagnosisNotes: 'Controlled hypertension, BP 128/82. Good exercise tolerance.',
        doctorRecommendations: 'Continue low salt diet and regular daily walking.',
        followUpDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        status: 'Completed',
      },
    };
    const consultRes = mockRes();
    await createConsultation(consultReq, consultRes, (err) => { if (err) throw err; });
    console.log('3.1 Consultation Saved Status:', consultRes.statusCode, consultRes.data.message);
    const consultationId = consultRes.data.consultation._id;

    // 4. DOCTOR DASHBOARD SUMMARY API
    console.log('\n=== 4. TEST GET /api/doctor/dashboard ===');
    const dashReq = { user: doctorUser };
    const dashRes = mockRes();
    await getDoctorDashboard(dashReq, dashRes, (err) => { if (err) throw err; });
    console.log('4.1 Dashboard Stats:', dashRes.data.stats);
    console.log('    - Today Consultations:', dashRes.data.stats.todayConsultationsCount, '(Expected >= 1)');
    console.log('    - Active Patients:', dashRes.data.stats.activePatientsCount, '(Expected >= 1)');
    if (dashRes.data.stats.todayConsultationsCount < 1 || dashRes.data.stats.activePatientsCount < 1) {
      throw new Error('Doctor dashboard stats calculation mismatch');
    }

    // 5. PATIENT SEARCH & LONGITUDINAL RECORD
    console.log('\n=== 5. PATIENT SEARCH & LONGITUDINAL RECORD ===');
    const searchReq = { user: doctorUser, query: { search: 'Ananya' } };
    const searchRes = mockRes();
    await getDoctorPatients(searchReq, searchRes, (err) => { if (err) throw err; });
    console.log('5.1 Patient Search Results count:', searchRes.data.count, '| First:', searchRes.data.patients[0].name);
    if (searchRes.data.count < 1 || searchRes.data.patients[0].pid !== 'PID-9876543210') {
      throw new Error('Patient search failed');
    }

    // Longitudinal Record
    const recordReq = { user: doctorUser, params: { patientId: String(patientUser._id) } };
    const recordRes = mockRes();
    await getPatientClinicalRecord(recordReq, recordRes, (err) => { if (err) throw err; });
    const rec = recordRes.data.record;
    console.log('5.2 Longitudinal Record:', rec.name, '| PID:', rec.pid, '| Blood:', rec.bloodGroup);
    console.log('    - Consultations in history:', rec.consultations.length);
    console.log('    - Chronic conditions:', rec.medicalConditions.length);
    if (rec.consultations.length < 1 || rec.bloodGroup !== 'B+') {
      throw new Error('Longitudinal record retrieval mismatch');
    }

    // 6. PRESCRIPTION AUTHORING & MEDWISE CHECKS
    console.log('\n=== 6. PRESCRIPTION AUTHORING & MEDWISE SAFETY CHECKS ===');
    const rxReq = {
      user: doctorUser,
      body: {
        patientId: patientUser._id,
        consultationId,
        clinicalDiagnosis: 'Stage 1 Essential Hypertension',
        doctorNotes: 'Take after breakfast with plenty of water',
        medicines: [
          { medicineName: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: '30 days', route: 'Oral', instructions: 'Morning' },
          { medicineName: 'Hydrochlorothiazide', dosage: '12.5mg', frequency: 'Once daily', duration: '30 days', route: 'Oral', instructions: 'Morning with food' },
        ],
      },
    };
    const rxRes = mockRes();
    await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
    console.log('6.1 Prescription Created:', rxRes.statusCode, rxRes.data.prescription.prescriptionId);
    const rxId = rxRes.data.prescription._id;
    if (rxRes.data.prescription.medicines.length !== 2) throw new Error('Prescription medicines count mismatch');

    // Trigger MedWise checks
    const checkReq = { user: doctorUser, params: { id: String(rxId) } };
    const checkRes = mockRes();
    await checkWithMedwise(checkReq, checkRes, (err) => { if (err) throw err; });
    console.log('6.2 MedWise Checks Initiated:', checkRes.data.medwiseChecks.status);
    console.log('    Overall Recommendation:', checkRes.data.medwiseChecks.overallRecommendation);

    // Doctor Approves Prescription
    const approveReq = { user: doctorUser, params: { id: String(rxId) } };
    const approveRes = mockRes();
    await approvePrescription(approveReq, approveRes, (err) => { if (err) throw err; });
    console.log('6.3 Prescription Approved:', approveRes.statusCode, approveRes.data.prescription.status);
    if (approveRes.data.prescription.status !== 'Sent to Pharmacist') throw new Error('Prescription approval failed');

    // 7. CLINICAL OVERVIEW & MEDWISE REVIEWS API
    console.log('\n=== 7. CLINICAL OVERVIEW & REVIEWS QUEUE ===');
    const overReq = { user: doctorUser };
    const overRes = mockRes();
    await getDoctorClinicalOverview(overReq, overRes, (err) => { if (err) throw err; });
    console.log('7.1 Clinical Overview Metrics:', overRes.data.metrics);

    const revReq = { user: doctorUser };
    const revRes = mockRes();
    await getDoctorMedwiseReviews(revReq, revRes, (err) => { if (err) throw err; });
    console.log('7.2 MedWise Review Queue Summary:', revRes.data.summary);

    // 8. SECURITY & ROLE AUTHORIZATION TESTS
    console.log('\n=== 8. SECURITY & AUTHORIZATION TESTS ===');
    // Patient cannot draft prescription
    const patRxReq = { user: patientUser, body: { patientId: patientUser._id, medicines: [{ medicineName: 'Test', dosage: '10mg', frequency: 'OD', duration: '5d' }] } };
    const patRxRes = mockRes();
    await createPrescription(patRxReq, patRxRes, (err) => { if (err) throw err; });
    console.log('8.1 Patient POST /api/prescriptions:', patRxRes.statusCode, patRxRes.data.message);
    if (patRxRes.statusCode !== 403) throw new Error('Patient must NOT be allowed to author prescriptions');

    // Cleanup
    await User.deleteMany({ _id: { $in: [doctorUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: doctorUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    await Consultation.deleteMany({ _id: consultationId });
    await Prescription.deleteMany({ _id: rxId });
    console.log('\nTest cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL DOCTOR PORTAL FULL-STACK TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Doctor Portal verification error:', error);
    process.exit(1);
  }
};

runTest();
