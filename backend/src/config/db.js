// const mongoose = require('mongoose');

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGODB_URI);
//     console.log(`[MedWise DB] MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`[MedWise DB] Database connection error: ${error.message}`);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;


const dns = require('node:dns');

// Use reliable public DNS servers for MongoDB Atlas SRV resolution
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[MedWise DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MedWise DB] Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;