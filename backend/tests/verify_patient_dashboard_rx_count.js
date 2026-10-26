const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verifyPatientDashboardRxCount() {
  console.log('=== VERIFYING PATIENT DASHBOARD PRESCRIPTION COUNT ===\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);

    const User = require('../src/models/User');
    const Prescription = require('../src/models/Prescription');

    // Fetch actual Abinaya user from DB
    const abinayaUser = await User.findOne({ email: 'abinaya.ec23@bitsathy.ac.in' });
    if (!abinayaUser) throw new Error('Abinaya user record not found in DB');

    // Count real DB prescriptions for Abinaya
    const dbCount = await Prescription.countDocuments({ patientId: abinayaUser._id });
    console.log(`MongoDB Prescription count for Abinaya (${abinayaUser.email}): ${dbCount}`);

    // Verify RX-577101 is present for Abinaya
    const rx577101 = await Prescription.findOne({ prescriptionId: 'RX-577101', patientId: abinayaUser._id });
    if (!rx577101) {
      throw new Error('Prescription RX-577101 not found for Abinaya in MongoDB!');
    }
    console.log('-> Found prescription RX-577101 for Abinaya in MongoDB.');

    // Generate token for Abinaya
    const abinayaToken = jwt.sign({ userId: abinayaUser._id, role: abinayaUser.role }, JWT_SECRET, { expiresIn: '1h' });

    // Fetch GET /api/prescriptions for Abinaya
    const res = await fetch(`${API_URL}/prescriptions`, {
      headers: { Authorization: `Bearer ${abinayaToken}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(`API error: ${JSON.stringify(data)}`);

    console.log(`API returned count for Abinaya: ${data.count}`);
    if (data.count !== dbCount) {
      throw new Error(`API count mismatch! API returned ${data.count}, expected ${dbCount}`);
    }

    const rxList = data.prescriptions || [];
    const hasRx577101 = rxList.some(r => r.prescriptionId === 'RX-577101');
    if (!hasRx577101) {
      throw new Error('RX-577101 is missing from API prescription list for Abinaya!');
    }
    console.log('-> RX-577101 successfully returned in API prescription list.');

    console.log('\n========================================================');
    console.log('PATIENT DASHBOARD PRESCRIPTION COUNT VERIFICATION PASSED!');
    console.log('========================================================');
  } catch (err) {
    console.error('\nVERIFICATION FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyPatientDashboardRxCount();
