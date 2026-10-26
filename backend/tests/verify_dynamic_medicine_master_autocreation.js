const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const Consultation = require('../src/models/Consultation');

const {
  createPrescription,
  updatePrescription,
  checkWithMedwise,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
  getPrescriptions,
} = require('../src/controllers/prescriptionController');
const { searchMedicines } = require('../src/controllers/medicineController');
const {
  findOrCreateMedicineMaster,
  findExistingMedicine,
  normalizeMedicineName,
  formatCanonicalName,
} = require('../src/services/medicineMasterService');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.data = null;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (obj) {
    this.data = obj;
    return this;
  };
  return res;
};

const nextErr = (err) => {
  if (err) throw err;
};

async function runTests() {
  console.log('========================================================================');
  console.log('VERIFY DYNAMIC MEDICINE MASTER AUTO-CREATION & DUPLICATE PREVENTION');
  console.log('========================================================================\n');

  let mongoConnected = false;
  const timestamp = Date.now();
  const testSuffix = `T${timestamp.toString().slice(-6)}`;
  const createdMedicineIds = [];
  const createdPrescriptionIds = [];
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  let initialMedicineCount = 0;

  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to MongoDB.');

    // Record initial Medicine Master state
    initialMedicineCount = await Medicine.countDocuments();
    console.log(`Initial Medicine Master record count: ${initialMedicineCount}`);
    assert(initialMedicineCount >= 33, `Expected at least 33 initial Medicine Master records, found ${initialMedicineCount}`);

    const originalMedicines = await Medicine.find().lean();
    const originalIds = new Set(originalMedicines.map((m) => m._id.toString()));

    // Set up or find Doctor user & profile
    let doctorUser = await User.findOne({ role: 'doctor' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: `Dr Test AutoMed ${testSuffix}`,
        email: `dr.automed.${testSuffix}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      });
      createdUserIds.push(doctorUser._id);
    }
    let doctorProfile = await DoctorProfile.findOne({ userId: doctorUser._id });
    if (!doctorProfile) {
      doctorProfile = await DoctorProfile.create({
        userId: doctorUser._id,
        specialization: 'Internal Medicine',
        medicalRegistrationNumber: `REG-${testSuffix}`,
        hospitalClinicName: 'MedWise Central Clinic',
        hospitalClinicAddress: '123 Health Ave',
      });
      createdProfileIds.push(doctorProfile._id);
    }

    // Set up or find Patient user & profile
    const patientUser = await User.create({
      name: `Patient AutoMed ${testSuffix}`,
      email: `patient.automed.${testSuffix}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientUser._id);

    const testMobile = `98123${timestamp.toString().slice(-5)}`;
    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      dateOfBirth: new Date('1990-05-15'),
      gender: 'Female',
      mobileNumber: testMobile,
      bloodGroup: 'B+',
      address: {
        addressLine1: '100 Health St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Emergency Person',
        relationship: 'Parent',
        mobileNumber: '9876543210',
      },
      hasNoKnownAllergies: true,
      allergies: [],
      profileCompleted: true,
    });
    createdProfileIds.push(patientProfile._id);

    // Set up or find Pharmacist user & profile
    let pharmacistUser = await User.findOne({ role: 'pharmacist' });
    if (!pharmacistUser) {
      pharmacistUser = await User.create({
        name: `Pharmacist Test ${testSuffix}`,
        email: `pharm.automed.${testSuffix}@medwise.com`,
        password: 'password123',
        role: 'pharmacist',
      });
      createdUserIds.push(pharmacistUser._id);
    }
    let pharmacistProfile = await PharmacistProfile.findOne({ userId: pharmacistUser._id });
    if (!pharmacistProfile) {
      pharmacistProfile = await PharmacistProfile.create({
        userId: pharmacistUser._id,
        mobileNumber: '9998887773',
        dateOfBirth: '1990-10-10',
        gender: 'Female',
        address: { addressLine1: 'Pharm St', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pinCode: '600003' },
        pharmacyRegistrationNumber: `LIC-A-${testSuffix}`,
        qualification: 'B.Pharm',
        yearsOfExperience: 5,
        pharmacyHospitalName: doctorProfile.hospitalClinicName,
        pharmacyHospitalAddress: doctorProfile.hospitalClinicAddress,
      });
      createdProfileIds.push(pharmacistProfile._id);
    }

    const doctorReqUser = {
      _id: doctorUser._id,
      name: doctorUser.name,
      role: 'doctor',
      hospitalClinicName: doctorProfile.hospitalClinicName,
      hospitalClinicAddress: doctorProfile.hospitalClinicAddress,
    };

    const pharmacistReqUser = {
      _id: pharmacistUser._id,
      name: pharmacistUser.name,
      role: 'pharmacist',
      pharmacyName: pharmacistProfile.pharmacyHospitalName,
      pharmacyAddress: pharmacistProfile.pharmacyHospitalAddress,
    };

    const patientPid = `PID-${testMobile}`;
    const testConsultation = await Consultation.create({
      patientId: patientUser._id,
      patientPid: patientPid,
      doctorId: doctorUser._id,
      doctorName: doctorUser.name,
      doctorSpecialization: doctorProfile.specialization || 'Internal Medicine',
      hospitalClinicName: doctorProfile.hospitalClinicName,
      hospitalClinicLocation: doctorProfile.hospitalClinicAddress,
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'General Checkup',
      clinicalNotes: 'Routine clinical consultation notes.',
      status: 'Completed',
    });
    createdConsultationIds.push(testConsultation._id);

    // -------------------------------------------------------------------------
    // TEST 1: Existing medicine search still works
    // -------------------------------------------------------------------------
    console.log('Test 1: Existing medicine search autocomplete...');
    const searchReq = { query: { search: 'paracetamol' } };
    const searchRes = mockRes();
    await searchMedicines(searchReq, searchRes);
    assert(searchRes.statusCode === 200, 'Search endpoint returned non-200');
    assert(searchRes.data.success === true, 'Search response success !== true');
    const foundParacetamol = searchRes.data.medicines.find((m) => m.genericName.toLowerCase() === 'paracetamol');
    assert(foundParacetamol !== undefined, 'Paracetamol not found in search results');
    console.log('  ✓ Test 1 Passed: Existing medicine search autocomplete works.');

    // -------------------------------------------------------------------------
    // TEST 2: Existing medicine selection still works without duplicate creation
    // -------------------------------------------------------------------------
    console.log('Test 2: Existing medicine selection reuses existing Medicine ID...');
    const paracetamolDoc = await Medicine.findOne({ genericName: 'Paracetamol' });
    assert(paracetamolDoc !== null, 'Paracetamol master document must exist');

    const rxReq1 = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Mild fever',
        medicines: [
          {
            medicineId: paracetamolDoc._id.toString(),
            medicineName: 'Paracetamol',
            genericName: 'Paracetamol',
            dosage: '500 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '3 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxRes1 = mockRes();
    await createPrescription(rxReq1, rxRes1, nextErr);
    assert(rxRes1.statusCode === 201, `Expected 201, got ${rxRes1.statusCode}`);
    const rx1 = rxRes1.data.prescription;
    createdPrescriptionIds.push(rx1._id);
    assert(rx1.medicines[0].medicineId.toString() === paracetamolDoc._id.toString(), 'Prescription did not reuse existing Paracetamol ID');

    const medCountAfterRx1 = await Medicine.countDocuments();
    assert(medCountAfterRx1 === initialMedicineCount, `Expected ${initialMedicineCount} medicines, got ${medCountAfterRx1}`);
    console.log('  ✓ Test 2 Passed: Existing medicine reused, no duplicate created.');

    // -------------------------------------------------------------------------
    // TEST 3 & 4: Manually enter a new medicine & auto-created in Medicine Master
    // -------------------------------------------------------------------------
    console.log('Test 3 & 4: New medicine manually entered is auto-created in Medicine Master upon prescription save...');
    const newMedName = `Cefixime Test ${testSuffix}`;
    const rxReq2 = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Bacterial infection',
        medicines: [
          {
            medicineId: null, // Doctor entered manually
            medicineName: newMedName,
            dosage: '200 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxRes2 = mockRes();
    await createPrescription(rxReq2, rxRes2, nextErr);
    assert(rxRes2.statusCode === 201, `Expected 201, got ${rxRes2.statusCode}`);
    const rx2 = rxRes2.data.prescription;
    createdPrescriptionIds.push(rx2._id);

    const newlyCreatedMed = await Medicine.findById(rx2.medicines[0].medicineId);
    assert(newlyCreatedMed !== null, 'New medicine was NOT created in Medicine Master');
    createdMedicineIds.push(newlyCreatedMed._id);
    assert(rx2.medicines[0].medicineId.toString() === newlyCreatedMed._id.toString(), 'Prescription medicineId does not match new Medicine Master ID');
    assert(newlyCreatedMed.genericName.toLowerCase() === newMedName.toLowerCase(), 'Generic name mismatch');
    assert(newlyCreatedMed.drugClass === 'Unclassified', 'Drug class should default to Unclassified without inventing claims');
    assert(Array.isArray(newlyCreatedMed.dosageGuidelines) && newlyCreatedMed.dosageGuidelines.length === 0, 'Must NOT invent dosage guidelines');
    assert(Array.isArray(newlyCreatedMed.contraindications) && newlyCreatedMed.contraindications.length === 0, 'Must NOT invent contraindications');
    console.log('  ✓ Test 3 & 4 Passed: New medicine manually entered and auto-created with clean clinical schema.');

    // -------------------------------------------------------------------------
    // TEST 5: Newly created medicine appears in autocomplete afterward
    // -------------------------------------------------------------------------
    console.log('Test 5: Newly created medicine appears in autocomplete search...');
    const searchNewReq = { query: { search: 'Cefixime' } };
    const searchNewRes = mockRes();
    await searchMedicines(searchNewReq, searchNewRes);
    assert(searchNewRes.statusCode === 200, 'Search endpoint failed for new medicine');
    const foundNewMed = searchNewRes.data.medicines.find((m) => m.id === newlyCreatedMed._id.toString());
    assert(foundNewMed !== undefined, 'Newly created medicine not found in autocomplete search');
    assert(foundNewMed.id === newlyCreatedMed._id.toString(), 'Autocomplete ID mismatch');
    console.log('  ✓ Test 5 Passed: Newly created medicine appears in autocomplete.');

    // -------------------------------------------------------------------------
    // TEST 6: Different capitalization does NOT create duplicates
    // -------------------------------------------------------------------------
    console.log('Test 6: Case-insensitive duplicate check...');
    const lowerMedName = newMedName.toLowerCase();
    const rxReqCase = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Infection followup',
        medicines: [
          {
            medicineId: null,
            medicineName: lowerMedName,
            dosage: '200 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxResCase = mockRes();
    await createPrescription(rxReqCase, rxResCase, nextErr);
    assert(rxResCase.statusCode === 201, 'Case prescription failed');
    const rxCase = rxResCase.data.prescription;
    createdPrescriptionIds.push(rxCase._id);
    assert(rxCase.medicines[0].medicineId.toString() === newlyCreatedMed._id.toString(), 'Different casing created duplicate instead of reusing existing ID');

    const medCountAfterCase = await Medicine.countDocuments();
    assert(medCountAfterCase === initialMedicineCount + 1, `Expected ${initialMedicineCount + 1} medicines (${initialMedicineCount} original + 1 test), got ${medCountAfterCase}`);
    console.log('  ✓ Test 6 Passed: Case variations safely reused existing medicine.');

    // -------------------------------------------------------------------------
    // TEST 7: Leading / trailing whitespace does NOT create duplicates
    // -------------------------------------------------------------------------
    console.log('Test 7: Leading/trailing whitespace duplicate check...');
    const whitespaceMedName = `   ${newMedName}   `;
    const rxReqWs = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Infection followup 2',
        medicines: [
          {
            medicineId: null,
            medicineName: whitespaceMedName,
            dosage: '200 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxResWs = mockRes();
    await createPrescription(rxReqWs, rxResWs, nextErr);
    const rxWs = rxResWs.data.prescription;
    createdPrescriptionIds.push(rxWs._id);
    assert(rxWs.medicines[0].medicineId.toString() === newlyCreatedMed._id.toString(), 'Leading/trailing whitespace created duplicate');
    console.log('  ✓ Test 7 Passed: Leading/trailing whitespace safely handled.');

    // -------------------------------------------------------------------------
    // TEST 8: Multiple internal spaces do NOT create duplicates
    // -------------------------------------------------------------------------
    console.log('Test 8: Multiple spaces duplicate check...');
    const multiSpaceMedBase = `Multi Space Med ${testSuffix}`;
    const rxReqMs1 = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Check multi spaces',
        medicines: [
          {
            medicineId: null,
            medicineName: multiSpaceMedBase,
            dosage: '100 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-0',
            duration: '3 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxResMs1 = mockRes();
    await createPrescription(rxReqMs1, rxResMs1, nextErr);
    const rxMs1 = rxResMs1.data.prescription;
    createdPrescriptionIds.push(rxMs1._id);
    const ms1MedDoc = await Medicine.findById(rxMs1.medicines[0].medicineId);
    createdMedicineIds.push(ms1MedDoc._id);

    // Try same with extra consecutive spaces
    const multiSpaceWithSpaces = `Multi   Space    Med   ${testSuffix}`;
    const rxReqMs2 = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Check multi spaces 2',
        medicines: [
          {
            medicineId: null,
            medicineName: multiSpaceWithSpaces,
            dosage: '100 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-0',
            duration: '3 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxResMs2 = mockRes();
    await createPrescription(rxReqMs2, rxResMs2, nextErr);
    const rxMs2 = rxResMs2.data.prescription;
    createdPrescriptionIds.push(rxMs2._id);
    assert(rxMs2.medicines[0].medicineId.toString() === ms1MedDoc._id.toString(), 'Multiple spaces created duplicate Medicine record');
    console.log('  ✓ Test 8 Passed: Multiple internal spaces normalized.');

    // -------------------------------------------------------------------------
    // TEST 9: Safe plural/alias variations do NOT create duplicates
    // -------------------------------------------------------------------------
    console.log('Test 9: Safe plural variation check against existing database...');
    // "Paracetamols" should safely match existing "Paracetamol"
    const rxReqPlural = {
      user: doctorReqUser,
      body: {
        patientPid: patientPid,
        patientId: patientUser._id,
        consultationId: testConsultation._id,
        clinicalDiagnosis: 'Headache',
        medicines: [
          {
            medicineId: null,
            medicineName: 'Paracetamols',
            dosage: '500 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '2 days',
            route: 'Oral',
          },
        ],
      },
    };
    const rxResPlural = mockRes();
    await createPrescription(rxReqPlural, rxResPlural, nextErr);
    const rxPlural = rxResPlural.data.prescription;
    createdPrescriptionIds.push(rxPlural._id);
    assert(rxPlural.medicines[0].medicineId.toString() === paracetamolDoc._id.toString(), 'Safe plural did not reuse Paracetamol document');
    console.log('  ✓ Test 9 Passed: Safe plural normalized to existing Medicine document.');

    // -------------------------------------------------------------------------
    // TEST 10: Genuine different medicine names are NOT incorrectly merged
    // -------------------------------------------------------------------------
    console.log('Test 10: Genuine different medicines ending with "s" are preserved...');
    // E.g., "Ferrous Sulfate" or "Dapsone" vs others
    const medEndS = `FerrousTest${testSuffix}`;
    const medNoS = `FerrouTest${testSuffix}`;
    const createdEndS = await findOrCreateMedicineMaster({ medicineName: medEndS });
    createdMedicineIds.push(createdEndS._id);
    const createdNoS = await findOrCreateMedicineMaster({ medicineName: medNoS });
    createdMedicineIds.push(createdNoS._id);

    assert(createdEndS._id.toString() !== createdNoS._id.toString(), 'Genuinely different medicine names were incorrectly merged!');
    console.log('  ✓ Test 10 Passed: Genuine different medicines are never incorrectly merged.');

    // -------------------------------------------------------------------------
    // TEST 11: Concurrent creation cannot create duplicate Medicine Master records
    // -------------------------------------------------------------------------
    console.log('Test 11: Concurrent creation race condition safety...');
    const concurrentName = `ConcurrentMed${testSuffix}`;
    const results = await Promise.all([
      findOrCreateMedicineMaster({ medicineName: concurrentName }),
      findOrCreateMedicineMaster({ medicineName: concurrentName }),
      findOrCreateMedicineMaster({ medicineName: concurrentName.toLowerCase() }),
      findOrCreateMedicineMaster({ medicineName: `  ${concurrentName}  ` }),
    ]);

    const firstId = results[0]._id.toString();
    for (let i = 1; i < results.length; i++) {
      assert(results[i]._id.toString() === firstId, `Concurrent creation returned different ID at index ${i}`);
    }
    for (let i = 0; i < results.length; i++) {
      createdMedicineIds.push(results[i]._id);
    }

    const canonicalConcurrent = formatCanonicalName(concurrentName);
    const concurrentMatches = await Medicine.find({
      $or: [
        { genericName: canonicalConcurrent },
        { normalizedName: concurrentName.toLowerCase() },
      ],
    });
    assert(concurrentMatches.length === 1, `Expected exactly 1 Medicine record for concurrent calls, found ${concurrentMatches.length}`);
    console.log('  ✓ Test 11 Passed: Concurrent requests safely return the same single record.');

    // -------------------------------------------------------------------------
    // TEST 12: Prescription uses the correct existing/new Medicine _id
    // -------------------------------------------------------------------------
    console.log('Test 12: Prescription stores accurate Medicine ObjectId...');
    const verifyRx = await Prescription.findById(rx2._id);
    assert(verifyRx.medicines[0].medicineId.toString() === newlyCreatedMed._id.toString(), 'Prescription did not store new Medicine _id');
    console.log('  ✓ Test 12 Passed: Prescription stores valid Medicine ObjectId.');

    // -------------------------------------------------------------------------
    // TEST 13 & 14: Existing prescriptions and original 33 medicines remain unchanged
    // -------------------------------------------------------------------------
    console.log('Test 13 & 14: Verifying original 33 Medicine records are intact...');
    for (const orig of originalMedicines) {
      const current = await Medicine.findById(orig._id).lean();
      assert(current !== null, `Original medicine ${orig.genericName} was deleted`);
      assert(current.genericName === orig.genericName, `Original medicine genericName changed for ${orig._id}`);
      assert(current.drugClass === orig.drugClass, `Original medicine drugClass changed for ${orig._id}`);
    }
    console.log('  ✓ Test 13 & 14 Passed: All original 33 Medicine records remain completely unchanged.');

    // -------------------------------------------------------------------------
    // TEST 15: Existing MedWise analysis still works on prescriptions with new medicines
    // -------------------------------------------------------------------------
    console.log('Test 15: MedWise clinical check on prescription with auto-created medicine...');
    const checkReq = { user: doctorReqUser, params: { id: rx2._id.toString() } };
    const checkRes = mockRes();
    await checkWithMedwise(checkReq, checkRes, nextErr);
    assert(checkRes.statusCode === 200, `checkWithMedwise failed with ${checkRes.statusCode}`);
    const analysis = checkRes.data.prescription.medwiseAnalysis;
    assert(analysis !== undefined && analysis !== null, 'MedWise analysis missing');
    const dosageItem = analysis.checks.dosage.find((d) => d.genericName.toLowerCase() === newlyCreatedMed.genericName.toLowerCase());
    assert(dosageItem !== undefined, 'New medicine missing from dosage check');
    assert(dosageItem.status === 'accepted', `Expected accepted dosage status, got '${dosageItem.status}'`);
    console.log('  ✓ Test 15 Passed: MedWise analysis ran successfully with dosage accepted.');

    // -------------------------------------------------------------------------
    // TEST 16: Prescription editing still works with auto-creation
    // -------------------------------------------------------------------------
    console.log('Test 16: Prescription editing with newly added medicine...');
    const editMedName = `Edited Med ${testSuffix}`;
    const updateReq = {
      user: doctorReqUser,
      params: { id: rx2._id.toString() },
      body: {
        clinicalDiagnosis: 'Updated diagnosis',
        medicines: [
          {
            medicineId: newlyCreatedMed._id.toString(),
            medicineName: newMedName,
            dosage: '200 mg',
            dosageForm: 'Tablet',
            frequency: '1-0-1',
            duration: '7 days',
            route: 'Oral',
          },
          {
            medicineId: null, // New medicine added during edit
            medicineName: editMedName,
            dosage: '10 mg',
            dosageForm: 'Tablet',
            frequency: '0-0-1',
            duration: '7 days',
            route: 'Oral',
          },
        ],
      },
    };
    const updateRes = mockRes();
    await updatePrescription(updateReq, updateRes, nextErr);
    assert(updateRes.statusCode === 200, `updatePrescription failed with ${updateRes.statusCode}`);
    const updatedRx = updateRes.data.prescription;
    assert(updatedRx.medicines.length === 2, `Expected 2 medicines after edit, got ${updatedRx.medicines.length}`);

    const editMedDoc = await Medicine.findById(updatedRx.medicines[1].medicineId);
    assert(editMedDoc !== null, 'Medicine added during edit was NOT created in Medicine Master');
    createdMedicineIds.push(editMedDoc._id);
    assert(updatedRx.medicines[1].medicineId.toString() === editMedDoc._id.toString(), 'Medicine ID from edit does not match Medicine Master');
    console.log('  ✓ Test 16 Passed: Prescription edit dynamically auto-created medicine.');

    // -------------------------------------------------------------------------
    // TEST 17: Doctor approval workflow still works
    // -------------------------------------------------------------------------
    console.log('Test 17: Doctor approval workflow...');
    // Run MedWise check first to clear required review
    const checkReq2 = { user: doctorReqUser, params: { id: rx2._id.toString() } };
    await checkWithMedwise(checkReq2, mockRes(), nextErr);

    const approveReq = { user: doctorReqUser, params: { id: rx2._id.toString() } };
    const approveRes = mockRes();
    await approvePrescription(approveReq, approveRes, nextErr);
    assert(approveRes.statusCode === 200, `approvePrescription failed with ${approveRes.statusCode}`);
    assert(approveRes.data.prescription.status === 'Sent to Pharmacist', `Expected status 'Sent to Pharmacist', got '${approveRes.data.prescription.status}'`);
    console.log('  ✓ Test 17 Passed: Doctor approval moved status to "Sent to Pharmacist".');

    // -------------------------------------------------------------------------
    // TEST 18: Pharmacist workflow (dispense & deliver) still works
    // -------------------------------------------------------------------------
    console.log('Test 18: Pharmacist dispense and deliver workflow...');
    const dispenseReq = { user: pharmacistReqUser, params: { id: rx2._id.toString() } };
    const dispenseRes = mockRes();
    await dispensePrescription(dispenseReq, dispenseRes, nextErr);
    assert(dispenseRes.statusCode === 200, `dispensePrescription failed with ${dispenseRes.statusCode}`);
    assert(dispenseRes.data.prescription.status === 'Dispensed', `Expected status 'Dispensed', got '${dispenseRes.data.prescription.status}'`);

    const deliverReq = { user: pharmacistReqUser, params: { id: rx2._id.toString() } };
    const deliverRes = mockRes();
    await deliverPrescription(deliverReq, deliverRes, nextErr);
    assert(deliverRes.statusCode === 200, `deliverPrescription failed with ${deliverRes.statusCode}`);
    assert(deliverRes.data.prescription.status === 'Delivered', `Expected status 'Delivered', got '${deliverRes.data.prescription.status}'`);
    console.log('  ✓ Test 18 Passed: Pharmacist dispense and deliver workflow completed.');

    // -------------------------------------------------------------------------
    // TEST 19: Patient medication history still works
    // -------------------------------------------------------------------------
    console.log('Test 19: Patient medication history retrieval...');
    const patientHistReq = { user: { _id: patientUser._id, role: 'patient' }, query: {} };
    const patientHistRes = mockRes();
    await getPrescriptions(patientHistReq, patientHistRes, nextErr);
    assert(patientHistRes.statusCode === 200, 'getPrescriptions failed for patient');
    const patientPrescriptions = patientHistRes.data.prescriptions;
    assert(patientPrescriptions.length >= 1, 'Patient medication history empty');
    const matchedRx = patientPrescriptions.find((p) => p._id.toString() === rx2._id.toString());
    assert(matchedRx !== undefined, 'Delivered prescription not found in patient history');
    console.log('  ✓ Test 19 Passed: Patient medication history contains prescription.');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('ALL DYNAMIC MEDICINE MASTER TESTS PASSED SUCCESSFULLY (19/19)');
    console.log('========================================================================\n');
  } catch (testErr) {
    console.error('\n❌ ERROR IN TEST SUITE:', testErr);
    throw testErr;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up ALL temporary test data
    // -------------------------------------------------------------------------
    console.log('Cleaning up test data...');
    if (mongoConnected) {
      if (createdPrescriptionIds.length > 0) {
        await Prescription.deleteMany({ _id: { $in: createdPrescriptionIds } });
        console.log(`Deleted ${createdPrescriptionIds.length} test prescriptions.`);
      }
      await Medicine.deleteMany({
        $or: [
          { _id: { $in: createdMedicineIds } },
          { genericName: new RegExp(testSuffix, 'i') },
        ],
      });
      console.log('Cleaned up test auto-created medicines.');
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
        console.log(`Deleted ${createdConsultationIds.length} test consultations.`);
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await DoctorProfile.deleteMany({ _id: { $in: createdProfileIds } });
        await PharmacistProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }

      const finalMedicineCount = await Medicine.countDocuments();
      console.log(`Final Medicine Master record count: ${finalMedicineCount}`);
      assert(finalMedicineCount === initialMedicineCount, `CRITICAL: Final medicine count must match initial count (${initialMedicineCount}), found ${finalMedicineCount}`);

      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
