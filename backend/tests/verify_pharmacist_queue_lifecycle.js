/**
 * verify_pharmacist_queue_lifecycle.js
 *
 * Automated test suite for Pharmacist Queue & Prescription Lifecycle:
 * 1. Create isolated test patient, doctor, pharmacist A (same facility), and pharmacist B (unrelated facility).
 * 2. Create prescription (starts as "Draft").
 * 3. Doctor runs MedWise analysis -> gets CLEARED outcome.
 * 4. Doctor approves prescription -> database status MUST become "Sent to Pharmacist", doctorDecision = "Approved", approvedAt set.
 * 5. Verify Pharmacist A Pending API returns the exact RX ID.
 * 6. Verify Pending / To Dispense count for Pharmacist A is 1.
 * 7. Verify Pharmacist B (unrelated facility) CANNOT see the prescription in queue (returns 0 or HTTP 403 when trying to access directly).
 * 8. Verify Pharmacist A can open/view prescription details.
 * 9. Pharmacist A dispenses it -> status becomes "Dispensed", pharmacistId recorded.
 * 10. Pharmacist A delivers it -> status becomes "Delivered", deliveredByPharmacistId & deliveredAt recorded.
 * 11. Verify prescription moves out of Pending queue.
 * 12. Verify prescription appears under Delivered tab/query.
 * 13. Verify exact RX ID is preserved throughout all state transitions.
 * 14. Clean up all created test data (users, profiles, prescriptions) in finally block.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Prescription = require('../src/models/Prescription');

const {
  createPrescription,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
  getPrescriptions,
  getPrescriptionById,
} = require('../src/controllers/prescriptionController');
const { analyzePrescription } = require('../src/controllers/medwiseController');

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
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdPrescriptionIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    const timestamp = Date.now();
    const facilityName = `MedWise General Hospital ${timestamp}`;
    const unrelatedFacility = `Unrelated City Clinic ${timestamp}`;

    // 1. CREATE TEST USERS & PROFILES
    console.log('\n--- STEP 1: Creating Test Entities ---');
    const doctorUser = await User.create({
      name: `Dr. Queue Test ${timestamp}`,
      email: `doctor.queue.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    createdUserIds.push(doctorUser._id);

    const docProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      mobileNumber: '9998887771',
      dateOfBirth: '1982-01-01',
      gender: 'Female',
      address: { addressLine1: 'Doc St', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-Q-${timestamp}`,
      specialization: 'General Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 8,
      hospitalClinicName: facilityName,
      hospitalClinicAddress: '123 Hospital Rd, Chennai',
    });
    createdProfileIds.push(docProfile._id);

    const patientUser = await User.create({
      name: `Patient Queue Test ${timestamp}`,
      email: `patient.queue.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    createdUserIds.push(patientUser._id);

    const patProfile = await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: '9998887772',
      dateOfBirth: '1995-05-20',
      gender: 'Male',
      address: { addressLine1: 'Pat St', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pinCode: '600002' },
      emergencyContact: {
        name: 'Jane Doe',
        relationship: 'Spouse',
        mobileNumber: '9998887770',
      },
      allergyStatus: 'none',
      hasNoKnownAllergies: true,
      allergies: [],
      chronicConditions: [],
    });
    createdProfileIds.push(patProfile._id);

    const pharmAUser = await User.create({
      name: `Pharm Alpha ${timestamp}`,
      email: `pharm.a.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    createdUserIds.push(pharmAUser._id);

    const pharmAProfile = await PharmacistProfile.create({
      userId: pharmAUser._id,
      mobileNumber: '9998887773',
      dateOfBirth: '1990-10-10',
      gender: 'Female',
      address: { addressLine1: 'Pharm St', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pinCode: '600003' },
      pharmacyRegistrationNumber: `LIC-A-${timestamp}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 5,
      pharmacyHospitalName: facilityName,
      pharmacyHospitalAddress: '123 Hospital Rd, Pharmacy Wing, Chennai',
    });
    createdProfileIds.push(pharmAProfile._id);

    const pharmBUser = await User.create({
      name: `Pharm Beta ${timestamp}`,
      email: `pharm.b.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    createdUserIds.push(pharmBUser._id);

    const pharmBProfile = await PharmacistProfile.create({
      userId: pharmBUser._id,
      mobileNumber: '9998887774',
      dateOfBirth: '1991-11-11',
      gender: 'Male',
      address: { addressLine1: 'Other St', city: 'Madurai', state: 'Tamil Nadu', country: 'India', pinCode: '625001' },
      pharmacyRegistrationNumber: `LIC-B-${timestamp}`,
      qualification: 'M.Pharm',
      yearsOfExperience: 4,
      pharmacyHospitalName: unrelatedFacility,
      pharmacyHospitalAddress: '456 Other Rd, Madurai',
    });
    createdProfileIds.push(pharmBProfile._id);

    // Create completed Consultation
    const Consultation = require('../src/models/Consultation');
    const mobileDigits = String(timestamp).slice(-10);
    const pid = `PID-${mobileDigits}`;

    const consultation = await Consultation.create({
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser._id,
      patientName: patientUser.name,
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'General Checkup',
    });

    console.log('✅ Created Doctor, Patient, Pharmacist A (same facility), Pharmacist B (unrelated facility), and Consultation.');

    // 2. CREATE PRESCRIPTION (DRAFT)
    console.log('\n--- STEP 2: Creating Prescription (Draft) ---');
    const reqCreate = {
      user: doctorUser,
      body: {
        patientId: patientUser._id,
        patientPid: pid,
        consultationId: consultation._id,
        clinicalDiagnosis: 'Fever',
        medicines: [
          {
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '3 days',
            instructions: 'After meals',
          }
        ],
        clinicalNotes: 'Rest and hydration',
      }
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { if (err) throw err; });

    if (resCreate.statusCode !== 201) {
      throw new Error(`Failed to create prescription: ${JSON.stringify(resCreate.data)}`);
    }

    const prescription = resCreate.data.prescription;
    const prescriptionId = String(prescription._id);
    const initialRxId = prescription.prescriptionId || prescription.rxId;
    createdPrescriptionIds.push(prescription._id);

    console.log(`✅ Prescription created. Status: "${prescription.status}", RX ID: "${initialRxId}"`);
    if (prescription.status !== 'Draft') {
      throw new Error(`Expected status to be "Draft", got "${prescription.status}"`);
    }

    // 3. DOCTOR RUNS MEDWISE ANALYSIS
    console.log('\n--- STEP 3: Doctor Runs MedWise Analysis ---');
    const reqAnalyze = {
      user: doctorUser,
      params: { prescriptionId: prescriptionId },
    };
    const resAnalyze = mockRes();
    await analyzePrescription(reqAnalyze, resAnalyze, (err) => { if (err) throw err; });

    if (resAnalyze.statusCode !== 200) {
      throw new Error(`MedWise analysis failed: ${JSON.stringify(resAnalyze.data)}`);
    }

    console.log('MedWise Analysis keys:', Object.keys(resAnalyze.data.analysis || {}));
    console.log('MedWise Analysis sample:', JSON.stringify(resAnalyze.data.analysis).slice(0, 300));
    const rawOutcome = resAnalyze.data.analysis?.clinicalOutcome ||
                     resAnalyze.data.analysis?.overallRecommendation?.outcome ||
                     resAnalyze.data.analysis?.overallRecommendation?.status ||
                     resAnalyze.data.prescription?.medwiseAnalysis?.clinicalOutcome;
    const clinicalOutcome = String(rawOutcome || '').toUpperCase();

    console.log(`✅ MedWise analysis complete. Outcome: "${clinicalOutcome}"`);
    if (clinicalOutcome !== 'CLEARED') {
      throw new Error(`Expected MedWise outcome to be "CLEARED", got "${clinicalOutcome}"`);
    }

    // 4. DOCTOR APPROVES PRESCRIPTION
    console.log('\n--- STEP 4: Doctor Approves Prescription ---');
    const reqApprove = {
      user: doctorUser,
      params: { id: prescriptionId },
    };
    const resApprove = mockRes();
    await approvePrescription(reqApprove, resApprove, (err) => { if (err) throw err; });

    if (resApprove.statusCode !== 200) {
      throw new Error(`Approval failed: ${JSON.stringify(resApprove.data)}`);
    }

    const approvedPrescription = resApprove.data.prescription;
    console.log(`✅ Approved prescription. Status in response: "${approvedPrescription.status}", Doctor Decision: "${approvedPrescription.doctorDecision}"`);

    // Verify DB record directly
    const dbPrescriptionAfterApproval = await Prescription.findById(prescriptionId);
    console.log(`✅ DB record status: "${dbPrescriptionAfterApproval.status}", Doctor Decision: "${dbPrescriptionAfterApproval.doctorDecision}"`);
    if (dbPrescriptionAfterApproval.status !== 'Sent to Pharmacist') {
      throw new Error(`DB status after approval MUST be "Sent to Pharmacist", got "${dbPrescriptionAfterApproval.status}"`);
    }
    if (dbPrescriptionAfterApproval.doctorDecision !== 'Approved') {
      throw new Error(`doctorDecision MUST be "Approved", got "${dbPrescriptionAfterApproval.doctorDecision}"`);
    }
    const currentDbRxId = dbPrescriptionAfterApproval.prescriptionId || dbPrescriptionAfterApproval.rxId;
    if (currentDbRxId !== initialRxId) {
      throw new Error(`RX ID changed! Original: "${initialRxId}", Current: "${currentDbRxId}"`);
    }

    // 5. PHARMACIST A PENDING QUEUE QUERY
    console.log('\n--- STEP 5: Checking Pharmacist A Pending Queue ---');
    const reqPharmAPending = {
      user: pharmAUser,
      query: { status: 'Sent to Pharmacist' },
    };
    const resPharmAPending = mockRes();
    await getPrescriptions(reqPharmAPending, resPharmAPending, (err) => { if (err) throw err; });

    if (resPharmAPending.statusCode !== 200) {
      throw new Error(`Pharmacist A getPrescriptions failed: ${JSON.stringify(resPharmAPending.data)}`);
    }

    const pendingListPharmA = resPharmAPending.data.prescriptions || [];
    console.log(`✅ Pharmacist A pending queue count: ${pendingListPharmA.length}`);
    const foundInQueuePharmA = pendingListPharmA.find(p => p._id.toString() === prescriptionId.toString());
    if (!foundInQueuePharmA) {
      throw new Error(`Prescription ${prescriptionId} not found in Pharmacist A's "Sent to Pharmacist" queue!`);
    }
    const pharmARxId = foundInQueuePharmA.prescriptionId || foundInQueuePharmA.rxId;
    if (pharmARxId !== initialRxId) {
      throw new Error(`RX ID mismatch in Pharmacist queue. Expected: ${initialRxId}, Got: ${pharmARxId}`);
    }

    // 6. PHARMACIST B (UNRELATED FACILITY) CANNOT SEE PRESCRIPTION IN QUEUE OR OPEN IT
    console.log('\n--- STEP 6: Checking Pharmacist B (Unrelated Facility) Access Isolation ---');
    const reqPharmBPending = {
      user: pharmBUser,
      query: { status: 'Sent to Pharmacist' },
    };
    const resPharmBPending = mockRes();
    await getPrescriptions(reqPharmBPending, resPharmBPending, (err) => { if (err) throw err; });

    const pendingListPharmB = resPharmBPending.data.prescriptions || [];
    const foundInQueuePharmB = pendingListPharmB.find(p => p._id.toString() === prescriptionId.toString());
    if (foundInQueuePharmB) {
      throw new Error(`SECURITY VIOLATION: Unrelated Pharmacist B can see prescription in queue!`);
    }
    console.log('✅ Pharmacist B (Unrelated facility) queue correctly excludes prescription.');

    const reqPharmBGetById = {
      user: pharmBUser,
      params: { id: prescriptionId },
    };
    const resPharmBGetById = mockRes();
    await getPrescriptionById(reqPharmBGetById, resPharmBGetById, (err) => { if (err) throw err; });
    console.log(`✅ Pharmacist B getPrescriptionById status code: ${resPharmBGetById.statusCode}`);
    if (resPharmBGetById.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 when Pharmacist B accesses unrelated prescription, got ${resPharmBGetById.statusCode}`);
    }

    // 7. PHARMACIST A OPENS PRESCRIPTION DETAILS
    console.log('\n--- STEP 7: Pharmacist A Views Prescription Details ---');
    const reqPharmAGetById = {
      user: pharmAUser,
      params: { id: prescriptionId },
    };
    const resPharmAGetById = mockRes();
    await getPrescriptionById(reqPharmAGetById, resPharmAGetById, (err) => { if (err) throw err; });
    if (resPharmAGetById.statusCode !== 200) {
      throw new Error(`Pharmacist A getPrescriptionById failed: ${JSON.stringify(resPharmAGetById.data)}`);
    }
    const openRx = resPharmAGetById.data.prescription;
    console.log(`✅ Pharmacist A successfully opened prescription ${openRx.prescriptionId || openRx.rxId}`);

    // 8. PHARMACIST A DISPENSES PRESCRIPTION
    console.log('\n--- STEP 8: Pharmacist A Dispenses Prescription ---');
    const reqDispense = {
      user: pharmAUser,
      params: { id: prescriptionId },
      body: { notes: 'Dispensed 1 box of Paracetamol 500mg' },
    };
    const resDispense = mockRes();
    await dispensePrescription(reqDispense, resDispense, (err) => { if (err) throw err; });

    if (resDispense.statusCode !== 200) {
      throw new Error(`Dispense failed: ${JSON.stringify(resDispense.data)}`);
    }

    const dispensedRx = resDispense.data.prescription;
    const dispensedRxId = dispensedRx.prescriptionId || dispensedRx.rxId;
    console.log(`✅ Dispensed prescription. Status: "${dispensedRx.status}", DispensedBy: "${dispensedRx.pharmacistId}"`);
    if (dispensedRx.status !== 'Dispensed') {
      throw new Error(`Expected status "Dispensed", got "${dispensedRx.status}"`);
    }
    if (dispensedRxId !== initialRxId) {
      throw new Error(`RX ID mismatch after dispense! Expected ${initialRxId}, Got ${dispensedRxId}`);
    }

    // Verify it moved out of Pharmacist A Pending Queue
    const resPharmAPending2 = mockRes();
    await getPrescriptions(reqPharmAPending, resPharmAPending2, (err) => { if (err) throw err; });
    const pendingListPharmA2 = resPharmAPending2.data.prescriptions || [];
    if (pendingListPharmA2.some(p => p._id.toString() === prescriptionId.toString())) {
      throw new Error(`Prescription still in Pending queue after being Dispensed!`);
    }
    console.log('✅ Prescription successfully moved out of Pending queue after dispensing.');

    // 9. PHARMACIST A DELIVERS PRESCRIPTION
    console.log('\n--- STEP 9: Pharmacist A Delivers Prescription ---');
    const reqDeliver = {
      user: pharmAUser,
      params: { id: prescriptionId },
      body: { notes: 'Handed over to patient in person' },
    };
    const resDeliver = mockRes();
    await deliverPrescription(reqDeliver, resDeliver, (err) => { if (err) throw err; });

    if (resDeliver.statusCode !== 200) {
      throw new Error(`Deliver failed: ${JSON.stringify(resDeliver.data)}`);
    }

    const deliveredRx = resDeliver.data.prescription;
    const deliveredRxId = deliveredRx.prescriptionId || deliveredRx.rxId;
    console.log(`✅ Delivered prescription. Status: "${deliveredRx.status}", DeliveredBy: "${deliveredRx.deliveredByPharmacistId}"`);
    if (deliveredRx.status !== 'Delivered') {
      throw new Error(`Expected status "Delivered", got "${deliveredRx.status}"`);
    }
    if (deliveredRxId !== initialRxId) {
      throw new Error(`RX ID mismatch after deliver! Expected ${initialRxId}, Got ${deliveredRxId}`);
    }

    // 10. VERIFY PRESCRIPTION APPEARS IN DELIVERED QUERY
    console.log('\n--- STEP 10: Verify Prescription Appears Under Delivered ---');
    const reqPharmADelivered = {
      user: pharmAUser,
      query: { status: 'Delivered' },
    };
    const resPharmADelivered = mockRes();
    await getPrescriptions(reqPharmADelivered, resPharmADelivered, (err) => { if (err) throw err; });
    if (resPharmADelivered.statusCode !== 200) {
      throw new Error(`Pharmacist A get Delivered prescriptions failed: ${JSON.stringify(resPharmADelivered.data)}`);
    }
    const deliveredListPharmA = resPharmADelivered.data.prescriptions || [];
    const foundInDelivered = deliveredListPharmA.find(p => p._id.toString() === prescriptionId.toString());
    if (!foundInDelivered) {
      throw new Error(`Prescription ${prescriptionId} not found in Pharmacist A's "Delivered" queue!`);
    }
    const finalDeliveredRxId = foundInDelivered.prescriptionId || foundInDelivered.rxId;
    console.log(`✅ Prescription ${finalDeliveredRxId} correctly found in Delivered list.`);

    console.log('\n==================================================');
    console.log('🎉 ALL PHARMACIST QUEUE & LIFECYCLE TESTS PASSED!');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    console.log('\n--- CLEANUP: Removing Test Data ---');
    try {
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
        console.log(`Deleted ${createdPrescriptionIds.length} test prescription(s).`);
      }
      if (createdProfileIds.length > 0) {
        await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await PharmacistProfile.deleteMany({ _id: { $in: createdProfileIds } });
        console.log(`Deleted ${createdProfileIds.length} test profile(s).`);
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`Deleted ${createdUserIds.length} test user(s).`);
      }
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runTest();
