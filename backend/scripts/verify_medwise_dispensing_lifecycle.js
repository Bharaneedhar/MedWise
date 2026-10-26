/**
 * verify_medwise_dispensing_lifecycle.js
 *
 * Phase 3.3 + 3.4 Verification Suite — Dispensing, Delivery & Patient Tracking
 *
 * Tests:
 * 1. Doctor creates & approves prescription (status = "Sent to Pharmacist", doctorDecision = "Approved").
 * 2. Pharmacist views pending queue (status = "Sent to Pharmacist").
 * 3. Pharmacist dispenses prescription (status = "Dispensed", dispensedAt timestamp present).
 * 4. Pharmacist marks prescription as delivered (status = "Delivered", deliveredAt timestamp present).
 * 5. Invalid status transitions are rejected (HTTP 400).
 * 6. Doctor cannot access pharmacist dispensing/delivery endpoints (HTTP 403).
 * 7. Patient cannot access pharmacist dispensing/delivery endpoints (HTTP 403).
 * 8. Patient A can view their own prescription details and track status (HTTP 200).
 * 9. Patient B cannot view Patient A's prescription (HTTP 403).
 * 10. Patient cannot modify prescription data (HTTP 403).
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
  dispensePrescription,
  deliverPrescription,
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
    console.log('Connected to DB for MedWise Dispensing, Delivery & Patient Tracking verification.');

    const timestamp = Date.now();

    // 1. SETUP USERS: DOCTOR, PHARMACIST, PATIENT A, PATIENT B
    console.log('\n=== 1. SETUP TEST USERS ===');
    const doctorUser = await User.create({
      name: 'Dr. Lifecycle Specialist',
      email: `doctor.lifecycle.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    await DoctorProfile.create({
      userId: doctorUser._id,
      mobileNumber: '9840111222',
      dateOfBirth: '1982-04-10',
      gender: 'Male',
      address: {
        addressLine1: '400 Medical Blvd',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600010',
      },
      medicalRegistrationNumber: `REG-LIFECYCLE-${timestamp}`,
      specialization: 'Internal Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 15,
      hospitalClinicName: 'Apex Health Center',
      hospitalClinicAddress: '400 Medical Blvd, Chennai',
    });

    const pharmacistUser = await User.create({
      name: 'Pharm. Dispenser Expert',
      email: `pharmacist.lifecycle.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    await PharmacistProfile.create({
      userId: pharmacistUser._id,
      mobileNumber: '9840333444',
      dateOfBirth: '1987-07-20',
      gender: 'Female',
      address: {
        addressLine1: '500 Pharmacy Avenue',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600020',
      },
      pharmacyRegistrationNumber: `PHARM-LIFECYCLE-${timestamp}`,
      qualification: 'M.Pharm',
      yearsOfExperience: 9,
      pharmacyHospitalName: 'Apex Pharmacy',
      pharmacyHospitalAddress: '500 Pharmacy Avenue, Chennai',
    });

    const patientAUser = await User.create({
      name: 'Patient Alpha Subject',
      email: `patient.alpha.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    const mobileDigitsA = String(timestamp).slice(-10);
    const pidA = `PID-${mobileDigitsA}`;
    await PatientProfile.create({
      userId: patientAUser._id,
      mobileNumber: mobileDigitsA,
      dateOfBirth: '1990-08-12',
      gender: 'Male',
      address: {
        addressLine1: '10 Alpha Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600030',
      },
      emergencyContact: {
        name: 'Alpha Contact',
        relationship: 'Sibling',
        mobileNumber: '9840888888',
      },
    });

    const patientBUser = await User.create({
      name: 'Patient Beta Subject',
      email: `patient.beta.${timestamp}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    const mobileDigitsB = String(timestamp + 1).slice(-10);
    const pidB = `PID-${mobileDigitsB}`;
    await PatientProfile.create({
      userId: patientBUser._id,
      mobileNumber: mobileDigitsB,
      dateOfBirth: '1995-11-25',
      gender: 'Female',
      address: {
        addressLine1: '20 Beta St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600040',
      },
      emergencyContact: {
        name: 'Beta Contact',
        relationship: 'Parent',
        mobileNumber: '9840777777',
      },
    });

    console.log(`Users Created: Doctor (${doctorUser._id}), Pharmacist (${pharmacistUser._id}), Patient A (${patientAUser._id}, ${pidA}), Patient B (${patientBUser._id}, ${pidB})`);

    // 2. DOCTOR CREATES & APPROVES PRESCRIPTION -> STATUS = "Sent to Pharmacist"
    console.log('\n=== 2. DOCTOR CREATES & APPROVES PRESCRIPTION ===');
    const reqCreate = {
      user: doctorUser,
      body: {
        patientPid: pidA,
        diagnosis: 'Acute Bronchitis',
        medicines: [
          {
            medicineName: 'Amoxicillin',
            name: 'Amoxicillin',
            brandName: 'Mox 500',
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
            instructions: 'Take after meals',
          },
        ],
        notes: 'Rest and stay hydrated.',
      },
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { throw err; });
    const rx = resCreate.data.prescription;
    console.log(`Prescription Created: ID=${rx._id}, Status=${rx.status}`);

    // Run MedWise Analysis
    const reqAnalyze = { user: doctorUser, params: { prescriptionId: rx._id.toString() } };
    const resAnalyze = mockRes();
    await analyzePrescription(reqAnalyze, resAnalyze, (err) => { throw err; });

    // Approve Prescription
    const reqApprove = { user: doctorUser, params: { id: rx._id.toString() } };
    const resApprove = mockRes();
    await approvePrescription(reqApprove, resApprove, (err) => { throw err; });

    if (resApprove.statusCode !== 200 || resApprove.data.prescription.status !== 'Sent to Pharmacist' || resApprove.data.prescription.doctorDecision !== 'Approved') {
      throw new Error(`Expected approval status 'Sent to Pharmacist', got '${resApprove.data.prescription.status}'`);
    }
    console.log(`PASSED: Doctor approved. Status=${resApprove.data.prescription.status}, Decision=${resApprove.data.prescription.doctorDecision}`);

    // 3. INVALID TRANSITION ATTEMPTS ON UNAPPROVED/WRONG STATUSES
    console.log('\n=== 3. INVALID TRANSITION ATTEMPTS REJECTION ===');
    // Attempting delivery when status is "Sent to Pharmacist" (Should fail 400)
    const reqDeliverEarly = { user: pharmacistUser, params: { id: rx._id.toString() } };
    const resDeliverEarly = mockRes();
    await deliverPrescription(reqDeliverEarly, resDeliverEarly, (err) => { throw err; });

    if (resDeliverEarly.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 for early delivery attempt, got ${resDeliverEarly.statusCode}`);
    }
    console.log(`PASSED: Early delivery attempt rejected (${resDeliverEarly.data.message})`);

    // 4. UNAUTHORIZED ROLE DISPENSING / DELIVERY ATTEMPTS (403)
    console.log('\n=== 4. UNAUTHORIZED ROLE DISPENSING REJECTION ===');
    // Doctor attempts dispense
    const reqDocDispense = { user: doctorUser, params: { id: rx._id.toString() } };
    const resDocDispense = mockRes();
    await dispensePrescription(reqDocDispense, resDocDispense, (err) => { throw err; });

    if (resDocDispense.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for doctor dispense attempt, got ${resDocDispense.statusCode}`);
    }

    // Patient attempts dispense
    const reqPatDispense = { user: patientAUser, params: { id: rx._id.toString() } };
    const resPatDispense = mockRes();
    await dispensePrescription(reqPatDispense, resPatDispense, (err) => { throw err; });

    if (resPatDispense.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for patient dispense attempt, got ${resPatDispense.statusCode}`);
    }
    console.log('PASSED: Doctor and Patient rejected on dispense endpoint with HTTP 403.');

    // 5. PHARMACIST DISPENSES PRESCRIPTION -> STATUS = "Dispensed"
    console.log('\n=== 5. PHARMACIST DISPENSES PRESCRIPTION ===');
    const reqPharmDispense = { user: pharmacistUser, params: { id: rx._id.toString() } };
    const resPharmDispense = mockRes();
    await dispensePrescription(reqPharmDispense, resPharmDispense, (err) => { throw err; });

    if (resPharmDispense.statusCode !== 200 || !resPharmDispense.data.success) {
      throw new Error(`Failed dispensing: ${JSON.stringify(resPharmDispense.data)}`);
    }
    const rxDispensed = resPharmDispense.data.prescription;
    if (rxDispensed.status !== 'Dispensed' || !rxDispensed.dispensedAt) {
      throw new Error(`Expected status 'Dispensed' and dispensedAt timestamp, got status '${rxDispensed.status}'`);
    }
    console.log(`PASSED: Prescription dispensed. Status=${rxDispensed.status}, DispensedAt=${rxDispensed.dispensedAt}`);

    // Re-dispensing already dispensed prescription -> SHOULD FAIL (400)
    const resRedispense = mockRes();
    await dispensePrescription(reqPharmDispense, resRedispense, (err) => { throw err; });

    if (resRedispense.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 for re-dispense attempt, got ${resRedispense.statusCode}`);
    }
    console.log(`PASSED: Re-dispense attempt correctly rejected (${resRedispense.data.message})`);

    // 6. PHARMACIST MARKS DELIVERED -> STATUS = "Delivered"
    console.log('\n=== 6. PHARMACIST MARKS DELIVERED ===');
    const reqPharmDeliver = { user: pharmacistUser, params: { id: rx._id.toString() } };
    const resPharmDeliver = mockRes();
    await deliverPrescription(reqPharmDeliver, resPharmDeliver, (err) => { throw err; });

    if (resPharmDeliver.statusCode !== 200 || !resPharmDeliver.data.success) {
      throw new Error(`Failed delivery: ${JSON.stringify(resPharmDeliver.data)}`);
    }
    const rxDelivered = resPharmDeliver.data.prescription;
    if (rxDelivered.status !== 'Delivered' || !rxDelivered.deliveredAt) {
      throw new Error(`Expected status 'Delivered' and deliveredAt timestamp, got status '${rxDelivered.status}'`);
    }
    console.log(`PASSED: Prescription delivered. Status=${rxDelivered.status}, DeliveredAt=${rxDelivered.deliveredAt}`);

    // Re-delivering already delivered prescription -> SHOULD FAIL (400)
    const resRedeliver = mockRes();
    await deliverPrescription(reqPharmDeliver, resRedeliver, (err) => { throw err; });

    if (resRedeliver.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 for re-delivery attempt, got ${resRedeliver.statusCode}`);
    }
    console.log(`PASSED: Re-delivery attempt correctly rejected (${resRedeliver.data.message})`);

    // 7. PATIENT PRESCRIPTION VIEW & CROSS-PATIENT PRIVACY (PHASE 3.4)
    console.log('\n=== 7. PATIENT PRESCRIPTION VIEW & PRIVACY ENFORCEMENT ===');
    // Patient A views their own prescriptions (GET /api/prescriptions)
    const reqPatAGetAll = { user: patientAUser };
    const resPatAGetAll = mockRes();
    await getPrescriptions(reqPatAGetAll, resPatAGetAll, (err) => { throw err; });

    if (resPatAGetAll.statusCode !== 200 || resPatAGetAll.data.count !== 1) {
      throw new Error(`Patient A failed to retrieve their own prescription`);
    }

    // Patient A views detail of their prescription
    const reqPatAGetId = { user: patientAUser, params: { id: rx._id.toString() } };
    const resPatAGetId = mockRes();
    await getPrescriptionById(reqPatAGetId, resPatAGetId, (err) => { throw err; });

    if (resPatAGetId.statusCode !== 200 || resPatAGetId.data.prescription.status !== 'Delivered') {
      throw new Error(`Patient A failed to retrieve detailed prescription view`);
    }
    console.log(`PASSED: Patient A successfully retrieved their prescription with status 'Delivered'.`);

    // Patient B attempts to view Patient A's prescription -> SHOULD FAIL (403)
    const reqPatBGetId = { user: patientBUser, params: { id: rx._id.toString() } };
    const resPatBGetId = mockRes();
    await getPrescriptionById(reqPatBGetId, resPatBGetId, (err) => { throw err; });

    if (resPatBGetId.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 when Patient B attempts to view Patient A's prescription, got ${resPatBGetId.statusCode}`);
    }
    console.log(`PASSED: Patient B rejected when attempting to view Patient A's prescription (${resPatBGetId.data.message})`);

    // Patient A attempts to modify prescription -> SHOULD FAIL (403)
    const reqPatUpdate = { user: patientAUser, params: { id: rx._id.toString() }, body: { diagnosis: 'Tampered' } };
    const resPatUpdate = mockRes();
    await updatePrescription(reqPatUpdate, resPatUpdate, (err) => { throw err; });

    if (resPatUpdate.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 when Patient A attempts to modify prescription, got ${resPatUpdate.statusCode}`);
    }
    console.log('PASSED: Patient write attempt correctly rejected with HTTP 403.');

    console.log('\n======================================================');
    console.log('ALL PHASE 3.3 + 3.4 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\nVerification failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
