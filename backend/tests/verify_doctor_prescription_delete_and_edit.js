const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const Appointment = require('../src/models/Appointment');

const {
  createPrescription,
  updatePrescription,
  deletePrescription,
  checkWithMedwise,
  approvePrescription,
} = require('../src/controllers/prescriptionController');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medwise';

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

async function runTests() {
  console.log('=== STARTING DOCTOR PRESCRIPTION DELETE & EDIT VERIFICATION ===\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    const ts = Date.now();
    const docAEmail = `docA_${ts}@medwise.com`;
    const docBEmail = `docB_${ts}@medwise.com`;
    const patEmail = `pat_${ts}@medwise.com`;
    const pharmEmail = `pharm_${ts}@medwise.com`;
    const patMobile = `98${String(ts).slice(-8)}`;
    const expectedPid = `PID-${patMobile.slice(-10)}`;

    // Create Doctor A
    const docAUser = await User.create({
      name: `Dr. Doctor A ${ts}`,
      email: docAEmail,
      password: 'password123',
      role: 'doctor',
    });
    await DoctorProfile.create({
      userId: docAUser._id,
      mobileNumber: '9876543210',
      dateOfBirth: '1980-01-01',
      gender: 'Male',
      address: { addressLine1: 'Doc St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-A-${ts}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 10,
      hospitalClinicName: 'Clinic A',
      hospitalClinicAddress: 'Address A',
      licenseNumber: `LIC-A-${ts}`,
      profileCompleted: true,
    });

    // Create Doctor B
    const docBUser = await User.create({
      name: `Dr. Doctor B ${ts}`,
      email: docBEmail,
      password: 'password123',
      role: 'doctor',
    });
    await DoctorProfile.create({
      userId: docBUser._id,
      mobileNumber: '9876543211',
      dateOfBirth: '1982-01-01',
      gender: 'Female',
      address: { addressLine1: 'Doc St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-B-${ts}`,
      specialization: 'Cardiology',
      qualification: 'MBBS, MD',
      yearsOfExperience: 8,
      hospitalClinicName: 'Clinic B',
      hospitalClinicAddress: 'Address B',
      licenseNumber: `LIC-B-${ts}`,
      profileCompleted: true,
    });

    // Create Patient
    const patUser = await User.create({
      name: `Patient Alpha ${ts}`,
      email: patEmail,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: patUser._id,
      mobileNumber: patMobile,
      dateOfBirth: '1990-06-15',
      gender: 'Male',
      bloodGroup: 'O+',
      address: { addressLine1: 'Pat Rd', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      emergencyContact: { name: 'Emergency Contact', relationship: 'Parent', mobileNumber: '9876543299' },
      profileCompleted: true,
    });

    // Create Pharmacist
    const pharmUser = await User.create({
      name: `Pharmacist Delta ${ts}`,
      email: pharmEmail,
      password: 'password123',
      role: 'pharmacist',
    });
    await PharmacistProfile.create({
      userId: pharmUser._id,
      mobileNumber: '9876543212',
      dateOfBirth: '1988-03-03',
      gender: 'Male',
      address: { addressLine1: 'Pharm St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600003' },
      pharmacyRegistrationNumber: `PHARM-REG-${ts}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 6,
      pharmacyHospitalName: 'City Pharmacy',
      pharmacyHospitalAddress: 'Pharm St',
      licenseNumber: `PHARM-LIC-${ts}`,
      profileCompleted: true,
    });

    // Create Completed Consultation by Doctor A for Patient
    const consultation = await Consultation.create({
      consultationId: `CONS-${ts}`,
      patientId: patUser._id,
      doctorId: docAUser._id,
      patientName: patUser.name,
      patientPid: expectedPid,
      doctorName: docAUser.name,
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'Hypertension and pain check',
      diagnosisNotes: 'Mild Hypertension',
      status: 'Completed',
    });

    // Create Appointment for Patient
    const appointment = await Appointment.create({
      appointmentId: `APPT-${ts}`,
      patientId: patUser._id,
      doctorId: docAUser._id,
      appointmentType: 'NEW_PATIENT',
      status: 'SCHEDULED',
      appointmentDate: new Date(),
    });

    console.log('[Setup] Created test users, consultation, and appointment.');

    // -----------------------------------------------------------------
    // TEST 1: Doctor A creates prescription
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Doctor A Creates Prescription ---');
    const reqCreate = {
      user: docAUser,
      body: {
        patientPid: expectedPid,
        consultationId: consultation._id.toString(),
        clinicalDiagnosis: 'Hypertension & Pain',
        doctorNotes: 'Initial regimen',
        medicines: [
          { medicineName: 'Aspirin', dosage: '100mg', frequency: '1-0-0', duration: '7 days', route: 'Oral' },
          { medicineName: 'Ibuprofen', dosage: '400mg', frequency: '1-0-1', duration: '5 days', route: 'Oral' },
        ],
      },
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { if (err) throw err; });

    if (!resCreate.data?.success || !resCreate.data.prescription) {
      throw new Error(`TEST 1 FAIL: Failed to create prescription. Msg: ${resCreate.data?.message}`);
    }
    const rxA = resCreate.data.prescription;
    console.log(`✓ Doctor A created prescription ${rxA.prescriptionId} (${rxA._id})`);

    // Verify consultation prescription link
    const updatedConsultation = await Consultation.findById(consultation._id);
    if (String(updatedConsultation.prescriptionId) !== String(rxA._id)) {
      throw new Error('TEST 1 FAIL: Consultation prescriptionId link not set!');
    }
    console.log('✓ Bi-directional link established on Consultation record');

    // -----------------------------------------------------------------
    // TEST 2: Doctor B attempts delete -> Expect 403 Forbidden
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Doctor B Attempts Delete (403 Expected) ---');
    const reqDelDocB = { user: docBUser, params: { id: rxA._id.toString() } };
    const resDelDocB = mockRes();
    await deletePrescription(reqDelDocB, resDelDocB, (err) => { if (err) throw err; });

    if (resDelDocB.statusCode !== 403) {
      throw new Error(`TEST 2 FAIL: Expected 403 for unauthorized doctor delete, got: ${resDelDocB.statusCode}`);
    }
    console.log('✓ Doctor B rejected with 403 Forbidden as expected');

    // -----------------------------------------------------------------
    // TEST 3: Patient attempts delete -> Expect 403 Forbidden
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Patient Attempts Delete (403 Expected) ---');
    const reqDelPat = { user: patUser, params: { id: rxA._id.toString() } };
    const resDelPat = mockRes();
    await deletePrescription(reqDelPat, resDelPat, (err) => { if (err) throw err; });

    if (resDelPat.statusCode !== 403) {
      throw new Error(`TEST 3 FAIL: Expected 403 for patient delete attempt, got: ${resDelPat.statusCode}`);
    }
    console.log('✓ Patient rejected with 403 Forbidden as expected');

    // -----------------------------------------------------------------
    // TEST 4: Pharmacist attempts delete -> Expect 403 Forbidden
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Pharmacist Attempts Delete (403 Expected) ---');
    const reqDelPharm = { user: pharmUser, params: { id: rxA._id.toString() } };
    const resDelPharm = mockRes();
    await deletePrescription(reqDelPharm, resDelPharm, (err) => { if (err) throw err; });

    if (resDelPharm.statusCode !== 403) {
      throw new Error(`TEST 4 FAIL: Expected 403 for pharmacist delete attempt, got: ${resDelPharm.statusCode}`);
    }
    console.log('✓ Pharmacist rejected with 403 Forbidden as expected');

    // Verify prescription still exists in DB
    const checkRxStillExists = await Prescription.findById(rxA._id);
    if (!checkRxStillExists) {
      throw new Error('TEST 2-4 FAIL: Prescription was deleted by unauthorized user!');
    }

    // -----------------------------------------------------------------
    // TEST 5: Doctor A deletes own prescription & reference safety
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Doctor A Deletes Own Prescription & Reference Verification ---');
    const reqDelDocA = { user: docAUser, params: { id: rxA._id.toString() } };
    const resDelDocA = mockRes();
    await deletePrescription(reqDelDocA, resDelDocA, (err) => { if (err) throw err; });

    if (!resDelDocA.data?.success) {
      throw new Error(`TEST 5 FAIL: Doctor A delete failed! Msg: ${resDelDocA.data?.message}`);
    }

    const [deletedRxCheck, consultAfterDelete, patientCheck, doctorCheck, apptCheck] = await Promise.all([
      Prescription.findById(rxA._id),
      Consultation.findById(consultation._id),
      User.findById(patUser._id),
      User.findById(docAUser._id),
      Appointment.findById(appointment._id),
    ]);

    if (deletedRxCheck) {
      throw new Error('TEST 5 FAIL: Prescription document still exists after deletion!');
    }
    if (!patientCheck || !doctorCheck || !consultAfterDelete || !apptCheck) {
      throw new Error('TEST 5 FAIL: Ancillary records (User, Consultation, Appointment) were mistakenly deleted!');
    }
    if (consultAfterDelete.prescriptionId != null) {
      throw new Error(`TEST 5 FAIL: Consultation.prescriptionId was not unset/cleared! Value: ${consultAfterDelete.prescriptionId}`);
    }
    console.log('✓ Prescription removed cleanly, Consultation.prescriptionId unset to null, and all patient/doctor/appointment records remain intact');

    // -----------------------------------------------------------------
    // TEST 6: Edit Prescription with Multiple Medicines & Duplicate Prevention
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Edit Prescription & No Duplicate Medicines/Prescriptions ---');
    // Create new prescription for testing edit flow
    const reqCreate2 = {
      user: docAUser,
      body: {
        patientPid: expectedPid,
        consultationId: consultation._id.toString(),
        clinicalDiagnosis: 'Pain & Inflammation',
        doctorNotes: 'Initial regimen',
        medicines: [
          { medicineName: 'Aspirin', dosage: '100mg', frequency: '1-0-0', duration: '7 days', route: 'Oral' },
          { medicineName: 'Ibuprofen', dosage: '400mg', frequency: '1-0-1', duration: '5 days', route: 'Oral' },
        ],
      },
    };
    const resCreate2 = mockRes();
    await createPrescription(reqCreate2, resCreate2, (err) => { if (err) throw err; });
    const rxB = resCreate2.data.prescription;

    // Run MedWise check (Aspirin + Ibuprofen flags interaction -> Review Recommended)
    const reqCheck1 = { user: docAUser, params: { id: rxB._id.toString() } };
    const resCheck1 = mockRes();
    await checkWithMedwise(reqCheck1, resCheck1, (err) => { if (err) throw err; });

    console.log('✓ Initial MedWise check executed. Overall recommendation:', resCheck1.data?.medwiseChecks?.overallRecommendation || resCheck1.data?.prescription?.medwiseChecks?.status);

    // Doctor edits prescription: REMOVES Ibuprofen, keeps Aspirin, adds Paracetamol
    const reqEdit = {
      user: docAUser,
      params: { id: rxB._id.toString() },
      body: {
        clinicalDiagnosis: 'Pain & Inflammation - Adjusted',
        doctorNotes: 'Removed Ibuprofen to avoid NSAID interaction',
        medicines: [
          { medicineName: 'Aspirin', dosage: '100mg', frequency: '1-0-0', duration: '7 days', route: 'Oral' },
          { medicineName: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '5 days', route: 'Oral' },
        ],
      },
    };
    const resEdit = mockRes();
    await updatePrescription(reqEdit, resEdit, (err) => { if (err) throw err; });

    if (!resEdit.data?.success || !resEdit.data.prescription) {
      throw new Error('TEST 6 FAIL: Edit prescription failed!');
    }

    const editedRx = resEdit.data.prescription;
    if (String(editedRx._id) !== String(rxB._id) || editedRx.prescriptionId !== rxB.prescriptionId) {
      throw new Error(`TEST 6 FAIL: Prescription ID or document _id changed on edit! Old: ${rxB.prescriptionId}, New: ${editedRx.prescriptionId}`);
    }

    if (editedRx.medicines.length !== 2) {
      throw new Error(`TEST 6 FAIL: Expected 2 medicines, got ${editedRx.medicines.length}`);
    }

    const medNames = editedRx.medicines.map((m) => m.medicineName);
    if (medNames.includes('Ibuprofen')) {
      throw new Error('TEST 6 FAIL: Removed medicine Ibuprofen still present in prescription medicines array!');
    }
    console.log('✓ Medicine list replaced completely (Aspirin, Paracetamol). Old medicine Ibuprofen removed cleanly without duplicates');

    // -----------------------------------------------------------------
    // TEST 7: Re-run MedWise & Fresh Analysis Replacement
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Re-run MedWise & Old Findings Replacement ---');
    const reqCheck2 = { user: docAUser, params: { id: rxB._id.toString() } };
    const resCheck2 = mockRes();
    await checkWithMedwise(reqCheck2, resCheck2, (err) => { if (err) throw err; });

    const freshRx = await Prescription.findById(rxB._id);
    const freshAnalysis = freshRx.medwiseAnalysis;

    if (!freshAnalysis) {
      throw new Error('TEST 7 FAIL: medwiseAnalysis missing after re-running MedWise!');
    }
    if (freshAnalysis.isOutdated) {
      throw new Error('TEST 7 FAIL: medwiseAnalysis is still marked outdated after fresh check!');
    }

    // Check interaction findings: Aspirin + Paracetamol has NO Aspirin-Ibuprofen interaction!
    const interactionFindings = freshAnalysis.checks?.interactions?.findings || [];
    const hasOldIbuprofenInteraction = interactionFindings.some(
      (f) => f.drugA === 'Ibuprofen' || f.drugB === 'Ibuprofen' || (f.message && f.message.includes('Ibuprofen'))
    );
    if (hasOldIbuprofenInteraction) {
      throw new Error('TEST 7 FAIL: Old Aspirin-Ibuprofen interaction finding remained in fresh MedWise analysis!');
    }
    console.log('✓ Fresh MedWise analysis replaced old analysis completely. Old Aspirin-Ibuprofen interaction removed from findings');

    // -----------------------------------------------------------------
    // TEST 8: Repeated Save / Re-run Duplicate Protection
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: Repeated Save / Re-run Duplicate Protection ---');
    // Save 3 times
    await updatePrescription(reqEdit, mockRes(), (err) => { if (err) throw err; });
    await updatePrescription(reqEdit, mockRes(), (err) => { if (err) throw err; });
    await checkWithMedwise(reqCheck2, mockRes(), (err) => { if (err) throw err; });

    const totalRxCountForPatient = await Prescription.countDocuments({ patientId: patUser._id });
    if (totalRxCountForPatient !== 1) {
      throw new Error(`TEST 8 FAIL: Duplicate prescriptions created! Count for patient: ${totalRxCountForPatient}`);
    }
    console.log('✓ Repeated saves and re-runs maintain exactly 1 prescription document without duplicates');

    // -----------------------------------------------------------------
    // TEST 9: Consultation-First Workflow Enforcement
    // -----------------------------------------------------------------
    console.log('\n--- TEST 9: Consultation-First Workflow Verification ---');
    // Create unconsulted patient
    const unconsultedPat = await User.create({
      name: `Unconsulted Pat ${ts}`,
      email: `unconsulted${ts}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    await PatientProfile.create({
      userId: unconsultedPat._id,
      mobileNumber: `97${String(ts).slice(-8)}`,
      dateOfBirth: '1992-02-02',
      gender: 'Female',
      address: { addressLine1: 'St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      emergencyContact: { name: 'Kin', relationship: 'Parent', mobileNumber: '9876543211' },
      profileCompleted: true,
    });

    const reqDirectRx = {
      user: docAUser,
      body: {
        patientId: unconsultedPat._id.toString(),
        patientPid: `PID-97${String(ts).slice(-8)}`,
        medicines: [{ medicineName: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '3 days', route: 'Oral' }],
      },
    };
    const resDirectRx = mockRes();
    await createPrescription(reqDirectRx, resDirectRx, (err) => { if (err) throw err; });

    if (resDirectRx.statusCode !== 400) {
      throw new Error(`TEST 9 FAIL: Consultation-first enforcement failed. Expected 400, got: ${resDirectRx.statusCode}`);
    }
    console.log('✓ Consultation-first workflow strictly enforced: Prescribing without consultation rejected with 400');

    // Clean up unconsulted pat
    await User.deleteOne({ _id: unconsultedPat._id });
    await PatientProfile.deleteOne({ userId: unconsultedPat._id });

    // -----------------------------------------------------------------
    // TEST 10: Doctor Approval Requires Fresh CLEARED Analysis
    // -----------------------------------------------------------------
    console.log('\n--- TEST 10: Outdated Approval Prevention Verification ---');
    // Edit prescription again
    await updatePrescription(reqEdit, mockRes(), (err) => { if (err) throw err; });

    // Attempt to approve without re-running MedWise (analysis is outdated)
    const reqApproveOutdated = { user: docAUser, params: { id: rxB._id.toString() } };
    const resApproveOutdated = mockRes();
    await approvePrescription(reqApproveOutdated, resApproveOutdated, (err) => { if (err) throw err; });

    if (resApproveOutdated.statusCode !== 400) {
      throw new Error(`TEST 10 FAIL: Approving outdated prescription was not blocked! Got status: ${resApproveOutdated.statusCode}`);
    }
    console.log('✓ Approval with outdated MedWise analysis rejected with 400 as expected');

    // -----------------------------------------------------------------
    // TEST 11: FULL DELIVERED PRESCRIPTION DELETION SEQUENCE
    // -----------------------------------------------------------------
    console.log('\n--- TEST 11: Delivered Prescription Deletion Sequence ---');
    // 1. Re-check MedWise on rxB so it can be approved
    await checkWithMedwise(reqCheck2, mockRes(), (err) => { if (err) throw err; });

    // 2. Approve prescription
    const reqApprove = { user: docAUser, params: { id: rxB._id.toString() } };
    const resApprove = mockRes();
    await approvePrescription(reqApprove, resApprove, (err) => { if (err) throw err; });
    if (!resApprove.data?.success) {
      throw new Error(`TEST 11 FAIL: Approval failed! Msg: ${resApprove.data?.message}`);
    }
    console.log('  1. Doctor A approved prescription');

    // 3. Pharmacist dispenses & marks delivered
    const rxDelivered = await Prescription.findByIdAndUpdate(
      rxB._id,
      {
        $set: {
          status: 'Delivered',
          sentToPharmacist: true,
          sentToPharmacistAt: new Date(),
          pharmacistId: pharmUser._id,
          dispensedAt: new Date(),
          deliveredByPharmacistId: pharmUser._id,
          deliveredAt: new Date(),
        },
      },
      { new: true }
    );
    console.log('  2. Prescription advanced to Delivered status');

    // Sync patient current medications as happens upon delivery
    await PatientProfile.findOneAndUpdate(
      { userId: patUser._id },
      {
        $push: {
          currentMedications: {
            medicineName: 'Aspirin 100mg',
            dosage: '100mg',
            frequency: '1-0-0',
            prescribedBy: docAUser.name,
            prescribedAt: new Date(),
            prescriptionId: rxB._id,
          },
        },
      }
    );

    // 4. Test that Doctor B (another doctor) CANNOT delete this Delivered prescription -> 403 Forbidden
    const reqDeliveredDocB = { user: docBUser, params: { id: rxB._id.toString() } };
    const resDeliveredDocB = mockRes();
    await deletePrescription(reqDeliveredDocB, resDeliveredDocB, (err) => { if (err) throw err; });
    if (resDeliveredDocB.statusCode !== 403) {
      throw new Error(`TEST 11 FAIL: Doctor B should get 403 deleting Delivered prescription, got ${resDeliveredDocB.statusCode}`);
    }
    console.log('  3. Doctor B (unauthorized) rejected with 403 Forbidden when trying to delete Delivered prescription');

    // 5. Authoring Doctor A deletes the Delivered prescription
    const reqDeliveredDocA = { user: docAUser, params: { id: rxB._id.toString() } };
    const resDeliveredDocA = mockRes();
    await deletePrescription(reqDeliveredDocA, resDeliveredDocA, (err) => { if (err) throw err; });
    if (!resDeliveredDocA.data?.success) {
      throw new Error(`TEST 11 FAIL: Authoring doctor failed to delete Delivered prescription! Msg: ${resDeliveredDocA.data?.message}`);
    }
    console.log('  4. Doctor A (author) successfully deleted Delivered prescription');

    // 6. Verify database state
    const deletedDeliveredRxInDB = await Prescription.findById(rxB._id);
    if (deletedDeliveredRxInDB) {
      throw new Error('TEST 11 FAIL: Delivered prescription still exists in MongoDB after deletion!');
    }

    const consultAfterDeliveredDelete = await Consultation.findById(consultation._id);
    if (consultAfterDeliveredDelete.prescriptionId != null) {
      throw new Error('TEST 11 FAIL: Consultation.prescriptionId was not cleared after Delivered prescription deletion!');
    }

    const patientProfileAfterDelete = await PatientProfile.findOne({ userId: patUser._id });
    const hasDeletedMed = patientProfileAfterDelete.currentMedications.some(
      (m) => m.prescriptionId && m.prescriptionId.toString() === rxB._id.toString()
    );
    if (hasDeletedMed) {
      throw new Error('TEST 11 FAIL: Patient currentMedications still contains reference to deleted prescription!');
    }
    console.log('  5. Verified MongoDB cleanup: Prescription deleted, Consultation.prescriptionId cleared, Patient currentMedications cleaned up cleanly');

    // Clean up test data
    console.log('\nCleaning up test records...');
    await User.deleteMany({ _id: { $in: [docAUser._id, docBUser._id, patUser._id, pharmUser._id] } });
    await DoctorProfile.deleteMany({ userId: { $in: [docAUser._id, docBUser._id] } });
    await PatientProfile.deleteMany({ userId: patUser._id });
    await PharmacistProfile.deleteMany({ userId: pharmUser._id });
    await Consultation.deleteMany({ _id: consultation._id });
    await Appointment.deleteMany({ _id: appointment._id });
    await Prescription.deleteMany({ _id: rxB._id });

    console.log('\n==================================================');
    console.log('ALL 10 DELETE & EDIT VERIFICATION TESTS PASSED!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB');
  }
}

runTests();
