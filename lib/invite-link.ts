import { supabase } from '@/lib/supabase';
import { buildInviteUrlForUser } from '@/constants/config';

/** Android share sheet title; iOS uses message. */
export const INVITE_SHARE_TITLE = 'Join Free to Hang';

export function buildInviteShareMessage(url: string): string {
  return `Join me on Free to Hang! ${url}`;
}

export async function fetchPersonalInviteUrl(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single();

  return buildInviteUrlForUser(userData?.username ?? user.id);
}
