import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = (managementKey) => {
  return {
    'Content-Type': 'application/json',
    'x-system-management-key': managementKey || sessionStorage.getItem('medwise_sys_mgmt_key') || 'medwise-sys-admin-2026',
  };
};

export const getSystemUsers = async (search = '', role = '', managementKey = '') => {
  const params = {};
  if (search) params.search = search;
  if (role) params.role = role;

  const response = await axios.get(`${API_URL}/system-management/users`, {
    params,
    headers: getHeaders(managementKey),
  });
  return response.data;
};

export const deleteUserAccount = async (userId, managementKey = '') => {
  const response = await axios.delete(`${API_URL}/system-management/users/${userId}`, {
    headers: getHeaders(managementKey),
  });
  return response.data;
};

export default {
  getSystemUsers,
  deleteUserAccount,
};
