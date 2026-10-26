const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');

/**
 * Normalizes doctor name for presentation: ensures single 'Dr. ' prefix if not present.
 */
const formatDoctorDisplayName = (name) => {
  if (!name || typeof name !== 'string') return '';
  let cleaned = name.trim();
  while (/^Dr\.?\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^Dr\.?\s+/i, '').trim();
  }
  if (!cleaned) return '';
  return `Dr. ${cleaned}`;
};

/**
 * Resolves live doctor identity from User and DoctorProfile models for Prescription and Consultation records.
 * Falls back to stored doc fields if User or DoctorProfile is missing or unresolvable.
 */
const resolveDoctorIdentity = async (input) => {
  if (!input) return input;

  const isArray = Array.isArray(input);
  const items = isArray ? input : [input];
  if (items.length === 0) return input;

  // Gather all unique doctor user IDs
  const doctorIds = new Set();
  const collectDocId = (item) => {
    if (!item || typeof item !== 'object') return;
    const docId = item.doctorId?._id || item.doctorId;
    if (docId && typeof docId === 'object' && docId.toString) {
      doctorIds.add(docId.toString());
    } else if (typeof docId === 'string' && docId.trim()) {
      doctorIds.add(docId.trim());
    }
    // Also check linked consultation or prescription if populated
    if (item.consultationId && typeof item.consultationId === 'object') {
      const cDocId = item.consultationId.doctorId?._id || item.consultationId.doctorId;
      if (cDocId) doctorIds.add(cDocId.toString());
    }
    if (item.prescriptionId && typeof item.prescriptionId === 'object') {
      const pDocId = item.prescriptionId.doctorId?._id || item.prescriptionId.doctorId;
      if (pDocId) doctorIds.add(pDocId.toString());
    }
  };

  items.forEach(collectDocId);

  if (doctorIds.size === 0) {
    return input;
  }

  const doctorIdArray = Array.from(doctorIds);

  // Bulk query User and DoctorProfile records
  const [users, doctorProfiles] = await Promise.all([
    User.find({ _id: { $in: doctorIdArray } }).select('name email role').lean(),
    DoctorProfile.find({ userId: { $in: doctorIdArray } }).lean(),
  ]);

  const userMap = new Map();
  users.forEach((u) => userMap.set(u._id.toString(), u));

  const profileMap = new Map();
  doctorProfiles.forEach((dp) => profileMap.set(dp.userId.toString(), dp));

  const applyResolvedIdentity = (rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') return rawItem;
    // If it's a Mongoose document, convert to plain object
    const item = typeof rawItem.toObject === 'function' ? rawItem.toObject() : { ...rawItem };

    const docId = (item.doctorId?._id || item.doctorId)?.toString();
    const u = docId ? userMap.get(docId) : null;
    const dp = docId ? profileMap.get(docId) : null;

    if (u && u.name) {
      item.doctorName = formatDoctorDisplayName(u.name);
      if (item.doctorId && typeof item.doctorId === 'object') {
        item.doctorId.name = formatDoctorDisplayName(u.name);
      }
    } else if (item.doctorName) {
      item.doctorName = formatDoctorDisplayName(item.doctorName);
    }

    if (dp) {
      const spec = dp.specialization === 'Other' && dp.otherSpecialization ? dp.otherSpecialization : dp.specialization;
      const qual = dp.qualification === 'Other' && dp.otherQualification ? dp.otherQualification : dp.qualification;

      if (spec) {
        item.doctorSpecialization = spec;
        item.specialization = spec;
      }
      if (qual) {
        item.doctorQualification = qual;
        item.qualification = qual;
      }
      if (dp.medicalRegistrationNumber) {
        item.doctorMedicalRegistrationNumber = dp.medicalRegistrationNumber;
      }
      if (dp.hospitalClinicName) {
        item.doctorHospitalClinicName = dp.hospitalClinicName;
        item.hospitalClinicName = dp.hospitalClinicName;
        item.workplaceName = dp.hospitalClinicName;
        item.pharmacyHospitalName = dp.hospitalClinicName;
      }
      if (dp.hospitalClinicAddress) {
        item.doctorHospitalClinicAddress = dp.hospitalClinicAddress;
        item.hospitalClinicLocation = dp.hospitalClinicAddress;
        item.hospitalClinicAddress = dp.hospitalClinicAddress;
        item.workplaceAddress = dp.hospitalClinicAddress;
        item.pharmacyHospitalAddress = dp.hospitalClinicAddress;
      }
      if (dp.professionalContactNumber) {
        item.doctorProfessionalContactNumber = dp.professionalContactNumber;
      }
    }

    // Apply recursively to linked consultation or prescription if populated as object
    if (item.consultationId && typeof item.consultationId === 'object') {
      const cDocId = (item.consultationId.doctorId?._id || item.consultationId.doctorId)?.toString();
      const cu = cDocId ? userMap.get(cDocId) : null;
      const cdp = cDocId ? profileMap.get(cDocId) : null;
      if (cu && cu.name) {
        item.consultationId.doctorName = formatDoctorDisplayName(cu.name);
      }
      if (cdp) {
        const cSpec = cdp.specialization === 'Other' && cdp.otherSpecialization ? cdp.otherSpecialization : cdp.specialization;
        if (cSpec) item.consultationId.doctorSpecialization = cSpec;
        if (cdp.hospitalClinicName) item.consultationId.hospitalClinicName = cdp.hospitalClinicName;
        if (cdp.hospitalClinicAddress) item.consultationId.hospitalClinicLocation = cdp.hospitalClinicAddress;
      }
    }

    if (item.prescriptionId && typeof item.prescriptionId === 'object') {
      const pDocId = (item.prescriptionId.doctorId?._id || item.prescriptionId.doctorId)?.toString();
      const pu = pDocId ? userMap.get(pDocId) : null;
      const pdp = pDocId ? profileMap.get(pDocId) : null;
      if (pu && pu.name) {
        item.prescriptionId.doctorName = formatDoctorDisplayName(pu.name);
      }
      if (pdp) {
        const pSpec = pdp.specialization === 'Other' && pdp.otherSpecialization ? pdp.otherSpecialization : pdp.specialization;
        if (pSpec) item.prescriptionId.doctorSpecialization = pSpec;
        if (pdp.hospitalClinicName) item.prescriptionId.doctorHospitalClinicName = pdp.hospitalClinicName;
        if (pdp.hospitalClinicAddress) item.prescriptionId.doctorHospitalClinicAddress = pdp.hospitalClinicAddress;
      }
    }

    return item;
  };

  if (isArray) {
    return items.map(applyResolvedIdentity);
  } else {
    return applyResolvedIdentity(items[0]);
  }
};

module.exports = {
  formatDoctorDisplayName,
  resolveDoctorIdentity,
};
