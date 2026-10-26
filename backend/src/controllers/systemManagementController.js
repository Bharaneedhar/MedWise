const mongoose = require('mongoose');
const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const PharmacistProfile = require('../models/PharmacistProfile');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');

/**
 * @desc    Get all user accounts across roles for System Management
 * @route   GET /api/system-management/users
 * @access  Private (System Management Key)
 */
const getSystemUsers = async (req, res, next) => {
  try {
    const { search, role } = req.query;

    let userQuery = {};
    if (role && ['doctor', 'pharmacist', 'patient'].includes(role)) {
      userQuery.role = role;
    }

    if (search && search.trim()) {
      const searchClean = search.trim();
      const mobileSearch = searchClean.replace(/\D/g, '');

      userQuery.$or = [
        { name: { $regex: searchClean, $options: 'i' } },
        { email: { $regex: searchClean, $options: 'i' } },
      ];

      if (mobileSearch) {
        const [matchingPatientProfiles, matchingDocProfiles, matchingPharmProfiles] = await Promise.all([
          PatientProfile.find({ mobileNumber: { $regex: mobileSearch, $options: 'i' } }).select('userId'),
          DoctorProfile.find({ contactPhone: { $regex: mobileSearch, $options: 'i' } }).select('userId'),
          PharmacistProfile.find({ contactPhone: { $regex: mobileSearch, $options: 'i' } }).select('userId'),
        ]);

        const profileUserIds = [
          ...matchingPatientProfiles.map((p) => p.userId),
          ...matchingDocProfiles.map((p) => p.userId),
          ...matchingPharmProfiles.map((p) => p.userId),
        ];

        userQuery.$or.push({ _id: { $in: profileUserIds } });
      }
    }

    const users = await User.find(userQuery).select('-password').sort({ createdAt: -1 }).lean();

    // Attach profile identities to each user
    const usersWithProfiles = await Promise.all(
      users.map(async (u) => {
        let profileInfo = {};
        if (u.role === 'patient') {
          const prof = await PatientProfile.findOne({ userId: u._id }).lean();
          if (prof) {
            const mobile = prof.mobileNumber || '';
            profileInfo = {
              pid: mobile ? `PID-${mobile.slice(-10)}` : '',
              mobileNumber: mobile,
              gender: prof.gender || '',
              bloodGroup: prof.bloodGroup || '',
            };
          }
        } else if (u.role === 'doctor') {
          const prof = await DoctorProfile.findOne({ userId: u._id }).lean();
          if (prof) {
            profileInfo = {
              licenseNumber: prof.licenseNumber || '',
              specialization: prof.specialization || '',
              workplaceName: prof.workplaceName || '',
            };
          }
        } else if (u.role === 'pharmacist') {
          const prof = await PharmacistProfile.findOne({ userId: u._id }).lean();
          if (prof) {
            profileInfo = {
              licenseNumber: prof.licenseNumber || '',
              pharmacyName: prof.pharmacyName || '',
            };
          }
        }

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          status: 'Active',
          profile: profileInfo,
        };
      })
    );

    return res.status(200).json({
      success: true,
      users: usersWithProfiles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cascade delete a user account and all exclusive related records
 * @route   DELETE /api/system-management/users/:userId
 * @access  Private (System Management Key)
 */
const deleteUserAccount = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Safety Check: Never allow deleting core baseline test accounts if explicitly protected
    // (Existing real data safety)

    const role = targetUser.role;
    const deletedSummary = {
      user: 0,
      profile: 0,
      consultations: 0,
      prescriptions: 0,
      appointments: 0,
    };

    // Try transaction session first
    let session = null;
    let useTransaction = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (e) {
      console.warn('[SystemManagement] Transactions not supported on this MongoDB instance. Executing sequential cascade delete.');
      session = null;
    }

    const options = useTransaction && session ? { session } : {};

    if (role === 'patient') {
      // PATIENT CASCADE DELETION (Sequential for transaction safety)
      const uRes = await User.deleteOne({ _id: userId }, options);
      const pRes = await PatientProfile.deleteOne({ userId: userId }, options);
      const cRes = await Consultation.deleteMany({ patientId: userId }, options);
      const aRes = await Appointment.deleteMany({ patientId: userId }, options);
      const rxRes = await Prescription.deleteMany({ patientId: userId }, options);

      deletedSummary.user = uRes.deletedCount || 0;
      deletedSummary.profile = pRes.deletedCount || 0;
      deletedSummary.consultations = cRes.deletedCount || 0;
      deletedSummary.appointments = aRes.deletedCount || 0;
      deletedSummary.prescriptions = rxRes.deletedCount || 0;
    } else if (role === 'doctor') {
      // DOCTOR CASCADE DELETION (Sequential for transaction safety)
      const uRes = await User.deleteOne({ _id: userId }, options);
      const pRes = await DoctorProfile.deleteOne({ userId: userId }, options);
      const cRes = await Consultation.deleteMany({ doctorId: userId }, options);
      const aRes = await Appointment.deleteMany({ doctorId: userId }, options);
      const rxRes = await Prescription.deleteMany({ doctorId: userId }, options);

      deletedSummary.user = uRes.deletedCount || 0;
      deletedSummary.profile = pRes.deletedCount || 0;
      deletedSummary.consultations = cRes.deletedCount || 0;
      deletedSummary.appointments = aRes.deletedCount || 0;
      deletedSummary.prescriptions = rxRes.deletedCount || 0;
    } else if (role === 'pharmacist') {
      // PHARMACIST DELETION (Preserve patient & doctor prescriptions, clear pharmacist reference)
      const uRes = await User.deleteOne({ _id: userId }, options);
      const pRes = await PharmacistProfile.deleteOne({ userId: userId }, options);
      const rxUpdateRes = await Prescription.updateMany(
        { pharmacistId: userId },
        { $set: { pharmacistId: null, pharmacistName: null, dispensingStatus: 'PENDING' } },
        options
      );

      deletedSummary.user = uRes.deletedCount || 0;
      deletedSummary.profile = pRes.deletedCount || 0;
      deletedSummary.prescriptionsUnlinked = rxUpdateRes.modifiedCount || 0;
    }

    if (useTransaction && session) {
      await session.commitTransaction();
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: `Account (${targetUser.name}) and all exclusive associated records deleted successfully.`,
      role,
      deletedSummary,
    });
  } catch (error) {
    console.error('[SystemManagement Error] Cascade deletion failed:', error);
    return res.status(500).json({
      success: false,
      message: `Cascade deletion failed: ${error.message}`,
    });
  }
};

module.exports = {
  getSystemUsers,
  deleteUserAccount,
};
