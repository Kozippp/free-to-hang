// API Configuration
export const API_CONFIG = {
  // Local development - Use your local network IP
  LOCAL_BASE_URL: 'http://localhost:3000/api',
  
  // Production (Railway) - Current working URL
  PROD_BASE_URL: 'https://free-to-hang-production.up.railway.app/api',
  
  // Current environment - Using Railway production
  BASE_URL: 'https://free-to-hang-production.up.railway.app/api',
};

// API Endpoints
export const API_ENDPOINTS = {
  // Health check (root endpoint, no /api prefix needed)
  HEALTH: '/',
  
  // User endpoints
  USER_PROFILE: '/user/me',
  REGISTER_PROFILE: '/user/register-profile',
  
  // Friend endpoints
  FRIENDS: '/friends',
  FRIENDS_SEARCH: '/friends/search',
  FRIENDS_REQUEST: '/friends/request',
  FRIENDS_ACCEPT: '/friends/request/accept',
  FRIENDS_DECLINE: '/friends/request/decline',
  FRIENDS_CANCEL: '/friends/request/cancel',
  FRIENDS_REMOVE: '/friends/remove',
  FRIENDS_INCOMING: '/friends/requests/incoming',
  FRIENDS_OUTGOING: '/friends/requests/outgoing',
  FRIENDS_STATUS: '/friends/status',
  
  // Plans endpoints
  PLANS: '/plans',
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Export API_URL for backwards compatibility
export const API_URL = API_CONFIG.BASE_URL; 