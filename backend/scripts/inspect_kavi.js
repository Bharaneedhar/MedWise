const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const PharmacistProfile = require('../src/models/PharmacistProfile');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- USER KAVI ---');
    const kaviUser = await User.findOne({ email: 'kavi@gmail.com' }).lean();
    console.log(kaviUser);
    
    if (kaviUser) {
      console.log('--- PHARMACIST PROFILE KAVI ---');
      const kaviProfile = await PharmacistProfile.findOne({ userId: kaviUser._id }).lean();
      console.log(kaviProfile);
    }
  } catch (err) {
    console.error('Error inspect:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
