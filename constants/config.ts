// API Configuration
export const API_CONFIG = {
  // Development
  DEV_BASE_URL: 'http://localhost:3000',
  
  // Production (Railway)
  PROD_BASE_URL: 'https://free-to-hang-production.up.railway.app',
  
  // Current environment
  BASE_URL: __DEV__ 
    ? 'http://localhost:3000' 
    : 'https://free-to-hang-production.up.railway.app',
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