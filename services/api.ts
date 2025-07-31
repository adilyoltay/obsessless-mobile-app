import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000/api' : 'https://api.obsessless.com');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for Firebase Auth token
api.interceptors.request.use(
  async (config) => {
    // Firebase Auth token will be handled by Firebase SDK automatically
    // For custom API calls, you can get Firebase ID token here
    try {
      // const { getAuth } = await import('./firebase'); // Firebase removed
      // const user = getAuth().currentUser;
      // if (user) {
      //   const token = await user.getIdToken();
      //   config.headers.Authorization = `Bearer ${token}`;
      // }
    } catch (error) {
      console.warn('Failed to get Firebase auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Firebase Auth will handle token refresh automatically
      console.warn('API request unauthorized - Firebase Auth may need refresh');
    }
    return Promise.reject(error);
  }
);

// API Service Functions (Optimized for Firebase Auth)
export const apiService = {
  // User endpoints
  user: {
    getProfile: async () => {
      const response = await api.get('/user/profile');
      return response.data;
    },
    updateProfile: async (data: any) => {
      const response = await api.put('/user/profile', data);
      return response.data;
    },
  },

  // Compulsion tracking endpoints
  compulsions: {
    getAll: async () => {
      const response = await api.get('/compulsions');
      return response.data;
    },
    create: async (data: any) => {
      const response = await api.post('/compulsions', data);
      return response.data;
    },
    update: async (id: string, data: any) => {
      const response = await api.put(`/compulsions/${id}`, data);
      return response.data;
    },
    delete: async (id: string) => {
      const response = await api.delete(`/compulsions/${id}`);
      return response.data;
    },
  },

  // ERP exercises endpoints
  erp: {
    getExercises: async () => {
      const response = await api.get('/erp-exercises');
      return response.data;
    },
    createExercise: async (data: any) => {
      const response = await api.post('/erp-exercises', data);
      return response.data;
    },
    startSession: async (exerciseId: string) => {
      const response = await api.post(`/erp-exercises/${exerciseId}/start`);
      return response.data;
    },
    completeSession: async (sessionId: string, data: any) => {
      const response = await api.post(`/erp-sessions/${sessionId}/complete`, data);
      return response.data;
    },
  },
};

export default api;