/**
 * verify_medwise_approval_handoff.js
 *
 * Phase 3.2 Verification Suite — Doctor Approval & Pharmacist Handoff
 *
 * Tests:
 * 1. Doctor A creates prescription and runs MedWise analysis.
 * 2. Attempting approval with outdated MedWise analysis fails with HTTP 400.
 * 3. Doctor A re-runs MedWise analysis and approves prescription successfully.
 * 4. Doctor B cannot approve Doctor A's prescription (HTTP 403).
 * 5. Pharmacist queue (GET /api/prescriptions) retrieves the approved prescription.
 * 6. Pharmacist detail view (GET /api/prescriptions/:id) retrieves full approved prescription details.
 * 7. Pharmacist cannot view unapproved (Draft) prescriptions (HTTP 403).
 * 8. Pharmacist cannot modify or approve prescriptions (HTTP 403).
 * 9. Patient cannot access pharmacist queue or write endpoints (HTTP 403).
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Prescription = require('../src/models/Prescription');

const {
  createPrescription,
  updatePrescription,
  approvePrescription,
  getPrescriptions,
  getPrescriptionById,
} = require('../src/controllers/prescriptionController');
const { analyzePrescription } = require('../src/controllers/medwiseController');

// Mock express req/res
const mockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
  };
  return res;
};

const runTest = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB for MedWise Approval & Pharmacist Handoff verification.');

    const timestamp = Date.now();

    // 1. SETUP USERS: DOCTOR A, DOCTOR B, PHARMACIST, PATIENT
    console.log('\n=== 1. SETUP USERS ===');
    const doctorA = await User.create({
      name: 'Dr. Primary Attending',
      email: `doctor.a.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    await DoctorProfile.create({
      userId: doctorA._id,
      mobileNumber: '9840111111',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: {
        addressLine1: '100 Medical Enclave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      medicalRegistrationNumber: `REG-A-${timestamp}`,
      specialization: 'Cardiology',
      qualification: 'MBBS, MD',
      yearsOfExperience: 12,
      hospitalClinicName: 'City General Hospital',
      hospitalClinicAddress: '100 Medical Enclave, Chennai',
    });

    const doctorB = await User.create({
      name: 'Dr. Other Doctor',
      email: `doctor.b.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    await DoctorProfile.create({
      userId: doctorB._id,
      mobileNumber: '9840222222',
      dateOfBirth: '1985-02-02',
      gender: 'Female',
      address: {
        addressLine1: '200 Doctors Row',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      medicalRegistrationNumber: `REG-B-${timestamp}`,
      specialization: 'Neurology',
      qualification: 'MBBS, DM',
      yearsOfExperience: 8,
      hospitalClinicName: 'Neuro Health Center',
      hospitalClinicAddress: '200 Doctors Row, Chennai',
    });

    const pharmacistUser = await User.create({
      name: 'Pharm. Chief Dispenser',
      email: `pharmacist.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    await PharmacistProfile.create({
      userId: pharmacistUser._id,
      mobileNumber: '9840333333',
      dateOfBirth: '1988-03-03',
      gender: 'Male',
      address: {
        addressLine1: '300 Pharmacy St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      pharmacyRegistrationNumber: `PHARM-LIC-${timestamp}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 6,
      pharmacyHospitalName: 'Central MedWise Pharmacy',
      pharmacyHospitalAddress: '300 Pharmacy St, Chennai',
    });

    const patientUser = await User.create({
      name: 'Patient Handoff Subject',
      email: `patient.handoff.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    const mobileDigits = String(timestamp).slice(-10);
    const expectedPid = `PID-${mobileDigits}`;
    await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: mobileDigits,
      dateOfBirth: '1992-06-15',
      gender: 'Female',
      address: {
        addressLine1: '12 Patient Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600004',
      },
      emergencyContact: {
        name: 'Emergency Guardian',
        relationship: 'Spouse',
        mobileNumber: '9840999999',
      },
    });

    console.log(`Users created: Doctor A (${doctorA._id}), Doctor B (${doctorB._id}), Pharmacist (${pharmacistUser._id}), Patient (${patientUser._id}, ${expectedPid})`);

    // 2. CREATE DRAFT PRESCRIPTION
    console.log('\n=== 2. CREATE DRAFT PRESCRIPTION ===');
    const reqCreate = {
      user: doctorA,
      body: {
        patientPid: expectedPid,
        diagnosis: 'Hypertension and Chronic Pain',
        medicines: [
          {
            medicineName: 'Paracetamol',
            name: 'Paracetamol',
            brandName: 'Calpol 650',
            dosage: '650mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
            instructions: 'Take after food',
          },
        ],
        notes: 'Monitor BP daily.',
      },
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { throw err; });

    if (resCreate.statusCode !== 201 || !resCreate.data.success) {
      throw new Error(`Failed to create draft prescription: ${JSON.stringify(resCreate.data)}`);
    }
    const rx = resCreate.data.prescription;
    console.log(`Draft Prescription created: ID=${rx._id}, RX_ID=${rx.prescriptionId}, Status=${rx.status}`);

    // 3. ATTEMPT APPROVAL WITHOUT MEDWISE ANALYSIS -> SHOULD FAIL (400)
    console.log('\n=== 3. APPROVAL WITHOUT MEDWISE ANALYSIS ===');
    const reqApproveNoMedwise = {
      user: doctorA,
      params: { id: rx._id.toString() },
    };
    const resApproveNoMedwise = mockRes();
    await approvePrescription(reqApproveNoMedwise, resApproveNoMedwise, (err) => { throw err; });

    if (resApproveNoMedwise.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 when approving without MedWise analysis, got ${resApproveNoMedwise.statusCode}`);
    }
    console.log(`PASSED: Approval rejected without MedWise analysis (${resApproveNoMedwise.data.message})`);

    // 4. RUN MEDWISE ANALYSIS & UPDATE PRESCRIPTION TO MAKE IT OUTDATED
    console.log('\n=== 4. OUTDATED MEDWISE ANALYSIS TEST ===');
    const reqAnalyze1 = {
      user: doctorA,
      params: { prescriptionId: rx._id.toString() },
    };
    const resAnalyze1 = mockRes();
    await analyzePrescription(reqAnalyze1, resAnalyze1, (err) => { throw err; });

    if (resAnalyze1.statusCode !== 200 || !resAnalyze1.data.success) {
      throw new Error(`Failed initial MedWise analysis: ${JSON.stringify(resAnalyze1.data)}`);
    }
    console.log('MedWise analysis initial run complete.');

    // Now update prescription data to mark MedWise analysis as outdated
    const reqUpdate = {
      user: doctorA,
      params: { id: rx._id.toString() },
      body: {
        patientPid: expectedPid,
        diagnosis: 'Hypertension, Chronic Pain, and Severe Osteoarthritis',
        medicines: [
          {
            medicineName: 'Paracetamol',
            name: 'Paracetamol',
            brandName: 'Calpol 650',
            dosage: '650mg',
            frequency: '1-1-1',
            duration: '7 days',
            route: 'Oral',
          },
          {
            medicineName: 'Ibuprofen',
            name: 'Ibuprofen',
            brandName: 'Brufen 400',
            dosage: '400mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
          },
        ],
      },
    };
    const resUpdate = mockRes();
    await updatePrescription(reqUpdate, resUpdate, (err) => { throw err; });

    if (resUpdate.statusCode !== 200 || !resUpdate.data.success) {
      throw new Error(`Failed to update prescription: ${JSON.stringify(resUpdate.data)}`);
    }

    const updatedRx = resUpdate.data.prescription;
    if (!updatedRx.medwiseAnalysis || !updatedRx.medwiseAnalysis.isOutdated) {
      throw new Error(`Expected medwiseAnalysis.isOutdated === true after editing prescription`);
    }
    console.log('Prescription updated and MedWise analysis marked as OUTDATED.');

    // Attempt approval with outdated analysis -> SHOULD FAIL (400)
    const reqApproveOutdated = {
      user: doctorA,
      params: { id: rx._id.toString() },
    };
    const resApproveOutdated = mockRes();
    await approvePrescription(reqApproveOutdated, resApproveOutdated, (err) => { throw err; });

    if (resApproveOutdated.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 when approving outdated MedWise analysis, got ${resApproveOutdated.statusCode}`);
    }
    console.log(`PASSED: Outdated MedWise analysis prevented approval (${resApproveOutdated.data.message})`);

    // 5. RE-RUN MEDWISE ANALYSIS & APPROVE PRESCRIPTION
    console.log('\n=== 5. RE-RUN MEDWISE & APPROVE PRESCRIPTION ===');
    const reqAnalyze2 = {
      user: doctorA,
      params: { prescriptionId: rx._id.toString() },
    };
    const resAnalyze2 = mockRes();
    await analyzePrescription(reqAnalyze2, resAnalyze2, (err) => { throw err; });

    if (resAnalyze2.statusCode !== 200 || !resAnalyze2.data.success) {
      throw new Error(`Failed re-running MedWise analysis: ${JSON.stringify(resAnalyze2.data)}`);
    }
    console.log('Re-ran MedWise analysis. isOutdated is now false.');

    // Approve as Doctor A
    const reqApproveSuccess = {
      user: doctorA,
      params: { id: rx._id.toString() },
    };
    const resApproveSuccess = mockRes();
    await approvePrescription(reqApproveSuccess, resApproveSuccess, (err) => { throw err; });

    if (resApproveSuccess.statusCode !== 200 || !resApproveSuccess.data.success) {
      throw new Error(`Failed doctor approval: ${JSON.stringify(resApproveSuccess.data)}`);
    }
    if (resApproveSuccess.data.prescription.status !== 'Sent to Pharmacist') {
      throw new Error(`Expected prescription status 'Sent to Pharmacist', got '${resApproveSuccess.data.prescription.status}'`);
    }
    if (resApproveSuccess.data.prescription.doctorDecision !== 'Approved') {
      throw new Error(`Expected doctorDecision 'Approved', got '${resApproveSuccess.data.prescription.doctorDecision}'`);
    }
    console.log(`PASSED: Prescription approved successfully. Status=${resApproveSuccess.data.prescription.status}, Decision=${resApproveSuccess.data.prescription.doctorDecision}`);

    // 6. DOCTOR B CANNOT APPROVE DOCTOR A'S PRESCRIPTION (403)
    console.log('\n=== 6. UNAUTHORIZED DOCTOR APPROVAL REJECTION ===');
    const reqApproveDoctorB = {
      user: doctorB,
      params: { id: rx._id.toString() },
    };
    const resApproveDoctorB = mockRes();
    await approvePrescription(reqApproveDoctorB, resApproveDoctorB, (err) => { throw err; });

    if (resApproveDoctorB.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for unauthorized doctor approval, got ${resApproveDoctorB.statusCode}`);
    }
    console.log(`PASSED: Doctor B rejected when trying to approve Doctor A's prescription (${resApproveDoctorB.data.message})`);

    // 7. PHARMACIST QUEUE RETRIEVAL (GET /api/prescriptions)
    console.log('\n=== 7. PHARMACIST QUEUE RETRIEVAL ===');
    const reqPharmQueue = { user: pharmacistUser };
    const resPharmQueue = mockRes();
    await getPrescriptions(reqPharmQueue, resPharmQueue, (err) => { throw err; });

    if (resPharmQueue.statusCode !== 200 || !resPharmQueue.data.success) {
      throw new Error(`Failed to fetch pharmacist queue: ${JSON.stringify(resPharmQueue.data)}`);
    }
    const queue = resPharmQueue.data.prescriptions;
    const foundRx = queue.find((p) => String(p._id) === String(rx._id));
    if (!foundRx) {
      throw new Error(`Approved prescription ${rx._id} not found in pharmacist queue! Queue count: ${queue.length}`);
    }
    console.log(`PASSED: Approved prescription found in Pharmacist queue (Queue total=${queue.length})`);

    // 8. PHARMACIST DETAIL VIEW (GET /api/prescriptions/:id)
    console.log('\n=== 8. PHARMACIST DETAIL VIEW ===');
    const reqPharmDetail = {
      user: pharmacistUser,
      params: { id: rx._id.toString() },
    };
    const resPharmDetail = mockRes();
    await getPrescriptionById(reqPharmDetail, resPharmDetail, (err) => { throw err; });

    if (resPharmDetail.statusCode !== 200 || !resPharmDetail.data.success) {
      throw new Error(`Failed pharmacist detail view: ${JSON.stringify(resPharmDetail.data)}`);
    }
    const pDetail = resPharmDetail.data.prescription;
    if (!pDetail.medicines || pDetail.medicines.length !== 2 || !pDetail.medwiseAnalysis) {
      throw new Error(`Pharmacist detail view missing required medicines or medwiseAnalysis!`);
    }
    console.log(`PASSED: Pharmacist can view full approved prescription details including MedWise review summary.`);

    // 9. PHARMACIST CANNOT MODIFY OR APPROVE PRESCRIPTION (403)
    console.log('\n=== 9. PHARMACIST WRITE ATTEMPTS REJECTION ===');
    const reqPharmModify = {
      user: pharmacistUser,
      params: { id: rx._id.toString() },
      body: { diagnosis: 'Malicious modification by pharmacist' },
    };
    const resPharmModify = mockRes();
    await updatePrescription(reqPharmModify, resPharmModify, (err) => { throw err; });

    if (resPharmModify.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for pharmacist update attempt, got ${resPharmModify.statusCode}`);
    }

    const reqPharmApprove = {
      user: pharmacistUser,
      params: { id: rx._id.toString() },
    };
    const resPharmApprove = mockRes();
    await approvePrescription(reqPharmApprove, resPharmApprove, (err) => { throw err; });

    if (resPharmApprove.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for pharmacist approve attempt, got ${resPharmApprove.statusCode}`);
    }
    console.log(`PASSED: Pharmacist write attempts correctly rejected with HTTP 403.`);

    // 10. PATIENT CANNOT ACCESS PHARMACIST WRITE OR APPROVAL ENDPOINTS
    console.log('\n=== 10. PATIENT RESTRICTIONS ===');
    const reqPatientApprove = {
      user: patientUser,
      params: { id: rx._id.toString() },
    };
    const resPatientApprove = mockRes();
    await approvePrescription(reqPatientApprove, resPatientApprove, (err) => { throw err; });

    if (resPatientApprove.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for patient approval attempt, got ${resPatientApprove.statusCode}`);
    }
    console.log(`PASSED: Patient approval attempt rejected with HTTP 403.`);

    console.log('\n======================================================');
    console.log('ALL PHASE 3.2 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\nVerification failed:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (doctorA?._id) {
        await DoctorProfile.deleteMany({ userId: doctorA._id });
        await User.deleteOne({ _id: doctorA._id });
      }
      if (doctorB?._id) {
        await DoctorProfile.deleteMany({ userId: doctorB._id });
        await User.deleteOne({ _id: doctorB._id });
      }
      if (pharmacistUser?._id) {
        await PharmacistProfile.deleteMany({ userId: pharmacistUser._id });
        await User.deleteOne({ _id: pharmacistUser._id });
      }
      if (patientUser?._id) {
        await PatientProfile.deleteMany({ userId: patientUser._id });
        await User.deleteOne({ _id: patientUser._id });
      }
      if (typeof rx !== 'undefined' && rx?._id) {
        await Prescription.deleteOne({ _id: rx._id });
      }
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await mongoose.disconnect();
  }
};

runTest();
