const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Appointment = require('../src/models/Appointment');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const DrugInteraction = require('../src/models/DrugInteraction');

const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { createConsultation, updateConsultation } = require('../src/controllers/consultationController');
const { createPrescription, updatePrescription, checkWithMedwise } = require('../src/controllers/prescriptionController');
const { getDoctorAppointments } = require('../src/controllers/appointmentController');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('STARTING FINAL CLINICAL OUTCOME + ALLERGY + FOLLOW-UP WORKFLOW TEST SUITE');
  console.log('========================================================================\n');

  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdAppointmentIds = [];
  const createdPrescriptionIds = [];
  const createdMedicineIds = [];
  const createdInteractionIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to MongoDB.');

    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // TEST FIXTURES SETUP
    // -------------------------------------------------------------------------
    console.log('Finding or creating doctor user...');
    let doctorUser = await User.findOne({ role: 'doctor' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: `Dr. VerificationDoc_${timestamp}`,
        email: `verif_doc_${timestamp}@medwise.test`,
        password: 'password123',
        role: 'doctor',
      });
      createdUserIds.push(doctorUser._id);
    }
    console.log(`Doctor setup complete. Using doctor: ${doctorUser.name} (${doctorUser._id})`);

    const doctorReqUser = {
      _id: doctorUser._id,
      name: doctorUser.name,
      email: doctorUser.email,
      role: 'doctor',
    };

    // -------------------------------------------------------------------------
    // TEST 1 — NEW PATIENT ALLERGY REQUIRED
    // -------------------------------------------------------------------------
    console.log('Running Test 1: New Patient Profile Allergy Assessment Required...');
    const patientUser1 = await User.create({
      name: `Test Patient One_${timestamp}`,
      email: `patient1_${timestamp}@gmail.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientUser1._id);

    const reqUser1 = {
      _id: patientUser1._id,
      name: patientUser1.name,
      email: patientUser1.email,
      role: 'patient',
    };

    // Attempt profile completion without allergy assessment
    let resMsg1 = '';
    const reqBody1 = {
      mobileNumber: `91234${timestamp.toString().slice(-5)}`,
      dateOfBirth: '1995-08-20',
      gender: 'Female',
      address: {
        addressLine1: '45 Lake View St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600028',
      },
      emergencyContact: {
        name: 'Emergency Person',
        relationship: 'Parent',
        mobileNumber: '9876543210',
      },
      // allergyStatus omitted / invalid
    };

    const reqMock1 = { user: reqUser1, body: reqBody1 };
    const resMock1 = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (obj) {
        this.body = obj;
        resMsg1 = obj.message;
        return this;
      },
    };

    const nextErr = (err) => { if (err) throw err; };

    await createOrUpdateMyProfile(reqMock1, resMock1, nextErr);
    assert(resMock1.statusCode === 400, 'Test 1 Failed: Should reject profile completion without allergy assessment');
    assert(resMsg1.includes('Allergy Assessment'), 'Test 1 Failed: Expected allergy assessment error message');
    console.log('  PASSED: Profile completion fails as expected when allergy assessment is missing.\n');

    // -------------------------------------------------------------------------
    // TEST 2 — NO KNOWN ALLERGIES
    // -------------------------------------------------------------------------
    console.log('Running Test 2: Select No Known Allergies Flow...');
    reqBody1.allergyStatus = 'none';
    reqBody1.hasNoKnownAllergies = true;
    reqBody1.allergies = [];

    await createOrUpdateMyProfile(reqMock1, resMock1, nextErr);
    assert(resMock1.statusCode === 200, 'Test 2 Failed: Profile completion should succeed with No Known Allergies');
    const prof1 = await PatientProfile.findOne({ userId: patientUser1._id });
    assert(prof1.hasNoKnownAllergies === true, 'Test 2 Failed: hasNoKnownAllergies must be true');
    assert(Array.isArray(prof1.allergies) && prof1.allergies.length === 0, 'Test 2 Failed: allergies must be []');

    // Create prescription and run MedWise for Patient 1
    const rx1 = await Prescription.create({
      prescriptionId: `RX-T2-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser1._id,
      patientName: patientUser1.name,
      patientPid: `PID-91234${timestamp.toString().slice(-5)}`,
      patientAge: 31,
      patientGender: 'Female',
      patientAllergies: [],
      medicines: [
        {
          medicineName: 'Paracetamol',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          strength: '500 mg',
          frequency: '1-0-1',
          duration: '3 days',
          route: 'Oral',
          instructions: 'Take after meals',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rx1._id);

    const reqRx1 = { user: doctorReqUser, params: { id: rx1._id.toString() } };
    let resRx1Obj = null;
    const resRx1 = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRx1Obj = obj; return this; },
    };

    await checkWithMedwise(reqRx1, resRx1, nextErr);
    assert(resRx1.statusCode === 200, 'Test 2 Failed: MedWise check failed');
    const outcomeStatus2 = resRx1Obj.prescription.medwiseAnalysis.overallRecommendation.status;
    assert(outcomeStatus2 === 'cleared' || outcomeStatus2 === 'review_required', `Test 2 Failed: Expected cleared or review_required, got ${outcomeStatus2}`);
    assert(outcomeStatus2 !== 'unable_to_assess', 'Test 2 Failed: Outcome MUST NOT be unable_to_assess for completed profile');
    console.log(`  PASSED: MedWise audit completed with outcome '${outcomeStatus2}' (never ANALYSIS INCOMPLETE).\n`);

    // -------------------------------------------------------------------------
    // TEST 3 — KNOWN ALLERGIES
    // -------------------------------------------------------------------------
    console.log('Running Test 3: Patient Has Known Allergies Flow...');
    const patientUser2 = await User.create({
      name: `Test Patient Two_${timestamp}`,
      email: `patient2_${timestamp}@gmail.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientUser2._id);

    const reqUser2 = {
      _id: patientUser2._id,
      name: patientUser2.name,
      email: patientUser2.email,
      role: 'patient',
    };

    const reqBody2 = {
      mobileNumber: `92234${timestamp.toString().slice(-5)}`,
      dateOfBirth: '1990-03-12',
      gender: 'Male',
      address: {
        addressLine1: '88 Park Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600034',
      },
      emergencyContact: {
        name: 'Spouse Emergency',
        relationship: 'Spouse',
        mobileNumber: '9876543211',
      },
      allergyStatus: 'yes',
      allergiesText: 'Penicillin, Amoxicillin',
    };

    const reqMock2 = { user: reqUser2, body: reqBody2 };
    const resMock2 = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; return this; },
    };

    await createOrUpdateMyProfile(reqMock2, resMock2, nextErr);
    assert(resMock2.statusCode === 200, 'Test 3 Failed: Profile completion failed with known allergies');
    const prof2 = await PatientProfile.findOne({ userId: patientUser2._id });
    assert(prof2.hasNoKnownAllergies === false, 'Test 3 Failed: hasNoKnownAllergies must be false');
    assert(prof2.allergies.includes('Penicillin'), 'Test 3 Failed: allergies must include Penicillin');
    console.log('  PASSED: Patient profile saved known allergies correctly.\n');

    // -------------------------------------------------------------------------
    // TEST 4 — CLINICAL INTERACTION (REVIEW RECOMMENDED)
    // -------------------------------------------------------------------------
    console.log('Running Test 4: Clinical Interaction yields REVIEW RECOMMENDED...');
    let medA = await Medicine.findOne({ genericName: 'Clarithromycin' });
    if (!medA) {
      medA = await Medicine.create({
        brandName: `Klacid_${timestamp}`,
        genericName: 'Clarithromycin',
        dosageForm: 'Tablet',
        strength: '500 mg',
        drugClass: 'Macrolide Antibiotic',
      });
      createdMedicineIds.push(medA._id);
    }

    let medB = await Medicine.findOne({ genericName: 'Simvastatin' });
    if (!medB) {
      medB = await Medicine.create({
        brandName: `Zocor_${timestamp}`,
        genericName: 'Simvastatin',
        dosageForm: 'Tablet',
        strength: '20 mg',
        drugClass: 'HMG-CoA Reductase Inhibitor',
      });
      createdMedicineIds.push(medB._id);
    }

    const pairKey = [medA._id.toString(), medB._id.toString()].sort().join('_');
    let interactionTest = await DrugInteraction.findOne({ interactionPairKey: pairKey });
    if (!interactionTest) {
      interactionTest = await DrugInteraction.create({
        medicineA: medA._id,
        medicineB: medB._id,
        interactionPairKey: pairKey,
        severity: 'Major',
        description: 'CYP3A4 inhibition increases statin exposure.',
        clinicalEffect: 'Severe rhabdomyolysis and myopathy risk.',
        recommendedAction: 'Avoid co-administration or hold statin during antibiotic therapy.',
        evidenceSource: 'MedWise DrugInteraction Database',
      });
      createdInteractionIds.push(interactionTest._id);
    }

    const rxInteracting = await Prescription.create({
      prescriptionId: `RX-T4-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser2._id,
      patientName: patientUser2.name,
      patientPid: `PID-92234${timestamp.toString().slice(-5)}`,
      patientAge: 36,
      patientGender: 'Male',
      patientAllergies: prof2.allergies,
      medicines: [
        {
          medicineName: 'Clarithromycin 500mg',
          genericName: 'Clarithromycin',
          dosage: '500 mg',
          strength: '500 mg',
          frequency: '1-0-1',
          duration: '7 days',
          route: 'Oral',
        },
        {
          medicineName: 'Simvastatin 20mg',
          genericName: 'Simvastatin',
          dosage: '20 mg',
          strength: '20 mg',
          frequency: '0-0-1',
          duration: '30 days',
          route: 'Oral',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rxInteracting._id);

    let resRx4Obj = null;
    const reqRx4 = { user: doctorReqUser, params: { id: rxInteracting._id.toString() } };
    const resRx4 = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRx4Obj = obj; return this; },
    };

    await checkWithMedwise(reqRx4, resRx4, nextErr);
    assert(resRx4.statusCode === 200, 'Test 4 Failed: MedWise check failed');
    const outcomeStatus4 = resRx4Obj.prescription.medwiseAnalysis.overallRecommendation.status;
    assert(outcomeStatus4 === 'review_required', `Test 4 Failed: Expected review_required for major interaction, got '${outcomeStatus4}'`);
    console.log('  PASSED: Verified major drug interaction produces outcome status REVIEW RECOMMENDED.\n');

    // -------------------------------------------------------------------------
    // TEST 5 — CLEAN PRESCRIPTION (CLEARED)
    // -------------------------------------------------------------------------
    console.log('Running Test 5: Clean Prescription yields CLEARED...');
    const rxClean = await Prescription.create({
      prescriptionId: `RX-T5-${timestamp}`,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      patientId: patientUser1._id,
      patientName: patientUser1.name,
      patientPid: `PID-91234${timestamp.toString().slice(-5)}`,
      patientAge: 31,
      patientGender: 'Female',
      patientAllergies: [],
      medicines: [
        {
          medicineName: 'Paracetamol 500mg',
          genericName: 'Paracetamol',
          dosage: '500 mg',
          strength: '500 mg',
          frequency: '1-0-1',
          duration: '3 days',
          route: 'Oral',
          instructions: 'Take after meals',
        },
      ],
      status: 'MedWise Review Required',
    });
    createdPrescriptionIds.push(rxClean._id);

    let resRx5Obj = null;
    const reqRx5 = { user: doctorReqUser, params: { id: rxClean._id.toString() } };
    const resRx5 = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resRx5Obj = obj; return this; },
    };

    await checkWithMedwise(reqRx5, resRx5, nextErr);
    assert(resRx5.statusCode === 200, 'Test 5 Failed: MedWise check failed');
    const outcomeStatus5 = resRx5Obj.prescription.medwiseAnalysis.overallRecommendation.status;
    assert(outcomeStatus5 === 'cleared', `Test 5 Failed: Expected cleared for clean prescription, got '${outcomeStatus5}'`);
    console.log('  PASSED: Clean prescription produces outcome status CLEARED.\n');

    // -------------------------------------------------------------------------
    // TEST 6 & 7 & 8 & 9 — FOLLOW-UP CONSULTATION WORKFLOW
    // -------------------------------------------------------------------------
    console.log('Running Test 6: Follow-up Required = YES Workflow...');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const reqConsultYes = {
      user: doctorReqUser,
      body: {
        patientId: patientUser1._id,
        patientPid: `PID-91234${timestamp.toString().slice(-5)}`,
        reasonForVisit: 'Routine Follow-up Test',
        followUpRequired: 'Yes',
        followUpDate: futureDateStr,
      },
    };
    let resConsultYesObj = null;
    const resConsultYes = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resConsultYesObj = obj; return this; },
    };

    await createConsultation(reqConsultYes, resConsultYes, nextErr);
    assert(resConsultYes.statusCode === 201, 'Test 6 Failed: Consultation creation failed');
    const cYes = resConsultYesObj.consultation;
    createdConsultationIds.push(cYes._id);

    assert(cYes.status === 'Follow-up Needed', `Test 6 Failed: Expected status Follow-up Needed, got '${cYes.status}'`);
    assert(cYes.followUpDate != null, 'Test 6 Failed: followUpDate must be set');

    const apptCount6 = await Appointment.countDocuments({ consultationId: cYes._id, status: 'SCHEDULED' });
    assert(apptCount6 === 1, `Test 6 Failed: Expected exactly 1 appointment created, got ${apptCount6}`);
    console.log('  PASSED: Follow-up Required = YES sets status "Follow-up Needed" and creates 1 appointment.\n');

    console.log('Running Test 7: Follow-up Required = NO Workflow...');
    const reqConsultNo = {
      user: doctorReqUser,
      body: {
        patientId: patientUser2._id,
        patientPid: `PID-92234${timestamp.toString().slice(-5)}`,
        reasonForVisit: 'Single Visit Resolution',
        followUpRequired: 'No',
      },
    };
    let resConsultNoObj = null;
    const resConsultNo = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resConsultNoObj = obj; return this; },
    };

    await createConsultation(reqConsultNo, resConsultNo, nextErr);
    assert(resConsultNo.statusCode === 201, 'Test 7 Failed: Consultation creation failed');
    const cNo = resConsultNoObj.consultation;
    createdConsultationIds.push(cNo._id);

    assert(cNo.status === 'Completed', `Test 7 Failed: Expected status Completed, got '${cNo.status}'`);
    assert(!cNo.followUpDate, 'Test 7 Failed: followUpDate must be empty/null');

    const apptCount7 = await Appointment.countDocuments({ consultationId: cNo._id, status: 'SCHEDULED' });
    assert(apptCount7 === 0, `Test 7 Failed: Expected 0 appointments for NO follow-up, got ${apptCount7}`);
    console.log('  PASSED: Follow-up Required = NO sets status "Completed" with no follow-up date.\n');

    console.log('Running Test 8: Change YES to NO clears date and cancels appointment...');
    const reqUpdateToNo = {
      user: doctorReqUser,
      params: { id: cYes._id.toString() },
      body: {
        reasonForVisit: 'Routine Follow-up Test',
        followUpRequired: 'No',
      },
    };
    let resUpdateToNoObj = null;
    const resUpdateToNo = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resUpdateToNoObj = obj; return this; },
    };

    await updateConsultation(reqUpdateToNo, resUpdateToNo, nextErr);
    assert(resUpdateToNo.statusCode === 200, 'Test 8 Failed: Consultation update failed');
    const cUpdatedNo = resUpdateToNoObj.consultation;
    assert(cUpdatedNo.status === 'Completed', `Test 8 Failed: Status should become Completed, got '${cUpdatedNo.status}'`);
    assert(!cUpdatedNo.followUpDate, 'Test 8 Failed: followUpDate should be cleared');

    const apptCount8 = await Appointment.countDocuments({ consultationId: cYes._id, status: 'SCHEDULED' });
    assert(apptCount8 === 0, `Test 8 Failed: Appointment should be cancelled, got active count ${apptCount8}`);
    console.log('  PASSED: Changing YES -> NO clears follow-up date and cancels scheduled appointment.\n');

    console.log('Running Test 9: Change NO to YES activates follow-up date and status...');
    const reqUpdateToYes = {
      user: doctorReqUser,
      params: { id: cNo._id.toString() },
      body: {
        reasonForVisit: 'Single Visit Resolution',
        followUpRequired: 'Yes',
        followUpDate: futureDateStr,
      },
    };
    let resUpdateToYesObj = null;
    const resUpdateToYes = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resUpdateToYesObj = obj; return this; },
    };

    await updateConsultation(reqUpdateToYes, resUpdateToYes, nextErr);
    assert(resUpdateToYes.statusCode === 200, 'Test 9 Failed: Consultation update failed');
    const cUpdatedYes = resUpdateToYesObj.consultation;
    assert(cUpdatedYes.status === 'Follow-up Needed', `Test 9 Failed: Status should become Follow-up Needed, got '${cUpdatedYes.status}'`);
    assert(cUpdatedYes.followUpDate != null, 'Test 9 Failed: followUpDate should be set');
    console.log('  PASSED: Changing NO -> YES correctly sets status "Follow-up Needed" and follow-up date.\n');

    // -------------------------------------------------------------------------
    // TEST 10 — PRESCRIPTION EDIT (PRESERVES RX ID & DOES NOT DUPLICATE)
    // -------------------------------------------------------------------------
    console.log('Running Test 10 & 11: Edit Existing Prescription preserves RX ID & prevents duplicates...');
    const origRxId = rxInteracting._id;
    const origRxCode = rxInteracting.prescriptionId;

    const editPayload = {
      clinicalDiagnosis: 'Updated Diagnosis for Statin Review',
      medicines: [
        {
          medicineName: 'Clarithromycin 500mg',
          genericName: 'Clarithromycin',
          dosage: '500 mg',
          strength: '500 mg',
          frequency: '1-0-1',
          duration: '7 days',
          route: 'Oral',
        },
        {
          medicineName: 'Atorvastatin 10mg',
          genericName: 'Atorvastatin',
          dosage: '10 mg',
          strength: '10 mg',
          frequency: '0-0-1',
          duration: '30 days',
          route: 'Oral',
        },
      ],
    };

    const reqEditRx = { user: doctorReqUser, params: { id: origRxId.toString() }, body: editPayload };
    let resEditRxObj = null;
    const resEditRx = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resEditRxObj = obj; return this; },
    };

    await updatePrescription(reqEditRx, resEditRx, nextErr);
    assert(resEditRx.statusCode === 200, 'Test 11 Failed: updatePrescription API failed');
    const updatedRxDoc = resEditRxObj.prescription;

    assert(String(updatedRxDoc._id) === String(origRxId), 'Test 11 Failed: MongoDB _id changed!');
    assert(updatedRxDoc.prescriptionId === origRxCode, `Test 11 Failed: Prescription code changed from ${origRxCode} to ${updatedRxDoc.prescriptionId}`);
    assert(updatedRxDoc.medicines.length === 2, `Test 11 Failed: Expected 2 medicines, got ${updatedRxDoc.medicines.length}`);
    assert(updatedRxDoc.medwiseAnalysis.isOutdated === true, 'Test 11 Failed: MedWise analysis should be marked outdated');
    console.log('  PASSED: Prescription edited in-place with same ID and outdated MedWise flag.\n');

    // -------------------------------------------------------------------------
    // TEST 12 — RE-RUN MEDWISE AFTER EDIT (REVIEW RECOMMENDED -> CLEARED)
    // -------------------------------------------------------------------------
    console.log('Running Test 12: Re-running MedWise after edit produces updated outcome...');
    const reqReRun = { user: doctorReqUser, params: { id: origRxId.toString() } };
    let resReRunObj = null;
    const resReRun = {
      status: function (code) { this.statusCode = code; return this; },
      json: function (obj) { this.body = obj; resReRunObj = obj; return this; },
    };

    await checkWithMedwise(reqReRun, resReRun, nextErr);
    assert(resReRun.statusCode === 200, 'Test 12 Failed: MedWise re-run failed');
    const freshOutcome = resReRunObj.prescription.medwiseAnalysis.overallRecommendation.status;
    assert(freshOutcome === 'cleared' || freshOutcome === 'review_required', `Test 12 Failed: Outcome must be cleared or review_required, got '${freshOutcome}'`);
    assert(freshOutcome !== 'unable_to_assess', 'Test 12 Failed: Final outcome MUST NOT be unable_to_assess');
    console.log(`  PASSED: MedWise re-evaluation completed with outcome '${freshOutcome}'.\n`);

    console.log('========================================================================');
    console.log('ALL 12 ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\nTEST SUITE ERROR:', error);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up temporary test records...');
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
        await Appointment.deleteMany({ consultationId: { $in: createdConsultationIds } });
      }
      if (createdAppointmentIds.length > 0) {
        await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
      }
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdInteractionIds.length > 0) {
        await DrugInteraction.deleteMany({ _id: { $in: createdInteractionIds } });
      }
      if (createdMedicineIds.length > 0) {
        await Medicine.deleteMany({ _id: { $in: createdMedicineIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Cleanup complete. Disconnecting MongoDB.');
      await mongoose.disconnect();
    }
  }
}

runAcceptanceTests();
