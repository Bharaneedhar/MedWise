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
 * Lookup patient by PID for prescription authoring
 * @param {string} pid - Patient ID in format PID-XXXXXXXXXX
 */
export const lookupPatientByPid = async (pid) => {
  const response = await api.get(`/prescriptions/patient-by-pid/${pid}`);
  return response.data;
};

export const getPrescriptions = async () => {
  const response = await api.get('/prescriptions');
  return response.data;
};

export const getPrescriptionById = async (id) => {
  const response = await api.get(`/prescriptions/${id}`);
  return response.data;
};

export const createPrescription = async (prescriptionData) => {
  const response = await api.post('/prescriptions', prescriptionData);
  return response.data;
};

export const checkWithMedwise = async (prescriptionId) => {
  const response = await api.post(`/medwise/prescriptions/${prescriptionId}/analyze`);
  return response.data;
};

export const updatePrescription = async (prescriptionId, prescriptionData) => {
  const response = await api.put(`/prescriptions/${prescriptionId}`, prescriptionData);
  return response.data;
};

export const deletePrescription = async (prescriptionId) => {
  const response = await api.delete(`/prescriptions/${prescriptionId}`);
  return response.data;
};

export const approvePrescription = async (prescriptionId) => {
  const response = await api.put(`/prescriptions/${prescriptionId}/approve`);
  return response.data;
};

export const dispensePrescription = async (prescriptionId) => {
  const response = await api.put(`/prescriptions/${prescriptionId}/dispense`);
  return response.data;
};

export const deliverPrescription = async (prescriptionId) => {
  const response = await api.put(`/prescriptions/${prescriptionId}/deliver`);
  return response.data;
};

export default {
  lookupPatientByPid,
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  checkWithMedwise,
  updatePrescription,
  deletePrescription,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
};
