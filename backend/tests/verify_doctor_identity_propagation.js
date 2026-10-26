const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');

const { resolveDoctorIdentity, formatDoctorDisplayName } = require('../src/utils/doctorIdentityResolver');

const runIdentityPropagationTest = async () => {
  let createdUsers = [];
  let createdDoctorProfiles = [];
  let createdPatientProfiles = [];
  let createdConsultations = [];
  let createdPrescriptions = [];

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');

    const timestamp = Date.now();

    // 1. Create Doctor A (initial profile)
    const docAUser = await User.create({
      name: 'Nithish', // Store plain name
      email: `docA_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUsers.push(docAUser._id);

    const docAProfile = await DoctorProfile.create({
      userId: docAUser._id,
      mobileNumber: '+91 9876543210',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'Male',
      address: {
        addressLine1: '123 Medical Enclave',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pinCode: '560001',
      },
      yearsOfExperience: 10,
      specialization: 'General Medicine',
      qualification: 'MBBS',
      medicalRegistrationNumber: 'REG-101',
      hospitalClinicName: 'City Hospital',
      hospitalClinicAddress: '123 Main St',
      profileCompleted: true,
    });
    createdDoctorProfiles.push(docAProfile._id);

    // 2. Create Doctor B (control doctor to ensure isolation)
    const docBUser = await User.create({
      name: 'Karthik Raj',
      email: `docB_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUsers.push(docBUser._id);

    const docBProfile = await DoctorProfile.create({
      userId: docBUser._id,
      mobileNumber: '+91 9876543211',
      dateOfBirth: new Date('1988-08-20'),
      gender: 'Male',
      address: {
        addressLine1: '456 Park Ave',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      yearsOfExperience: 8,
      specialization: 'Pediatrics',
      qualification: 'MD',
      medicalRegistrationNumber: 'REG-202',
      hospitalClinicName: 'Children Clinic',
      hospitalClinicAddress: '456 Park Ave',
      profileCompleted: true,
    });
    createdDoctorProfiles.push(docBProfile._id);

    // 3. Create Patient
    const patientUser = await User.create({
      name: 'John Doe',
      email: `patient_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUsers.push(patientUser._id);

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: '+91 9988776655',
      dateOfBirth: new Date('1995-12-10'),
      gender: 'Male',
      address: {
        addressLine1: '78 Garden Street',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        pinCode: '500001',
      },
      emergencyContact: {
        name: 'Contact Person',
        relationship: 'Sibling',
        mobileNumber: '+91 9988776654',
      },
      profileCompleted: true,
    });
    createdPatientProfiles.push(patientProfile._id);

    // 4. Create Consultation for Doctor A
    const consultationA = await Consultation.create({
      consultationId: `CNS-${timestamp}-A`,
      patientId: patientUser._id,
      doctorId: docAUser._id,
      doctorName: 'Nithish', // Stale snapshot field in DB schema
      doctorSpecialization: 'General Medicine', // Stale snapshot field in DB schema
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'High Fever',
      symptoms: ['Fever'],
      diagnosis: 'Viral Fever',
    });
    createdConsultations.push(consultationA._id);

    // 5. Create Prescription for Doctor A linked to Consultation A
    const rxIdA = `RX-${timestamp}-A`;
    const prescriptionA = await Prescription.create({
      prescriptionId: rxIdA,
      consultationId: consultationA._id,
      patientId: patientUser._id,
      patientPid: `PID-${timestamp}`,
      patientName: 'John Doe',
      doctorId: docAUser._id,
      doctorName: 'Nithish', // Stale snapshot field in DB schema
      doctorSpecialization: 'General Medicine', // Stale snapshot field in DB schema
      medicines: [
        { medicineName: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' }
      ],
      status: 'Draft',
      doctorNotes: 'Take after meals',
    });
    createdPrescriptions.push(prescriptionA._id);

    // 6. Verify initial resolved values for Doctor A's consultation & prescription
    console.log('\n--- Verifying Initial Identity Resolution ---');
    
    // Fetch raw documents and resolve identity
    const rawConsultation = await Consultation.findById(consultationA._id).lean();
    const resolvedConsultationInitial = await resolveDoctorIdentity(rawConsultation);

    console.log('Initial Consultation Doctor Name:', resolvedConsultationInitial.doctorName);
    console.log('Initial Consultation Specialization:', resolvedConsultationInitial.doctorSpecialization);

    if (resolvedConsultationInitial.doctorName !== 'Dr. Nithish') {
      throw new Error(`Expected 'Dr. Nithish', got '${resolvedConsultationInitial.doctorName}'`);
    }
    if (resolvedConsultationInitial.doctorSpecialization !== 'General Medicine') {
      throw new Error(`Expected 'General Medicine', got '${resolvedConsultationInitial.doctorSpecialization}'`);
    }

    const rawPrescription = await Prescription.findById(prescriptionA._id).lean();
    const resolvedRxInitial = await resolveDoctorIdentity(rawPrescription);

    console.log('Initial Prescription Doctor Name:', resolvedRxInitial.doctorName);
    console.log('Initial Prescription Specialization:', resolvedRxInitial.doctorSpecialization);

    if (resolvedRxInitial.doctorName !== 'Dr. Nithish') {
      throw new Error(`Expected 'Dr. Nithish', got '${resolvedRxInitial.doctorName}'`);
    }
    if (resolvedRxInitial.doctorSpecialization !== 'General Medicine') {
      throw new Error(`Expected 'General Medicine', got '${resolvedRxInitial.doctorSpecialization}'`);
    }

    // 7. Update Doctor A's User name and DoctorProfile specialization
    console.log('\n--- Updating Doctor A Profile (Name -> Dr. Nithish, Specialization -> Dermatology) ---');
    await User.findByIdAndUpdate(docAUser._id, { name: 'Dr. Nithish' });
    await DoctorProfile.findOneAndUpdate({ userId: docAUser._id }, { specialization: 'Dermatology' });

    // 8. Re-fetch and verify resolved identity for Doctor A's consultation & prescription
    console.log('\n--- Verifying Updated Identity Propagation ---');

    const freshConsultation = await Consultation.findById(consultationA._id).lean();
    const resolvedConsultationUpdated = await resolveDoctorIdentity(freshConsultation);

    console.log('Updated Consultation Doctor Name:', resolvedConsultationUpdated.doctorName);
    console.log('Updated Consultation Specialization:', resolvedConsultationUpdated.doctorSpecialization);

    if (resolvedConsultationUpdated.doctorName !== 'Dr. Nithish') {
      throw new Error(`Expected 'Dr. Nithish', got '${resolvedConsultationUpdated.doctorName}'`);
    }
    if (resolvedConsultationUpdated.doctorSpecialization !== 'Dermatology') {
      throw new Error(`Expected 'Dermatology', got '${resolvedConsultationUpdated.doctorSpecialization}'`);
    }

    const freshPrescription = await Prescription.findById(prescriptionA._id).lean();
    const resolvedRxUpdated = await resolveDoctorIdentity(freshPrescription);

    console.log('Updated Prescription Doctor Name:', resolvedRxUpdated.doctorName);
    console.log('Updated Prescription Specialization:', resolvedRxUpdated.doctorSpecialization);

    if (resolvedRxUpdated.doctorName !== 'Dr. Nithish') {
      throw new Error(`Expected 'Dr. Nithish', got '${resolvedRxUpdated.doctorName}'`);
    }
    if (resolvedRxUpdated.doctorSpecialization !== 'Dermatology') {
      throw new Error(`Expected 'Dermatology', got '${resolvedRxUpdated.doctorSpecialization}'`);
    }

    // 9. Verify formatDoctorDisplayName utility edge cases
    console.log('\n--- Verifying Display Name Prefix Utility Edge Cases ---');
    if (formatDoctorDisplayName('Nithish') !== 'Dr. Nithish') throw new Error('Failed prefix formatting for Nithish');
    if (formatDoctorDisplayName('Dr. Nithish') !== 'Dr. Nithish') throw new Error('Failed prefix formatting for Dr. Nithish');
    if (formatDoctorDisplayName('Dr Nithish') !== 'Dr. Nithish') throw new Error('Failed prefix formatting for Dr Nithish');
    if (formatDoctorDisplayName('DR. Nithish') !== 'Dr. Nithish') throw new Error('Failed prefix formatting for DR. Nithish');

    // 10. Verify data invariants (IDs, medicines, clinical data unchanged)
    console.log('\n--- Verifying Data Invariants ---');
    if (freshPrescription.prescriptionId !== rxIdA) throw new Error('RX ID changed!');
    if (freshPrescription.consultationId.toString() !== consultationA._id.toString()) throw new Error('Consultation ID link changed!');
    if (freshPrescription.doctorId.toString() !== docAUser._id.toString()) throw new Error('Doctor ID changed!');
    if (freshPrescription.patientId.toString() !== patientUser._id.toString()) throw new Error('Patient ID changed!');
    if (freshPrescription.medicines.length !== 1 || freshPrescription.medicines[0].medicineName !== 'Paracetamol') throw new Error('Medicines mutated!');
    if (freshPrescription.status !== 'Draft') throw new Error('Prescription status changed!');

    // 11. Verify Doctor B remains completely unaffected (isolation check)
    console.log('\n--- Verifying Doctor B Isolation ---');
    const consultationB = await Consultation.create({
      consultationId: `CNS-${timestamp}-B`,
      patientId: patientUser._id,
      doctorId: docBUser._id,
      doctorName: 'Karthik Raj',
      doctorSpecialization: 'Pediatrics',
      consultationDate: new Date(),
      status: 'Completed',
      reasonForVisit: 'Checkup',
    });
    createdConsultations.push(consultationB._id);

    const rawConsultationB = await Consultation.findById(consultationB._id).lean();
    const resolvedConsultationB = await resolveDoctorIdentity(rawConsultationB);

    console.log('Doctor B Consultation Doctor Name:', resolvedConsultationB.doctorName);
    console.log('Doctor B Consultation Specialization:', resolvedConsultationB.doctorSpecialization);

    if (resolvedConsultationB.doctorName !== 'Dr. Karthik Raj') {
      throw new Error(`Expected 'Dr. Karthik Raj', got '${resolvedConsultationB.doctorName}'`);
    }
    if (resolvedConsultationB.doctorSpecialization !== 'Pediatrics') {
      throw new Error(`Expected 'Pediatrics', got '${resolvedConsultationB.doctorSpecialization}'`);
    }

    console.log('\n>>> DOCTOR IDENTITY PROPAGATION TEST PASSED SUCCESSFULLY! <<<');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up created test records...');
    try {
      if (createdPrescriptions.length > 0) await Prescription.deleteMany({ _id: { $in: createdPrescriptions } });
      if (createdConsultations.length > 0) await Consultation.deleteMany({ _id: { $in: createdConsultations } });
      if (createdPatientProfiles.length > 0) await PatientProfile.deleteMany({ _id: { $in: createdPatientProfiles } });
      if (createdDoctorProfiles.length > 0) await DoctorProfile.deleteMany({ _id: { $in: createdDoctorProfiles } });
      if (createdUsers.length > 0) await User.deleteMany({ _id: { $in: createdUsers } });
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runIdentityPropagationTest();
