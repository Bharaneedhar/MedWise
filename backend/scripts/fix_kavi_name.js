const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');

async function fixKavi() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const updated = await User.findOneAndUpdate(
      { email: 'kavi@gmail.com' },
      { name: 'Kavi' },
      { new: true }
    );
    console.log('Successfully updated kavi@gmail.com name:', updated.name);
  } catch (err) {
    console.error('Error fixing Kavi name:', err);
  } finally {
    await mongoose.disconnect();
  }
}

fixKavi();
