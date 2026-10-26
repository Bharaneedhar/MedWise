const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const PatientProfile = require('../src/models/PatientProfile');
const { checkUserProfileCompleted } = require('../src/controllers/profileController');

const runVerification = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');

    const timestamp = Date.now();

    // 1. TEST DOCTOR (NO emergencyContact)
    console.log('\n--- 1. Testing Doctor Registration & Profile (No emergencyContact) ---');
    const doctorEmail = `doc${timestamp}@medwise.com`;
    const docUser = await User.create({
      name: 'Dr. Test Physician',
      email: doctorEmail,
      password: 'password123',
      role: 'doctor',
    });
    console.log(`Doctor created with ID: ${docUser._id}`);

    let isDocComplete = await checkUserProfileCompleted(docUser._id, 'doctor');
    console.log(`Doctor profileCompleted initially: ${isDocComplete} (Expected: false)`);
    if (isDocComplete !== false) throw new Error('Doctor profile should initially be incomplete');

    const doctorProfileData = {
      userId: docUser._id,
      mobileNumber: '+91 9876543210',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Male',
      profilePhoto: '',
      address: {
        addressLine1: '123 Medical Enclave',
        addressLine2: 'Block A',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pinCode: '560001',
      },
      medicalRegistrationNumber: 'MCI-123456-DOC',
      specialization: 'Cardiology',
      otherSpecialization: '',
      qualification: 'MD',
      otherQualification: '',
      yearsOfExperience: 12,
      hospitalClinicName: 'Apollo Specialty Hospital',
      hospitalClinicAddress: 'Main Ring Road, Jayanagar',
      professionalContactNumber: '+91 80 23456789',
      profileCompleted: true,
    };

    const savedDocProfile = await DoctorProfile.create(doctorProfileData);
    console.log(`Doctor profile created in doctorprofiles collection: ID ${savedDocProfile._id}`);
    const docJSON = savedDocProfile.toJSON();
    if (docJSON.emergencyContact) {
      throw new Error('DoctorProfile MUST NOT contain emergencyContact');
    }
    console.log('Verified: DoctorProfile contains NO emergencyContact field.');

    isDocComplete = await checkUserProfileCompleted(docUser._id, 'doctor');
    console.log(`Doctor profileCompleted after save: ${isDocComplete} (Expected: true)`);
    if (isDocComplete !== true) throw new Error('Doctor profile should be complete');

    // 2. TEST PHARMACIST (NO emergencyContact)
    console.log('\n--- 2. Testing Pharmacist Registration & Profile (No emergencyContact) ---');
    const pharmEmail = `pharm${timestamp}@medwise.com`;
    const pharmUser = await User.create({
      name: 'Pharm. Test Dispenser',
      email: pharmEmail,
      password: 'password123',
      role: 'pharmacist',
    });

    const pharmProfileData = {
      userId: pharmUser._id,
      mobileNumber: '+91 9123456780',
      dateOfBirth: new Date('1990-08-20'),
      gender: 'Female',
      address: {
        addressLine1: '45 Pharmacy Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      pharmacyRegistrationNumber: 'PCI-987654-PH',
      qualification: 'Pharm.D',
      specialization: 'Clinical Pharmacy',
      yearsOfExperience: 5,
      pharmacyHospitalName: 'MedWise Central Pharmacy',
      pharmacyHospitalAddress: 'Healthcare Hub, T. Nagar',
      profileCompleted: true,
    };

    const savedPharmProfile = await PharmacistProfile.create(pharmProfileData);
    console.log(`Pharmacist profile created in pharmacistprofiles collection: ID ${savedPharmProfile._id}`);
    const pharmJSON = savedPharmProfile.toJSON();
    if (pharmJSON.emergencyContact) {
      throw new Error('PharmacistProfile MUST NOT contain emergencyContact');
    }
    console.log('Verified: PharmacistProfile contains NO emergencyContact field.');
    const isPharmComplete = await checkUserProfileCompleted(pharmUser._id, 'pharmacist');
    console.log(`Pharmacist profileCompleted: ${isPharmComplete} (Expected: true)`);

    // 3. TEST PATIENT (WITH emergencyContact & NO allergies)
    console.log('\n--- 3. Testing Patient Registration & Profile (With emergencyContact & No allergies) ---');
    const patientEmail = `patient${timestamp}@medwise.com`;
    const patientUser = await User.create({
      name: 'Test Patient User',
      email: patientEmail,
      password: 'password123',
      role: 'patient',
    });

    const patientProfileData = {
      userId: patientUser._id,
      mobileNumber: '+91 9988776655',
      dateOfBirth: new Date('1995-12-10'),
      gender: 'Female',
      address: {
        addressLine1: '78 Garden Street',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pinCode: '500001',
      },
      emergencyContact: {
        name: 'Robert User',
        relationship: 'Sibling',
        mobileNumber: '+91 9988776654',
      },
      bloodGroup: 'B+',
      medicalConditions: [
        { name: 'Type 2 Diabetes', sinceYear: 2021, notes: 'Managed with diet and oral meds' },
        { name: 'Hypertension', sinceYear: 2023, notes: 'Mild' },
      ],
      currentMedications: [
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', notes: 'After meals' },
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', notes: 'Morning' },
      ],
      previousSurgeries: [
        { surgeryName: 'Appendectomy', year: 2018, hospital: 'City Care Hospital', notes: 'Laparoscopic' },
      ],
      profileCompleted: true,
    };

    const savedPatientProfile = await PatientProfile.create(patientProfileData);
    console.log(`Patient profile created in patientprofiles collection: ID ${savedPatientProfile._id}`);
    const patientDocJSON = savedPatientProfile.toJSON();
    if (!patientDocJSON.emergencyContact) {
      throw new Error('FAILED: PatientProfile MUST contain emergencyContact!');
    }
    if (patientDocJSON.allergies || patientDocJSON.allergyList || patientDocJSON.allergy) {
      throw new Error('FAILED: PatientProfile MUST NOT contain any allergy fields!');
    }
    console.log('Verified: PatientProfile contains emergencyContact and zero allergy fields (as required).');

    // Clean up test records
    await User.deleteMany({ _id: { $in: [docUser._id, pharmUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: docUser._id });
    await PharmacistProfile.deleteMany({ userId: pharmUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });
    console.log('Cleanup completed.');

    console.log('\n>>> ALL BACKEND PROFILE MODEL TESTS PASSED! <<<');
    process.exit(0);
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
};

runVerification();
