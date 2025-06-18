// API Configuration
export const API_CONFIG = {
  // Development - Use Railway for now (can switch back to local if needed)
  DEV_BASE_URL: 'https://free-to-hang-production.up.railway.app',
  
  // Production (Railway)
  PROD_BASE_URL: 'https://free-to-hang-production.up.railway.app',
  
  // Current environment - Use Railway for both dev and prod
  BASE_URL: 'https://free-to-hang-production.up.railway.app',
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