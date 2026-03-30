import { API_CONFIG } from '@/constants/config';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabase');
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

/** Mirrors `notification_preferences` columns used by the push pipeline (see backend notificationService). */
export interface NotificationPreferencesState {
  push_enabled: boolean;
  plan_notifications: boolean;
  chat_notifications: boolean;
  friend_notifications: boolean;
  status_notifications: boolean;
  engagement_notifications: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const DEFAULT_QUIET_START = '22:00:00';
const DEFAULT_QUIET_END = '08:00:00';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesState = {
  push_enabled: true,
  plan_notifications: true,
  chat_notifications: true,
  friend_notifications: true,
  status_notifications: true,
  engagement_notifications: true,
  quiet_hours_enabled: false,
  quiet_hours_start: DEFAULT_QUIET_START,
  quiet_hours_end: DEFAULT_QUIET_END,
};

function toTimeString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length >= 5 ? trimmed.slice(0, 8) : trimmed;
  }
  return null;
}

function normalizeRow(row: Record<string, unknown> | null | undefined): NotificationPreferencesState {
  if (!row) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  return {
    push_enabled: row.push_enabled !== false,
    plan_notifications: row.plan_notifications !== false,
    chat_notifications: row.chat_notifications !== false,
    friend_notifications: row.friend_notifications !== false,
    status_notifications: row.status_notifications !== false,
    engagement_notifications: row.engagement_notifications !== false,
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: toTimeString(row.quiet_hours_start) ?? DEFAULT_QUIET_START,
    quiet_hours_end: toTimeString(row.quiet_hours_end) ?? DEFAULT_QUIET_END,
  };
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesState> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/preferences`, {
    method: 'GET',
    headers,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load notification preferences');
  }
  return normalizeRow(json.preferences);
}

export type NotificationPreferencesPatch = Partial<{
  push_enabled: boolean;
  plan_notifications: boolean;
  chat_notifications: boolean;
  friend_notifications: boolean;
  status_notifications: boolean;
  engagement_notifications: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}>;

export async function patchNotificationPreferences(
  patch: NotificationPreferencesPatch
): Promise<NotificationPreferencesState> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/preferences`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save notification preferences');
  }
  return normalizeRow(json.preferences);
}

/** Parse Postgres TIME / "HH:MM:SS" into a Date (today) for pickers. */
export function timeStringToLocalDate(time: string | null, fallback: string): Date {
  const t = (time && time.length >= 5 ? time : fallback).slice(0, 8);
  const [h, m, s] = t.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 22, Number.isFinite(m) ? m : 0, Number.isFinite(s) ? s : 0, 0);
  return d;
}

export function localDateToTimeString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
