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
 * Get authenticated user's clinical consultations
 */
export const getMyConsultations = async () => {
  const response = await api.get('/consultations/my');
  return response.data;
};

/**
 * Get single consultation by ID
 */
export const getConsultationById = async (id) => {
  const response = await api.get(`/consultations/${id}`);
  return response.data;
};

/**
 * Create a new clinical consultation
 */
export const createConsultation = async (payload) => {
  const response = await api.post('/consultations', payload);
  return response.data;
};

/**
 * Update an existing clinical consultation
 */
export const updateConsultation = async (id, payload) => {
  const response = await api.put(`/consultations/${id}`, payload);
  return response.data;
};

export default {
  getMyConsultations,
  getConsultationById,
  createConsultation,
  updateConsultation,
};
