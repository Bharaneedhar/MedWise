import axios from 'axios';
import { tokenStorage } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header dynamically
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Execute MedWise dosage analysis on a prescription (Doctor authenticated)
 * @param {string} prescriptionId - Prescription ID (e.g. RX-123456 or MongoDB ObjectId)
 * @returns {Promise<{ success: boolean, message: string, analysis: Object }>}
 */
export const checkPrescriptionDosage = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/dosage-check`);
  return response.data;
};

/**
 * Execute MedWise drug-drug interaction analysis on a prescription (Doctor authenticated)
 * @param {string} prescriptionId - Prescription ID (e.g. RX-123456 or MongoDB ObjectId)
 * @returns {Promise<{ success: boolean, message: string, analysis: Object }>}
 */
export const checkPrescriptionInteractions = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/interaction-check`);
  return response.data;
};

/**
 * Execute MedWise duplicate medication analysis on a prescription (Doctor authenticated)
 * @param {string} prescriptionId - Prescription ID (e.g. RX-123456 or MongoDB ObjectId)
 * @returns {Promise<{ success: boolean, message: string, analysis: Object }>}
 */
export const checkPrescriptionDuplicates = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/duplicate-check`);
  return response.data;
};

/**
 * Execute MedWise allergy and safety analysis on a prescription (Doctor authenticated)
 * @param {string} prescriptionId - Prescription ID (e.g. RX-123456 or MongoDB ObjectId)
 * @returns {Promise<{ success: boolean, message: string, analysis: Object }>}
 */
export const checkPrescriptionAllergySafety = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/allergy-safety-check`);
  return response.data;
};

/**
 * Execute full MedWise prescription analysis (Doctor authenticated)
 * @param {string} prescriptionId - Prescription ID (e.g. RX-123456 or MongoDB ObjectId)
 * @returns {Promise<{ success: boolean, message: string, analysis: Object }>}
 */
export const analyzePrescription = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/analyze`);
  return response.data;
};

export default {
  checkPrescriptionDosage,
  checkPrescriptionInteractions,
  checkPrescriptionDuplicates,
  checkPrescriptionAllergySafety,
  analyzePrescription,
};


