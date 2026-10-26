const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const {
  toCalendarDateString,
  compareCalendarDates,
  isFollowUpDateInFuture,
  isFollowUpDateToday,
  isFollowUpDateOverdue,
  formatDisplayDate: formatDisplayDateUtil,
} = require('../utils/dateUtils');

/**
 * Standard clinical daily time slots
 */
const STANDARD_TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
];

/**
 * Parse time slot string to minutes from midnight for chronological ordering
 */
const parseTimeSlot = (timeStr) => {
  if (!timeStr) return 0;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toUpperCase() : 'AM';
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

/**
 * Helper to compute age from Date of Birth
 */
const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return '';
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Format patient's 10-digit mobile number into unique Patient ID (PID)
 */
const formatPatientId = (mobile) => {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `PID-${last10}`;
};

/**
 * Idempotently sync follow-up consultations to Appointment records for a specific doctor
 */
const syncFollowUpAppointmentsForDoctor = async (doctorId) => {
  // 1. Find all consultations by doctor that have a valid followUpDate and status Follow-up Needed
  const consultationsWithFollowUp = await Consultation.find({
    doctorId,
    followUpDate: { $ne: null, $exists: true },
    status: 'Follow-up Needed',
  }).lean();

  for (const c of consultationsWithFollowUp) {
    if (!c.followUpDate || isNaN(new Date(c.followUpDate).getTime())) continue;

    const followUpDate = new Date(c.followUpDate);
    const reasonText = c.reasonForVisit ? `Follow-up for: ${c.reasonForVisit}` : 'Follow-up consultation';

    const existingAppt = await Appointment.findOne({
      consultationId: c._id,
      appointmentType: 'FOLLOW_UP',
    });

    if (existingAppt) {
      // Update if date, reason, or PID changed
      let modified = false;
      if (existingAppt.appointmentDate.getTime() !== followUpDate.getTime()) {
        existingAppt.appointmentDate = followUpDate;
        modified = true;
      }
      if (c.patientPid && existingAppt.patientPid !== c.patientPid) {
        existingAppt.patientPid = c.patientPid;
        modified = true;
      }
      if (existingAppt.reason !== reasonText) {
        existingAppt.reason = reasonText;
        modified = true;
      }
      // Re-enable if it was cancelled but followUpDate is restored
      if (existingAppt.status === 'CANCELLED') {
        existingAppt.status = 'SCHEDULED';
        modified = true;
      }

      if (modified) {
        await existingAppt.save();
      }
    } else {
      // Create new follow-up appointment
      await Appointment.create({
        patientId: c.patientId,
        doctorId: c.doctorId,
        patientPid: c.patientPid || '',
        appointmentDate: followUpDate,
        appointmentTime: '09:00 AM',
        appointmentType: 'FOLLOW_UP',
        reason: reasonText,
        status: 'SCHEDULED',
        consultationId: c._id,
      });
    }
  }

  // 2. Handle consultations where followUpDate was removed/cleared or status changed to Completed
  const followUpAppts = await Appointment.find({
    doctorId,
    appointmentType: 'FOLLOW_UP',
    consultationId: { $ne: null },
  });

  for (const appt of followUpAppts) {
    const parentConsultation = await Consultation.findById(appt.consultationId).lean();
    if (!parentConsultation || !parentConsultation.followUpDate || parentConsultation.status !== 'Follow-up Needed') {
      if (appt.status !== 'CANCELLED') {
        appt.status = 'CANCELLED';
        await appt.save();
      }
    }
  }
};

/**
 * @desc    Search patient by PID for appointment booking (Admin only)
 * @route   GET /api/appointments/patient-lookup
 * @access  Private (Admin)
 */
const lookupPatientByPid = async (req, res, next) => {
  try {
    const { pid } = req.query;
    if (!pid || !pid.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID (PID) search term is required',
      });
    }

    const cleanTerm = pid.trim();
    const digitsOnly = cleanTerm.replace(/\D/g, '');
    const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    let patientProfile = null;
    let patientUser = null;

    if (last10.length === 10) {
      patientProfile = await PatientProfile.findOne({
        mobileNumber: { $regex: last10, $options: 'i' },
      }).lean();
      if (patientProfile) {
        patientUser = await User.findOne({ _id: patientProfile.userId, role: 'patient' }).select('-password').lean();
      }
    }

    if (!patientUser && cleanTerm.toLowerCase().startsWith('pid-')) {
      const slug = cleanTerm.substring(4);
      const slugDigits = slug.replace(/\D/g, '');
      if (slugDigits.length === 10) {
        patientProfile = await PatientProfile.findOne({
          mobileNumber: { $regex: slugDigits, $options: 'i' },
        }).lean();
        if (patientProfile) {
          patientUser = await User.findOne({ _id: patientProfile.userId, role: 'patient' }).select('-password').lean();
        }
      }
    }

    if (!patientUser && cleanTerm.includes('@')) {
      patientUser = await User.findOne({ email: cleanTerm.toLowerCase(), role: 'patient' }).select('-password').lean();
      if (patientUser) {
        patientProfile = await PatientProfile.findOne({ userId: patientUser._id }).lean();
      }
    }

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: `No patient found with Patient ID "${cleanTerm}". Please verify the PID.`,
      });
    }

    const mobile = patientProfile?.mobileNumber || '';
    const finalPid = mobile ? formatPatientId(mobile) : `PID-${patientUser.email ? patientUser.email.split('@')[0] : 'PATIENT'}`;
    const age = patientProfile?.dateOfBirth ? calculateAge(patientProfile.dateOfBirth) : '';

    return res.status(200).json({
      success: true,
      patient: {
        patientId: patientUser._id,
        name: patientUser.name,
        email: patientUser.email,
        pid: finalPid,
        age,
        gender: patientProfile?.gender || '',
        bloodGroup: patientProfile?.bloodGroup || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get departments and registered doctors (Admin only)
 * @route   GET /api/appointments/departments-doctors
 * @access  Private (Admin)
 */
const getDepartmentsAndDoctors = async (req, res, next) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('name email').lean();
    const docProfiles = await DoctorProfile.find({
      userId: { $in: doctors.map((d) => d._id) },
    }).lean();

    const profileMap = new Map();
    docProfiles.forEach((p) => {
      profileMap.set(p.userId.toString(), p);
    });

    const detailedDoctors = doctors.map((doc) => {
      const prof = profileMap.get(doc._id.toString());
      const specialization = prof?.specialization || 'General Medicine';
      return {
        doctorId: doc._id,
        name: doc.name,
        email: doc.email,
        specialization,
        department: specialization,
        hospitalClinicName: prof?.hospitalClinicName || '',
        yearsOfExperience: prof?.yearsOfExperience || 0,
      };
    });

    const SUPPORTED_DEPARTMENTS = [
      'General Medicine',
      'Internal Medicine',
      'Cardiology',
      'Dermatology',
      'Endocrinology',
      'Gastroenterology',
      'Neurology',
      'Obstetrics & Gynecology',
      'Oncology',
      'Ophthalmology',
      'Orthopedics',
      'Pediatrics',
      'Psychiatry',
      'Pulmonology',
      'Radiology',
    ];

    const departments = Array.from(
      new Set([
        ...SUPPORTED_DEPARTMENTS,
        ...detailedDoctors.map((d) => d.specialization),
      ])
    )
      .filter((d) => Boolean(d) && d !== 'Other')
      .sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      success: true,
      departments,
      doctors: detailedDoctors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get available slots for a doctor on a specific date (Admin only)
 * @route   GET /api/appointments/available-slots
 * @access  Private (Admin)
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and appointment date are required to check slot availability',
      });
    }

    const targetCalendarStr = toCalendarDateString(date);

    const existingAppointments = await Appointment.find({
      doctorId,
      status: 'SCHEDULED',
    }).lean();

    const sameDateAppointments = existingAppointments.filter(
      (a) => toCalendarDateString(a.appointmentDate) === targetCalendarStr
    );

    const bookedSlots = new Set(sameDateAppointments.map((a) => a.appointmentTime?.trim()).filter(Boolean));

    const slots = STANDARD_TIME_SLOTS.map((slot) => ({
      time: slot,
      available: !bookedSlots.has(slot),
    }));

    return res.status(200).json({
      success: true,
      date: targetCalendarStr,
      doctorId,
      totalSlots: slots.length,
      availableCount: slots.filter((s) => s.available).length,
      slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create and confirm a new patient appointment (Admin only)
 * @route   POST /api/appointments
 * @access  Private (Admin)
 */
const createAppointment = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only authorized administrators may book and confirm patient appointments',
      });
    }

    const {
      patientId,
      doctorId,
      department,
      patientPid,
      appointmentDate,
      appointmentTime,
      appointmentType,
      reason,
      vitals,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required to create an appointment',
      });
    }

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required to create an appointment',
      });
    }

    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date is required',
      });
    }

    if (!appointmentTime || !appointmentTime.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment time slot is required',
      });
    }

    // 1. Verify patient user exists
    const patientUser = await User.findById(patientId);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found in system',
      });
    }

    // 2. Verify doctor user exists
    const doctorUser = await User.findById(doctorId);
    if (!doctorUser || doctorUser.role !== 'doctor') {
      return res.status(404).json({
        success: false,
        message: 'Doctor account not found in system',
      });
    }

    // 3. Verify doctor-department membership on the backend
    const docProfile = await DoctorProfile.findOne({ userId: doctorId }).lean();
    const docDepartment = docProfile?.specialization || 'General Medicine';
    if (department && department.trim()) {
      if (docDepartment.toLowerCase().trim() !== department.toLowerCase().trim()) {
        return res.status(400).json({
          success: false,
          message: `Doctor ${doctorUser.name} does not belong to the ${department} department`,
        });
      }
    }

    // 4. Resolve patient PID if not provided
    let finalPid = patientPid || '';
    if (!finalPid) {
      const profile = await PatientProfile.findOne({ userId: patientId }).lean();
      if (profile && profile.mobileNumber) {
        finalPid = formatPatientId(profile.mobileNumber);
      } else {
        finalPid = `PID-${patientUser.email ? patientUser.email.split('@')[0] : 'PATIENT'}`;
      }
    }

    // 5. Validate appointment-specific vitals if provided
    let finalVitals = null;
    if (vitals && typeof vitals === 'object') {
      finalVitals = {};

      if (vitals.bloodPressure && typeof vitals.bloodPressure === 'object') {
        const { systolic, diastolic } = vitals.bloodPressure;

        if (systolic !== undefined && systolic !== '' && systolic !== null) {
          const sysNum = Number(systolic);
          if (isNaN(sysNum) || sysNum < 40 || sysNum > 300) {
            return res.status(400).json({
              success: false,
              message: 'Systolic blood pressure must be a valid number between 40 and 300 mmHg',
            });
          }
          finalVitals.bloodPressure = { systolic: sysNum, unit: 'mmHg' };
        }

        if (diastolic !== undefined && diastolic !== '' && diastolic !== null) {
          const diaNum = Number(diastolic);
          if (isNaN(diaNum) || diaNum < 30 || diaNum > 200) {
            return res.status(400).json({
              success: false,
              message: 'Diastolic blood pressure must be a valid number between 30 and 200 mmHg',
            });
          }
          if (!finalVitals.bloodPressure) finalVitals.bloodPressure = { unit: 'mmHg' };
          finalVitals.bloodPressure.diastolic = diaNum;
        }

        if (finalVitals.bloodPressure?.systolic && finalVitals.bloodPressure?.diastolic) {
          if (finalVitals.bloodPressure.systolic <= finalVitals.bloodPressure.diastolic) {
            return res.status(400).json({
              success: false,
              message: 'Systolic blood pressure must be greater than diastolic blood pressure',
            });
          }
        }
      }

      if (vitals.temperature !== undefined && vitals.temperature !== '' && vitals.temperature !== null) {
        const tempNum = Number(vitals.temperature);
        if (isNaN(tempNum)) {
          return res.status(400).json({
            success: false,
            message: 'Body temperature must be a valid number',
          });
        }

        let unit = vitals.temperatureUnit;
        if (!unit) {
          unit = (tempNum >= 25 && tempNum <= 45) ? '°C' : '°F';
        }

        if (unit === '°F' || unit === 'F') {
          if (tempNum < 85 || tempNum > 115) {
            return res.status(400).json({
              success: false,
              message: 'Body temperature must be a valid number between 85°F and 115°F',
            });
          }
          finalVitals.temperature = tempNum;
          finalVitals.temperatureUnit = '°F';
        } else {
          if (tempNum < 25 || tempNum > 45) {
            return res.status(400).json({
              success: false,
              message: 'Body temperature must be a valid number between 25°C and 45°C',
            });
          }
          finalVitals.temperature = tempNum;
          finalVitals.temperatureUnit = '°C';
        }
      }

      if (Object.keys(finalVitals).length === 0) {
        finalVitals = null;
      }
    }

    // 6. Enforce slot availability and conflict validation (prevent overlapping confirmed appointments)
    const targetCalendarStr = toCalendarDateString(appointmentDate);
    const existingDoctorAppts = await Appointment.find({
      doctorId,
      status: 'SCHEDULED',
      appointmentTime: appointmentTime.trim(),
    }).lean();

    const hasConflict = existingDoctorAppts.some(
      (a) => toCalendarDateString(a.appointmentDate) === targetCalendarStr
    );

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: `The selected time slot (${appointmentTime.trim()}) on ${targetCalendarStr} is already booked for Dr. ${doctorUser.name}. Please select an alternative slot.`,
      });
    }

    // 7. Save confirmed appointment in MongoDB
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      department: department || docDepartment,
      patientPid: finalPid,
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime.trim(),
      appointmentType: appointmentType === 'FOLLOW_UP' ? 'FOLLOW_UP' : 'NEW_PATIENT',
      reason: reason !== undefined && reason !== null ? String(reason).trim() : '',
      status: 'SCHEDULED',
      vitals: finalVitals,
      createdBy: req.user._id,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'name email mobileNumber')
      .populate('doctorId', 'name email')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Appointment confirmed and scheduled successfully',
      appointment: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get appointments for logged-in doctor with categorization & follow-up sync
 * @route   GET /api/appointments/doctor
 * @access  Private (Doctor)
 */
const getDoctorAppointments = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians may view appointment schedules',
      });
    }

    const doctorId = req.user._id;

    // Sync any consultation follow-ups first
    await syncFollowUpAppointmentsForDoctor(doctorId);

    // Date boundary calculation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({ doctorId })
      .populate('patientId', 'name email mobileNumber')
      .populate('consultationId', 'reasonForVisit consultationDate followUpDate')
      .sort({ appointmentDate: 1 })
      .lean();

    // Enhance appointments with patient profiles for accurate display
    const enhancedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        let profile = null;
        if (appt.patientId && appt.patientId._id) {
          profile = await PatientProfile.findOne({ userId: appt.patientId._id }).lean();
        }
        const patientName = appt.patientId?.name || 'Patient';
        const pid = appt.patientPid || (profile?.mobileNumber ? formatPatientId(profile.mobileNumber) : 'PID-VERIFIED');
        const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : '';

        return {
          ...appt,
          patientName,
          patientPid: pid,
          patientAge: age,
          patientGender: profile?.gender || '',
        };
      })
    );

    // Calendar date based grouping in intended timezone (Asia/Kolkata)
    const todayCalendarStr = toCalendarDateString(new Date());

    const todayAppointments = enhancedAppointments.filter(
      (a) =>
        a.status === 'SCHEDULED' &&
        toCalendarDateString(a.appointmentDate) === todayCalendarStr
    );

    const upcomingAppointments = enhancedAppointments.filter(
      (a) =>
        a.status === 'SCHEDULED' &&
        toCalendarDateString(a.appointmentDate) > todayCalendarStr
    );

    const pastAppointments = enhancedAppointments.filter(
      (a) =>
        toCalendarDateString(a.appointmentDate) < todayCalendarStr ||
        a.status !== 'SCHEDULED'
    );

    const newPatientAppointments = enhancedAppointments.filter(
      (a) =>
        a.appointmentType === 'NEW_PATIENT' &&
        a.status === 'SCHEDULED' &&
        toCalendarDateString(a.appointmentDate) >= todayCalendarStr
    );

    const allScheduledFollowUps = enhancedAppointments.filter(
      (a) =>
        a.appointmentType === 'FOLLOW_UP' &&
        a.status === 'SCHEDULED'
    );

    const followUpAppointments = allScheduledFollowUps.filter(
      (a) => toCalendarDateString(a.appointmentDate) >= todayCalendarStr
    );

    const todayFollowUps = allScheduledFollowUps.filter(
      (a) => toCalendarDateString(a.appointmentDate) === todayCalendarStr
    );

    const upcomingFollowUps = allScheduledFollowUps.filter(
      (a) => toCalendarDateString(a.appointmentDate) > todayCalendarStr
    );

    const overdueFollowUps = allScheduledFollowUps.filter(
      (a) => toCalendarDateString(a.appointmentDate) < todayCalendarStr
    );

    // Chronological sorting by scheduled time
    todayAppointments.sort((a, b) => parseTimeSlot(a.appointmentTime) - parseTimeSlot(b.appointmentTime));
    upcomingAppointments.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate) || parseTimeSlot(a.appointmentTime) - parseTimeSlot(b.appointmentTime));
    newPatientAppointments.sort((a, b) => parseTimeSlot(a.appointmentTime) - parseTimeSlot(b.appointmentTime));
    todayFollowUps.sort((a, b) => parseTimeSlot(a.appointmentTime) - parseTimeSlot(b.appointmentTime));

    return res.status(200).json({
      success: true,
      count: enhancedAppointments.length,
      stats: {
        totalToday: todayAppointments.length,
        totalUpcoming: upcomingAppointments.length,
        totalNewPatients: newPatientAppointments.length,
        totalFollowUps: allScheduledFollowUps.length,
        todayFollowUpsCount: todayFollowUps.length,
        upcomingFollowUpsCount: upcomingFollowUps.length,
        overdueFollowUpsCount: overdueFollowUps.length,
      },
      appointments: enhancedAppointments,
      categorized: {
        today: todayAppointments,
        upcoming: upcomingAppointments,
        past: pastAppointments,
        newPatients: newPatientAppointments,
        followUps: {
          today: todayFollowUps,
          upcoming: upcomingFollowUps,
          overdue: overdueFollowUps,
          allScheduled: allScheduledFollowUps,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get follow-up appointments specifically for logged-in doctor
 * @route   GET /api/appointments/doctor/follow-ups
 * @access  Private (Doctor)
 */
const getDoctorFollowUps = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians may view follow-up appointment schedules',
      });
    }

    const doctorId = req.user._id;

    // Sync follow-up consultations
    await syncFollowUpAppointmentsForDoctor(doctorId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const followUps = await Appointment.find({
      doctorId,
      appointmentType: 'FOLLOW_UP',
      status: 'SCHEDULED',
    })
      .populate('patientId', 'name email mobileNumber')
      .populate('consultationId', 'reasonForVisit consultationDate followUpDate')
      .sort({ appointmentDate: 1 })
      .lean();

    const enhanced = await Promise.all(
      followUps.map(async (a) => {
        let profile = null;
        if (a.patientId && a.patientId._id) {
          profile = await PatientProfile.findOne({ userId: a.patientId._id }).lean();
        }
        return {
          ...a,
          patientName: a.patientId?.name || 'Patient',
          patientPid: a.patientPid || (profile?.mobileNumber ? formatPatientId(profile.mobileNumber) : 'PID-VERIFIED'),
          patientAge: profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : '',
          patientGender: profile?.gender || '',
        };
      })
    );

    const todayCalendarStr = toCalendarDateString(new Date());

    const today = enhanced.filter(
      (a) => toCalendarDateString(a.appointmentDate) === todayCalendarStr
    );

    const upcoming = enhanced.filter(
      (a) => toCalendarDateString(a.appointmentDate) > todayCalendarStr
    );

    const overdue = enhanced.filter(
      (a) => toCalendarDateString(a.appointmentDate) < todayCalendarStr
    );

    const past = await Appointment.find({
      doctorId,
      appointmentType: 'FOLLOW_UP',
      appointmentDate: { $lt: startOfToday },
    })
      .populate('patientId', 'name email mobileNumber')
      .populate('consultationId', 'reasonForVisit consultationDate followUpDate')
      .sort({ appointmentDate: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: enhanced.length,
      today,
      upcoming,
      overdue,
      past,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single appointment details
 * @route   GET /api/appointments/:id
 * @access  Private (Doctor / Patient)
 */
const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email mobileNumber')
      .populate('doctorId', 'name email')
      .populate('consultationId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment record not found',
      });
    }

    const userIdStr = req.user._id.toString();
    const docIdStr = appointment.doctorId?._id ? appointment.doctorId._id.toString() : appointment.doctorId?.toString();
    const patIdStr = appointment.patientId?._id ? appointment.patientId._id.toString() : appointment.patientId?.toString();

    if (req.user.role !== 'admin' && userIdStr !== docIdStr && userIdStr !== patIdStr) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to appointment record',
      });
    }

    return res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update appointment details/status
 * @route   PUT /api/appointments/:id
 * @access  Private (Doctor owner)
 */
const updateAppointment = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only registered physicians may update appointments',
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment record not found',
      });
    }

    if (appointment.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit appointments belonging to your schedule',
      });
    }

    const { appointmentDate, appointmentTime, reason, status } = req.body;

    if (appointmentDate !== undefined) appointment.appointmentDate = new Date(appointmentDate);
    if (appointmentTime !== undefined) appointment.appointmentTime = appointmentTime;
    if (reason !== undefined) appointment.reason = reason;
    if (status !== undefined) appointment.status = status;

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  syncFollowUpAppointmentsForDoctor,
  createAppointment,
  getDoctorAppointments,
  getDoctorFollowUps,
  getAppointmentById,
  updateAppointment,
  lookupPatientByPid,
  getDepartmentsAndDoctors,
  getAvailableSlots,
};
