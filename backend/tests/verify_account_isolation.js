const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verifyAccountIsolation() {
  console.log('=== VERIFYING ACCOUNT ISOLATION & PHARMACIST IDENTITY ===\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);

    const User = require('../src/models/User');
    const PharmacistProfile = require('../src/models/PharmacistProfile');
    const PatientProfile = require('../src/models/PatientProfile');

    // Fetch actual Kavi user from DB
    const kaviUserDoc = await User.findOne({ email: 'kavi@gmail.com' });
    if (!kaviUserDoc) throw new Error('Kavi user not found in DB');

    // Fetch actual Abinaya user from DB
    const abinayaUserDoc = await User.findOne({ email: 'abinaya.ec23@bitsathy.ac.in' });
    if (!abinayaUserDoc) throw new Error('Abinaya user not found in DB');

    console.log(`Kavi User ID: ${kaviUserDoc._id}, Name: ${kaviUserDoc.name}, Role: ${kaviUserDoc.role}`);
    console.log(`Abinaya User ID: ${abinayaUserDoc._id}, Name: ${abinayaUserDoc.name}, Role: ${abinayaUserDoc.role}\n`);

    // Verify DB records directly
    if (kaviUserDoc.name !== 'Kavi') {
      throw new Error(`DB Error: Kavi name is "${kaviUserDoc.name}", expected "Kavi"`);
    }
    if (abinayaUserDoc.name !== 'ABINAYA S') {
      throw new Error(`DB Error: Abinaya name is "${abinayaUserDoc.name}", expected "ABINAYA S"`);
    }

    // Generate JWT tokens using the exact secret
    const kaviToken = jwt.sign({ userId: kaviUserDoc._id, role: kaviUserDoc.role }, JWT_SECRET, { expiresIn: '1h' });
    const abinayaToken = jwt.sign({ userId: abinayaUserDoc._id, role: abinayaUserDoc.role }, JWT_SECRET, { expiresIn: '1h' });

    // 1. TEST /api/auth/me FOR KAVI
    console.log('1. Testing GET /api/auth/me with Kavi JWT...');
    const kaviMeRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${kaviToken}` }
    });
    const kaviMeData = await kaviMeRes.json();
    console.log('-> Auth Me User:', kaviMeData.user);
    if (kaviMeData.user.name !== 'Kavi' || kaviMeData.user.email !== 'kavi@gmail.com') {
      throw new Error(`Kavi /auth/me identity failure! Expected Kavi, got: ${JSON.stringify(kaviMeData.user)}`);
    }

    // 2. TEST /api/profile/me FOR KAVI
    console.log('2. Testing GET /api/profile/me with Kavi JWT...');
    const kaviProfileRes = await fetch(`${API_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${kaviToken}` }
    });
    const kaviProfileData = await kaviProfileRes.json();
    console.log('-> Profile Me User:', kaviProfileData.user);
    console.log('-> Pharmacist Profile:', kaviProfileData.profile ? 'Present' : 'Not found');
    if (kaviProfileData.user.name !== 'Kavi') {
      throw new Error(`Kavi /profile/me identity failure! Expected Kavi, got: ${JSON.stringify(kaviProfileData.user)}`);
    }

    // 3. TEST /api/auth/me FOR ABINAYA
    console.log('\n3. Testing GET /api/auth/me with Abinaya JWT...');
    const abinayaMeRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${abinayaToken}` }
    });
    const abinayaMeData = await abinayaMeRes.json();
    console.log('-> Auth Me User:', abinayaMeData.user);
    if (abinayaMeData.user.name !== 'ABINAYA S' || abinayaMeData.user.email !== 'abinaya.ec23@bitsathy.ac.in') {
      throw new Error(`Abinaya /auth/me identity failure! Expected ABINAYA S, got: ${JSON.stringify(abinayaMeData.user)}`);
    }

    // 4. TEST /api/profile/me FOR ABINAYA
    console.log('4. Testing GET /api/profile/me with Abinaya JWT...');
    const abinayaProfileRes = await fetch(`${API_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${abinayaToken}` }
    });
    const abinayaProfileData = await abinayaProfileRes.json();
    console.log('-> Profile Me User:', abinayaProfileData.user);
    if (abinayaProfileData.user.name !== 'ABINAYA S') {
      throw new Error(`Abinaya /profile/me identity failure! Expected ABINAYA S, got: ${JSON.stringify(abinayaProfileData.user)}`);
    }

    console.log('\n========================================================');
    console.log('ALL ACCOUNT ISOLATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================');
  } catch (err) {
    console.error('\nVERIFICATION FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyAccountIsolation();
