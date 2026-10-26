const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Medicine = require('../src/models/Medicine');
const Prescription = require('../src/models/Prescription');

const { register } = require('../src/controllers/authController');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');
const { searchMedicines, getMedicineById } = require('../src/controllers/medicineController');
const { createPrescription, getPrescriptionById } = require('../src/controllers/prescriptionController');

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

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Medicine Search & Autocomplete integration tests.\n');

    const timestamp = Date.now();

    // 1. SETUP DOCTOR & PATIENT
    console.log('=== 1. SETUP TEST DOCTOR & PATIENT ===');
    const docRegReq = {
      body: {
        name: 'Dr. Autocomplete Tester',
        email: `doc.auto.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);

    const patRegReq = {
      body: {
        name: 'Test Patient Auto',
        email: `patient.auto.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'patient',
      },
    };
    const patRegRes = mockRes();
    await register(patRegReq, patRegRes, (err) => { if (err) throw err; });
    const patientUser = await User.findById(patRegRes.data.user.id);

    const patProfReq = {
      user: patientUser,
      body: {
        name: 'Test Patient Auto',
        mobileNumber: '9998887776',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        address: {
          addressLine1: '123 Test St',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pinCode: '600001',
        },
        bloodGroup: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Parent',
          mobileNumber: '9998887777',
        },
      },
    };
    const patProfRes = mockRes();
    await createOrUpdateMyProfile(patProfReq, patProfRes, (err) => { if (err) throw err; });
    console.log('1.1 Doctor and Patient created. PID: PID-9998887776');

    // 2. SEARCH MEDICINE API (GENERIC NAME, BRAND NAME, CASE INSENSITIVE)
    console.log('\n=== 2. MEDICINE SEARCH API TESTS ===');
    
    // Test 2.1: Generic name search "para"
    const req1 = { user: doctorUser, query: { search: 'para' } };
    const res1 = mockRes();
    await searchMedicines(req1, res1, (err) => { if (err) throw err; });
    console.log('2.1 Search "para": found', res1.data.count, 'medicines');
    if (res1.data.count === 0) throw new Error('Search "para" returned no medicines');
    const paracetamol = res1.data.medicines.find((m) => m.genericName.toLowerCase().includes('paracetamol'));
    if (!paracetamol) throw new Error('Paracetamol not found in search results');
    console.log('    -> Found:', paracetamol.genericName, '| ID:', paracetamol._id);

    // Test 2.2: Brand name search "Dolo"
    const req2 = { user: doctorUser, query: { search: 'Dolo' } };
    const res2 = mockRes();
    await searchMedicines(req2, res2, (err) => { if (err) throw err; });
    console.log('2.2 Search "Dolo": found', res2.data.count, 'medicines');
    if (res2.data.count === 0) throw new Error('Search "Dolo" returned no medicines');
    console.log('    -> Match:', res2.data.medicines[0].genericName, '| Brands:', res2.data.medicines[0].brandNames);

    // Test 2.3: Case-insensitive search "amox"
    const req3 = { user: doctorUser, query: { search: 'AMOX' } };
    const res3 = mockRes();
    await searchMedicines(req3, res3, (err) => { if (err) throw err; });
    console.log('2.3 Search "AMOX": found', res3.data.count, 'medicines');
    if (res3.data.count === 0) throw new Error('Search "AMOX" returned no medicines');

    // Test 2.4: Get medicine by ID
    const req4 = { user: doctorUser, params: { id: String(paracetamol._id) } };
    const res4 = mockRes();
    await getMedicineById(req4, res4, (err) => { if (err) throw err; });
    console.log('2.4 Get medicine by ID:', res4.data.medicine.genericName);
    console.log('    - Available Strengths:', res4.data.medicine.availableStrengths);
    console.log('    - Dosage Forms:', res4.data.medicine.dosageForms);
    console.log('    - Routes:', res4.data.medicine.routes);

    // 3. CREATE PRESCRIPTION WITH MASTER DATABASE REFERENCE
    console.log('\n=== 3. CREATE PRESCRIPTION WITH MASTER MEDICINE REFERENCES ===');
    const amoxicillin = res3.data.medicines[0];

    const getStrengthString = (s) => {
      if (!s) return '500 mg';
      if (typeof s === 'string') return s;
      if (typeof s === 'object' && s.value != null && s.unit) return `${s.value} ${s.unit}`;
      return String(s);
    };

    const paraStrength = getStrengthString(paracetamol.availableStrengths?.[0]);
    const amoxStrength = getStrengthString(amoxicillin.availableStrengths?.[0]);

    const rxPayload = {
      patientPid: 'PID-9998887776',
      patientId: patientUser._id,
      clinicalDiagnosis: 'Acute Pharyngitis & Fever',
      doctorNotes: 'Take full course of antibiotics',
      medicines: [
        {
          medicineId: String(paracetamol._id),
          genericName: paracetamol.genericName,
          medicineName: 'Paracetamol',
          dosage: paraStrength,
          dosageForm: paracetamol.dosageForms[0] || 'Tablet',
          strength: paraStrength,
          frequency: 'Thrice daily',
          duration: '5 days',
          route: paracetamol.routes[0] || 'Oral',
          instructions: 'After meals',
        },
        {
          medicineId: String(amoxicillin._id),
          genericName: amoxicillin.genericName,
          medicineName: amoxicillin.genericName,
          dosage: amoxStrength,
          dosageForm: amoxicillin.dosageForms[0] || 'Capsule',
          strength: amoxStrength,
          frequency: 'Twice daily',
          duration: '7 days',
          route: amoxicillin.routes[0] || 'Oral',
          instructions: 'Complete full course',
        },
      ],
    };

    const rxReq = { user: doctorUser, body: rxPayload };
    const rxRes = mockRes();
    let rxErr = null;
    await createPrescription(rxReq, rxRes, (err) => { rxErr = err; });

    if (rxErr || rxRes.statusCode !== 201) {
      console.error('Prescription creation failed:', rxRes.statusCode, rxRes.data, rxErr);
      throw new Error(`createPrescription returned status ${rxRes.statusCode}: ${JSON.stringify(rxRes.data)}`);
    }

    console.log('3.1 Prescription Created:', rxRes.statusCode, rxRes.data.prescription.prescriptionId);
    const createdRx = rxRes.data.prescription;
    if (createdRx.medicines.length !== 2) throw new Error('Medicines count mismatch');

    console.log('3.2 Verify Master DB linkage in saved prescription:');
    console.log('    Med #1 medicineId:', createdRx.medicines[0].medicineId, '| Generic:', createdRx.medicines[0].genericName);
    console.log('    Med #2 medicineId:', createdRx.medicines[1].medicineId, '| Generic:', createdRx.medicines[1].genericName);

    if (String(createdRx.medicines[0].medicineId) !== String(paracetamol._id)) {
      throw new Error('Medicine #1 medicineId mismatch');
    }
    if (String(createdRx.medicines[1].medicineId) !== String(amoxicillin._id)) {
      throw new Error('Medicine #2 medicineId mismatch');
    }

    // 4. CLEANUP TEST DATA
    console.log('\n=== 4. CLEANUP TEST DATA ===');
    await User.deleteMany({ _id: { $in: [doctorUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: doctorUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    await Prescription.deleteMany({ _id: createdRx._id });
    console.log('Cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL MEDICINE AUTOCOMPLETE INTEGRATION TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Integration test failed with error:', error);
    process.exit(1);
  }
};

runTest();
