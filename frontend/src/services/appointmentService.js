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
 * Schedule and confirm an appointment (Admin only)
 */
export const createAppointment = async (payload) => {
  const response = await api.post('/appointments', payload);
  return response.data;
};

/**
 * Search patient by PID for appointment booking (Admin only)
 */
export const lookupPatientByPid = async (pid) => {
  const response = await api.get(`/appointments/patient-lookup?pid=${encodeURIComponent(pid)}`);
  return response.data;
};

/**
 * Get departments and registered doctors (Admin only)
 */
export const getDepartmentsAndDoctors = async () => {
  const response = await api.get('/appointments/departments-doctors');
  return response.data;
};

/**
 * Get available slots for doctor on a specific date (Admin only)
 */
export const getAvailableSlots = async (doctorId, date) => {
  const response = await api.get(`/appointments/available-slots?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`);
  return response.data;
};

/**
 * Get all appointments for logged-in doctor
 */
export const getDoctorAppointments = async () => {
  const response = await api.get('/appointments/doctor');
  return response.data;
};

/**
 * Get follow-up appointments for logged-in doctor
 */
export const getDoctorFollowUps = async () => {
  const response = await api.get('/appointments/doctor/follow-ups');
  return response.data;
};

/**
 * Get single appointment by ID
 */
export const getAppointmentById = async (id) => {
  const response = await api.get(`/appointments/${id}`);
  return response.data;
};

/**
 * Update an appointment
 */
export const updateAppointment = async (id, payload) => {
  const response = await api.put(`/appointments/${id}`, payload);
  return response.data;
};

export default {
  createAppointment,
  getDoctorAppointments,
  getDoctorFollowUps,
  getAppointmentById,
  updateAppointment,
};
