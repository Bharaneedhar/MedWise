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

export const getDoctorDashboard = async () => {
  const response = await api.get('/doctor/dashboard');
  return response.data;
};

export const getDoctorPatients = async (search = '', includePatientId = '') => {
  const params = {};
  if (search) params.search = search;
  if (includePatientId) params.includePatientId = includePatientId;
  const response = await api.get('/doctor/patients', { params });
  return response.data;
};

export const getPatientClinicalRecord = async (patientId) => {
  const response = await api.get(`/doctor/patients/${patientId}`);
  return response.data;
};

export const getDoctorClinicalOverview = async () => {
  const response = await api.get('/doctor/clinical-overview');
  return response.data;
};

export const getDoctorMedwiseReviews = async () => {
  const response = await api.get('/doctor/medwise-reviews');
  return response.data;
};

export const updatePatientClinicalProfile = async (patientId, clinicalData) => {
  const response = await api.put(`/doctor/patients/${patientId}/clinical-profile`, clinicalData);
  return response.data;
};

export const updatePatientMedicationStatus = async (patientId, medicationId, status) => {
  const response = await api.patch(`/doctor/patients/${patientId}/medications/${medicationId}/status`, { status });
  return response.data;
};

export default {
  getDoctorDashboard,
  getDoctorPatients,
  getPatientClinicalRecord,
  getDoctorClinicalOverview,
  getDoctorMedwiseReviews,
  updatePatientClinicalProfile,
  updatePatientMedicationStatus,
};

