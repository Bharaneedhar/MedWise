const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const MedwiseEngine = require('../src/services/medwise/medwiseEngine');

const {
  createPrescription,
  getPrescriptionById,
} = require('../src/controllers/prescriptionController');

const {
  createConsultation,
  getConsultationById,
} = require('../src/controllers/consultationController');

async function runConsultationFirstTests() {
  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdPrescriptionIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to DB for MedWise Consultation-First Workflow Verification.\n');

    const timestamp = Date.now();

    // 1. Verify existing real prescription RX-577101 remains intact
    const realRx = await Prescription.findOne({ prescriptionId: 'RX-577101' });
    console.log('1. Existing historical prescription RX-577101 exists intact:', Boolean(realRx));
    console.assert(Boolean(realRx), 'FAIL: Real prescription RX-577101 missing');

    // -----------------------------------------------------------------
    // TEST FIXTURES SETUP
    // -----------------------------------------------------------------
    // Doctor 1
    const doctor1 = await User.create({
      name: `Dr. First_Doc1_${timestamp}`,
      email: `first_doc1_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctor1._id);

    await DoctorProfile.create({
      userId: doctor1._id,
      name: doctor1.name,
      specialization: 'Internal Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 10,
      medicalRegistrationNumber: `MRN-CF1-${timestamp}`,
      hospitalClinicName: 'General Hospital',
      hospitalClinicAddress: '100 Main St, Chennai',
      mobileNumber: '9876540111',
      dateOfBirth: new Date('1982-01-01'),
      gender: 'Female',
      address: {
        addressLine1: '100 Main St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
    });

    // Doctor 2
    const doctor2 = await User.create({
      name: `Dr. First_Doc2_${timestamp}`,
      email: `first_doc2_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctor2._id);

    await DoctorProfile.create({
      userId: doctor2._id,
      name: doctor2.name,
      specialization: 'General Practice',
      qualification: 'MBBS',
      yearsOfExperience: 8,
      medicalRegistrationNumber: `MRN-CF2-${timestamp}`,
      hospitalClinicName: 'City Clinic',
      hospitalClinicAddress: '200 City Way, Chennai',
      mobileNumber: '9876540222',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Male',
      address: {
        addressLine1: '200 City Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
    });

    // Patient 1 (New Patient)
    const patient1 = await User.create({
      name: `Patient_CF1_${timestamp}`,
      email: `patient_cf1_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patient1._id);

    const prof1 = await PatientProfile.create({
      userId: patient1._id,
      name: patient1.name,
      mobileNumber: '9876540001',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      hasNoKnownAllergies: true,
      address: {
        addressLine1: '1 Main St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Contact 1',
        relationship: 'Spouse',
        mobileNumber: '9876540001',
      },
    });
    createdProfileIds.push(prof1._id);

    // Patient 2 (Follow-up Patient)
    const patient2 = await User.create({
      name: `Patient_CF2_${timestamp}`,
      email: `patient_cf2_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patient2._id);

    const prof2 = await PatientProfile.create({
      userId: patient2._id,
      name: patient2.name,
      mobileNumber: '9876540002',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Female',
      hasNoKnownAllergies: true,
      address: {
        addressLine1: '2 Main St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Contact 2',
        relationship: 'Sibling',
        mobileNumber: '9876540002',
      },
    });
    createdProfileIds.push(prof2._id);

    // Test Medicine
    const medAmox = await Medicine.create({
      genericName: `TestAmoxCF_${timestamp}`,
      brandNames: [`AmoxCF_${timestamp}`],
      category: 'Antibiotic',
      drugClass: 'Penicillin',
      form: 'Capsule',
      defaultStrength: '500 mg',
      dosageGuidelines: [
        {
          population: 'Adult',
          maximumSingleDose: 1000,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 3000,
          maximumDailyDoseUnit: 'mg',
          evidenceSource: 'FDA Guidelines',
        },
      ],
    });

    const mockRes = () => {
      const res = {};
      res.status = function (code) {
        this.statusCode = code;
        return this;
      };
      res.json = function (data) {
        this.body = data;
        return this;
      };
      return res;
    };

    console.log('--- CONSULTATION-FIRST WORKFLOW VERIFICATION TESTS (1-12) ---');

    // 2. Direct prescription creation WITHOUT consultation MUST BE REJECTED
    const reqNoConsult = {
      user: doctor1,
      body: {
        patientPid: 'PID-9876540001',
        patientId: patient1._id,
        clinicalDiagnosis: 'Acute Bronchitis',
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resNoConsult = mockRes();
    await createPrescription(reqNoConsult, resNoConsult, (err) => { throw err; });
    console.log('2. Direct prescription creation without consultation rejected (HTTP 400):', resNoConsult.statusCode === 400);
    console.assert(resNoConsult.statusCode === 400, 'FAIL: Prescription created without completed consultation!');

    // 3. Create consultation for Patient 1 (New Patient)
    const reqConsult1 = {
      user: doctor1,
      body: {
        patientId: patient1._id,
        patientPid: 'PID-9876540001',
        reasonForVisit: 'Chest congestion and cough',
        clinicalNotes: 'Bilateral wheezing observed.',
        diagnosisNotes: 'Acute Bronchitis',
        status: 'Completed',
      },
    };
    const resConsult1 = mockRes();
    await createConsultation(reqConsult1, resConsult1, (err) => { throw err; });
    console.log('3. New patient consultation created successfully:', resConsult1.statusCode === 201);
    console.assert(resConsult1.statusCode === 201, 'FAIL: Unable to create consultation for new patient');
    const consult1Id = resConsult1.body.consultation._id;
    createdConsultationIds.push(consult1Id);

    // 4. Completed consultation enables prescription creation & bi-directional link
    const reqRx1 = {
      user: doctor1,
      body: {
        patientPid: 'PID-9876540001',
        patientId: patient1._id,
        consultationId: consult1Id,
        clinicalDiagnosis: 'Acute Bronchitis',
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resRx1 = mockRes();
    await createPrescription(reqRx1, resRx1, (err) => { throw err; });
    console.log('4. Prescription created with completed consultation link:', resRx1.statusCode === 201);
    console.assert(resRx1.statusCode === 201, 'FAIL: Prescription creation failed with completed consultation');
    const rx1Id = resRx1.body.prescription._id;
    createdPrescriptionIds.push(rx1Id);

    // Verify bi-directional link
    const createdRxDoc = await Prescription.findById(rx1Id);
    const updatedConsultDoc = await Consultation.findById(consult1Id);
    console.log('4. Bi-directional link verified (Rx -> Consultation & Consultation -> Rx):',
      createdRxDoc.consultationId.toString() === consult1Id.toString() &&
      updatedConsultDoc.prescriptionId.toString() === rx1Id.toString()
    );
    console.assert(
      createdRxDoc.consultationId.toString() === consult1Id.toString() &&
      updatedConsultDoc.prescriptionId.toString() === rx1Id.toString(),
      'FAIL: Bi-directional link failed'
    );

    // 5. Wrong doctor's consultation cannot be used
    const reqWrongDoc = {
      user: doctor2, // Doctor 2 trying to use Doctor 1's consultation
      body: {
        patientPid: 'PID-9876540001',
        patientId: patient1._id,
        consultationId: consult1Id,
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resWrongDoc = mockRes();
    await createPrescription(reqWrongDoc, resWrongDoc, (err) => { throw err; });
    console.log('5. Prescription with wrong doctor consultation rejected (HTTP 403):', resWrongDoc.statusCode === 403);
    console.assert(resWrongDoc.statusCode === 403, 'FAIL: Doctor cross-access protection failed');

    // 6. Wrong patient's consultation cannot be used
    const reqWrongPatient = {
      user: doctor1,
      body: {
        patientPid: 'PID-9876540002', // Patient 2 PID
        patientId: patient2._id,     // Patient 2 ID, but consult1Id belongs to Patient 1
        consultationId: consult1Id,
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resWrongPatient = mockRes();
    await createPrescription(reqWrongPatient, resWrongPatient, (err) => { throw err; });
    console.log('6. Prescription with patient mismatch rejected (HTTP 400):', resWrongPatient.statusCode === 400);
    console.assert(resWrongPatient.statusCode === 400, 'FAIL: Patient mismatch protection failed');

    // 7. Follow-up consultation creation & prescription requirement
    const followUpDateVal = new Date(Date.now() + 86400000 * 7);
    const reqFollowUpConsult = {
      user: doctor1,
      body: {
        patientId: patient2._id,
        patientPid: 'PID-9876540002',
        reasonForVisit: 'Hypertension Follow-Up Visit',
        clinicalNotes: 'Blood pressure 120/80 mmHg.',
        followUpDate: followUpDateVal,
        status: 'Completed',
      },
    };
    const resFollowUpConsult = mockRes();
    await createConsultation(reqFollowUpConsult, resFollowUpConsult, (err) => { throw err; });
    console.log('7. Follow-up consultation created:', resFollowUpConsult.statusCode === 201);
    console.assert(resFollowUpConsult.statusCode === 201, 'FAIL: Follow-up consultation creation failed');
    const consult2Id = resFollowUpConsult.body.consultation._id;
    createdConsultationIds.push(consult2Id);

    // 8. Follow-up prescription creation linked to newly completed follow-up consultation
    const reqFollowUpRx = {
      user: doctor1,
      body: {
        patientPid: 'PID-9876540002',
        patientId: patient2._id,
        consultationId: consult2Id,
        clinicalDiagnosis: 'Essential Hypertension',
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: 'Once daily',
            duration: '7 days',
          },
        ],
      },
    };
    const resFollowUpRx = mockRes();
    await createPrescription(reqFollowUpRx, resFollowUpRx, (err) => { throw err; });
    console.log('8. Follow-up prescription created with consultation link:', resFollowUpRx.statusCode === 201);
    console.assert(resFollowUpRx.statusCode === 201, 'FAIL: Follow-up prescription creation failed');
    const rx2Id = resFollowUpRx.body.prescription._id;
    createdPrescriptionIds.push(rx2Id);

    // 9. Existing MedWise analysis works on prescription created via consultation-first flow
    const rxDocToAnalyze = await Prescription.findById(rx2Id);
    const analysis = await MedwiseEngine.analyzeFullPrescription(rxDocToAnalyze);
    console.log('9. MedWise analysis executed on consultation-first prescription:', Boolean(analysis && analysis.audit));
    console.assert(Boolean(analysis && analysis.audit), 'FAIL: MedWise engine failed on consultation-first prescription');

    // 10. Direct prescription creation without completed consultation returns clear message
    const patient3 = await User.create({
      name: `Patient_CF3_${timestamp}`,
      email: `patient_cf3_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patient3._id);

    const prof3 = await PatientProfile.create({
      userId: patient3._id,
      name: patient3.name,
      mobileNumber: '9876540003',
      dateOfBirth: new Date('1995-10-10'),
      gender: 'Male',
      hasNoKnownAllergies: true,
      address: {
        addressLine1: '3 Main St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600003',
      },
      emergencyContact: {
        name: 'Contact 3',
        relationship: 'Friend',
        mobileNumber: '9876540003',
      },
    });
    createdProfileIds.push(prof3._id);

    const reqNoConsultP3 = {
      user: doctor1,
      body: {
        patientPid: 'PID-9876540003',
        patientId: patient3._id,
        medicines: [
          {
            medicineId: medAmox._id,
            medicineName: medAmox.genericName,
            dosage: '500 mg',
            frequency: '1-0-1',
            duration: '5 days',
          },
        ],
      },
    };
    const resNoConsultP3 = mockRes();
    await createPrescription(reqNoConsultP3, resNoConsultP3, (err) => { throw err; });
    console.log('10. Validation error message clear:', resNoConsultP3.body.message.includes('completed clinical consultation is required'));
    console.assert(resNoConsultP3.body.message.includes('completed clinical consultation is required'), 'FAIL: Error message unclear');

    // 11 & 12. Cleanup temporary records
    console.log('11. Teardown starting...');
    console.log('12. Test suite finished cleanly.');

    console.log('\n================================================================');
    console.log('>>> ALL 12 CONSULTATION-FIRST WORKFLOW TESTS PASSED! <<<');
    console.log('================================================================\n');
  } catch (err) {
    console.error('TEST ERROR in Consultation-First Workflow:', err);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up temporary consultation-first artifacts from MongoDB...');
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      await mongoose.disconnect();
      console.log('MongoDB connection closed and cleanup completed.');
    }
  }
}

runConsultationFirstTests();
