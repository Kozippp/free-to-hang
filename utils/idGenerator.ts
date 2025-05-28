import { Platform } from 'react-native';

/**
 * Secure ID generator for production use
 * Suitable for scaling to millions of users
 */

// Fallback to crypto-secure random if available
const getSecureRandom = (): number => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  
  // Fallback to Math.random (not recommended for production)
  console.warn('Using Math.random() - not cryptographically secure');
  return Math.random();
};

// Generate cryptographically secure random string
const generateSecureRandomString = (length: number = 12): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(getSecureRandom() * chars.length);
    result += chars[randomIndex];
  }
  
  return result;
};

// Generate machine/device identifier (should be stored persistently)
const getMachineId = (): string => {
  // In production, this should be:
  // - Stored in secure storage
  // - Generated once per device
  // - Include device-specific info
  return Platform.OS + '-' + generateSecureRandomString(8);
};

/**
 * Generate UUID v4 compatible ID
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export const generateUUID = (): string => {
  const hex = '0123456789abcdef';
  let uuid = '';
  
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      const r = Math.floor(getSecureRandom() * 4);
      uuid += hex[8 + r]; // 8, 9, A, or B
    } else {
      uuid += hex[Math.floor(getSecureRandom() * 16)];
    }
  }
  
  return uuid;
};

/**
 * Generate production-ready message ID
 * Format: msg-{timestamp}-{machineId}-{random}
 */
export const generateMessageId = (): string => {
  const timestamp = Date.now().toString(36);
  const machineId = getMachineId().slice(0, 6);
  const random = generateSecureRandomString(8);
  
  return `msg-${timestamp}-${machineId}-${random}`;
};

/**
 * Generate production-ready plan ID
 * Uses UUID format for maximum compatibility
 */
export const generatePlanId = (): string => {
  return generateUUID();
};

/**
 * Generate production-ready user ID
 * Format: user-{uuid}
 */
export const generateUserId = (): string => {
  return `user-${generateUUID()}`;
};

/**
 * Generate production-ready poll option ID
 * Format: opt-{timestamp}-{random}
 */
export const generatePollOptionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = generateSecureRandomString(6);
  
  return `opt-${timestamp}-${random}`;
};

/**
 * Validate if ID follows expected format
 */
export const validateId = (id: string, type: 'message' | 'plan' | 'user' | 'option'): boolean => {
  const patterns = {
    message: /^msg-[a-z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/,
    plan: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    user: /^user-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    option: /^opt-[a-z0-9]+-[a-zA-Z0-9]+$/
  };
  
  return patterns[type].test(id);
};

// Export for backward compatibility
export default {
  generateUUID,
  generateMessageId,
  generatePlanId,
  generateUserId,
  generatePollOptionId,
  validateId
}; 