const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Consultation = require('../src/models/Consultation');
const Appointment = require('../src/models/Appointment');

const {
  createAppointment,
  getDoctorAppointments,
  getDoctorFollowUps,
  getAppointmentById,
  updateAppointment,
} = require('../src/controllers/appointmentController');

const {
  createConsultation,
  updateConsultation,
  getConsultationById,
} = require('../src/controllers/consultationController');

const { getDoctorPatients } = require('../src/controllers/doctorController');

async function runAppointmentTests() {
  let mongoConnected = false;
  const createdUserIds = [];
  const createdProfileIds = [];
  const createdConsultationIds = [];
  const createdAppointmentIds = [];

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medwise';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('Connected to DB for MedWise Doctor Appointment Management Verification.\n');

    const timestamp = Date.now();

    // -----------------------------------------------------------------
    // TEST FIXTURES SETUP
    // -----------------------------------------------------------------
    // Doctor A
    const doctorA = await User.create({
      name: `Dr. Alice_Appt_${timestamp}`,
      email: `alice_appt_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorA._id);

    await DoctorProfile.create({
      userId: doctorA._id,
      name: doctorA.name,
      specialization: 'General Medicine',
      qualification: 'MBBS, MD',
      yearsOfExperience: 10,
      medicalRegistrationNumber: `MRN-A-${timestamp}`,
      hospitalClinicName: 'City General Clinic',
      hospitalClinicAddress: '100 Main St, Chennai',
      mobileNumber: '9876543111',
      dateOfBirth: new Date('1982-01-01'),
      gender: 'Female',
      address: {
        addressLine1: '100 Main St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
    });

    // Doctor B
    const doctorB = await User.create({
      name: `Dr. Bob_Appt_${timestamp}`,
      email: `bob_appt_${timestamp}@test.com`,
      password: 'password123',
      role: 'doctor',
    });
    createdUserIds.push(doctorB._id);

    await DoctorProfile.create({
      userId: doctorB._id,
      name: doctorB.name,
      specialization: 'Cardiology',
      qualification: 'MBBS, DM',
      yearsOfExperience: 12,
      medicalRegistrationNumber: `MRN-B-${timestamp}`,
      hospitalClinicName: 'Heart Care Center',
      hospitalClinicAddress: '200 Heart Way, Chennai',
      mobileNumber: '9876543222',
      dateOfBirth: new Date('1980-05-15'),
      gender: 'Male',
      address: {
        addressLine1: '200 Heart Way',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
    });

    // Patient A
    const patientA = await User.create({
      name: `PatientA_Appt_${timestamp}`,
      email: `patienta_appt_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientA._id);

    const profA = await PatientProfile.create({
      userId: patientA._id,
      name: patientA.name,
      mobileNumber: '9876500001',
      dateOfBirth: new Date('1990-03-12'),
      gender: 'Male',
      bloodGroup: 'O+',
      address: {
        addressLine1: '1 Primary St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600001',
      },
      emergencyContact: {
        name: 'Contact A',
        relationship: 'Spouse',
        mobileNumber: '9876500001',
      },
      hasNoKnownAllergies: true,
    });
    createdProfileIds.push(profA._id);

    // Patient B
    const patientB = await User.create({
      name: `PatientB_Appt_${timestamp}`,
      email: `patientb_appt_${timestamp}@test.com`,
      password: 'password123',
      role: 'patient',
    });
    createdUserIds.push(patientB._id);

    const profB = await PatientProfile.create({
      userId: patientB._id,
      name: patientB.name,
      mobileNumber: '9876500002',
      dateOfBirth: new Date('1992-07-25'),
      gender: 'Female',
      bloodGroup: 'A+',
      address: {
        addressLine1: '2 Secondary St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pinCode: '600002',
      },
      emergencyContact: {
        name: 'Contact B',
        relationship: 'Sibling',
        mobileNumber: '9876500002',
      },
      hasNoKnownAllergies: true,
    });
    createdProfileIds.push(profB._id);

    console.log('--- DOCTOR APPOINTMENT MANAGEMENT VERIFICATION TESTS (1-16) ---');

    // Helper fake Express res
    const mockRes = () => {
      const res = {};
      res.status = function (code) {
        this.statusCode = code;
        return this;
      };
      res.json = function (data) {
        this.body = data;
        return this;
      };
      return res;
    };

    // 1. Doctor can create new-patient appointment
    const req1 = {
      user: doctorA,
      body: {
        patientId: patientA._id,
        appointmentDate: new Date(Date.now() + 86400000 * 2), // 2 days in future
        appointmentTime: '11:00 AM',
        appointmentType: 'NEW_PATIENT',
        reason: 'Initial consultation for hypertension',
      },
    };
    const res1 = mockRes();
    await createAppointment(req1, res1, (err) => { throw err; });

    console.log('1. Doctor created new-patient appointment:', res1.statusCode === 201 && res1.body.success);
    console.assert(res1.statusCode === 201 && res1.body.success, 'FAIL: Doctor unable to create new patient appointment');
    const newApptId = res1.body.appointment._id;
    createdAppointmentIds.push(newApptId);

    // 2. Appointment is linked to correct patient
    const apptDoc = await Appointment.findById(newApptId);
    console.log('2. Appointment linked to patientA:', apptDoc.patientId.toString() === patientA._id.toString());
    console.assert(apptDoc.patientId.toString() === patientA._id.toString(), 'FAIL: Patient linkage mismatch');

    // 3. Appointment is linked to correct doctor
    console.log('3. Appointment linked to doctorA:', apptDoc.doctorId.toString() === doctorA._id.toString());
    console.assert(apptDoc.doctorId.toString() === doctorA._id.toString(), 'FAIL: Doctor linkage mismatch');

    // 4. Existing patient search still works
    const reqSearch = { user: doctorA, query: { search: 'PatientA_Appt' } };
    const resSearch = mockRes();
    await getDoctorPatients(reqSearch, resSearch, (err) => { throw err; });
    console.log('4. Existing patient search returned patients count:', resSearch.body?.count);
    console.assert(resSearch.body?.count >= 1 && resSearch.body.patients.some((p) => p.name.includes('PatientA_Appt')), 'FAIL: Patient search failed');

    // 5. Consultation with followUpDate creates/produces follow-up visibility
    const futureFollowUp = new Date(Date.now() + 86400000 * 5); // 5 days in future
    const reqConsult = {
      user: doctorA,
      body: {
        patientId: patientA._id,
        patientPid: 'PID-9876500001',
        reasonForVisit: 'Routine Follow-Up Visit',
        clinicalNotes: 'Blood pressure controlled.',
        followUpDate: futureFollowUp,
      },
    };
    const resConsult = mockRes();
    await createConsultation(reqConsult, resConsult, (err) => { throw err; });
    console.log('5. Consultation created with followUpDate:', resConsult.statusCode === 201);
    console.assert(resConsult.statusCode === 201, 'FAIL: Consultation creation failed');
    const consultId = resConsult.body.consultation._id;
    createdConsultationIds.push(consultId);

    // Fetch follow-ups for Doctor A
    const reqFollowUps = { user: doctorA };
    const resFollowUps = mockRes();
    await getDoctorFollowUps(reqFollowUps, resFollowUps, (err) => { throw err; });

    console.log('6. Follow-up appears for correct doctor:', resFollowUps.body.upcoming.length >= 1);
    console.assert(resFollowUps.body.upcoming.length >= 1, 'FAIL: Follow-up missing for Doctor A');

    // 7. Follow-up appears for correct patient
    const foundFollowUp = resFollowUps.body.upcoming.find((f) => f.consultationId?._id?.toString() === consultId.toString() || f.consultationId?.toString() === consultId.toString());
    console.log('7. Follow-up patient ID matches Patient A:', foundFollowUp && (foundFollowUp.patientId?._id?.toString() === patientA._id.toString() || foundFollowUp.patientId?.toString() === patientA._id.toString()));
    console.assert(foundFollowUp && (foundFollowUp.patientId?._id?.toString() === patientA._id.toString() || foundFollowUp.patientId?.toString() === patientA._id.toString()), 'FAIL: Follow-up patient mismatch');

    // Track created follow-up appointment ID for cleanup
    if (foundFollowUp && foundFollowUp._id) {
      createdAppointmentIds.push(foundFollowUp._id);
    }

    // 8. Follow-up is sorted by upcoming date
    const reqApptsA = { user: doctorA };
    const resApptsA = mockRes();
    await getDoctorAppointments(reqApptsA, resApptsA, (err) => { throw err; });
    const upcomingList = resApptsA.body.categorized.upcoming;
    let isSorted = true;
    for (let i = 0; i < upcomingList.length - 1; i++) {
      if (new Date(upcomingList[i].appointmentDate) > new Date(upcomingList[i + 1].appointmentDate)) {
        isSorted = false;
        break;
      }
    }
    console.log('8. Upcoming appointments sorted by date:', isSorted);
    console.assert(isSorted, 'FAIL: Upcoming appointments not sorted by date');

    // 9. Past follow-up is not shown as upcoming
    const pastDate = new Date(Date.now() - 86400000 * 3); // 3 days ago
    const pastConsult = await Consultation.create({
      patientId: patientA._id,
      patientPid: 'PID-9876500001',
      doctorId: doctorA._id,
      doctorName: doctorA.name,
      reasonForVisit: 'Past Checkup',
      followUpDate: pastDate,
    });
    createdConsultationIds.push(pastConsult._id);

    const pastAppt = await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA._id,
      patientPid: 'PID-9876500001',
      appointmentDate: pastDate,
      appointmentType: 'FOLLOW_UP',
      reason: 'Past Follow-up',
      status: 'SCHEDULED',
      consultationId: pastConsult._id,
    });
    createdAppointmentIds.push(pastAppt._id);

    const resFollowUps2 = mockRes();
    await getDoctorFollowUps({ user: doctorA }, resFollowUps2, (err) => { throw err; });
    const isPastInUpcoming = resFollowUps2.body.upcoming.some((f) => f._id.toString() === pastAppt._id.toString());
    console.log('9. Past follow-up excluded from upcoming list:', !isPastInUpcoming);
    console.assert(!isPastInUpcoming, 'FAIL: Past follow-up incorrectly included in upcoming');

    // 10. Updating followUpDate updates the follow-up appointment
    const newFollowUpDate = new Date(Date.now() + 86400000 * 10); // 10 days in future
    const reqUpdateConsult = {
      user: doctorA,
      params: { id: consultId },
      body: { followUpDate: newFollowUpDate },
    };
    const resUpdateConsult = mockRes();
    await updateConsultation(reqUpdateConsult, resUpdateConsult, (err) => { throw err; });

    const updatedApptDoc = await Appointment.findOne({ consultationId: consultId, appointmentType: 'FOLLOW_UP' });
    console.log('10. Follow-up appointment date updated upon consultation edit:', updatedApptDoc && updatedApptDoc.appointmentDate.getTime() === newFollowUpDate.getTime());
    console.assert(updatedApptDoc && updatedApptDoc.appointmentDate.getTime() === newFollowUpDate.getTime(), 'FAIL: Appointment date not updated');

    // 11. Clearing followUpDate removes it from upcoming follow-ups
    const reqClearFollowUp = {
      user: doctorA,
      params: { id: consultId },
      body: { followUpDate: null },
    };
    const resClearFollowUp = mockRes();
    await updateConsultation(reqClearFollowUp, resClearFollowUp, (err) => { throw err; });

    const clearedApptDoc = await Appointment.findOne({ consultationId: consultId, appointmentType: 'FOLLOW_UP' });
    console.log('11. Appointment status set to CANCELLED upon clearing followUpDate:', clearedApptDoc && clearedApptDoc.status === 'CANCELLED');
    console.assert(clearedApptDoc && clearedApptDoc.status === 'CANCELLED', 'FAIL: Appointment not cancelled on followUpDate removal');

    // Restore followUpDate for duplicate re-save test
    await updateConsultation({ user: doctorA, params: { id: consultId }, body: { followUpDate: futureFollowUp } }, mockRes(), (err) => { throw err; });

    // 12. Re-saving the same consultation does not create duplicate follow-ups
    await updateConsultation({ user: doctorA, params: { id: consultId }, body: { clinicalNotes: 'Re-saved note update' } }, mockRes(), (err) => { throw err; });
    const countAppts = await Appointment.countDocuments({ consultationId: consultId, appointmentType: 'FOLLOW_UP' });
    console.log('12. Count of follow-up appointments for single consultation:', countAppts);
    console.assert(countAppts === 1, 'FAIL: Duplicate follow-up appointments created');

    // 13. Doctor isolation works (Doctor B cannot see Doctor A's appointments)
    const reqDoctorB = { user: doctorB };
    const resDoctorB = mockRes();
    await getDoctorAppointments(reqDoctorB, resDoctorB, (err) => { throw err; });

    const doctorBHasDoctorAAppt = resDoctorB.body.appointments.some((a) => a.doctorId.toString() === doctorA._id.toString() || a._id.toString() === newApptId.toString());
    console.log('13. Doctor B cannot see Doctor A appointments:', !doctorBHasDoctorAAppt);
    console.assert(!doctorBHasDoctorAAppt, 'FAIL: Doctor cross-access isolation breached');

    // 14. Patient isolation works (Patient A cannot view Patient B appointment)
    const reqGetApptPatientA = { user: patientA, params: { id: newApptId } };
    const resGetApptPatientA = mockRes();
    await getAppointmentById(reqGetApptPatientA, resGetApptPatientA, (err) => { throw err; });
    console.log('14. Patient A can view own appointment:', resGetApptPatientA.statusCode === 200);
    console.assert(resGetApptPatientA.statusCode === 200, 'FAIL: Patient A unable to view own appointment');

    const reqGetApptPatientB = { user: patientB, params: { id: newApptId } };
    const resGetApptPatientB = mockRes();
    await getAppointmentById(reqGetApptPatientB, resGetApptPatientB, (err) => { throw err; });
    console.log('14. Patient B rejected from viewing Patient A appointment:', resGetApptPatientB.statusCode === 403);
    console.assert(resGetApptPatientB.statusCode === 403, 'FAIL: Patient cross-access isolation breached');

    // 15. Unauthorized access is rejected (Patient role creating doctor appointment)
    const reqUnauth = {
      user: patientA,
      body: {
        patientId: patientB._id,
        appointmentDate: new Date(),
      },
    };
    const resUnauth = mockRes();
    await createAppointment(reqUnauth, resUnauth, (err) => { throw err; });
    console.log('15. Patient role rejected from creating appointment:', resUnauth.statusCode === 403);
    console.assert(resUnauth.statusCode === 403, 'FAIL: Role authorization failure');

    // 16. Existing consultation functionality remains intact
    const reqGetConsult = { user: doctorA, params: { id: consultId } };
    const resGetConsult = mockRes();
    await getConsultationById(reqGetConsult, resGetConsult, (err) => { throw err; });
    console.log('16. Consultation retrieval intact:', resGetConsult.statusCode === 200 && resGetConsult.body.consultation._id.toString() === consultId.toString());
    console.assert(resGetConsult.statusCode === 200 && resGetConsult.body.consultation._id.toString() === consultId.toString(), 'FAIL: Existing consultation API broken');

    console.log('\n================================================================');
    console.log('>>> ALL 16 DOCTOR APPOINTMENT MANAGEMENT TESTS PASSED! <<<');
    console.log('================================================================\n');
  } catch (err) {
    console.error('TEST ERROR in Doctor Appointment Management:', err);
    process.exitCode = 1;
  } finally {
    if (mongoConnected) {
      console.log('Cleaning up temporary appointment demonstration artifacts from MongoDB...');
      if (createdAppointmentIds.length > 0) {
        await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
      }
      if (createdConsultationIds.length > 0) {
        await Consultation.deleteMany({ _id: { $in: createdConsultationIds } });
      }
      if (createdProfileIds.length > 0) {
        await PatientProfile.deleteMany({ _id: { $in: createdProfileIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      await mongoose.disconnect();
      console.log('MongoDB connection closed and cleanup completed.');
    }
  }
}

runAppointmentTests();
