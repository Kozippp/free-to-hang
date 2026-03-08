/**
 * Notification trigger API
 * Called by client after successful direct Supabase writes (friend request, accept).
 * Backend creates notification record + sends push.
 */

import { API_CONFIG } from '@/constants/config';

async function getAuthHeaders() {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No authentication token available');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

export async function triggerFriendRequestNotification(
  receiverId: string,
  requestId: string
): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/trigger-friend-request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ receiver_id: receiverId, request_id: requestId }),
    });
    if (!response.ok) {
      console.warn('⚠️ Failed to trigger friend request notification:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.warn('⚠️ Error triggering friend request notification:', error);
    return false;
  }
}

export async function triggerFriendAcceptedNotification(requestId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/trigger-friend-accepted`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request_id: requestId }),
    });
    if (!response.ok) {
      console.warn('⚠️ Failed to trigger friend accepted notification:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.warn('⚠️ Error triggering friend accepted notification:', error);
    return false;
  }
}
