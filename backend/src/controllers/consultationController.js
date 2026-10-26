const Consultation = require('../models/Consultation');
const User = require('../models/User');
const { resolveDoctorIdentity } = require('../utils/doctorIdentityResolver');
const { isFollowUpDateInFuture, formatDisplayDate } = require('../utils/dateUtils');

/**
 * @desc    Get authenticated patient's consultations
 * @route   GET /api/consultations/my
 * @access  Private (Patient / Authenticated User)
 */
const getMyConsultations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    let query = {};
    if (role === 'patient') {
      query.patientId = userId;
    } else if (role === 'doctor') {
      query.doctorId = userId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view clinical consultation history',
      });
    }

    const consultations = await Consultation.find(query)
      .populate('patientId', 'name email mobileNumber')
      .populate('doctorId', 'name email')
      .sort({ consultationDate: -1, createdAt: -1 })
      .lean();

    const formattedConsultations = consultations.map((c) => ({
      ...c,
      patientName: c.patientId?.name || c.patientName || '',
    }));

    const resolvedConsultations = await resolveDoctorIdentity(formattedConsultations);

    return res.status(200).json({
      success: true,
      count: resolvedConsultations.length,
      consultations: resolvedConsultations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record a new consultation (used by Doctor / automated tests)
 * @route   POST /api/consultations
 * @access  Private (Doctor)
 */
const createConsultation = async (req, res, next) => {
  try {
    // Only doctor can create consultations
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only authorized physicians may document clinical consultations',
      });
    }

    const {
      appointmentId,
      patientId,
      patientPid,
      hospitalClinicName,
      hospitalClinicLocation,
      hospitalClinicAddress,
      consultationDate,
      consultationType,
      reasonForVisit,
      clinicalNotes,
      diagnosisNotes,
      diagnosisAssessment,
      doctorRecommendations,
      followUpDate,
      status,
      prescriptionId,
    } = req.body;

    const Appointment = require('../models/Appointment');
    let linkedAppt = null;
    if (appointmentId) {
      linkedAppt = await Appointment.findById(appointmentId);
      if (!linkedAppt) {
        return res.status(404).json({
          success: false,
          message: 'Associated appointment not found',
        });
      }

      // Backend ownership check: doctor must be assigned doctor
      const apptDocId = linkedAppt.doctorId?._id ? linkedAppt.doctorId._id.toString() : linkedAppt.doctorId?.toString();
      if (apptDocId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You can only conduct consultations for appointments assigned to you',
        });
      }

      // Validation: Future follow-up consultations cannot be started before scheduled date
      if (linkedAppt.appointmentType === 'FOLLOW_UP') {
        if (isFollowUpDateInFuture(linkedAppt.appointmentDate)) {
          const displayDate = formatDisplayDate(linkedAppt.appointmentDate);
          return res.status(400).json({
            success: false,
            message: `Cannot start follow-up consultation before scheduled date. Available from ${displayDate}.`,
          });
        }
      }

      // Prevent accidental duplicate consultations caused by repeated clicks on completed appointments
      if (linkedAppt.status === 'COMPLETED') {
        return res.status(409).json({
          success: false,
          message: 'A consultation has already been conducted for this appointment',
          consultationId: linkedAppt.consultationId,
        });
      }
    }

    const finalPatientId = patientId || (linkedAppt ? linkedAppt.patientId?.toString() : null);

    if (!finalPatientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required to record consultation',
      });
    }

    // Verify patient exists
    const patientUser = await User.findById(finalPatientId);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found',
      });
    }

    let finalReasonForVisit = '';
    if (reasonForVisit !== undefined && reasonForVisit !== null && String(reasonForVisit).trim() !== '') {
      finalReasonForVisit = String(reasonForVisit).trim();
    } else if (linkedAppt && linkedAppt.reason) {
      finalReasonForVisit = linkedAppt.reason.trim();
    } else {
      finalReasonForVisit = reasonForVisit !== undefined && reasonForVisit !== null ? String(reasonForVisit).trim() : '';
    }

    // Transfer vitals from appointment if not provided
    let finalVitals = req.body.vitals;
    if (!finalVitals && linkedAppt && linkedAppt.vitals) {
      finalVitals = linkedAppt.vitals;
    }

    const followUpReq = req.body.followUpRequired;
    let finalFollowUpDate = followUpDate ? new Date(followUpDate) : undefined;
    let finalStatus = status || (finalFollowUpDate ? 'Follow-up Needed' : 'Completed');

    if (followUpReq === 'No') {
      finalFollowUpDate = undefined;
      finalStatus = status || 'Completed';
    } else if (followUpReq === 'Yes') {
      if (!followUpDate) {
        return res.status(400).json({
          success: false,
          message: 'Follow-up Date is required when Follow-up Required is Yes',
        });
      }
      finalFollowUpDate = new Date(followUpDate);
      finalStatus = status || 'Follow-up Needed';
    }

    const consultation = await Consultation.create({
      patientId: finalPatientId,
      patientPid: patientPid || (linkedAppt ? linkedAppt.patientPid : '') || '',
      doctorId: req.user._id,
      doctorName: req.user.name,
      doctorSpecialization: req.body.doctorSpecialization || 'General Medicine',
      hospitalClinicName: hospitalClinicName || '',
      hospitalClinicLocation: hospitalClinicLocation || hospitalClinicAddress || '',
      consultationDate: consultationDate ? new Date(consultationDate) : (linkedAppt && linkedAppt.appointmentDate ? new Date(linkedAppt.appointmentDate) : new Date()),
      consultationType: consultationType || 'In-person',
      reasonForVisit: finalReasonForVisit,
      clinicalNotes: clinicalNotes ? clinicalNotes.trim() : '',
      diagnosisNotes: (diagnosisNotes || diagnosisAssessment || '').trim(),
      doctorRecommendations: doctorRecommendations ? doctorRecommendations.trim() : '',
      followUpDate: finalFollowUpDate,
      status: finalStatus,
      prescriptionId: prescriptionId || undefined,
      appointmentId: linkedAppt ? linkedAppt._id : (appointmentId || undefined),
      vitals: finalVitals || undefined,
    });

    if (linkedAppt) {
      linkedAppt.consultationId = consultation._id;
      linkedAppt.status = 'COMPLETED';
      await linkedAppt.save();
    }

    // Auto-create Follow-up Appointment if followUpDate is provided and status is Follow-up Needed
    if (consultation.followUpDate && consultation.status === 'Follow-up Needed') {
      const reasonText = consultation.reasonForVisit
        ? `Follow-up for: ${consultation.reasonForVisit}`
        : 'Follow-up consultation';

      const existingAppt = await Appointment.findOne({
        consultationId: consultation._id,
        appointmentType: 'FOLLOW_UP',
      });

      if (!existingAppt) {
        await Appointment.create({
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          patientPid: consultation.patientPid || '',
          appointmentDate: consultation.followUpDate,
          appointmentTime: '09:00 AM',
          appointmentType: 'FOLLOW_UP',
          reason: reasonText,
          status: 'SCHEDULED',
          consultationId: consultation._id,
        });
      }
    }

    const resolvedConsultation = await resolveDoctorIdentity(consultation);

    return res.status(201).json({
      success: true,
      message: 'Consultation documented successfully',
      consultation: resolvedConsultation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single consultation by ID
 * @route   GET /api/consultations/:id
 * @access  Private (Doctor / Patient)
 */
const getConsultationById = async (req, res, next) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patientId', 'name email mobileNumber')
      .populate('doctorId', 'name email')
      .populate('prescriptionId');

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation record not found',
      });
    }

    // Role Security
    const userIdStr = req.user._id.toString();
    const docIdStr = consultation.doctorId?._id ? consultation.doctorId._id.toString() : consultation.doctorId?.toString();
    const patIdStr = consultation.patientId?._id ? consultation.patientId._id.toString() : consultation.patientId?.toString();

    const isDoctorOwner = docIdStr === userIdStr;
    const isPatientTarget = patIdStr === userIdStr;

    if (req.user.role === 'pharmacist' || (!isDoctorOwner && !isPatientTarget)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this clinical consultation record',
      });
    }

    const resolvedConsultation = await resolveDoctorIdentity(consultation);

    return res.status(200).json({
      success: true,
      consultation: resolvedConsultation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update consultation by ID
 * @route   PUT /api/consultations/:id
 * @access  Private (Doctor owner only)
 */
const updateConsultation = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only authorized physicians may update clinical consultations',
      });
    }

    let consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation record not found',
      });
    }

    // Only doctor author can update
    if (consultation.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit consultations authored by you',
      });
    }

    const {
      hospitalClinicName,
      hospitalClinicLocation,
      hospitalClinicAddress,
      consultationDate,
      consultationType,
      reasonForVisit,
      clinicalNotes,
      diagnosisNotes,
      diagnosisAssessment,
      doctorRecommendations,
      followUpDate,
      status,
    } = req.body;

    const followUpReq = req.body.followUpRequired;
    if (followUpReq === 'No') {
      consultation.followUpDate = undefined;
      consultation.status = 'Completed';
    } else if (followUpReq === 'Yes') {
      if (followUpDate) {
        consultation.followUpDate = new Date(followUpDate);
      }
      consultation.status = 'Follow-up Needed';
    } else {
      if (followUpDate !== undefined) consultation.followUpDate = followUpDate ? new Date(followUpDate) : undefined;
      if (status !== undefined) consultation.status = status;
    }

    if (hospitalClinicName !== undefined) consultation.hospitalClinicName = hospitalClinicName;
    if (hospitalClinicLocation !== undefined || hospitalClinicAddress !== undefined) {
      consultation.hospitalClinicLocation = hospitalClinicLocation || hospitalClinicAddress || '';
    }
    if (consultationDate !== undefined) consultation.consultationDate = new Date(consultationDate);
    if (consultationType !== undefined) consultation.consultationType = consultationType;
    if (reasonForVisit !== undefined) consultation.reasonForVisit = reasonForVisit.trim();
    if (clinicalNotes !== undefined) consultation.clinicalNotes = clinicalNotes.trim();
    if (diagnosisNotes !== undefined || diagnosisAssessment !== undefined) {
      consultation.diagnosisNotes = (diagnosisNotes || diagnosisAssessment || '').trim();
    }
    if (doctorRecommendations !== undefined) consultation.doctorRecommendations = doctorRecommendations.trim();

    await consultation.save();

    // Auto sync/update associated Follow-up Appointment
    const Appointment = require('../models/Appointment');
    let followUpAppt = await Appointment.findOne({
      consultationId: consultation._id,
      appointmentType: 'FOLLOW_UP',
    });

    if (consultation.followUpDate && consultation.status === 'Follow-up Needed') {
      const reasonText = consultation.reasonForVisit
        ? `Follow-up for: ${consultation.reasonForVisit}`
        : 'Follow-up consultation';

      if (followUpAppt) {
        followUpAppt.appointmentDate = consultation.followUpDate;
        followUpAppt.reason = reasonText;
        followUpAppt.status = 'SCHEDULED';
        if (consultation.patientPid) followUpAppt.patientPid = consultation.patientPid;
        await followUpAppt.save();
      } else {
        await Appointment.create({
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          patientPid: consultation.patientPid || '',
          appointmentDate: consultation.followUpDate,
          appointmentTime: '09:00 AM',
          appointmentType: 'FOLLOW_UP',
          reason: reasonText,
          status: 'SCHEDULED',
          consultationId: consultation._id,
        });
      }
    } else if (followUpAppt) {
      followUpAppt.status = 'CANCELLED';
      await followUpAppt.save();
    }

    const resolvedConsultation = await resolveDoctorIdentity(consultation);

    return res.status(200).json({
      success: true,
      message: 'Consultation updated successfully',
      consultation: resolvedConsultation,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyConsultations,
  createConsultation,
  getConsultationById,
  updateConsultation,
};
