const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Prescription = require('../src/models/Prescription');
const Consultation = require('../src/models/Consultation');

const run = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas.');

    // 1. Find target prescription
    const targetRx = await Prescription.findOne({
      $or: [
        { prescriptionId: 'RX-540281' },
        { patientName: 'Patient Handoff Subject' },
        { patientPid: 'PID-9529391543' }
      ]
    });

    if (!targetRx) {
      console.log('No prescription found matching RX-540281 / Patient Handoff Subject.');
    } else {
      console.log('Target Prescription Found:');
      console.log(JSON.stringify(targetRx, null, 2));

      // Find linked user IDs
      const doctorId = targetRx.doctorId;
      const patientId = targetRx.patientId;
      const consultationId = targetRx.consultationId;

      console.log('\nLinked IDs:');
      console.log('Doctor User ID:', doctorId);
      console.log('Patient User ID:', patientId);
      console.log('Consultation ID:', consultationId);

      // Check linked Consultation
      let linkedConsultation = null;
      if (consultationId) {
        linkedConsultation = await Consultation.findById(consultationId);
        console.log('Linked Consultation:', linkedConsultation);
      }

      // Check linked Doctor
      let doctorUser = await User.findById(doctorId);
      let doctorProfile = await DoctorProfile.findOne({ userId: doctorId });
      console.log('Doctor User:', doctorUser ? { id: doctorUser._id, name: doctorUser.name, email: doctorUser.email } : null);

      // Check linked Patient
      let patientUser = await User.findById(patientId);
      let patientProfile = await PatientProfile.findOne({ userId: patientId });
      console.log('Patient User:', patientUser ? { id: patientUser._id, name: patientUser.name, email: patientUser.email } : null);

      // PERFORM DELETION
      console.log('\n--- EXECUTING DELETION ---');
      await Prescription.deleteOne({ _id: targetRx._id });
      console.log(`SUCCESSFULLY DELETED Prescription document: _id=${targetRx._id}, prescriptionId=${targetRx.prescriptionId}`);

      if (linkedConsultation) {
        await Consultation.deleteOne({ _id: linkedConsultation._id });
        console.log(`SUCCESSFULLY DELETED linked Consultation document: _id=${linkedConsultation._id}`);
      }

      if (doctorUser && (doctorUser.email.includes('doctor.a.') || doctorUser.name === 'Dr. Primary Attending')) {
        await DoctorProfile.deleteOne({ userId: doctorUser._id });
        await User.deleteOne({ _id: doctorUser._id });
        console.log(`SUCCESSFULLY DELETED dummy Doctor User & Profile (${doctorUser.email})`);
      }

      if (patientUser && (patientUser.email.includes('patient.handoff.') || patientUser.name === 'Patient Handoff Subject')) {
        await PatientProfile.deleteOne({ userId: patientUser._id });
        await User.deleteOne({ _id: patientUser._id });
        console.log(`SUCCESSFULLY DELETED dummy Patient User & Profile (${patientUser.email})`);
      }
    }

    // 2. Also clean up any lingering dummy users created by verify_medwise_approval_handoff test script
    const dummyDoctors = await User.find({ email: { $regex: /^doctor\.[ab]\.\d+@medwise\.com$/i } });
    for (const doc of dummyDoctors) {
      await DoctorProfile.deleteMany({ userId: doc._id });
      await Prescription.deleteMany({ doctorId: doc._id });
      await User.deleteOne({ _id: doc._id });
      console.log(`Cleaned up test doctor: ${doc.email}`);
    }

    const dummyPatients = await User.find({ email: { $regex: /^patient\.handoff\.\d+@medwise\.com$/i } });
    for (const pat of dummyPatients) {
      await PatientProfile.deleteMany({ userId: pat._id });
      await Prescription.deleteMany({ patientId: pat._id });
      await User.deleteOne({ _id: pat._id });
      console.log(`Cleaned up test patient: ${pat.email}`);
    }

    // 3. Print all remaining prescriptions in MongoDB
    console.log('\n--- CURRENT PRESCRIPTIONS REMAINING IN MONGO DB ---');
    const remainingPrescriptions = await Prescription.find({});
    console.log(`Total remaining prescriptions count: ${remainingPrescriptions.length}`);
    remainingPrescriptions.forEach((rx) => {
      console.log(`- RX ID: ${rx.prescriptionId || rx._id}, Patient: ${rx.patientName} (${rx.patientPid}), Doctor: ${rx.doctorName}, Status: ${rx.status}`);
    });

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
  }
};

run();
