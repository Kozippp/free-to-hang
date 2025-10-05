export type FriendStatus = 'available' | 'offline' | 'online' | 'pinged';

export const formatTimeAgo = (timestamp: string): string => {
  if (!timestamp) {
    return 'recently';
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - parsed.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  }

  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  return `${days}d ago`;
};

interface FriendAvailabilitySource {
  status: FriendStatus;
  statusChangedAt?: string | null;
  lastActive?: string | null;
  lastSeen?: string | null;
}

export const formatFriendLastAvailable = (friend: FriendAvailabilitySource): string => {
  if (friend.status === 'available') {
    return 'now';
  }

  if (friend.statusChangedAt) {
    const statusAgo = formatTimeAgo(friend.statusChangedAt);
    if (statusAgo !== 'recently') {
      return statusAgo;
    }
  }

  if (friend.lastSeen) {
    const lastSeenAgo = formatTimeAgo(friend.lastSeen);
    if (lastSeenAgo !== 'recently') {
      return lastSeenAgo;
    }
  }

  if (friend.lastActive) {
    const normalized = friend.lastActive.trim();
    if (normalized.length > 0) {
      return normalized.toLowerCase() === 'recently' ? 'recently' : normalized;
    }
  }

  return 'recently';
};
