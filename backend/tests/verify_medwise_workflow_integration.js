/**
 * verify_medwise_workflow_integration.js
 *
 * Phase 3.1 Verification Suite — MedWise Prescription Workflow Integration
 *
 * Tests:
 * 1. Doctor registers and creates a draft prescription.
 * 2. Doctor runs full MedWise analysis (POST /api/medwise/prescriptions/:id/analyze or checkWithMedwise).
 * 3. All six MedWise sections exist and are returned correctly (dosage, interactions, duplicates, allergySafety, audit, overallRecommendation).
 * 4. Modifying prescription data (PUT /api/prescriptions/:id) marks previous analysis as outdated (isOutdated === true).
 * 5. Re-running MedWise analysis on modified prescription clears outdated flag (isOutdated === false) and evaluates updated data.
 * 6. Patient role is rejected with HTTP 403 when attempting to trigger MedWise analysis.
 * 7. Doctor approves prescription successfully (Prescription lifecycle preserved).
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');

const { createPrescription, updatePrescription, approvePrescription } = require('../src/controllers/prescriptionController');
const { analyzePrescription } = require('../src/controllers/medwiseController');

// Helper to mock Express req/res
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
    console.log('Connected to DB for MedWise Workflow Integration verification.');

    const timestamp = Date.now();

    // 1. SETUP TEST DOCTOR & PATIENT
    console.log('\n=== 1. SETUP TEST DOCTOR & PATIENT ===');
    const doctorUser = await User.create({
      name: 'Dr. Workflow Tester',
      email: `doctor.workflow.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });

    await DoctorProfile.create({
      userId: doctorUser._id,
      mobileNumber: '9840123456',
      dateOfBirth: '1982-05-15',
      gender: 'Male',
      address: {
        addressLine1: '45, Cathedral Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600086',
      },
      medicalRegistrationNumber: `REG-${timestamp}`,
      specialization: 'General Practice',
      qualification: 'MBBS, MD',
      yearsOfExperience: 10,
      hospitalClinicName: 'Workflow Medical Center',
      hospitalClinicAddress: '100 Anna Salai, Chennai',
    });

    const patientUser = await User.create({
      name: 'Patient Workflow Subject',
      email: `patient.workflow.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });

    const mobileDigits = String(timestamp).slice(-10);
    const expectedPid = `PID-${mobileDigits}`;

    await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: mobileDigits,
      dateOfBirth: new Date('1990-05-15'),
      gender: 'Male',
      bloodGroup: 'O+',
      address: {
        addressLine1: '123 Main Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Suresh Kumar',
        relationship: 'Parent',
        mobileNumber: '9876543211',
      },
    });

    console.log('1.1 Doctor & Patient created. Doctor:', doctorUser.name, '| Patient PID:', expectedPid);

    // 2. DOCTOR CREATES PRESCRIPTION
    console.log('\n=== 2. DOCTOR CREATES PRESCRIPTION ===');
    const createReq = {
      user: doctorUser,
      body: {
        patientPid: expectedPid,
        clinicalDiagnosis: 'Acute Pharyngitis & Pain',
        doctorNotes: 'Take after food',
        medicines: [
          {
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '5 days',
            route: 'Oral',
            instructions: 'After food',
          },
          {
            medicineName: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'Thrice daily',
            duration: '7 days',
            route: 'Oral',
            instructions: 'With water',
          },
        ],
      },
    };

    const createRes = mockRes();
    await createPrescription(createReq, createRes, (err) => { if (err) throw err; });

    console.log('2.1 Create Prescription status:', createRes.statusCode, '| ID:', createRes.data.prescription.prescriptionId);
    if (createRes.statusCode !== 201 || !createRes.data.prescription) {
      throw new Error('Failed to create prescription');
    }

    const prescriptionDbId = createRes.data.prescription._id;
    const prescriptionHumanId = createRes.data.prescription.prescriptionId;

    // 3. DOCTOR RUNS MEDWISE ANALYSIS (POST /api/medwise/prescriptions/:id/analyze)
    console.log('\n=== 3. DOCTOR RUNS MEDWISE ANALYSIS ===');
    const analyzeReq = {
      user: doctorUser,
      params: { prescriptionId: prescriptionHumanId },
    };
    const analyzeRes = mockRes();
    await analyzePrescription(analyzeReq, analyzeRes, (err) => { if (err) throw err; });

    console.log('3.1 Analysis status code:', analyzeRes.statusCode);
    if (analyzeRes.statusCode !== 200 || !analyzeRes.data.analysis) {
      throw new Error('MedWise analysis failed');
    }

    const analysis = analyzeRes.data.analysis;

    // 4. VERIFY ALL SIX MEDWISE SECTIONS
    console.log('\n=== 4. VERIFY ALL SIX MEDWISE SECTIONS ===');
    console.log('4.1 Dosage Check exists:', Array.isArray(analysis.checks.dosage));
    console.log('4.2 Interaction Check exists:', analysis.checks.interactions !== null);
    console.log('4.3 Duplicate Check exists:', analysis.checks.duplicates !== null);
    console.log('4.4 Allergy/Safety Check exists:', analysis.checks.allergySafety !== null);
    console.log('4.5 Prescription Audit exists:', analysis.audit !== null);
    console.log('4.6 Overall Recommendation status:', analysis.overallRecommendation.status);

    if (
      !Array.isArray(analysis.checks.dosage) ||
      !analysis.checks.interactions ||
      !analysis.checks.duplicates ||
      !analysis.checks.allergySafety ||
      !analysis.audit ||
      !analysis.overallRecommendation
    ) {
      throw new Error('Not all 6 MedWise sections were returned');
    }

    // Verify saved state on prescription document in DB
    const savedRx1 = await Prescription.findById(prescriptionDbId);
    console.log('4.7 Saved medwiseAnalysis exists in DB:', savedRx1.medwiseAnalysis !== null);
    console.log('4.8 Saved isOutdated flag:', savedRx1.medwiseAnalysis?.isOutdated);
    if (!savedRx1.medwiseAnalysis || savedRx1.medwiseAnalysis.isOutdated !== false) {
      throw new Error('MedWise analysis was not saved correctly to prescription document');
    }

    // 5. DOCTOR MODIFIES PRESCRIPTION (PUT /api/prescriptions/:id)
    console.log('\n=== 5. DOCTOR MODIFIES PRESCRIPTION DATA ===');
    const updateReq = {
      user: doctorUser,
      params: { id: String(prescriptionDbId) },
      body: {
        clinicalDiagnosis: 'Acute Pharyngitis with Severe Pain',
        medicines: [
          {
            medicineName: 'Paracetamol',
            dosage: '1000mg', // Changed dosage to higher
            frequency: 'Thrice daily',
            duration: '5 days',
            route: 'Oral',
          },
          {
            medicineName: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'Thrice daily',
            duration: '7 days',
            route: 'Oral',
          },
        ],
      },
    };

    const updateRes = mockRes();
    await updatePrescription(updateReq, updateRes, (err) => { if (err) throw err; });

    console.log('5.1 Update status:', updateRes.statusCode, '| Message:', updateRes.data.message);
    if (updateRes.statusCode !== 200) {
      throw new Error('Failed to update prescription');
    }

    // Verify that previous analysis is marked as outdated
    const savedRx2 = await Prescription.findById(prescriptionDbId);
    console.log('5.2 Analysis marked as outdated in DB:', savedRx2.medwiseAnalysis?.isOutdated);
    if (savedRx2.medwiseAnalysis?.isOutdated !== true) {
      throw new Error('Previous MedWise analysis was NOT marked as outdated after prescription modification');
    }

    // 6. DOCTOR RE-RUNS MEDWISE ANALYSIS ON UPDATED PRESCRIPTION
    console.log('\n=== 6. DOCTOR RE-RUNS MEDWISE ANALYSIS ===');
    const reAnalyzeReq = {
      user: doctorUser,
      params: { prescriptionId: prescriptionHumanId },
    };
    const reAnalyzeRes = mockRes();
    await analyzePrescription(reAnalyzeReq, reAnalyzeRes, (err) => { if (err) throw err; });

    console.log('6.1 Fresh Analysis status:', reAnalyzeRes.statusCode);

    const savedRx3 = await Prescription.findById(prescriptionDbId);
    console.log('6.2 Fresh analysis isOutdated flag in DB:', savedRx3.medwiseAnalysis?.isOutdated);
    if (savedRx3.medwiseAnalysis?.isOutdated !== false) {
      throw new Error('Fresh MedWise analysis did NOT clear outdated flag');
    }

    // 7. PATIENT ROLE IS REJECTED FROM RUNNING ANALYSIS (HTTP 403)
    console.log('\n=== 7. PATIENT ROLE REJECTION TEST ===');
    const patAnalyzeReq = {
      user: patientUser,
      params: { prescriptionId: prescriptionHumanId },
    };
    const patAnalyzeRes = mockRes();
    await analyzePrescription(patAnalyzeReq, patAnalyzeRes, (err) => { if (err) throw err; });

    console.log('7.1 Patient analyze rejection status:', patAnalyzeRes.statusCode, '| Message:', patAnalyzeRes.data.message);
    if (patAnalyzeRes.statusCode !== 403) {
      throw new Error('Patient was NOT rejected from running MedWise analysis with HTTP 403');
    }

    // 8. DOCTOR APPROVES PRESCRIPTION
    console.log('\n=== 8. DOCTOR APPROVES PRESCRIPTION ===');
    const approveReq = {
      user: doctorUser,
      params: { id: String(prescriptionDbId) },
    };
    const approveRes = mockRes();
    await approvePrescription(approveReq, approveRes, (err) => { if (err) throw err; });

    console.log('8.1 Approve status:', approveRes.statusCode, '| Status in DB:', approveRes.data.prescription.status, '| Doctor Decision:', approveRes.data.prescription.doctorDecision);
    if (approveRes.statusCode !== 200 || approveRes.data.prescription.status !== 'Sent to Pharmacist' || approveRes.data.prescription.doctorDecision !== 'Approved') {
      throw new Error('Failed to approve prescription or status was not set to Sent to Pharmacist');
    }

    // CLEANUP
    console.log('\n=== CLEANUP TEST DATA ===');
    await User.deleteMany({ _id: { $in: [doctorUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: doctorUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    await Prescription.deleteMany({ _id: prescriptionDbId });
    console.log('Cleaned up test users, profiles, and prescription.');

    await mongoose.disconnect();
    console.log('Disconnected from DB.');

    console.log('\n================================================================');
    console.log('>>> ALL MEDWISE PRESCRIPTION WORKFLOW INTEGRATION TESTS PASSED! <<<');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  }
};

runTest();
