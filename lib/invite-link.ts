import { supabase } from '@/lib/supabase';
import { buildInviteUrlForUser } from '@/constants/config';

/** Android share sheet title; iOS uses message. */
export const INVITE_SHARE_TITLE = 'Join Free to Hang';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve invite URL segment to a user id (requires authenticated Supabase session; RLS must allow read).
 */
export async function resolveInviteRefToUserId(ref: string): Promise<string | null> {
  const decoded = decodeURIComponent(ref.trim());
  if (!decoded) return null;

  if (UUID_RE.test(decoded)) {
    const { data, error } = await supabase
      .from('user_directory')
      .select('id')
      .eq('id', decoded)
      .maybeSingle();
    if (error) {
      console.warn('resolveInviteRefToUserId by id:', error.message);
      return null;
    }
    return data?.id ?? null;
  }

  const { data: byExact, error: errExact } = await supabase
    .from('user_directory')
    .select('id')
    .eq('username', decoded)
    .maybeSingle();
  if (errExact) {
    console.warn('resolveInviteRefToUserId by username:', errExact.message);
    return null;
  }
  if (byExact?.id) return byExact.id;

  const { data: byIlike, error: errIlike } = await supabase
    .from('user_directory')
    .select('id')
    .ilike('username', decoded)
    .maybeSingle();
  if (errIlike) {
    console.warn('resolveInviteRefToUserId ilike:', errIlike.message);
    return null;
  }
  return byIlike?.id ?? null;
}

/** In-app / custom-scheme path for Expo Router, e.g. freetohang://invite/alice */
export function buildAppInvitePath(ref: string): string {
  return `/invite/${encodeURIComponent(ref.trim())}`;
}

/**
 * Extract invite ref from https, custom scheme, or path fragment (for tests / tooling).
 */
export function parseInviteRefFromUrl(url: string): string | null {
  const match = url.match(/\/invite\/([^?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function buildInviteShareMessage(url: string): string {
  return `Join me on Free to Hang! ${url}`;
}

export async function fetchPersonalInviteUrl(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('user_directory')
    .select('username')
    .eq('id', user.id)
    .single();

  return buildInviteUrlForUser(userData?.username ?? user.id);
}
