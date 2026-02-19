import axios from 'axios';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || 'https://tlink-production-backend.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Ensure headers object exists
      if (!config.headers) {
        config.headers = {} as any;
      }
      config.headers.Authorization = `Bearer ${token}`;
      
      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log('[API Request]', config.method?.toUpperCase(), config.url);
        console.log('[Auth Token]', 'Present');
      }
    } else {
      // Only warn for routes that require authentication (skip login/register/public)
      const publicRoutes = ['/auth/login', '/auth/register', '/manufacturer-auth/login', '/manufacturer-auth/register'];
      const isPublicRoute = publicRoutes.some(route => config.url?.includes(route));
      if (!isPublicRoute) {
        console.warn('[API] No auth_token found in localStorage for request:', config.url);
      }
    }
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log detailed error information
    if (error.response) {
      console.error('[API Error]', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response.data,
        headers: error.config?.headers,
      });
    }
    
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized - Clearing auth and redirecting to login');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
