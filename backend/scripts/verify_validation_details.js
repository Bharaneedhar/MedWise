const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const PatientProfile = require('../src/models/PatientProfile');
const { createOrUpdateMyProfile } = require('../src/controllers/profileController');

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

const runValidationTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for validation test suite.\n');

    const timestamp = Date.now();

    // ----------------------------------------------------
    // 1. DOCTOR VALIDATION TESTS
    // ----------------------------------------------------
    console.log('=== 1. TESTING DOCTOR VALIDATION ===');
    const docUser = await User.create({
      name: 'Dr. Val Test',
      email: `val.doc.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });

    const validDoctorBody = {
      name: 'Dr. Val Test',
      mobileNumber: '+91 9876543210',
      dateOfBirth: '1985-05-15',
      gender: 'Male',
      address: {
        addressLine1: '123 Medical Way',
        addressLine2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pinCode: '560001',
      },
      medicalRegistrationNumber: 'MCI-123456',
      specialization: 'Cardiology',
      qualification: 'MD',
      yearsOfExperience: 10,
      hospitalClinicName: 'Apollo Hospital',
      hospitalClinicAddress: 'Main Ring Road',
    };

    // 1.1 All valid fields
    const res1 = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: validDoctorBody }, res1, (err) => { if (err) throw err; });
    console.log('1.1 Valid Doctor Profile:', res1.statusCode, res1.data.message);
    if (res1.statusCode !== 200) throw new Error('Expected 200 for valid doctor profile');

    // 1.2 Years of Experience = 0 (Must be accepted as valid!)
    const res1b = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, yearsOfExperience: 0 } }, res1b, (err) => { if (err) throw err; });
    console.log('1.2 Doctor Experience = 0:', res1b.statusCode, res1b.data.profile.yearsOfExperience === 0 ? 'Saved 0 correctly' : 'Failed');
    if (res1b.statusCode !== 200 || res1b.data.profile.yearsOfExperience !== 0) throw new Error('Years of experience = 0 must be accepted');

    // 1.3 Missing Mobile Number
    const res1c = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, mobileNumber: '' } }, res1c, (err) => { if (err) throw err; });
    console.log('1.3 Missing Mobile:', res1c.statusCode, res1c.data.message);
    if (res1c.statusCode !== 400 || res1c.data.message !== 'Please complete: Mobile Number.') throw new Error('Failed specific mobile validation message');

    // 1.4 Missing Medical Registration Number
    const res1d = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, medicalRegistrationNumber: '  ' } }, res1d, (err) => { if (err) throw err; });
    console.log('1.4 Missing Med Reg:', res1d.statusCode, res1d.data.message);
    if (res1d.statusCode !== 400 || res1d.data.message !== 'Please complete: Medical Registration Number.') throw new Error('Failed specific med reg validation message');

    // 1.5 Specialization = "Other" without otherSpecialization
    const res1e = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, specialization: 'Other', otherSpecialization: '' } }, res1e, (err) => { if (err) throw err; });
    console.log('1.5 Specialization=Other (empty):', res1e.statusCode, res1e.data.message);
    if (res1e.statusCode !== 400 || res1e.data.message !== 'Please complete: Specify Other Specialization.') throw new Error('Failed specific other specialization message');

    // 1.6 Specialization = "Other" with otherSpecialization
    const res1f = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, specialization: 'Other', otherSpecialization: 'Pediatric Surgery' } }, res1f, (err) => { if (err) throw err; });
    console.log('1.6 Specialization=Other (filled):', res1f.statusCode, res1f.data.profile.otherSpecialization);
    if (res1f.statusCode !== 200 || res1f.data.profile.otherSpecialization !== 'Pediatric Surgery') throw new Error('Failed specialization Other fill');

    // 1.7 Qualification = "Other" without otherQualification
    const res1g = mockRes();
    await createOrUpdateMyProfile({ user: docUser, body: { ...validDoctorBody, qualification: 'Other', otherQualification: '' } }, res1g, (err) => { if (err) throw err; });
    console.log('1.7 Qualification=Other (empty):', res1g.statusCode, res1g.data.message);
    if (res1g.statusCode !== 400 || res1g.data.message !== 'Please complete: Specify Other Qualification.') throw new Error('Failed specific other qualification message');

    // ----------------------------------------------------
    // 2. PHARMACIST VALIDATION TESTS
    // ----------------------------------------------------
    console.log('\n=== 2. TESTING PHARMACIST VALIDATION ===');
    const pharmUser = await User.create({
      name: 'Pharm. Val Test',
      email: `val.pharm.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'pharmacist',
    });

    const validPharmBody = {
      mobileNumber: '+91 9123456780',
      dateOfBirth: '1990-08-20',
      gender: 'Female',
      address: {
        addressLine1: '45 Pharmacy Ave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      pharmacyRegistrationNumber: 'PCI-987654',
      qualification: 'Pharm.D',
      yearsOfExperience: 5,
      pharmacyHospitalName: 'City Central Pharmacy',
      pharmacyHospitalAddress: 'Healthcare Hub',
    };

    const res2 = mockRes();
    await createOrUpdateMyProfile({ user: pharmUser, body: validPharmBody }, res2, (err) => { if (err) throw err; });
    console.log('2.1 Valid Pharmacist Profile:', res2.statusCode, res2.data.message);
    if (res2.statusCode !== 200) throw new Error('Expected 200 for valid pharmacist profile');

    // Missing Pharmacy Registration Number
    const res2b = mockRes();
    await createOrUpdateMyProfile({ user: pharmUser, body: { ...validPharmBody, pharmacyRegistrationNumber: '' } }, res2b, (err) => { if (err) throw err; });
    console.log('2.2 Missing Pharmacy Reg:', res2b.statusCode, res2b.data.message);
    if (res2b.statusCode !== 400 || res2b.data.message !== 'Please complete: Pharmacy Registration Number.') throw new Error('Failed specific pharmacy reg message');

    // ----------------------------------------------------
    // 3. PATIENT VALIDATION TESTS
    // ----------------------------------------------------
    console.log('\n=== 3. TESTING PATIENT VALIDATION ===');
    const patientUser = await User.create({
      name: 'Patient Val Test',
      email: `val.patient.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });

    const validPatientBody = {
      mobileNumber: '+91 9988776655',
      dateOfBirth: '1995-12-10',
      gender: 'Male',
      address: {
        addressLine1: '78 Garden Street',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pinCode: '500001',
      },
      emergencyContact: {
        name: 'Mary Patient',
        relationship: 'Sibling',
        mobileNumber: '+91 9988776654',
      },
      bloodGroup: 'B+',
      medicalConditions: [],
      currentMedications: [],
      previousSurgeries: [],
    };

    const res3 = mockRes();
    await createOrUpdateMyProfile({ user: patientUser, body: validPatientBody }, res3, (err) => { if (err) throw err; });
    console.log('3.1 Valid Patient Profile (empty dynamic arrays ok):', res3.statusCode, res3.data.message);
    if (res3.statusCode !== 200) throw new Error('Expected 200 for valid patient profile');

    // Missing Emergency Contact Mobile Number
    const res3b = mockRes();
    await createOrUpdateMyProfile({ user: patientUser, body: { ...validPatientBody, emergencyContact: { name: 'Mary', relationship: 'Parent', mobileNumber: '' } } }, res3b, (err) => { if (err) throw err; });
    console.log('3.2 Missing Emergency Mobile:', res3b.statusCode, res3b.data.message);
    if (res3b.statusCode !== 400 || res3b.data.message !== 'Please complete: Emergency Contact Mobile Number.') throw new Error('Failed specific emergency mobile message');

    // Cleanup
    await User.deleteMany({ _id: { $in: [docUser._id, pharmUser._id, patientUser._id] } });
    await DoctorProfile.deleteMany({ userId: docUser._id });
    await PharmacistProfile.deleteMany({ userId: pharmUser._id });
    await PatientProfile.deleteMany({ userId: patientUser._id });

    console.log('\n======================================================');
    console.log('>>> ALL SPECIFIC VALIDATION TESTS PASSED CLEANLY! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Validation test error:', error);
    process.exit(1);
  }
};

runValidationTests();
