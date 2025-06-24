// API Configuration
export const API_CONFIG = {
  // Local development - Use your local network IP
  LOCAL_BASE_URL: 'http://192.168.0.24:3000',
  
  // Production (Railway) - Will be updated after deployment
  PROD_BASE_URL: 'https://free-to-hang-backend-production.up.railway.app',
  
  // Current environment - Use Railway for both dev and production for now
  BASE_URL: 'https://free-to-hang-backend-production.up.railway.app', // Always use Railway
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

// Export API_URL for backwards compatibility
export const API_URL = API_CONFIG.BASE_URL; 