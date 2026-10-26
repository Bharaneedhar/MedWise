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
 * Get authenticated user's role-specific profile
 */
export const getMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data;
};

/**
 * Create or update authenticated user's role-specific profile
 * @param {Object} profileData
 */
export const updateMyProfile = async (profileData) => {
  const response = await api.put('/profile/me', profileData);
  return response.data;
};

export const getMyMedications = async () => {
  const response = await api.get('/profile/medications');
  return response.data;
};

export const addPatientMedication = async (medicationData) => {
  const response = await api.post('/profile/medications', medicationData);
  return response.data;
};

export const updateMyMedicationStatus = async (medicationId, status) => {
  const response = await api.patch(`/profile/medications/${medicationId}/status`, { status });
  return response.data;
};

export default {
  getMyProfile,
  updateMyProfile,
  getMyMedications,
  addPatientMedication,
  updateMyMedicationStatus,
};

