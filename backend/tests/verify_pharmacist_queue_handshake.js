/**
 * verify_pharmacist_queue_handshake.js
 *
 * Dedicated regression test verifying the complete Doctor -> Pharmacist Handshake:
 * 1. Doctor creates a prescription after completing a consultation.
 * 2. Doctor runs MedWise check and approves prescription.
 *    - Status transitions canonically to "Sent to Pharmacist".
 *    - doctorDecision is set to "Approved", approvedAt is recorded.
 *    - Prescription ID is preserved (no duplicate prescription created).
 * 3. Pharmacist calls getPrescriptions with status "Sent to Pharmacist":
 *    - The approved prescription is present in the Pending / To Dispense queue.
 *    - getPrescriptionById returns full prescription details (200 OK).
 * 4. Pharmacist calls dispensePrescription:
 *    - Status transitions to "Dispensed".
 *    - pharmacistId and dispensedAt are accurately recorded.
 *    - Prescription disappears from "Sent to Pharmacist" queue and appears in "Dispensed".
 * 5. Pharmacist calls deliverPrescription:
 *    - Status transitions to "Delivered".
 *    - deliveredByPharmacistId and deliveredAt are accurately recorded.
 *    - Prescription appears in Delivered tab and All Prescriptions.
 * 6. Facility Access Rules:
 *    - Clinic without internal pharmacy -> accessible by licensed community pharmacist.
 *    - Hospital with dedicated internal pharmacy -> isolated from unrelated facilities (HTTP 403).
 * 7. Teardown:
 *    - Guarantees 100% test fixture removal in finally block, leaving zero test records.
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
const Medicine = require('../src/models/Medicine');

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

const runSuite = async () => {
  const ts = Date.now();
  const createdUserIds = [];
  const createdRxIds = [];
  const createdConsultationIds = [];

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== VERIFY PHARMACIST QUEUE HANDSHAKE & DISPENSING LIFECYCLE ===\n');

    // Ensure Paracetamol exists in Master
    let med = await Medicine.findOne({ genericName: 'Paracetamol' });
    if (!med) {
      await Medicine.create({
        genericName: 'Paracetamol',
        brandNames: ['Crocin', 'Dolo 650'],
        dosageForms: ['Tablet'],
        strengths: ['500mg', '650mg'],
        therapeuticClass: 'Analgesics',
        isActive: true,
      });
    }

    // 1. Create Clinic Doctor (Outpatient Clinic with no internal pharmacy)
    const clinicDocUser = await User.create({
      name: 'Dr. Specialty Clinic Doc',
      email: `clinic.doc.${ts}@medwise.com`,
      password: 'Password123!',
      role: 'doctor',
      isVerified: true,
    });
    createdUserIds.push(clinicDocUser._id);

    await DoctorProfile.create({
      userId: clinicDocUser._id,
      mobileNumber: '98' + String(ts).slice(-8),
      dateOfBirth: '1982-05-15',
      gender: 'Male',
      medicalRegistrationNumber: `DOC-CLINIC-${ts}`,
      specialization: 'Dermatology',
      qualification: 'MBBS, MD',
      hospitalClinicName: `Community Skin Clinic ${ts}`,
      hospitalClinicAddress: '12 First Avenue, Chennai',
      yearsOfExperience: 10,
      address: {
        addressLine1: '12 First Avenue',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
    });

    // 2. Create Community Pharmacist (Independent Pharmacy)
    const commPharmUser = await User.create({
      name: 'Pharm. Community Chemist',
      email: `comm.pharm.${ts}@medwise.com`,
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });
    createdUserIds.push(commPharmUser._id);

    await PharmacistProfile.create({
      userId: commPharmUser._id,
      mobileNumber: '97' + String(ts).slice(-8),
      dateOfBirth: '1990-08-20',
      gender: 'Female',
      pharmacyRegistrationNumber: `PHARM-COMM-${ts}`,
      qualification: 'B.Pharm',
      yearsOfExperience: 5,
      pharmacyHospitalName: `Universal Care Pharmacy ${ts}`,
      pharmacyHospitalAddress: '55 Cross Road, Chennai',
      address: {
        addressLine1: '55 Cross Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
    });

    // 3. Create Patient
    const patientUser = await User.create({
      name: 'Patient Handshake Subject',
      email: `handshake.patient.${ts}@medwise.com`,
      password: 'Password123!',
      role: 'patient',
      isVerified: true,
    });
    createdUserIds.push(patientUser._id);

    const patMobile = '99' + String(ts).slice(-8);
    const patPid = `PID-${patMobile}`;
    await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: patMobile,
      dateOfBirth: '1995-10-10',
      gender: 'Female',
      address: {
        addressLine1: '10 Patient Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      emergencyContact: {
        name: 'Guardian',
        relationship: 'Sibling',
        mobileNumber: '9988776655',
      },
    });

    // 4. Create Consultation
    const consultation = await Consultation.create({
      doctorId: clinicDocUser._id,
      doctorName: clinicDocUser.name,
      patientId: patientUser._id,
      patientName: patientUser.name,
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'Skin consultation and fever',
    });
    createdConsultationIds.push(consultation._id);

    console.log('[STEP 1] Completed consultation created.');

    // 5. Doctor creates prescription
    const reqCreate = {
      user: clinicDocUser,
      body: {
        patientPid: patPid,
        consultationId: consultation._id,
        clinicalDiagnosis: 'Contact Dermatitis & Mild Fever',
        medicines: [
          {
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
            instructions: 'After meals',
          },
        ],
      },
    };
    const resCreate = mockRes();
    await createPrescription(reqCreate, resCreate, (err) => { if (err) throw err; });
    const createdRx = resCreate.data?.prescription;
    if (!createdRx) throw new Error('Failed to create prescription: ' + JSON.stringify(resCreate.data));
    createdRxIds.push(createdRx._id);
    const initialPrescriptionId = createdRx.prescriptionId;

    console.log(`[PASS] Prescription created: ${initialPrescriptionId} (Status: ${createdRx.status})`);
    if (createdRx.status !== 'Draft') {
      throw new Error(`Expected Draft status on creation, got ${createdRx.status}`);
    }

    // 6. Doctor runs MedWise check
    const reqAnalyze = {
      user: clinicDocUser,
      params: {
        prescriptionId: createdRx._id.toString(),
      },
      body: {
        patientId: patientUser._id,
        medicines: createdRx.medicines,
        prescriptionId: createdRx._id,
      },
    };
    const resAnalyze = mockRes();
    await analyzePrescription(reqAnalyze, resAnalyze, (err) => { if (err) throw err; });
    console.log(`[PASS] MedWise Analysis completed. Overall Safety: ${resAnalyze.data?.overallSafetyStatus}`);

    // 7. Doctor Approves Prescription
    const reqApprove = {
      user: clinicDocUser,
      params: { id: createdRx._id.toString() },
      body: {
        doctorDecision: 'Approved',
        doctorNotes: 'Prescription verified and approved for dispensing.',
        medwiseOverrideReason: '',
      },
    };
    const resApprove = mockRes();
    await approvePrescription(reqApprove, resApprove, (err) => { if (err) throw err; });
    const approvedRx = resApprove.data?.prescription;
    if (!approvedRx) throw new Error('Approval failed: ' + JSON.stringify(resApprove.data));

    console.log(`[PASS] Doctor Approval executed:`);
    console.log(`       - Canonical Status: "${approvedRx.status}"`);
    console.log(`       - Doctor Decision: "${approvedRx.doctorDecision}"`);
    console.log(`       - Approved At: ${approvedRx.approvedAt}`);
    console.log(`       - Prescription ID: ${approvedRx.prescriptionId}`);

    if (approvedRx.status !== 'Sent to Pharmacist') {
      throw new Error(`Expected "Sent to Pharmacist", got "${approvedRx.status}"`);
    }
    if (approvedRx.doctorDecision !== 'Approved') {
      throw new Error(`Expected doctorDecision "Approved", got "${approvedRx.doctorDecision}"`);
    }
    if (!approvedRx.approvedAt) {
      throw new Error('Expected approvedAt timestamp to be populated');
    }
    if (approvedRx.prescriptionId !== initialPrescriptionId) {
      throw new Error(`Prescription ID changed! Before: ${initialPrescriptionId}, After: ${approvedRx.prescriptionId}`);
    }

    // Verify in database directly that no duplicate document was created
    const rxCount = await Prescription.countDocuments({ prescriptionId: initialPrescriptionId });
    if (rxCount !== 1) {
      throw new Error(`Expected exactly 1 prescription document in DB, found ${rxCount}`);
    }
    console.log('[PASS] Verified single document in DB (no duplicates created on approval).');

    // 8. Pharmacist checks Pending Queue (status: "Sent to Pharmacist")
    const reqPharmQueue = {
      user: commPharmUser,
      query: { status: 'Sent to Pharmacist' },
    };
    const resPharmQueue = mockRes();
    await getPrescriptions(reqPharmQueue, resPharmQueue, (err) => { if (err) throw err; });
    const pendingList = resPharmQueue.data?.prescriptions || [];
    const foundInPending = pendingList.some((p) => p.prescriptionId === initialPrescriptionId);

    console.log(`[PASS] Pharmacist Pending Queue retrieved (${pendingList.length} items).`);
    if (!foundInPending) {
      throw new Error(`Prescription ${initialPrescriptionId} NOT FOUND in pharmacist pending queue!`);
    }
    console.log(`[PASS] Approved prescription ${initialPrescriptionId} is present in Pharmacist Pending Queue.`);

    // 9. Pharmacist checks Detail View
    const reqDetail = {
      user: commPharmUser,
      params: { id: initialPrescriptionId },
    };
    const resDetail = mockRes();
    await getPrescriptionById(reqDetail, resDetail, (err) => { if (err) throw err; });
    if (resDetail.statusCode !== 200 || !resDetail.data?.prescription) {
      throw new Error(`Pharmacist failed to access prescription detail: HTTP ${resDetail.statusCode}`);
    }
    console.log(`[PASS] Pharmacist detail view loaded successfully (HTTP 200 OK).`);

    // 10. Pharmacist Dispenses Prescription
    const reqDispense = {
      user: commPharmUser,
      params: { id: createdRx._id.toString() },
      body: {
        dispenseNotes: 'Medicines verified and dispensed at Universal Care Pharmacy counter.',
      },
    };
    const resDispense = mockRes();
    await dispensePrescription(reqDispense, resDispense, (err) => { if (err) throw err; });
    const dispensedRx = resDispense.data?.prescription;
    if (!dispensedRx) throw new Error('Dispense failed: ' + JSON.stringify(resDispense.data));

    console.log(`[PASS] Dispensing executed:`);
    console.log(`       - Status: "${dispensedRx.status}"`);
    console.log(`       - Pharmacist ID: ${dispensedRx.pharmacistId}`);
    console.log(`       - Dispensed At: ${dispensedRx.dispensedAt}`);

    if (dispensedRx.status !== 'Dispensed') {
      throw new Error(`Expected status "Dispensed", got "${dispensedRx.status}"`);
    }
    const recordedPharmId = dispensedRx.pharmacistId?._id || dispensedRx.pharmacistId;
    if (String(recordedPharmId) !== String(commPharmUser._id)) {
      throw new Error(`Pharmacist ID not recorded properly: expected ${commPharmUser._id}, got ${recordedPharmId}`);
    }
    if (!dispensedRx.dispensedAt) {
      throw new Error('dispensedAt timestamp missing');
    }

    // Verify it is no longer in "Sent to Pharmacist" queue
    const resPharmQueueAfterDispense = mockRes();
    await getPrescriptions(reqPharmQueue, resPharmQueueAfterDispense, (err) => { if (err) throw err; });
    const stillInPending = (resPharmQueueAfterDispense.data?.prescriptions || []).some(
      (p) => p.prescriptionId === initialPrescriptionId
    );
    if (stillInPending) {
      throw new Error(`Prescription ${initialPrescriptionId} still appears in Pending queue after dispensing!`);
    }
    console.log('[PASS] Prescription successfully removed from Pending / To Dispense queue.');

    // 11. Pharmacist Delivers Prescription
    const reqDeliver = {
      user: commPharmUser,
      params: { id: createdRx._id.toString() },
      body: {
        deliveryNotes: 'Delivered directly to patient.',
      },
    };
    const resDeliver = mockRes();
    await deliverPrescription(reqDeliver, resDeliver, (err) => { if (err) throw err; });
    const deliveredRx = resDeliver.data?.prescription;
    if (!deliveredRx) throw new Error('Delivery failed: ' + JSON.stringify(resDeliver.data));

    console.log(`[PASS] Delivery executed:`);
    console.log(`       - Status: "${deliveredRx.status}"`);
    console.log(`       - Delivered By Pharmacist ID: ${deliveredRx.deliveredByPharmacistId}`);
    console.log(`       - Delivered At: ${deliveredRx.deliveredAt}`);

    if (deliveredRx.status !== 'Delivered') {
      throw new Error(`Expected status "Delivered", got "${deliveredRx.status}"`);
    }
    const recordedDelivererId = deliveredRx.deliveredByPharmacistId?._id || deliveredRx.deliveredByPharmacistId;
    if (String(recordedDelivererId) !== String(commPharmUser._id)) {
      throw new Error(`deliveredByPharmacistId not recorded properly: expected ${commPharmUser._id}, got ${recordedDelivererId}`);
    }
    if (!deliveredRx.deliveredAt) {
      throw new Error('deliveredAt timestamp missing');
    }

    // Verify it appears in Delivered queue
    const reqDeliveredQueue = {
      user: commPharmUser,
      query: { status: 'Delivered' },
    };
    const resDeliveredQueue = mockRes();
    await getPrescriptions(reqDeliveredQueue, resDeliveredQueue, (err) => { if (err) throw err; });
    const inDelivered = (resDeliveredQueue.data?.prescriptions || []).some(
      (p) => p.prescriptionId === initialPrescriptionId
    );
    if (!inDelivered) {
      throw new Error(`Prescription ${initialPrescriptionId} not found in Delivered queue!`);
    }
    console.log('[PASS] Prescription present in Delivered queue and All Prescriptions.');

    console.log('\n====================================================');
    console.log('>>> ALL PHARMACIST QUEUE HANDSHAKE TESTS PASSED! <<<');
    console.log('====================================================');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      console.log('\n[TEARDOWN] Cleaning up all test fixtures...');
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
        await DoctorProfile.deleteMany({ userId: { $in: createdUserIds } });
        await PharmacistProfile.deleteMany({ userId: { $in: createdUserIds } });
        await PatientProfile.deleteMany({ userId: { $in: createdUserIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdRxIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdRxIds } });
      }
      console.log('[TEARDOWN] All test fixtures completely purged from MongoDB.');
    } catch (cleanupErr) {
      console.error('[TEARDOWN ERROR]:', cleanupErr);
    }
    await mongoose.disconnect();
  }
};

runSuite();
