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
    const status = error.response?.status;
    if (status === 401) {
      // Firebase Auth will handle token refresh automatically
      console.warn('API request unauthorized - Firebase Auth may need refresh');
    }
    // Basic backoff for rate limit / server errors
    if (status === 429 || (status && status >= 500)) {
      const attempt = (error.config.__retryCount || 0) + 1;
      if (attempt <= 5) {
        error.config.__retryCount = attempt;
        const base = 500; // ms
        const delay = Math.min(base * Math.pow(2, attempt), 8000) + Math.floor(Math.random() * 300);
        await new Promise((res) => setTimeout(res, delay));
        return api.request(error.config);
      }
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

  // Compulsion endpoints removed

  // (Removed) ERP exercises endpoints
};

export default api;