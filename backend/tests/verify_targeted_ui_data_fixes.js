const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const Medicine = require('../src/models/Medicine');
const { lookupPatientByPid, checkWithMedwise, createPrescription } = require('../src/controllers/prescriptionController');
const { getMyProfile } = require('../src/controllers/profileController');
const { updatePatientClinicalProfile } = require('../src/controllers/doctorController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';

async function runVerification() {
  console.log('--- STARTING TARGETED UI/DATA AUTO-POPULATION & MISSING DETAILS FIXES VERIFICATION ---');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 });

  let tempDoctorUser, tempDoctorProfile;
  let tempPatientUser, tempPatientProfile;
  let tempConsultation, tempPrescription;
  let testMedicine;

  try {
    // 0. Ensure master medicine exists
    console.log('Finding test medicine...');
    testMedicine = await Medicine.findOne({ isActive: true });
    if (!testMedicine) {
      testMedicine = await Medicine.create({
        genericName: 'Paracetamol',
        brandNames: ['Calpol'],
        dosageForms: ['Tablet'],
        availableStrengths: ['500mg'],
        routes: ['Oral'],
        isActive: true,
      });
    }

    // 1. TEST DOCTOR WORKPLACE AUTO-FILL
    console.log('\n1. Testing Doctor Workplace Details Auto-Fill...');
    console.log('Creating temp doctor user...');
    tempDoctorUser = await User.create({
      name: 'Dr. Test AutoFill',
      email: `testdoc_${Date.now()}@medwise.com`,
      password: 'hashedpassword123',
      role: 'doctor',
    });
    console.log('Temp doctor user created:', tempDoctorUser._id);

    tempDoctorProfile = await DoctorProfile.create({
      userId: tempDoctorUser._id,
      mobileNumber: '9988776655',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Male',
      address: {
        addressLine1: '123 Health Ave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      medicalRegistrationNumber: 'REG-123456',
      specialization: 'General Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 12,
      hospitalClinicName: 'City Care Hospital',
      hospitalClinicAddress: '45 Hospital Road, Anna Nagar, Chennai',
      profileCompleted: true,
    });

    // Mock request for getMyProfile
    let profileResObj = null;
    const reqProfile = { user: tempDoctorUser };
    const resProfile = {
      status: (code) => ({
        json: (data) => {
          profileResObj = data;
          return data;
        },
      }),
    };
    await getMyProfile(reqProfile, resProfile, (err) => { if (err) throw err; });

    if (!profileResObj || !profileResObj.success || !profileResObj.profile) {
      throw new Error('getMyProfile failed to return doctor profile.');
    }
    const prof = profileResObj.profile;
    console.log('Returned profile workplaceName:', prof.workplaceName);
    console.log('Returned profile workplaceAddress:', prof.workplaceAddress);

    if (prof.workplaceName !== 'City Care Hospital') {
      throw new Error(`Expected workplaceName 'City Care Hospital', got '${prof.workplaceName}'`);
    }
    if (prof.workplaceAddress !== '45 Hospital Road, Anna Nagar, Chennai') {
      throw new Error(`Expected workplaceAddress '45 Hospital Road, Anna Nagar, Chennai', got '${prof.workplaceAddress}'`);
    }
    console.log('PASSED: Doctor Workplace Details Auto-Fill verified.');

    // 2. TEST PATIENT PID LOOKUP AUTO-FILL (AGE & BLOOD GROUP)
    console.log('\n2. Testing Patient PID Lookup Auto-Fill (Age & Blood Group)...');
    tempPatientUser = await User.create({
      name: 'Meera Krishnan Test',
      email: `meera_${Date.now()}@medwise.com`,
      password: 'hashedpassword123',
      role: 'patient',
    });

    tempPatientProfile = await PatientProfile.create({
      userId: tempPatientUser._id,
      mobileNumber: '8765432109',
      dateOfBirth: new Date('2000-08-20'),
      gender: 'Female',
      address: {
        addressLine1: '12 Rose Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Raman Krishnan',
        relationship: 'Parent',
        mobileNumber: '9876543210',
      },
      bloodGroup: 'O+',
      hasNoKnownAllergies: false,
      allergies: [],
      profileCompleted: true,
    });

    const expectedPid = 'PID-8765432109';
    let lookupResObj = null;
    const reqLookup = {
      user: tempDoctorUser,
      params: { pid: expectedPid },
    };
    const resLookup = {
      status: (code) => ({
        json: (data) => {
          lookupResObj = data;
          return data;
        },
      }),
    };

    await lookupPatientByPid(reqLookup, resLookup, (err) => { if (err) throw err; });

    if (!lookupResObj || !lookupResObj.success || !lookupResObj.patient) {
      throw new Error('lookupPatientByPid failed to return patient object.');
    }
    const patData = lookupResObj.patient;
    console.log('Lookup Patient Result:', patData);

    if (!patData.name.startsWith('Meera Krishnan')) throw new Error(`Expected name starting with 'Meera Krishnan', got '${patData.name}'`);
    if (patData.pid !== expectedPid) throw new Error(`Expected PID '${expectedPid}', got '${patData.pid}'`);
    if (typeof patData.age !== 'number' || patData.age <= 0) throw new Error(`Expected valid calculated age integer, got '${patData.age}'`);
    if (patData.gender !== 'Female') throw new Error(`Expected gender 'Female', got '${patData.gender}'`);
    if (patData.bloodGroup !== 'O+') throw new Error(`Expected bloodGroup 'O+', got '${patData.bloodGroup}'`);

    console.log('PASSED: Patient PID Lookup Auto-Fill (Age & Blood Group) verified.');

    // 3. TEST CONSULTATION -> PRESCRIPTION AUTO-FILL DETAILS
    console.log('\n3. Testing Consultation -> Prescription Auto-Fill...');
    tempConsultation = await Consultation.create({
      patientId: patData.userId,
      patientPid: expectedPid,
      doctorId: tempDoctorUser._id,
      doctorName: tempDoctorUser.name,
      doctorSpecialization: 'General Medicine',
      hospitalClinicName: tempDoctorProfile.hospitalClinicName,
      hospitalClinicLocation: tempDoctorProfile.hospitalClinicAddress,
      consultationDate: new Date(),
      consultationType: 'In-person',
      reasonForVisit: 'Acute Fever and Headache',
      clinicalNotes: 'Patient complains of fever since 2 days.',
      diagnosisNotes: 'Viral Upper Respiratory Infection',
      doctorRecommendations: 'Rest adequately, drink plenty of fluids, take prescribed antipyretics.',
      followUpDate: new Date('2026-10-15'),
      status: 'Completed',
    });

    let createRxResObj = null;
    const reqCreateRx = {
      user: tempDoctorUser,
      body: {
        patientPid: expectedPid,
        consultationId: tempConsultation._id,
        clinicalDiagnosis: tempConsultation.diagnosisNotes,
        doctorNotes: tempConsultation.doctorRecommendations,
        followUpDate: '2026-10-15',
        medicines: [
          {
            medicineId: testMedicine._id,
            genericName: testMedicine.genericName,
            medicineName: testMedicine.genericName,
            dosage: '500mg',
            frequency: '1-0-1',
            duration: '5 days',
            route: 'Oral',
            instructions: 'Take after meals',
          },
        ],
      },
    };
    const resCreateRx = {
      status: (code) => ({
        json: (data) => {
          createRxResObj = data;
          return data;
        },
      }),
    };

    await createPrescription(reqCreateRx, resCreateRx, (err) => { if (err) throw err; });

    if (!createRxResObj || !createRxResObj.success || !createRxResObj.prescription) {
      throw new Error(`createPrescription failed: ${JSON.stringify(createRxResObj)}`);
    }
    tempPrescription = createRxResObj.prescription;
    console.log('Created Prescription:', {
      prescriptionId: tempPrescription.prescriptionId,
      clinicalDiagnosis: tempPrescription.clinicalDiagnosis,
      doctorNotes: tempPrescription.doctorNotes,
      followUpDate: tempPrescription.followUpDate,
    });

    if (tempPrescription.clinicalDiagnosis !== 'Viral Upper Respiratory Infection') {
      throw new Error(`Diagnosis mismatch: '${tempPrescription.clinicalDiagnosis}'`);
    }
    if (tempPrescription.doctorNotes !== 'Rest adequately, drink plenty of fluids, take prescribed antipyretics.') {
      throw new Error(`Doctor notes mismatch: '${tempPrescription.doctorNotes}'`);
    }
    console.log('PASSED: Consultation -> Prescription Auto-Fill verified.');

    // 4. TEST MEDWISE CHECK & ADD MISSING DETAILS (INCOMPLETE ALLERGY ASSESSMENT -> COMPLETED)
    console.log('\n4. Testing MedWise Incomplete Allergy Assessment -> Update Missing Details -> Auto-Rerun...');
    
    // Ensure patient allergy assessment is incomplete initially for test
    await PatientProfile.updateOne({ userId: patData.userId }, { $set: { hasNoKnownAllergies: false, allergies: [] } });

    // First MedWise Check
    let check1ResObj = null;
    const reqCheck1 = {
      user: tempDoctorUser,
      params: { id: tempPrescription._id.toString() },
    };
    const resCheck1 = {
      status: (code) => ({
        json: (data) => {
          check1ResObj = data;
          return data;
        },
      }),
    };

    await checkWithMedwise(reqCheck1, resCheck1, (err) => { if (err) throw err; });

    if (!check1ResObj || !check1ResObj.success || !check1ResObj.analysis) {
      throw new Error('Initial MedWise check failed.');
    }

    const audit1 = check1ResObj.analysis.audit;
    console.log('Initial Audit Outcome:', check1ResObj.analysis.overallRecommendation?.status);
    console.log('Audit Findings Count:', audit1?.findings?.length);
    console.log('Has allergy incomplete finding:', audit1?.findings?.some(f => f.type === 'allergy_assessment_incomplete'));

    if (!audit1?.findings?.some(f => f.type === 'allergy_assessment_incomplete')) {
      throw new Error('Expected initial MedWise audit to flag allergy_assessment_incomplete.');
    }

    // Now Doctor fills Missing Details: "No known allergies"
    console.log('Submitting Missing Details: hasNoKnownAllergies = true...');
    let updateProfileResObj = null;
    const reqUpdateProf = {
      user: tempDoctorUser,
      params: { patientId: patData.userId.toString() },
      body: {
        hasNoKnownAllergies: true,
        allergies: [],
      },
    };
    const resUpdateProf = {
      status: (code) => ({
        json: (data) => {
          updateProfileResObj = data;
          return data;
        },
      }),
    };

    await updatePatientClinicalProfile(reqUpdateProf, resUpdateProf, (err) => { if (err) throw err; });
    if (!updateProfileResObj || !updateProfileResObj.success) {
      throw new Error('updatePatientClinicalProfile failed.');
    }

    // Second MedWise Check (Auto-Rerun)
    let check2ResObj = null;
    const resCheck2 = {
      status: (code) => ({
        json: (data) => {
          check2ResObj = data;
          return data;
        },
      }),
    };
    await checkWithMedwise(reqCheck1, resCheck2, (err) => { if (err) throw err; });

    if (!check2ResObj || !check2ResObj.success || !check2ResObj.analysis) {
      throw new Error('Second MedWise check failed.');
    }

    const audit2 = check2ResObj.analysis.audit;
    const rec2 = check2ResObj.analysis.overallRecommendation;
    console.log('Second Audit Outcome:', rec2?.status);
    console.log('Second Audit Summary:', audit2?.summary);
    console.log('Has allergy incomplete finding (2nd check):', audit2?.findings?.some(f => f.type === 'allergy_assessment_incomplete'));

    if (audit2?.findings?.some(f => f.type === 'allergy_assessment_incomplete')) {
      throw new Error('Allergy assessment incomplete finding should NO LONGER exist after saving no known allergies.');
    }

    if (rec2?.status !== 'cleared') {
      throw new Error(`Expected overall recommendation status to be 'cleared', got '${rec2?.status}'`);
    }

    console.log('PASSED: MedWise Incomplete Allergy Assessment -> Save -> Auto Rerun -> Outcome CLEARED verified!');

  } finally {
    // Clean up temporary test fixtures
    console.log('\nCleaning up temporary test data...');
    if (tempPrescription) await Prescription.deleteOne({ _id: tempPrescription._id });
    if (tempConsultation) await Consultation.deleteOne({ _id: tempConsultation._id });
    if (tempPatientProfile) await PatientProfile.deleteOne({ _id: tempPatientProfile._id });
    if (tempPatientUser) await User.deleteOne({ _id: tempPatientUser._id });
    if (tempDoctorProfile) await DoctorProfile.deleteOne({ _id: tempDoctorProfile._id });
    if (tempDoctorUser) await User.deleteOne({ _id: tempDoctorUser._id });
    await mongoose.disconnect();
    console.log('Cleanup complete.');
  }

  console.log('\n--- ALL TARGETED FIXES VERIFIED SUCCESSFULLY! ---');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
