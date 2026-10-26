const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dotenv.config();

// Use google public DNS for SRV resolution if local windows DNS fails SRV lookup
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PharmacistProfile = require('../src/models/PharmacistProfile');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- ALL PHARMACIST USERS ---');
    const pharmacists = await User.find({ role: 'pharmacist' }).lean();
    console.log(pharmacists.map(u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role })));
    
    console.log('--- ALL PHARMACIST PROFILES ---');
    const profiles = await PharmacistProfile.find().populate('userId', 'name email').lean();
    console.log(profiles.map(p => ({
      profileId: String(p._id),
      userId: p.userId ? String(p.userId._id) : null,
      userName: p.userId ? p.userId.name : null,
      userEmail: p.userId ? p.userId.email : null,
      pharmacyRegistrationNumber: p.pharmacyRegistrationNumber,
      pharmacyHospitalName: p.pharmacyHospitalName
    })));
    
    console.log('--- ALL USERS SEARCH KAVI OR ABINAYA ---');
    const matched = await User.find({ name: { $regex: 'kavi|abinaya', $options: 'i' } }).lean();
    console.log(matched.map(u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role })));
  } catch (err) {
    console.error('Error inspect:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
