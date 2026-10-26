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
 * Search active medicines from the Medicine Master Database
 * @param {string} searchTerm - Query string to search generic, brand, or active ingredient
 * @returns {Promise<{ success: boolean, count: number, medicines: Array }>}
 */
export const searchMedicines = async (searchTerm = '') => {
  const params = {};
  if (searchTerm && searchTerm.trim().length > 0) {
    params.search = searchTerm.trim();
  }
  const response = await api.get('/medicines', { params });
  return response.data;
};

/**
 * Retrieve complete clinical details for a single medicine
 * @param {string} id - MongoDB ObjectId of the medicine
 * @returns {Promise<{ success: boolean, medicine: Object }>}
 */
export const getMedicineById = async (id) => {
  const response = await api.get(`/medicines/${id}`);
  return response.data;
};

export default {
  searchMedicines,
  getMedicineById,
};
