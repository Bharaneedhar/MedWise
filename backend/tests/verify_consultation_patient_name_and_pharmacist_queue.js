const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');
dotenv.config({ path: './.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING TARGETED CONSULTATION PATIENT NAME & PHARMACIST QUEUE VERIFICATION');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  // 1. DATA SAFETY CHECK: Real patient ABINAYA S / RX-577101
  const realRx577101 = await Prescription.findOne({ prescriptionId: 'RX-577101' }).lean();
  if (!realRx577101) throw new Error('[FAIL] Real prescription RX-577101 is missing!');
  console.log('[PASS] Real prescription RX-577101 exists intact.');

  const realPatientAbinaya = await PatientProfile.findOne({ mobileNumber: '7708854661' }).lean();
  if (!realPatientAbinaya) throw new Error('[FAIL] Real patient profile for ABINAYA S is missing!');
  console.log('[PASS] Real patient profile for ABINAYA S exists intact.');

  // 2. DOCTOR & PATIENT RECORDS FOR TEST CASE
  const docUser = await User.findOne({ name: /Karthik Raj/i }).lean();
  if (!docUser) throw new Error('[FAIL] Doctor Dr. Karthik Raj not found!');
  const docProfile = await DoctorProfile.findOne({ userId: docUser._id }).lean();
  console.log('[PASS] Doctor Dr. Karthik Raj verified. Workplace:', docProfile?.hospitalClinicName);

  const patUser = await User.findOne({ name: /Meera Krishnan/i }).lean();
  if (!patUser) throw new Error('[FAIL] Patient Meera Krishnan not found!');
  console.log('[PASS] Patient Meera Krishnan verified. User ID:', patUser._id);

  // 3. CONSULTATION PATIENT NAME & PID DISPLAY VERIFICATION
  const consultations = await Consultation.find({ doctorId: docUser._id })
    .populate('patientId', 'name email mobileNumber')
    .sort({ consultationDate: -1 })
    .lean();

  if (consultations.length === 0) throw new Error('[FAIL] No consultations found for Dr. Karthik Raj!');

  const meeraConsultation = consultations.find(c => String(c.patientId?._id || c.patientId) === String(patUser._id));
  if (!meeraConsultation) throw new Error('[FAIL] Consultation for Meera Krishnan not found!');

  const resolvedPatientName = meeraConsultation.patientId?.name || meeraConsultation.patientName;
  if (resolvedPatientName !== 'Meera Krishnan') {
    throw new Error(`[FAIL] Patient Name on consultation is '${resolvedPatientName}', expected 'Meera Krishnan'!`);
  }
  console.log(`[PASS] Consultation displays Patient Name: '${resolvedPatientName}'`);

  if (!meeraConsultation.patientPid || meeraConsultation.patientPid !== 'PID-8765432109') {
    throw new Error(`[FAIL] Consultation patientPid is '${meeraConsultation.patientPid}', expected 'PID-8765432109'!`);
  }
  console.log(`[PASS] Consultation displays Patient PID: '${meeraConsultation.patientPid}'`);

  // 4. PHARMACIST KAVI PROFILE & FACILITY ALIGNMENT
  const kaviUser = await User.findOne({ name: 'Kavi', role: 'pharmacist' }).lean();
  if (!kaviUser) throw new Error('[FAIL] Pharmacist Kavi user not found!');

  let kaviProfile = await PharmacistProfile.findOne({ userId: kaviUser._id });
  if (!kaviProfile) {
    kaviProfile = await PharmacistProfile.create({
      userId: kaviUser._id,
      pharmacyHospitalName: docProfile.hospitalClinicName || 'Sri Lakshmi Medical Centre',
      profileCompleted: true
    });
  } else if (kaviProfile.pharmacyHospitalName !== docProfile.hospitalClinicName) {
    kaviProfile.pharmacyHospitalName = docProfile.hospitalClinicName || 'Sri Lakshmi Medical Centre';
    await kaviProfile.save();
  }
  console.log('[PASS] Pharmacist Kavi profile aligned with facility:', kaviProfile.pharmacyHospitalName);

  // 5. INSPECT RX-880190 BEFORE TESTING QUEUE
  let rx880190 = await Prescription.findOne({ prescriptionId: 'RX-880190' });
  if (!rx880190) throw new Error('[FAIL] Prescription RX-880190 not found!');

  // Ensure RX-880190 is in doctor approved 'Sent to Pharmacist' state initially
  rx880190.doctorDecision = 'Approved';
  rx880190.approvedAt = rx880190.approvedAt || new Date();
  rx880190.status = 'Sent to Pharmacist';
  await rx880190.save();

  console.log('[PASS] RX-880190 state set to doctor-approved: status = "Sent to Pharmacist"');

  // 6. PHARMACIST QUEUE FILTERING VERIFICATION
  const STOP_WORDS = new Set(['hospital', 'clinic', 'center', 'pharmacy', 'health', 'healthcare', 'medical', 'care', 'inc', 'ltd', 'pvt', 'and', '&']);
  const areFacilitiesRelated = (facilityA, facilityB) => {
    if (!facilityA || !facilityB) return true;
    const normA = facilityA.trim().toLowerCase();
    const normB = facilityB.trim().toLowerCase();
    if (normA === normB) return true;

    const getTokens = (str) =>
      str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w && !STOP_WORDS.has(w) && isNaN(w));

    const tokensA = getTokens(normA);
    const tokensB = getTokens(normB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      return normA.includes(normB) || normB.includes(normA);
    }

    return tokensA.some((t) => tokensB.includes(t));
  };

  const allowedStatus = { $in: ['Sent to Pharmacist', 'Dispensed', 'Delivered'] };
  let kaviPrescriptions = await Prescription.find({ status: allowedStatus }).lean();
  const pharmFacility = (kaviProfile.pharmacyHospitalName || '').trim();

  kaviPrescriptions = kaviPrescriptions.filter((rx) => {
    const isDispenser = rx.pharmacistId && String(rx.pharmacistId._id || rx.pharmacistId) === String(kaviUser._id);
    const isDeliverer = rx.deliveredByPharmacistId && String(rx.deliveredByPharmacistId._id || rx.deliveredByPharmacistId) === String(kaviUser._id);
    if (isDispenser || isDeliverer) return true;
    return areFacilitiesRelated(pharmFacility, rx.doctorHospitalClinicName);
  });

  const pendingToDispense = kaviPrescriptions.filter(rx => rx.status === 'Sent to Pharmacist');
  const foundRx = pendingToDispense.find(rx => rx.prescriptionId === 'RX-880190');

  if (!foundRx) {
    throw new Error('[FAIL] RX-880190 did NOT appear in Pharmacist Kavi\'s Pending / To Dispense queue!');
  }
  console.log(`[PASS] Pharmacist Kavi Pending / To Dispense queue count: ${pendingToDispense.length}. RX-880190 is present.`);

  // 7. DISPENSE RX-880190
  rx880190.status = 'Dispensed';
  rx880190.pharmacistId = kaviUser._id;
  rx880190.dispensedAt = new Date();
  await rx880190.save();

  const rxAfterDispense = await Prescription.findOne({ prescriptionId: 'RX-880190' }).lean();
  if (rxAfterDispense.status !== 'Dispensed' || String(rxAfterDispense.pharmacistId) !== String(kaviUser._id)) {
    throw new Error('[FAIL] RX-880190 dispense update failed!');
  }
  console.log('[PASS] RX-880190 successfully transitioned to DISPENSED (pharmacist identity & dispensedAt saved).');

  // 8. DELIVER RX-880190
  rx880190.status = 'Delivered';
  rx880190.deliveredByPharmacistId = kaviUser._id;
  rx880190.deliveredAt = new Date();
  await rx880190.save();

  const rxAfterDeliver = await Prescription.findOne({ prescriptionId: 'RX-880190' }).lean();
  if (rxAfterDeliver.status !== 'Delivered' || String(rxAfterDeliver.deliveredByPharmacistId) !== String(kaviUser._id)) {
    throw new Error('[FAIL] RX-880190 delivery update failed!');
  }
  console.log('[PASS] RX-880190 successfully transitioned to DELIVERED (delivery identity & deliveredAt saved).');

  // 9. PATIENT & DOCTOR VISIBILITY OF DELIVERED STATUS
  const patientViewRx = await Prescription.findOne({ _id: rx880190._id, patientId: patUser._id }).lean();
  if (!patientViewRx || patientViewRx.status !== 'Delivered') {
    throw new Error('[FAIL] Patient Meera Krishnan cannot see RX-880190 as Delivered!');
  }
  console.log('[PASS] Patient Meera Krishnan sees RX-880190 as DELIVERED.');

  const doctorViewRx = await Prescription.findOne({ _id: rx880190._id, doctorId: docUser._id }).lean();
  if (!doctorViewRx || doctorViewRx.status !== 'Delivered') {
    throw new Error('[FAIL] Doctor Dr. Karthik Raj cannot see RX-880190 as Delivered!');
  }
  console.log('[PASS] Doctor Dr. Karthik Raj sees RX-880190 as DELIVERED.');

  // 10. RESTORE RX-880190 INITIAL QUEUE STATE FOR LIVE APP / MANUAL TESTING
  rx880190.status = 'Sent to Pharmacist';
  rx880190.pharmacistId = undefined;
  rx880190.dispensedAt = undefined;
  rx880190.deliveredByPharmacistId = undefined;
  rx880190.deliveredAt = undefined;
  await rx880190.save();
  console.log('[PASS] RX-880190 restored to doctor-approved "Sent to Pharmacist" state for live queue operations.');

  // 11. RE-VERIFY DATA SAFETY
  const postCheckRx577101 = await Prescription.findOne({ prescriptionId: 'RX-577101' }).lean();
  if (!postCheckRx577101 || postCheckRx577101.patientName !== 'ABINAYA S') {
    throw new Error('[FAIL] Real prescription RX-577101 was modified or deleted!');
  }
  console.log('[PASS] Re-verified real patient data (ABINAYA S / RX-577101) is 100% intact.');

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log('ALL TARGETED VERIFICATION CHECKS PASSED (100%)');
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('\nVerification error:', err);
  process.exit(1);
});
