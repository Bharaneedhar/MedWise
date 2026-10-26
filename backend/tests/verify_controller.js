const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const PatientProfile = require('../src/models/PatientProfile');
const { getMyProfile, createOrUpdateMyProfile } = require('../src/controllers/profileController');

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

const runControllerTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const timestamp = Date.now();

    // 1. Create a test doctor user
    const docUser = await User.create({
      name: 'Dr. Controller Test',
      email: `controller.doc.${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });

    // Test getMyProfile when incomplete
    const req1 = { user: docUser };
    const res1 = mockRes();
    await getMyProfile(req1, res1, (err) => { if (err) throw err; });
    console.log('GET /api/profile/me (incomplete):', res1.statusCode, res1.data.profileCompleted);
    if (res1.data.profileCompleted !== false) throw new Error('Expected profileCompleted = false');

    // Test PUT /api/profile/me validation error: missing mobile number
    const req2 = {
      user: docUser,
      body: {
        dateOfBirth: '1988-01-01',
        gender: 'Male',
      }
    };
    const res2 = mockRes();
    await createOrUpdateMyProfile(req2, res2, (err) => { if (err) throw err; });
    console.log('PUT validation check (missing mobile):', res2.statusCode, res2.data.message);
    if (res2.statusCode !== 400) throw new Error('Expected status 400 for missing mobile');

    // Test PUT /api/profile/me validation error: future DOB
    const req3 = {
      user: docUser,
      body: {
        mobileNumber: '+91 9988776655',
        dateOfBirth: '2099-01-01',
        gender: 'Male',
      }
    };
    const res3 = mockRes();
    await createOrUpdateMyProfile(req3, res3, (err) => { if (err) throw err; });
    console.log('PUT validation check (future DOB):', res3.statusCode, res3.data.message);
    if (res3.statusCode !== 400) throw new Error('Expected status 400 for future DOB');

    // Test PUT /api/profile/me valid Doctor profile (NO emergency contact needed for Doctor)
    const req4 = {
      user: docUser,
      body: {
        name: 'Dr. Controller Test Updated',
        mobileNumber: '+91 9876543210',
        dateOfBirth: '1985-05-15',
        gender: 'Male',
        address: {
          addressLine1: 'Suite 400, Clinic Tower',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          pinCode: '400001',
        },
        medicalRegistrationNumber: 'MCI-998877',
        specialization: 'Neurology',
        qualification: 'DM',
        yearsOfExperience: 10,
        hospitalClinicName: 'City Neuro Center',
        hospitalClinicAddress: 'Park Avenue, Bandra',
      }
    };
    const res4 = mockRes();
    await createOrUpdateMyProfile(req4, res4, (err) => { if (err) throw err; });
    console.log('PUT valid doctor profile result:', res4.statusCode, res4.data.profileCompleted);
    if (res4.statusCode !== 200 || !res4.data.profileCompleted) throw new Error('Expected successful profile update');

    // Verify User name was updated
    const updatedUser = await User.findById(docUser._id);
    console.log('Updated user name in DB:', updatedUser.name);
    if (updatedUser.name !== 'Dr. Controller Test Updated') throw new Error('User name should be updated');

    // Verify DoctorProfile does NOT contain emergencyContact
    const savedDoc = await DoctorProfile.findOne({ userId: docUser._id });
    if (savedDoc.emergencyContact) throw new Error('Doctor profile should not have emergency contact');
    console.log('Verified: Doctor profile saved without emergency contact.');

    // Cleanup
    await User.findByIdAndDelete(docUser._id);
    await DoctorProfile.findOneAndDelete({ userId: docUser._id });

    console.log('\n>>> Profile Controller Tests PASSED! <<<');
    process.exit(0);
  } catch (error) {
    console.error('Controller test error:', error);
    process.exit(1);
  }
};

runControllerTest();
