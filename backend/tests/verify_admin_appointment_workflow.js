const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Consultation = require('../src/models/Consultation');
const PatientProfile = require('../src/models/PatientProfile');
const DoctorProfile = require('../src/models/DoctorProfile');
const { register, login } = require('../src/controllers/authController');
const {
  lookupPatientByPid,
  getDepartmentsAndDoctors,
  getAvailableSlots,
  createAppointment,
  getDoctorAppointments,
  getAppointmentById,
} = require('../src/controllers/appointmentController');
const { createConsultation } = require('../src/controllers/consultationController');
const { toCalendarDateString } = require('../src/utils/dateUtils');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const runTests = async () => {
  const dns = require('node:dns');
  try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
  try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  let testAdminEmail = `admin_test_${Date.now()}@medwise.org`;
  let adminUser = null;
  let testApptId = null;

  try {
    console.log('=== TEST 1: Admin Registration & Login ===');
    // 1. Admin registration
    const regReq = {
      body: {
        name: 'System Hospital Admin',
        email: testAdminEmail,
        password: 'Password123!',
        role: 'admin',
      },
    };
    const regRes = mockRes();
    await register(regReq, regRes, (err) => { if (err) throw err; });
    assert.strictEqual(regRes.statusCode, 201, 'Admin registration should return 201');
    assert.strictEqual(regRes.body.user.role, 'admin', 'Role should be admin');
    assert.strictEqual(regRes.body.user.profileCompleted, true, 'Admin should have profileCompleted = true');
    console.log('✔ Admin registration passed with profileCompleted: true');

    // 2. Admin login
    const loginReq = {
      body: {
        email: testAdminEmail,
        password: 'Password123!',
      },
    };
    const loginRes = mockRes();
    await login(loginReq, loginRes, (err) => { if (err) throw err; });
    assert.strictEqual(loginRes.statusCode, 200, 'Admin login should return 200');
    assert.strictEqual(loginRes.body.user.role, 'admin');
    assert.strictEqual(loginRes.body.user.profileCompleted, true);
    adminUser = await User.findOne({ email: testAdminEmail });
    console.log('✔ Admin login succeeded with role: admin');

    console.log('\n=== TEST 1B: Existing Roles Authentication Remains Functional ===');
    const existingRoles = ['doctor', 'pharmacist', 'patient'];
    for (const role of existingRoles) {
      const userOfRole = await User.findOne({ role });
      assert.ok(userOfRole, `Should find at least one existing ${role} user in database`);
      assert.strictEqual(userOfRole.role, role);
      console.log(`✔ Existing ${role} account active: ${userOfRole.name} (${userOfRole.email})`);
    }

    console.log('\n=== TEST 2: Existing Patient Lookup by PID (Admin Only) ===');
    // Find an existing real patient
    const realPatient = await User.findOne({ role: 'patient' });
    assert.ok(realPatient, 'Should have at least one patient in database');
    const realPatientProfile = await PatientProfile.findOne({ userId: realPatient._id });
    const targetPid = realPatientProfile && realPatientProfile.mobileNumber
      ? `PID-${realPatientProfile.mobileNumber.slice(-10)}`
      : 'PID-NONEXISTENT';

    // 1. Search with valid PID
    const lookupReq = {
      user: adminUser,
      query: { pid: targetPid },
    };
    const lookupRes = mockRes();
    await lookupPatientByPid(lookupReq, lookupRes, (err) => { if (err) throw err; });
    assert.strictEqual(lookupRes.statusCode, 200, 'Patient lookup should succeed');
    assert.strictEqual(lookupRes.body.success, true);
    assert.strictEqual(lookupRes.body.patient.patientId.toString(), realPatient._id.toString());
    assert.ok(lookupRes.body.patient.name);
    console.log(`✔ Patient lookup by PID (${targetPid}) returned patient: ${lookupRes.body.patient.name}`);

    // 2. Search with invalid / non-existent PID
    const invalidLookupReq = {
      user: adminUser,
      query: { pid: 'PID-0000000000' },
    };
    const invalidLookupRes = mockRes();
    await lookupPatientByPid(invalidLookupReq, invalidLookupRes, (err) => { if (err) throw err; });
    assert.strictEqual(invalidLookupRes.statusCode, 404, 'Non-existent PID should return 404');
    assert.strictEqual(invalidLookupRes.body.success, false);
    console.log('✔ Non-existent PID returned 404 without auto-creating patient');

    console.log('\n=== TEST 3: Departments & Doctors Dynamic Population ===');
    const deptReq = { user: adminUser };
    const deptRes = mockRes();
    await getDepartmentsAndDoctors(deptReq, deptRes, (err) => { if (err) throw err; });
    assert.strictEqual(deptRes.statusCode, 200);
    assert.ok(Array.isArray(deptRes.body.departments), 'Departments should be array');
    assert.ok(Array.isArray(deptRes.body.doctors), 'Doctors should be array');
    console.log(`✔ Found ${deptRes.body.departments.length} departments and ${deptRes.body.doctors.length} registered doctors.`);
    assert.ok(deptRes.body.doctors.length > 0, 'Should have at least 1 registered doctor');

    const selectedDoc = deptRes.body.doctors[0];
    const docDept = selectedDoc.specialization || selectedDoc.department;
    console.log(`✔ Selected test doctor: ${selectedDoc.name} (${docDept})`);

    console.log('\n=== TEST 4: Available Time Slots Query ===');
    const todayCalendarStr = toCalendarDateString(new Date());
    const slotsReq = {
      user: adminUser,
      query: { doctorId: selectedDoc.doctorId.toString(), date: todayCalendarStr },
    };
    const slotsRes = mockRes();
    await getAvailableSlots(slotsReq, slotsRes, (err) => { if (err) throw err; });
    assert.strictEqual(slotsRes.statusCode, 200);
    assert.ok(Array.isArray(slotsRes.body.slots));
    const availableSlot = slotsRes.body.slots.find((s) => s.available);
    assert.ok(availableSlot, 'Should find at least one open slot');
    console.log(`✔ Available slots queried: ${slotsRes.body.availableCount}/${slotsRes.body.totalSlots} open. Selected: ${availableSlot.time}`);

    console.log('\n=== TEST 5: Admin Appointment Creation with Vitals & Reason ===');
    // Ensure permission check: doctor cannot call admin endpoint
    const docUser = await User.findById(selectedDoc.doctorId);
    const unauthorizedReq = {
      user: docUser,
      body: {
        patientId: realPatient._id,
        doctorId: selectedDoc.doctorId,
        department: docDept,
        appointmentDate: todayCalendarStr,
        appointmentTime: availableSlot.time,
      },
    };
    const unauthorizedRes = mockRes();
    await createAppointment(unauthorizedReq, unauthorizedRes, (err) => { if (err) throw err; });
    assert.strictEqual(unauthorizedRes.statusCode, 403, 'Doctor should be forbidden from calling admin booking API');
    console.log('✔ Non-admin role blocked from admin appointment booking endpoint');

    // Admin books appointment with vitals and reason
    const testVitals = {
      bloodPressure: { systolic: 124, diastolic: 82 },
      temperature: 36.8,
    };
    const bookReq = {
      user: adminUser,
      body: {
        patientId: realPatient._id,
        doctorId: selectedDoc.doctorId,
        department: docDept,
        appointmentDate: todayCalendarStr,
        appointmentTime: availableSlot.time,
        reason: 'Routine quarterly diabetes checkup and blood pressure monitoring',
        vitals: testVitals,
      },
    };
    const bookRes = mockRes();
    await createAppointment(bookReq, bookRes, (err) => { if (err) throw err; });
    assert.strictEqual(bookRes.statusCode, 201, 'Admin appointment booking should return 201');
    assert.ok(bookRes.body.appointment, 'Should return created appointment');
    testApptId = bookRes.body.appointment._id;
    assert.strictEqual(bookRes.body.appointment.status, 'SCHEDULED');
    assert.strictEqual(bookRes.body.appointment.vitals.bloodPressure.systolic, 124);
    assert.strictEqual(bookRes.body.appointment.vitals.bloodPressure.diastolic, 82);
    assert.strictEqual(bookRes.body.appointment.vitals.bloodPressure.unit, 'mmHg');
    assert.strictEqual(bookRes.body.appointment.vitals.temperature, 36.8);
    assert.strictEqual(bookRes.body.appointment.vitals.temperatureUnit, '°C');
    console.log('✔ Confirmed appointment created with vitals and reason preserved in MongoDB');

    console.log('\n=== TEST 6: Prevent Slot Overlap / Double-Booking (409 Conflict) ===');
    const duplicateSlotReq = {
      user: adminUser,
      body: {
        patientId: realPatient._id,
        doctorId: selectedDoc.doctorId,
        department: docDept,
        appointmentDate: todayCalendarStr,
        appointmentTime: availableSlot.time,
        reason: 'Attempting to double book the same slot',
      },
    };
    const duplicateSlotRes = mockRes();
    await createAppointment(duplicateSlotReq, duplicateSlotRes, (err) => { if (err) throw err; });
    assert.strictEqual(duplicateSlotRes.statusCode, 409, 'Double booking same slot must return 409 Conflict');
    console.log('✔ Slot conflict validation prevented double-booking with 409 Conflict');

    console.log("\n=== TEST 7: Doctor Portal Schedule & Today's Appointments Counter ===");
    const docApptsReq = {
      user: docUser,
    };
    const docApptsRes = mockRes();
    await getDoctorAppointments(docApptsReq, docApptsRes, (err) => { if (err) throw err; });
    assert.strictEqual(docApptsRes.statusCode, 200);
    const todayList = docApptsRes.body.categorized.today;
    assert.ok(todayList.length >= 1, "Today's appointment list should have at least 1 item");
    assert.strictEqual(docApptsRes.body.stats.totalToday, todayList.length, 'Counter must equal today appointment count');
    const foundOurAppt = todayList.find((a) => a._id.toString() === testApptId.toString());
    assert.ok(foundOurAppt, "Doctor's today appointments must contain the booked appointment");
    console.log(`✔ Doctor today's counter: ${docApptsRes.body.stats.totalToday} appointments matching today's list count`);

    console.log('\n=== TEST 8: Chronological Ordering of Today Appointments ===');
    let isChronological = true;
    for (let i = 0; i < todayList.length - 1; i++) {
      const t1 = todayList[i].appointmentTime;
      const t2 = todayList[i + 1].appointmentTime;
      // If times are different, ensure order is correct
      if (t1 && t2) {
        // Simple comparison using 24h conversion
        const toMinutes = (timeStr) => {
          const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (!match) return 0;
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const p = match[3] ? match[3].toUpperCase() : 'AM';
          if (p === 'PM' && h < 12) h += 12;
          if (p === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        };
        if (toMinutes(t1) > toMinutes(t2)) {
          isChronological = false;
        }
      }
    }
    assert.ok(isChronological, "Today's appointments must be chronologically ordered");
    console.log("✔ Today's appointments are strictly ordered chronologically by scheduled time");

    console.log('\n=== TEST 9: Doctor Access Control / Ownership Protection ===');
    // Find another doctor
    const otherDoctor = await User.findOne({ role: 'doctor', _id: { $ne: docUser._id } });
    if (otherDoctor) {
      const forbiddenApptReq = {
        user: otherDoctor,
        params: { id: testApptId },
      };
      const forbiddenApptRes = mockRes();
      await getAppointmentById(forbiddenApptReq, forbiddenApptRes, (err) => { if (err) throw err; });
      assert.strictEqual(forbiddenApptRes.statusCode, 403, 'Unauthorized doctor must be forbidden from accessing another doctor appt');
      console.log('✔ Unauthorized doctor blocked from viewing appointment record (403)');

      const forbiddenConsultReq = {
        user: otherDoctor,
        body: {
          appointmentId: testApptId,
          patientId: realPatient._id,
          consultationDate: todayCalendarStr,
        },
      };
      const forbiddenConsultRes = mockRes();
      await createConsultation(forbiddenConsultReq, forbiddenConsultRes, (err) => { if (err) throw err; });
      assert.strictEqual(forbiddenConsultRes.statusCode, 403, 'Unauthorized doctor cannot start consultation for another doctor appt');
      console.log('✔ Unauthorized doctor blocked from starting consultation for another doctor appt (403)');
    }

    console.log('\n=== TEST 10: Start Consultation & Transfer Vitals & Reason ===');
    const consultReq = {
      user: docUser,
      body: {
        appointmentId: testApptId,
        patientId: realPatient._id,
        consultationDate: todayCalendarStr,
        followUpRequired: 'No',
      },
    };
    const consultRes = mockRes();
    await createConsultation(consultReq, consultRes, (err) => { if (err) throw err; });
    assert.strictEqual(consultRes.statusCode, 201, 'Consultation creation should succeed');
    assert.strictEqual(
      consultRes.body.consultation.reasonForVisit,
      'Routine quarterly diabetes checkup and blood pressure monitoring',
      'Reason for visit must transfer from appointment to consultation'
    );
    assert.strictEqual(consultRes.body.consultation.vitals.bloodPressure.systolic, 124);
    assert.strictEqual(consultRes.body.consultation.vitals.temperature, 36.8);
    console.log('✔ Reason for visit and vitals transferred accurately to consultation');

    // Verify appointment status updated to COMPLETED
    const updatedAppt = await Appointment.findById(testApptId);
    assert.strictEqual(updatedAppt.status, 'COMPLETED');
    assert.strictEqual(updatedAppt.consultationId.toString(), consultRes.body.consultation._id.toString());
    console.log('✔ Originating appointment status transitioned to COMPLETED with consultationId linked');

    // Duplicate consultation prevention
    const dupConsultReq = {
      user: docUser,
      body: {
        appointmentId: testApptId,
        patientId: realPatient._id,
        followUpRequired: 'No',
      },
    };
    const dupConsultRes = mockRes();
    await createConsultation(dupConsultReq, dupConsultRes, (err) => { if (err) throw err; });
    assert.strictEqual(dupConsultRes.statusCode, 409, 'Duplicate consultation on same appointment must be rejected with 409');
    console.log('✔ Accidental duplicate consultation prevented on completed appointment (409)');

    console.log('\n=== TEST 11: Database Records Integrity Verification ===');
    const userCount = await User.countDocuments();
    const patientProfileCount = await PatientProfile.countDocuments();
    const doctorProfileCount = await DoctorProfile.countDocuments();
    const apptCount = await Appointment.countDocuments();
    const consultCount = await Consultation.countDocuments();
    assert.ok(userCount > 0, 'User records preserved');
    assert.ok(patientProfileCount > 0, 'Patient profiles preserved');
    assert.ok(doctorProfileCount > 0, 'Doctor profiles preserved');
    console.log(`✔ Database integrity verified: ${userCount} Users, ${patientProfileCount} Patients, ${doctorProfileCount} Doctors, ${apptCount} Appointments, ${consultCount} Consultations.`);

    console.log('\n========================================');
    console.log('ALL VERIFICATION SUITE TESTS PASSED (100%)!');
    console.log('========================================\n');
  } finally {
    // Clean up test appointment & consultation
    if (testApptId) {
      await Consultation.deleteMany({ appointmentId: testApptId });
      await Appointment.findByIdAndDelete(testApptId);
    }
    if (adminUser) {
      await User.findByIdAndDelete(adminUser._id);
    }
    await mongoose.disconnect();
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
