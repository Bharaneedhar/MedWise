const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const PharmacistProfile = require('../src/models/PharmacistProfile');
const Consultation = require('../src/models/Consultation');
const Prescription = require('../src/models/Prescription');
const Appointment = require('../src/models/Appointment');

const { createConsultation, updateConsultation } = require('../src/controllers/consultationController');
const { getPrescriptions } = require('../src/controllers/prescriptionController');
const { getPatientClinicalRecord } = require('../src/controllers/doctorController');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.data = data;
    return this;
  };
  return res;
};

const runFollowUpAndRxHistoryTest = async () => {
  let createdUsers = [];
  let createdDoctorProfiles = [];
  let createdPatientProfiles = [];
  let createdPharmacistProfiles = [];
  let createdConsultations = [];
  let createdPrescriptions = [];
  let createdAppointments = [];

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');

    const timestamp = Date.now();

    // 1. Create Doctor A & Doctor B
    const docA = await User.create({
      name: 'Dr. Doctor Alpha',
      email: `docA_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUsers.push(docA._id);

    const docAProf = await DoctorProfile.create({
      userId: docA._id,
      mobileNumber: '+91 9800011111',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'Male',
      address: { addressLine1: 'Clinic A', city: 'City A', state: 'State A', country: 'India', pinCode: '500001' },
      yearsOfExperience: 15,
      specialization: 'Cardiology',
      qualification: 'MD',
      medicalRegistrationNumber: `REG-A-${timestamp}`,
      hospitalClinicName: 'Alpha Heart Clinic',
      hospitalClinicAddress: '123 Alpha St, City A',
      profileCompleted: true,
    });
    createdDoctorProfiles.push(docAProf._id);

    const docB = await User.create({
      name: 'Dr. Doctor Beta',
      email: `docB_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUsers.push(docB._id);

    const docBProf = await DoctorProfile.create({
      userId: docB._id,
      mobileNumber: '+91 9800022222',
      dateOfBirth: new Date('1982-02-02'),
      gender: 'Female',
      address: { addressLine1: 'Clinic B', city: 'City B', state: 'State B', country: 'India', pinCode: '600001' },
      yearsOfExperience: 12,
      specialization: 'Dermatology',
      qualification: 'MD',
      medicalRegistrationNumber: `REG-B-${timestamp}`,
      hospitalClinicName: 'Beta Skin Care',
      hospitalClinicAddress: '456 Beta Ave, City B',
      profileCompleted: true,
    });
    createdDoctorProfiles.push(docBProf._id);

    // 2. Create Patient P
    const patientUser = await User.create({
      name: 'Isolated Patient P',
      email: `patientP_${timestamp}@medwise.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUsers.push(patientUser._id);

    const patientProf = await PatientProfile.create({
      userId: patientUser._id,
      mobileNumber: '+91 9777788888',
      dateOfBirth: new Date('1992-05-15'),
      gender: 'Female',
      bloodGroup: 'A+',
      address: { addressLine1: 'Home 123', city: 'Metro', state: 'State X', country: 'India', pinCode: '500002' },
      emergencyContact: { name: 'Emergency Contact', relationship: 'Spouse', mobileNumber: '+91 9777788889' },
      profileCompleted: true,
    });
    createdPatientProfiles.push(patientProf._id);
    const pid = 'PID-9777788888';

    // 3. Create initial Consultation by Doctor A for Patient P (Follow-up Required = YES)
    console.log('\n--- 1. Testing Follow-up Required = YES ---');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const reqConsA1 = {
      user: docA,
      body: {
        patientId: patientUser._id,
        patientPid: pid,
        reasonForVisit: 'Chest discomfort checkup',
        diagnosisNotes: 'Mild angina suspected',
        doctorRecommendations: 'ECG and follow up',
        followUpRequired: 'Yes',
        followUpDate: futureDateStr,
      },
    };
    const resConsA1 = mockRes();
    await createConsultation(reqConsA1, resConsA1, (err) => { if (err) throw err; });

    if (resConsA1.statusCode !== 201) throw new Error(`Create consultation failed with status ${resConsA1.statusCode}`);
    const consA1 = resConsA1.data.consultation;
    createdConsultations.push(consA1._id);

    console.log('Consultation A1 created. Status:', consA1.status, 'Follow-up Date:', consA1.followUpDate);
    if (consA1.status !== 'Follow-up Needed') throw new Error(`Expected status 'Follow-up Needed', got '${consA1.status}'`);
    if (!consA1.followUpDate) throw new Error('Expected followUpDate to be set');

    // Check that appointment was auto-synced
    const apptA1 = await Appointment.findOne({ consultationId: consA1._id });
    if (!apptA1 || apptA1.status !== 'SCHEDULED') throw new Error('Expected scheduled follow-up appointment');
    createdAppointments.push(apptA1._id);

    // 4. Update Consultation A1 (Simulate Doctor conducting follow-up and selecting Follow-up Required = NO)
    console.log('\n--- 2. Testing Follow-up Required = NO (Closing follow-up cycle) ---');
    const reqUpdateA1 = {
      user: docA,
      params: { id: consA1._id },
      body: {
        reasonForVisit: 'Follow-up checkup completed',
        followUpRequired: 'No',
      },
    };
    const resUpdateA1 = mockRes();
    await updateConsultation(reqUpdateA1, resUpdateA1, (err) => { if (err) throw err; });

    if (resUpdateA1.statusCode !== 200) throw new Error(`Update consultation failed with status ${resUpdateA1.statusCode}`);
    const consA1Updated = resUpdateA1.data.consultation;
    console.log('Consultation A1 updated. Status:', consA1Updated.status, 'Follow-up Date:', consA1Updated.followUpDate);

    if (consA1Updated.status !== 'Completed') throw new Error(`Expected status 'Completed', got '${consA1Updated.status}'`);
    if (consA1Updated.followUpDate) throw new Error('Expected followUpDate to be cleared/null');

    // Check that appointment status changed to CANCELLED
    const apptA1Updated = await Appointment.findById(apptA1._id);
    if (apptA1Updated.status !== 'CANCELLED') throw new Error(`Expected appointment status 'CANCELLED', got '${apptA1Updated.status}'`);

    // 5. Create Doctor A Prescription 1 for Patient P
    console.log('\n--- 3. Creating Prescription RX-A1 for Doctor A ---');
    const rxIdA1 = `RX-TEST-${timestamp}-A1`;
    const rxA1 = await Prescription.create({
      prescriptionId: rxIdA1,
      consultationId: consA1._id,
      patientId: patientUser._id,
      patientPid: pid,
      patientName: patientUser.name,
      doctorId: docA._id,
      doctorName: docA.name,
      doctorSpecialization: 'Cardiology',
      medicines: [{ medicineName: 'Aspirin', dosage: '75mg', frequency: 'Once daily', duration: '30 days' }],
      status: 'Approved',
    });
    createdPrescriptions.push(rxA1._id);

    // Link prescriptionId back to consultation A1
    await Consultation.findByIdAndUpdate(consA1._id, { prescriptionId: rxA1._id });

    // 6. Create Doctor A Prescription 2 for Patient P
    console.log('\n--- 4. Creating Prescription RX-A2 for Doctor A ---');
    const rxIdA2 = `RX-TEST-${timestamp}-A2`;
    const rxA2 = await Prescription.create({
      prescriptionId: rxIdA2,
      patientId: patientUser._id,
      patientPid: pid,
      patientName: patientUser.name,
      doctorId: docA._id,
      doctorName: docA.name,
      doctorSpecialization: 'Cardiology',
      medicines: [{ medicineName: 'Atorvastatin', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
      status: 'Approved',
    });
    createdPrescriptions.push(rxA2._id);

    // 7. Create Doctor B Prescription 1 for Patient P
    console.log('\n--- 5. Creating Prescription RX-B1 for Doctor B ---');
    const rxIdB1 = `RX-TEST-${timestamp}-B1`;
    const rxB1 = await Prescription.create({
      prescriptionId: rxIdB1,
      patientId: patientUser._id,
      patientPid: pid,
      patientName: patientUser.name,
      doctorId: docB._id,
      doctorName: docB.name,
      doctorSpecialization: 'Dermatology',
      medicines: [{ medicineName: 'Hydrocortisone Cream', dosage: '1%', frequency: 'Apply twice daily', duration: '7 days' }],
      status: 'Approved',
    });
    createdPrescriptions.push(rxB1._id);

    // 8. Test Doctor-Specific Prescription History: Query prescriptions as Doctor A for Patient P
    console.log('\n--- 6. Testing Doctor A Prescription History View for Patient P ---');
    const reqGetRxDocA = {
      user: docA,
      query: { patientId: patientUser._id.toString() },
    };
    const resGetRxDocA = mockRes();
    await getPrescriptions(reqGetRxDocA, resGetRxDocA, (err) => { if (err) throw err; });

    const docARxList = resGetRxDocA.data.prescriptions;
    console.log(`Doctor A fetched ${docARxList.length} prescription(s) for Patient P.`);
    const docARxIds = docARxList.map((r) => r.prescriptionId);
    console.log('Doctor A Prescription IDs:', docARxIds);

    if (docARxList.length !== 2) throw new Error(`Expected 2 prescriptions for Doctor A, got ${docARxList.length}`);
    if (!docARxIds.includes(rxIdA1) || !docARxIds.includes(rxIdA2)) throw new Error('Doctor A list missing Doctor A prescriptions');
    if (docARxIds.includes(rxIdB1)) throw new Error('CRITICAL LEAK: Doctor B prescription leaked into Doctor A view!');

    // 9. Test Doctor-Specific Prescription History: Query prescriptions as Doctor B for Patient P
    console.log('\n--- 7. Testing Doctor B Prescription History View for Patient P ---');
    const reqGetRxDocB = {
      user: docB,
      query: { patientId: patientUser._id.toString() },
    };
    const resGetRxDocB = mockRes();
    await getPrescriptions(reqGetRxDocB, resGetRxDocB, (err) => { if (err) throw err; });

    const docBRxList = resGetRxDocB.data.prescriptions;
    console.log(`Doctor B fetched ${docBRxList.length} prescription(s) for Patient P.`);
    const docBRxIds = docBRxList.map((r) => r.prescriptionId);
    console.log('Doctor B Prescription IDs:', docBRxIds);

    if (docBRxList.length !== 1) throw new Error(`Expected 1 prescription for Doctor B, got ${docBRxList.length}`);
    if (!docBRxIds.includes(rxIdB1)) throw new Error('Doctor B list missing Doctor B prescription');
    if (docBRxIds.includes(rxIdA1) || docBRxIds.includes(rxIdA2)) throw new Error('CRITICAL LEAK: Doctor A prescriptions leaked into Doctor B view!');

    // 10. Test Doctor Clinical Record API (getPatientClinicalRecord) for Doctor A
    console.log('\n--- 8. Testing getPatientClinicalRecord for Doctor A ---');
    const reqEhrDocA = {
      user: docA,
      params: { patientId: patientUser._id.toString() },
    };
    const resEhrDocA = mockRes();
    await getPatientClinicalRecord(reqEhrDocA, resEhrDocA, (err) => { if (err) throw err; });

    const ehrRxListDocA = resEhrDocA.data.record.prescriptions;
    const ehrRxIdsDocA = ehrRxListDocA.map((r) => r.prescriptionId);
    console.log('EHR Prescriptions for Doctor A:', ehrRxIdsDocA);

    if (ehrRxListDocA.length !== 2) throw new Error(`Expected 2 prescriptions in EHR for Doctor A, got ${ehrRxListDocA.length}`);
    if (ehrRxIdsDocA.includes(rxIdB1)) throw new Error('CRITICAL LEAK: Doctor B prescription in Doctor A EHR view!');

    // 11. Test Patient viewing their own prescriptions (Patient P sees ALL 3 prescriptions)
    console.log('\n--- 9. Testing Patient P View of Own Prescriptions ---');
    const reqGetRxPatient = {
      user: patientUser,
      query: {},
    };
    const resGetRxPatient = mockRes();
    await getPrescriptions(reqGetRxPatient, resGetRxPatient, (err) => { if (err) throw err; });

    const patientRxList = resGetRxPatient.data.prescriptions;
    console.log(`Patient P fetched ${patientRxList.length} total prescription(s).`);
    if (patientRxList.length !== 3) throw new Error(`Patient P expected to see all 3 prescriptions, got ${patientRxList.length}`);

    console.log('\n>>> ALL FOLLOW-UP AND DOCTOR-SPECIFIC RX HISTORY TESTS PASSED SUCCESSFULLY! <<<');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up created test records...');
    try {
      if (createdAppointments.length > 0) await Appointment.deleteMany({ _id: { $in: createdAppointments } });
      if (createdPrescriptions.length > 0) await Prescription.deleteMany({ _id: { $in: createdPrescriptions } });
      if (createdConsultations.length > 0) await Consultation.deleteMany({ _id: { $in: createdConsultations } });
      if (createdPatientProfiles.length > 0) await PatientProfile.deleteMany({ _id: { $in: createdPatientProfiles } });
      if (createdDoctorProfiles.length > 0) await DoctorProfile.deleteMany({ _id: { $in: createdDoctorProfiles } });
      if (createdPharmacistProfiles.length > 0) await PharmacistProfile.deleteMany({ _id: { $in: createdPharmacistProfiles } });
      if (createdUsers.length > 0) await User.deleteMany({ _id: { $in: createdUsers } });
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runFollowUpAndRxHistoryTest();
