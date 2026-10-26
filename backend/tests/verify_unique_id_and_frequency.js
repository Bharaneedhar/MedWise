const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const Consultation = require('../src/models/Consultation');

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { createPrescription, checkWithMedwise, getPrescriptionById } = require('../src/controllers/prescriptionController');

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

const runVerification = async () => {
  let doctorUser = null;
  let patientUser = null;
  let consultation = null;
  const createdRxDocs = [];
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Unique Prescription ID & 3-Part Frequency verification.\n');

    // Ensure at least one medicine exists in Master DB
    let paracetamol = await Medicine.findOne({ genericName: 'Paracetamol' });
    if (!paracetamol) {
      paracetamol = await Medicine.create({
        genericName: 'Paracetamol',
        brandNames: ['Crocin', 'Dolo 650'],
        drugClass: 'Analgesic / Antipyretic',
        dosageForms: ['Tablet'],
        availableStrengths: [{ value: 500, unit: 'mg', dosageForm: 'Tablet' }],
        dosageGuidelines: [{
          population: 'Adult',
          minimumDose: 500,
          minimumDoseUnit: 'mg',
          maximumSingleDose: 1000,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 4000,
          maximumDailyDoseUnit: 'mg',
        }],
        isActive: true,
      });
    }

    const timestamp = Date.now();

    // 1. REGISTER DOCTOR & PATIENT
    const docRegReq = {
      body: {
        name: 'Dr. ID & Frequency Verifier',
        email: `doc.freq.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    doctorUser = await User.findById(docRegRes.data.user._id || docRegRes.data.user.id);
    const docProfReq = {
      user: doctorUser,
      body: {
        name: doctorUser.name,
        mobileNumber: '98' + String(timestamp).slice(-8),
        dateOfBirth: '1980-01-01',
        gender: 'Male',
        address: {
          addressLine1: '123 Medical St',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600001',
        },
        medicalRegistrationNumber: 'MCI-12345',
        specialization: 'General Medicine',
        qualification: 'MBBS, MD',
        hospitalClinicName: 'City Hospital',
      },
    };
    const docProfRes = mockRes();
    await createOrUpdateMyProfile(docProfReq, docProfRes, (err) => { if (err) throw err; });
    const activeDoctor = await User.findById(doctorUser._id);

    const patRegReq = {
      body: {
        name: 'Test Patient Freq',
        email: `pat.freq.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'patient',
      },
    };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    patientUser = await User.findById(patRegRes.data.user._id || patRegRes.data.user.id);

    const mobile = '9' + String(timestamp).slice(-9);
    const patPid = `PID-${mobile}`;

    const patProfReq = {
      user: patientUser,
      body: {
        name: 'Test Patient Freq',
        mobileNumber: mobile,
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        bloodGroup: 'O+',
        address: {
          addressLine1: '123 Main St',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600001',
        },
        emergencyContact: {
          name: 'Contact Name',
          relationship: 'Parent',
          mobileNumber: '9876543211',
        },
      },
    };
    const patProfRes = mockRes();
    await createOrUpdateMyProfile(patProfReq, patProfRes, (err) => { if (err) throw err; });
    const activePatient = await User.findById(patientUser._id);

    // Create a completed consultation to satisfy consultation-first workflow
    consultation = await Consultation.create({
      doctorId: activeDoctor._id,
      doctorName: activeDoctor.name,
      patientId: activePatient._id,
      patientName: activePatient.name,
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'General Checkup',
    });

    // 2. CREATE MULTIPLE PRESCRIPTIONS & VERIFY UNIQUE IDS
    console.log('=== 1. VERIFY UNIQUE PRESCRIPTION ID GENERATION ===');
    const createdIds = new Set();
    const createdRxDocs = [];

    for (let i = 1; i <= 5; i++) {
      const rxReq = {
        user: activeDoctor,
        body: {
          patientId: activePatient._id,
          patientPid: patPid,
          consultationId: consultation._id,
          clinicalDiagnosis: `Diagnosis ${i}`,
          doctorNotes: `Notes ${i}`,
          medicines: [
            {
              medicineName: 'Paracetamol',
              dosage: '500mg',
              frequency: '1-0-1',
              duration: '5 days',
              route: 'Oral',
            },
          ],
        },
      };
      const rxRes = mockRes();
      await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });

      const rxId = rxRes.data.prescription.prescriptionId;
      console.log(`Prescription #${i} created: ID = ${rxId}`);

      if (createdIds.has(rxId)) {
        throw new Error(`DUPLICATE PRESCRIPTION ID DETECTED: ${rxId}`);
      }
      createdIds.add(rxId);
      createdRxDocs.push(rxRes.data.prescription);
    }

    console.log(`\nSuccessfully created 5 prescriptions. Unique ID Count: ${createdIds.size} / 5.`);
    if (createdIds.size !== 5) throw new Error('Unique Prescription ID verification failed.');

    // 3. TEST 3-PART FREQUENCY SAVING AND MEDWISE DOSAGE PARSING
    console.log('\n=== 2. VERIFY 3-PART FREQUENCY (1-0-1, 1-1-1, 1-0-0) ===');
    const testFrequencies = [
      { freq: '1-0-0', expectedDosesPerDay: 1 },
      { freq: '1-0-1', expectedDosesPerDay: 2 },
      { freq: '1-1-1', expectedDosesPerDay: 3 },
      { freq: '0-1-0', expectedDosesPerDay: 1 },
      { freq: '0-0-1', expectedDosesPerDay: 1 },
      { freq: '1-1-0', expectedDosesPerDay: 2 },
      { freq: '0-1-1', expectedDosesPerDay: 2 },
    ];

    for (const item of testFrequencies) {
      const rxReq = {
        user: activeDoctor,
        body: {
          patientId: activePatient._id,
          patientPid: patPid,
          consultationId: consultation._id,
          clinicalDiagnosis: `Testing Frequency ${item.freq}`,
          medicines: [
            {
              medicineName: 'Paracetamol',
              dosage: '500mg',
              frequency: item.freq,
              duration: '5 days',
              route: 'Oral',
            },
          ],
        },
      };
      const rxRes = mockRes();
      await createPrescription(rxReq, rxRes, (err) => { if (err) throw err; });
      const rx = rxRes.data.prescription;

      console.log(`Created prescription with frequency "${item.freq}". Saved frequency: "${rx.medicines[0].frequency}"`);
      if (rx.medicines[0].frequency !== item.freq) {
        throw new Error(`Frequency saving mismatch for ${item.freq}`);
      }

      // Run MedWise check to verify dosage parser handles this frequency
      const checkReq = { user: activeDoctor, params: { id: rx._id.toString() } };
      const checkRes = mockRes();
      await checkWithMedwise(checkReq, checkRes, (err) => { if (err) throw err; });

      const dosageCheck = checkRes.data.analysis.checks.dosage[0];
      console.log(`  MedWise Dosage Check status: "${dosageCheck.status}" | Message: ${dosageCheck.message}`);
      if (dosageCheck.status === 'unable_to_assess') {
        throw new Error(`MedWise failed to parse 3-part frequency "${item.freq}"`);
      }

      // Fetch detail endpoint and verify exact frequency string returns
      const detailReq = { user: doctorUser, params: { id: rx._id.toString() } };
      const detailRes = mockRes();
      await getPrescriptionById(detailReq, detailRes, (err) => { if (err) throw err; });
      if (detailRes.data.prescription.medicines[0].frequency !== item.freq) {
        throw new Error(`GetPrescriptionById returned incorrect frequency for ${item.freq}`);
      }

      createdRxDocs.push(rx);
    }

    console.log('======================================================================');
    console.log('>>> ALL UNIQUE ID & 3-PART FREQUENCY VERIFICATION TESTS PASSED! <<<');
    console.log('======================================================================');
  } catch (error) {
    console.error('Verification error:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (doctorUser?._id || patientUser?._id) {
        await User.deleteMany({ _id: { $in: [doctorUser?._id, patientUser?._id].filter(Boolean) } });
      }
      if (doctorUser?._id) {
        await DoctorProfile.deleteMany({ userId: doctorUser._id });
      }
      if (patientUser?._id) {
        await PatientProfile.deleteMany({ userId: patientUser._id });
      }
      if (consultation?._id) {
        await Consultation.deleteOne({ _id: consultation._id });
      }
      if (createdRxDocs.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdRxDocs.map((r) => r._id) } });
      }
      console.log('Test cleanup complete.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await mongoose.disconnect();
  }
};

runVerification();
