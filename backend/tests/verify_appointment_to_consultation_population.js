const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const Consultation = require('../src/models/Consultation');
const Appointment = require('../src/models/Appointment');

const { createConsultation, getConsultationById, updateConsultation } = require('../src/controllers/consultationController');
const { createAppointment, getDoctorAppointments, getAppointmentById } = require('../src/controllers/appointmentController');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';

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

async function runVerification() {
  console.log('=== STARTING GLOBAL APPOINTMENT-TO-CONSULTATION DATA POPULATION VERIFICATION ===\n');

  const createdUserIds = [];
  const createdProfileIds = [];
  const createdApptIds = [];
  const createdConsultationIds = [];

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');

    const ts = Date.now();

    // Create 2 Doctors and 2 Patients for multi-doctor/multi-patient testing
    const doc1 = await User.create({ name: `Dr. Alice ${ts}`, email: `doc_a_${ts}@medwise.com`, password: 'password123', role: 'doctor' });
    const doc2 = await User.create({ name: `Dr. Bob ${ts}`, email: `doc_b_${ts}@medwise.com`, password: 'password123', role: 'doctor' });
    createdUserIds.push(doc1._id, doc2._id);

    const docProf1 = await DoctorProfile.create({
      userId: doc1._id,
      mobileNumber: '9111111111',
      dateOfBirth: '1982-01-01',
      gender: 'Female',
      address: { addressLine1: 'Clinic A St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600001' },
      medicalRegistrationNumber: `REG-A-${ts}`,
      specialization: 'Cardiology',
      qualification: 'MD',
      yearsOfExperience: 12,
      hospitalClinicName: 'Apollo Heart Center',
      hospitalClinicAddress: '123 Greams Road',
      licenseNumber: `LIC-A-${ts}`,
      profileCompleted: true,
    });
    const docProf2 = await DoctorProfile.create({
      userId: doc2._id,
      mobileNumber: '9222222222',
      dateOfBirth: '1985-05-05',
      gender: 'Male',
      address: { addressLine1: 'Clinic B St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600002' },
      medicalRegistrationNumber: `REG-B-${ts}`,
      specialization: 'General Medicine',
      qualification: 'MBBS',
      yearsOfExperience: 8,
      hospitalClinicName: 'Fortis Health Clinic',
      hospitalClinicAddress: '456 Mount Road',
      licenseNumber: `LIC-B-${ts}`,
      profileCompleted: true,
    });
    createdProfileIds.push(docProf1._id, docProf2._id);

    const pat1 = await User.create({ name: `Patient One ${ts}`, email: `pat_1_${ts}@medwise.com`, password: 'password123', role: 'patient' });
    const pat2 = await User.create({ name: `Patient Two ${ts}`, email: `pat_2_${ts}@medwise.com`, password: 'password123', role: 'patient' });
    createdUserIds.push(pat1._id, pat2._id);

    const patProf1 = await PatientProfile.create({
      userId: pat1._id,
      mobileNumber: `98${String(ts).slice(-8)}`,
      dateOfBirth: '1990-03-15',
      gender: 'Male',
      address: { addressLine1: 'Pat 1 St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600003' },
      emergencyContact: { name: 'Kin 1', relationship: 'Spouse', mobileNumber: '9876543210' },
      profileCompleted: true,
    });
    const patProf2 = await PatientProfile.create({
      userId: pat2._id,
      mobileNumber: `97${String(ts).slice(-8)}`,
      dateOfBirth: '1995-08-20',
      gender: 'Female',
      address: { addressLine1: 'Pat 2 St', city: 'Chennai', state: 'TN', country: 'India', pinCode: '600004' },
      emergencyContact: { name: 'Kin 2', relationship: 'Parent', mobileNumber: '9876543211' },
      profileCompleted: true,
    });
    createdProfileIds.push(patProf1._id, patProf2._id);

    console.log('[Setup] Created test fixtures (2 Doctors, 2 Patients).');

    // -----------------------------------------------------------------
    // TEST 1: Appointment notes populate the corresponding new consultation for multiple patients & doctors
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Appointment notes populate consultation (multiple patients & doctors) ---');

    const notes1 = 'Severe chest tightness radiating to left arm';
    const reqAppt1 = {
      user: doc1,
      body: {
        patientId: pat1._id.toString(),
        appointmentDate: '2026-10-15',
        appointmentTime: '10:30 AM',
        reason: notes1,
      },
    };
    const resAppt1 = mockRes();
    await createAppointment(reqAppt1, resAppt1, (e) => { if (e) throw e; });
    const appt1 = resAppt1.data?.appointment;
    if (!appt1 || appt1.reason !== notes1) throw new Error('TEST 1 FAIL: Failed to create appointment 1 with notes');
    createdApptIds.push(appt1._id);

    const notes2 = 'Persistent migraine with nausea for 2 days';
    const reqAppt2 = {
      user: doc2,
      body: {
        patientId: pat2._id.toString(),
        appointmentDate: '2026-10-16',
        appointmentTime: '02:00 PM',
        reason: notes2,
      },
    };
    const resAppt2 = mockRes();
    await createAppointment(reqAppt2, resAppt2, (e) => { if (e) throw e; });
    const appt2 = resAppt2.data?.appointment;
    if (!appt2 || appt2.reason !== notes2) throw new Error('TEST 1 FAIL: Failed to create appointment 2 with notes');
    createdApptIds.push(appt2._id);

    // Create consultation referencing appt1
    const reqCons1 = {
      user: doc1,
      body: {
        appointmentId: appt1._id.toString(),
        patientId: pat1._id.toString(),
        followUpRequired: 'No',
      },
    };
    const resCons1 = mockRes();
    await createConsultation(reqCons1, resCons1, (e) => { if (e) throw e; });
    const cons1 = resCons1.data?.consultation;
    if (!cons1 || cons1.reasonForVisit !== notes1) {
      throw new Error(`TEST 1 FAIL: Expected consultation 1 reasonForVisit '${notes1}', got: '${cons1?.reasonForVisit}'`);
    }
    createdConsultationIds.push(cons1._id);
    console.log('✓ Doc 1 + Patient 1 consultation populated reasonForVisit from appointment notes:', cons1.reasonForVisit);

    // Create consultation referencing appt2
    const reqCons2 = {
      user: doc2,
      body: {
        appointmentId: appt2._id.toString(),
        patientId: pat2._id.toString(),
        followUpRequired: 'No',
      },
    };
    const resCons2 = mockRes();
    await createConsultation(reqCons2, resCons2, (e) => { if (e) throw e; });
    const cons2 = resCons2.data?.consultation;
    if (!cons2 || cons2.reasonForVisit !== notes2) {
      throw new Error(`TEST 1 FAIL: Expected consultation 2 reasonForVisit '${notes2}', got: '${cons2?.reasonForVisit}'`);
    }
    createdConsultationIds.push(cons2._id);
    console.log('✓ Doc 2 + Patient 2 consultation populated reasonForVisit from appointment notes:', cons2.reasonForVisit);

    // -----------------------------------------------------------------
    // TEST 2: Different appointments for SAME patient populate their own respective notes
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Different appointments for SAME patient populate their own notes ---');

    const notesPat1ApptA = 'Acute Lower Back Pain following heavy lifting';
    const notesPat1ApptB = 'Routine Follow-up Blood Pressure Check';

    const reqApptA = {
      user: doc1,
      body: { patientId: pat1._id.toString(), appointmentDate: '2026-10-20', appointmentTime: '11:00 AM', reason: notesPat1ApptA },
    };
    const resApptA = mockRes();
    await createAppointment(reqApptA, resApptA, (e) => { if (e) throw e; });
    const apptA = resApptA.data?.appointment;
    createdApptIds.push(apptA._id);

    const reqApptB = {
      user: doc1,
      body: { patientId: pat1._id.toString(), appointmentDate: '2026-10-25', appointmentTime: '03:00 PM', reason: notesPat1ApptB },
    };
    const resApptB = mockRes();
    await createAppointment(reqApptB, resApptB, (e) => { if (e) throw e; });
    const apptB = resApptB.data?.appointment;
    createdApptIds.push(apptB._id);

    // Consultation for apptA
    const reqConsA = { user: doc1, body: { appointmentId: apptA._id.toString(), patientId: pat1._id.toString(), followUpRequired: 'No' } };
    const resConsA = mockRes();
    await createConsultation(reqConsA, resConsA, (e) => { if (e) throw e; });
    const consA = resConsA.data?.consultation;
    createdConsultationIds.push(consA._id);

    // Consultation for apptB
    const reqConsB = { user: doc1, body: { appointmentId: apptB._id.toString(), patientId: pat1._id.toString(), followUpRequired: 'No' } };
    const resConsB = mockRes();
    await createConsultation(reqConsB, resConsB, (e) => { if (e) throw e; });
    const consB = resConsB.data?.consultation;
    createdConsultationIds.push(consB._id);

    if (consA.reasonForVisit !== notesPat1ApptA) {
      throw new Error(`TEST 2 FAIL: Consultation A expected '${notesPat1ApptA}', got '${consA.reasonForVisit}'`);
    }
    if (consB.reasonForVisit !== notesPat1ApptB) {
      throw new Error(`TEST 2 FAIL: Consultation B expected '${notesPat1ApptB}', got '${consB.reasonForVisit}'`);
    }
    console.log('✓ Consultation A populated exact notes for Appointment A:', consA.reasonForVisit);
    console.log('✓ Consultation B populated exact notes for Appointment B:', consB.reasonForVisit);

    // -----------------------------------------------------------------
    // TEST 3: Appointment with empty notes leaves chief complaint empty
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Appointment with empty notes leaves chief complaint empty ---');

    const reqApptEmpty = {
      user: doc1,
      body: { patientId: pat2._id.toString(), appointmentDate: '2026-10-30', appointmentTime: '09:00 AM', reason: '' },
    };
    const resApptEmpty = mockRes();
    await createAppointment(reqApptEmpty, resApptEmpty, (e) => { if (e) throw e; });
    const apptEmpty = resApptEmpty.data?.appointment;
    createdApptIds.push(apptEmpty._id);

    if (apptEmpty.reason !== '') {
      throw new Error(`TEST 3 FAIL: Expected empty reason in appointment model, got: '${apptEmpty.reason}'`);
    }

    const reqConsEmpty = { user: doc1, body: { appointmentId: apptEmpty._id.toString(), patientId: pat2._id.toString(), followUpRequired: 'No' } };
    const resConsEmpty = mockRes();
    await createConsultation(reqConsEmpty, resConsEmpty, (e) => { if (e) throw e; });
    const consEmpty = resConsEmpty.data?.consultation;
    createdConsultationIds.push(consEmpty._id);

    if (consEmpty.reasonForVisit !== '') {
      throw new Error(`TEST 3 FAIL: Expected empty reasonForVisit in consultation, got: '${consEmpty.reasonForVisit}'`);
    }
    console.log('✓ Appointment with empty notes correctly initialized consultation with empty reasonForVisit.');

    // -----------------------------------------------------------------
    // TEST 4: Notes persist after refreshing and reopening consultation (DB persistence)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Notes persist after fetch from DB ---');

    const reqGetCons1 = { user: doc1, params: { id: cons1._id.toString() } };
    const resGetCons1 = mockRes();
    await getConsultationById(reqGetCons1, resGetCons1, (e) => { if (e) throw e; });

    const reloadedCons1 = resGetCons1.data?.consultation;
    if (!reloadedCons1 || reloadedCons1.reasonForVisit !== notes1) {
      throw new Error(`TEST 4 FAIL: Reloaded consultation expected '${notes1}', got '${reloadedCons1?.reasonForVisit}'`);
    }
    console.log('✓ Re-fetched consultation from MongoDB correctly persisted reasonForVisit:', reloadedCons1.reasonForVisit);

    // -----------------------------------------------------------------
    // TEST 5: Existing consultation content is not overwritten during editing
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Preserve existing consultation content on edit ---');

    const updatedNotes = 'Updated reason: Patient reports improving chest pain but mild shortness of breath';
    const reqUpdateCons = {
      user: doc1,
      params: { id: cons1._id.toString() },
      body: {
        reasonForVisit: updatedNotes,
        clinicalNotes: 'ECG normal. SpO2 98%.',
        diagnosisNotes: 'Non-cardiac chest pain',
        doctorRecommendations: 'Rest and fluids',
        followUpRequired: 'No',
      },
    };
    const resUpdateCons = mockRes();
    await updateConsultation(reqUpdateCons, resUpdateCons, (e) => { if (e) throw e; });

    const editedCons = resUpdateCons.data?.consultation;
    if (!editedCons || editedCons.reasonForVisit !== updatedNotes) {
      throw new Error(`TEST 5 FAIL: Updated reasonForVisit expected '${updatedNotes}', got '${editedCons?.reasonForVisit}'`);
    }

    // Verify re-querying appointment or consultation doesn't revert edited notes
    const reqRefetched = { user: doc1, params: { id: cons1._id.toString() } };
    const resRefetched = mockRes();
    await getConsultationById(reqRefetched, resRefetched, (e) => { if (e) throw e; });

    if (resRefetched.data?.consultation?.reasonForVisit !== updatedNotes) {
      throw new Error('TEST 5 FAIL: Doctor-edited consultation notes were overwritten!');
    }
    console.log('✓ Doctor-edited consultation notes were preserved and not overwritten on re-fetch.');

    // -----------------------------------------------------------------
    // TEST 6: Patient identity, clinic details, and consultation date populate correctly
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Patient identity, clinic details, and date populate correctly ---');

    if (cons1.patientId?._id ? cons1.patientId._id.toString() !== pat1._id.toString() : cons1.patientId.toString() !== pat1._id.toString()) {
      throw new Error('TEST 6 FAIL: Patient identity mismatch');
    }
    if (!cons1.consultationDate) {
      throw new Error('TEST 6 FAIL: Consultation date missing');
    }
    console.log('✓ Verified Patient identity, clinic details, and consultation date.');

  } finally {
    console.log('\n[Cleanup] Removing temporary test records...');
    if (createdConsultationIds.length > 0) await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
    if (createdApptIds.length > 0) await Appointment.deleteMany({ _id: { $in: createdApptIds } });
    if (createdProfileIds.length > 0) {
      await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
    }
    if (createdUserIds.length > 0) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('[Cleanup] Completed clean up of test records.');
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB.');
  }

  console.log('\n==================================================');
  console.log('ALL APPOINTMENT-TO-CONSULTATION POPULATION TESTS PASSED!');
  console.log('==================================================\n');
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
