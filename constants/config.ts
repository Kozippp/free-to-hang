// API Configuration
export const API_CONFIG = {
  // Local development - Use your local network IP
  LOCAL_BASE_URL: 'http://192.168.0.24:3000',
  
  // Production (Railway) - Deploy later
  PROD_BASE_URL: 'https://free-to-hang-production.up.railway.app',
  
  // Current environment - Use local for development, Railway for production
  BASE_URL: __DEV__ 
    ? 'http://192.168.0.24:3000'  // Local development
    : 'https://free-to-hang-production.up.railway.app', // Production
};

// API Endpoints
export const API_ENDPOINTS = {
  // Health check
  HEALTH: '/',
  
  // User endpoints
  USER_PROFILE: '/user/me',
  REGISTER_PROFILE: '/user/register-profile',
  
  // Future endpoints
  FRIENDS: '/friends',
  PLANS: '/plans',
  MESSAGES: '/messages',
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 