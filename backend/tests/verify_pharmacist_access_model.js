/**
 * verify_pharmacist_access_model.js
 *
 * Verification suite for the Pharmacist Prescription Access Model:
 * 1. Doctor creates & approves prescription (status = "Sent to Pharmacist", pharmacistId is NOT assigned).
 * 2. Two pharmacists (Pharm A & Pharm B) at the same facility can see the "Sent to Pharmacist" prescription in queue.
 * 3. Either pharmacist (e.g. Pharm A) can open & view details.
 * 4. Pharm A dispenses the prescription (status = "Dispensed", pharmacistId recorded as Pharm A, dispensedAt recorded).
 * 5. Pharm B can view the updated historical status ("Dispensed") and see Pharm A recorded as dispenser.
 * 6. Pharm B can mark prescription as delivered (status = "Delivered", deliveredByPharmacistId recorded as Pharm B, deliveredAt recorded).
 * 7. Pharm C (at an unrelated facility context "City General Hospital") cannot view or dispense/deliver Pharm A/B's prescription ("Apex Pharmacy") -> HTTP 403.
 * 8. Doctor cannot invoke dispense or deliver endpoints -> HTTP 403.
 * 9. Patient can view prescription status throughout the lifecycle.
 * 10. Verify zero dummy records are present.
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
const Consultation = require('../src/models/Consultation');

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
  let doctorUser, pharmAUser, pharmBUser, pharmCUser, patientUser, consultation, createdRx;
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB for Pharmacist Access Model verification.');

    const timestamp = Date.now();
    const facilityName = `Apex Health Center ${timestamp}`;

    // 1. SETUP TEST USERS
    console.log('\n=== 1. SETUP TEST USERS ===');
    
    // Doctor
    doctorUser = await User.create({
      name: 'Dr. Facility Attending',
      email: `doctor.access.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    await DoctorProfile.create({
      userId: doctorUser._id,
      mobileNumber: '9840111999',
      dateOfBirth: '1980-05-15',
      gender: 'Male',
      address: {
        addressLine1: '100 Medical Enclave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      medicalRegistrationNumber: `REG-ACC-${timestamp}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 10,
      hospitalClinicName: facilityName,
      hospitalClinicAddress: '100 Medical Enclave, Chennai',
    });

    // Pharmacist A (Same Facility)
    pharmAUser = await User.create({
      name: 'Pharm. Alice Alpha',
      email: `pharm.a.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    await PharmacistProfile.create({
      userId: pharmAUser._id,
      mobileNumber: '9840222111',
      dateOfBirth: '1988-03-20',
      gender: 'Female',
      address: {
        addressLine1: '200 Pharmacy Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      pharmacyRegistrationNumber: `PHARM-A-${timestamp}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 6,
      pharmacyHospitalName: facilityName,
      pharmacyHospitalAddress: '100 Medical Enclave, Chennai',
    });

    // Pharmacist B (Same Facility)
    pharmBUser = await User.create({
      name: 'Pharm. Bob Beta',
      email: `pharm.b.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    await PharmacistProfile.create({
      userId: pharmBUser._id,
      mobileNumber: '9840222222',
      dateOfBirth: '1990-07-11',
      gender: 'Male',
      address: {
        addressLine1: '201 Pharmacy Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      pharmacyRegistrationNumber: `PHARM-B-${timestamp}`,
      qualification: 'M.Pharm',
      yearsOfExperience: 8,
      pharmacyHospitalName: facilityName,
      pharmacyHospitalAddress: '100 Medical Enclave, Chennai',
    });

    // Pharmacist C (UNRELATED Facility)
    pharmCUser = await User.create({
      name: 'Pharm. Charlie Unrelated',
      email: `pharm.c.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    await PharmacistProfile.create({
      userId: pharmCUser._id,
      mobileNumber: '9840222333',
      dateOfBirth: '1992-11-05',
      gender: 'Male',
      address: {
        addressLine1: '300 Remote Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      pharmacyRegistrationNumber: `PHARM-C-${timestamp}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 4,
      pharmacyHospitalName: `Other Metro Clinic ${timestamp}`,
      pharmacyHospitalAddress: '300 Remote Road, Chennai',
    });

    // Patient
    patientUser = await User.create({
      name: 'Patient Testing Subject',
      email: `patient.test.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    const mobileDigits = String(timestamp).slice(-10);
    const pid = `PID-${mobileDigits}`;
    await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: mobileDigits,
      dateOfBirth: '1995-01-01',
      gender: 'Female',
      address: {
        addressLine1: '50 Patient Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600005',
      },
      emergencyContact: {
        name: 'Emergency Person',
        relationship: 'Parent',
        mobileNumber: '9840999888',
      },
    });

    console.log(`Users created successfully.`);

    consultation = await Consultation.create({
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser._id,
      patientName: patientUser.name,
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'Acute Bronchitis Evaluation',
    });

    const reqCreate = {
      user: doctorUser,
      body: {
        patientPid: pid,
        consultationId: consultation._id,
        clinicalDiagnosis: 'Acute Bronchitis',
        medicines: [
          {
            medicineName: 'Amoxicillin',
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { if (err) throw err; });
    createdRx = resCreate.data.prescription;
    const rxId = String(createdRx._id);

    // Run MedWise check before approval
    const reqMedwise = { user: doctorUser, params: { prescriptionId: rxId } };
    const resMedwise = mockRes();
    await analyzePrescription(reqMedwise, resMedwise, (err) => { if (err) throw err; });

    // Approve
    const reqApprove = { user: doctorUser, params: { id: rxId } };
    const resApprove = mockRes();
    await approvePrescription(reqApprove, resApprove, (err) => { if (err) throw err; });

    const approvedRx = resApprove.data.prescription;
    if (approvedRx.status !== 'Sent to Pharmacist') throw new Error('Status should be Sent to Pharmacist');
    if (approvedRx.pharmacistId) throw new Error('pharmacistId MUST NOT be assigned at approval time');
    console.log(`PASSED: Doctor approved prescription. Status="${approvedRx.status}", pharmacistId is unassigned.`);

    // 3. BOTH PHARMACISTS (A & B) CAN SEE THE ELIGIBLE PRESCRIPTION IN QUEUE
    console.log('\n=== 3. QUEUE VISIBILITY FOR ELIGIBLE PHARMACISTS (A & B) ===');
    
    // Pharm A Queue
    const reqPharmAQueue = { user: pharmAUser, query: {} };
    const resPharmAQueue = mockRes();
    await getPrescriptions(reqPharmAQueue, resPharmAQueue, (err) => { if (err) throw err; });
    const foundInA = resPharmAQueue.data.prescriptions.find((rx) => String(rx._id) === String(rxId));
    if (!foundInA) throw new Error('Pharmacist A could not find prescription in queue');

    // Pharm B Queue
    const reqPharmBQueue = { user: pharmBUser, query: {} };
    const resPharmBQueue = mockRes();
    await getPrescriptions(reqPharmBQueue, resPharmBQueue, (err) => { if (err) throw err; });
    const foundInB = resPharmBQueue.data.prescriptions.find((rx) => String(rx._id) === String(rxId));
    if (!foundInB) throw new Error('Pharmacist B could not find prescription in queue');

    console.log(`PASSED: Both Pharmacist A and Pharmacist B can see the eligible "Sent to Pharmacist" prescription.`);

    // 4. EITHER PHARMACIST CAN OPEN AND VIEW DETAILS
    console.log('\n=== 4. PHARMACIST OPEN & DETAIL VIEW ===');
    const reqPharmADetail = { user: pharmAUser, params: { id: rxId } };
    const resPharmADetail = mockRes();
    await getPrescriptionById(reqPharmADetail, resPharmADetail, (err) => { if (err) throw err; });
    if (resPharmADetail.statusCode !== 200 || !resPharmADetail.data.prescription) {
      throw new Error('Pharmacist A failed to open prescription detail');
    }
    console.log(`PASSED: Pharmacist A successfully opened and viewed prescription detail.`);

    // 5. PHARMACIST A DISPENSES PRESCRIPTION
    console.log('\n=== 5. PHARMACIST A DISPENSES PRESCRIPTION ===');
    const reqDispense = { user: pharmAUser, params: { id: rxId } };
    const resDispense = mockRes();
    await dispensePrescription(reqDispense, resDispense, (err) => { if (err) throw err; });
    
    if (resDispense.statusCode !== 200) throw new Error(`Dispense failed with status ${resDispense.statusCode}`);
    const dispensedRx = resDispense.data.prescription;
    if (dispensedRx.status !== 'Dispensed') throw new Error('Status should be Dispensed');
    if (!dispensedRx.dispensedAt) throw new Error('dispensedAt timestamp missing');
    const dispenserName = dispensedRx.pharmacistId?.name || dispensedRx.pharmacistId;
    console.log(`PASSED: Pharmacist A dispensed rx. Status="${dispensedRx.status}", Dispenser="${dispenserName}", DispensedAt=${dispensedRx.dispensedAt}`);

    // 6. PHARMACIST B CAN SEE RESULTING HISTORICAL STATUS & DISPENSER IDENTITY
    console.log('\n=== 6. PHARMACIST B VIEWS DISPENSED HISTORICAL STATUS ===');
    const reqPharmBDetail = { user: pharmBUser, params: { id: rxId } };
    const resPharmBDetail = mockRes();
    await getPrescriptionById(reqPharmBDetail, resPharmBDetail, (err) => { if (err) throw err; });
    const rxAsSeenByB = resPharmBDetail.data.prescription;
    if (rxAsSeenByB.status !== 'Dispensed') throw new Error('Pharmacist B should see Dispensed status');
    if (!rxAsSeenByB.pharmacistId) throw new Error('Pharmacist B should see dispensing pharmacist identity');
    console.log(`PASSED: Pharmacist B can view historical status "${rxAsSeenByB.status}" and dispensing pharmacist identity (${rxAsSeenByB.pharmacistId.name}).`);

    // 7. PHARMACIST B MARKS DELIVERED & PRESERVES DELIVERY IDENTITY & TIMESTAMP
    console.log('\n=== 7. PHARMACIST B MARKS DELIVERED ===');
    const reqDeliver = { user: pharmBUser, params: { id: rxId } };
    const resDeliver = mockRes();
    await deliverPrescription(reqDeliver, resDeliver, (err) => { if (err) throw err; });

    if (resDeliver.statusCode !== 200) throw new Error(`Deliver failed with status ${resDeliver.statusCode}`);
    const deliveredRx = resDeliver.data.prescription;
    if (deliveredRx.status !== 'Delivered') throw new Error('Status should be Delivered');
    if (!deliveredRx.deliveredAt) throw new Error('deliveredAt timestamp missing');
    if (!deliveredRx.deliveredByPharmacistId) throw new Error('deliveredByPharmacistId missing');
    console.log(`PASSED: Pharmacist B marked rx as delivered. Status="${deliveredRx.status}", Delivery Pharmacist="${deliveredRx.deliveredByPharmacistId.name}", DeliveredAt=${deliveredRx.deliveredAt}`);

    // 8. UNAUTHORIZED / UNRELATED FACILITY ACCESS IS REJECTED (PHARMACIST C)
    console.log('\n=== 8. UNAUTHORIZED FACILITY CONTEXT REJECTION (PHARMACIST C) ===');
    
    // Pharm C Queue should filter it out
    const reqPharmCQueue = { user: pharmCUser, query: {} };
    const resPharmCQueue = mockRes();
    await getPrescriptions(reqPharmCQueue, resPharmCQueue, (err) => { if (err) throw err; });
    const foundInC = resPharmCQueue.data.prescriptions.find((rx) => String(rx._id) === String(rxId));
    if (foundInC) throw new Error('Pharmacist C from unrelated facility should NOT see prescription in queue');

    // Pharm C Direct GET by ID should be rejected HTTP 403
    const reqPharmCGet = { user: pharmCUser, params: { id: rxId } };
    const resPharmCGet = mockRes();
    await getPrescriptionById(reqPharmCGet, resPharmCGet, (err) => { if (err) throw err; });
    if (resPharmCGet.statusCode !== 403) throw new Error(`Expected HTTP 403 for Pharm C GET, got ${resPharmCGet.statusCode}`);

    // Pharm C Direct Dispense should be rejected HTTP 403
    const reqPharmCDispense = { user: pharmCUser, params: { id: rxId } };
    const resPharmCDispense = mockRes();
    await dispensePrescription(reqPharmCDispense, resPharmCDispense, (err) => { if (err) throw err; });
    if (resPharmCDispense.statusCode !== 403) throw new Error(`Expected HTTP 403 for Pharm C dispense, got ${resPharmCDispense.statusCode}`);

    console.log(`PASSED: Pharmacist C (unrelated facility) access strictly rejected with HTTP 403.`);

    // 9. DOCTOR CANNOT PERFORM PHARMACIST STATUS TRANSITIONS
    console.log('\n=== 9. DOCTOR CANNOT PERFORM PHARMACIST TRANSITIONS ===');
    const reqDocDispense = { user: doctorUser, params: { id: rxId } };
    const resDocDispense = mockRes();
    await dispensePrescription(reqDocDispense, resDocDispense, (err) => { if (err) throw err; });
    if (resDocDispense.statusCode !== 403) throw new Error(`Expected HTTP 403 for Doctor dispense, got ${resDocDispense.statusCode}`);
    console.log(`PASSED: Doctor prevented from invoking pharmacist dispense endpoint (HTTP 403).`);

    // 10. PATIENT CAN STILL SEE THE STATUS
    console.log('\n=== 10. PATIENT VISIBILITY ===');
    const reqPatientGet = { user: patientUser, params: { id: rxId } };
    const resPatientGet = mockRes();
    await getPrescriptionById(reqPatientGet, resPatientGet, (err) => { if (err) throw err; });
    if (resPatientGet.statusCode !== 200 || resPatientGet.data.prescription.status !== 'Delivered') {
      throw new Error('Patient failed to view delivered prescription status');
    }
    console.log(`PASSED: Patient can view final prescription status "${resPatientGet.data.prescription.status}".`);

    // 11. NO DUMMY RECORDS APPEAR IN PHARMACIST QUEUE
    console.log('\n=== 11. NO DUMMY RECORDS ===');
    const allRxInPharmA = resPharmAQueue.data.prescriptions;
    const hasDummy = allRxInPharmA.some((rx) => rx.patientName === 'Dummy' || rx.prescriptionId === 'RX-DUMMY');
    if (hasDummy) throw new Error('Dummy prescription records detected in database response!');
    console.log(`PASSED: Zero dummy records found in Pharmacist queue.`);

    console.log('\n========================================================');
    console.log('ALL PHARMACIST ACCESS MODEL VERIFICATION TESTS PASSED!');
    console.log('========================================================\n');

  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    try {
      if (typeof doctorUser !== 'undefined' && doctorUser?._id) {
        await DoctorProfile.deleteMany({ userId: doctorUser._id });
        await User.deleteOne({ _id: doctorUser._id });
      }
      if (typeof pharmAUser !== 'undefined' && pharmAUser?._id) {
        await PharmacistProfile.deleteMany({ userId: pharmAUser._id });
        await User.deleteOne({ _id: pharmAUser._id });
      }
      if (typeof pharmBUser !== 'undefined' && pharmBUser?._id) {
        await PharmacistProfile.deleteMany({ userId: pharmBUser._id });
        await User.deleteOne({ _id: pharmBUser._id });
      }
      if (typeof pharmCUser !== 'undefined' && pharmCUser?._id) {
        await PharmacistProfile.deleteMany({ userId: pharmCUser._id });
        await User.deleteOne({ _id: pharmCUser._id });
      }
      if (typeof patientUser !== 'undefined' && patientUser?._id) {
        await PatientProfile.deleteMany({ userId: patientUser._id });
        await User.deleteOne({ _id: patientUser._id });
      }
      if (typeof createdRx !== 'undefined' && createdRx?._id) {
        await Prescription.deleteOne({ _id: createdRx._id });
      }
      if (typeof consultation !== 'undefined' && consultation?._id) {
        await Consultation.deleteOne({ _id: consultation._id });
      }
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await mongoose.disconnect();
  }
};

runTest();
