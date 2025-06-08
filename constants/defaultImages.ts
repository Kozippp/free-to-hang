// Default profile images for users who haven't uploaded a photo
export const DEFAULT_AVATAR_URL = 'https://ui-avatars.com/api/?name=User&background=e5e7eb&color=6b7280&size=150&format=png';

export const generateDefaultAvatar = (name: string, userId?: string) => {
  // Create a default avatar with user's initials
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
  
  // Use a consistent color based on user ID for same user to always get same color
  const colors = [
    { bg: '3B82F6', color: 'ffffff' }, // Blue
    { bg: 'EF4444', color: 'ffffff' }, // Red  
    { bg: '10B981', color: 'ffffff' }, // Green
    { bg: 'F59E0B', color: 'ffffff' }, // Yellow
    { bg: '8B5CF6', color: 'ffffff' }, // Purple
    { bg: 'EC4899', color: 'ffffff' }, // Pink
    { bg: '06B6D4', color: 'ffffff' }, // Cyan
    { bg: 'F97316', color: 'ffffff' }, // Orange
  ];
  
  const colorIndex = userId 
    ? userId.charCodeAt(0) % colors.length 
    : Math.floor(Math.random() * colors.length);
  
  const selectedColor = colors[colorIndex];
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${selectedColor.bg}&color=${selectedColor.color}&size=150&format=png&bold=true`;
};

// Fallback silhouette image
export const SILHOUETTE_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRTVFN0VCIi8+CjxwYXRoIGQ9Ik03NSA3NkM4Ni4wNDU3IDc2IDk1IDY3LjA0NTcgOTUgNTZDOTUgNDQuOTU0MyA4Ni4wNDU3IDM2IDc1IDM2QzYzLjk1NDMgMzYgNTUgNDQuOTU0MyA1NSA1NkM1NSA2Ny4wNDU3IDYzLjk1NDMgNzYgNzUgNzZaIiBmaWxsPSIjOUI5Q0EwIi8+CjxwYXRoIGQ9Ik0zMCAxMjBDMzAgMTA0LjUzNiA0Mi41MzU5IDkyIDU4IDkySDkyQzEwNy40NjQgOTIgMTIwIDEwNC41MzYgMTIwIDEyMFYxNTBIMzBWMTIwWiIgZmlsbD0iIzlCOUNBMCIvPgo8L3N2Zz4K'; 