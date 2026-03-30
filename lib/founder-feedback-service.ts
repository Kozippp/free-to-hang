import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { generateUUID } from '@/utils/idGenerator';

export const FOUNDER_FEEDBACK_MAX_BODY = 10000;
export const FOUNDER_FEEDBACK_MAX_ATTACHMENTS = 8;

const BUCKET = 'feedback_attachments';
const MAX_BYTES = 50 * 1024 * 1024;

export type LocalFeedbackAttachment = {
  uri: string;
  mimeType: string;
  kind: 'image' | 'video';
};

function extensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'video/mp4') return 'mp4';
  return 'bin';
}

async function assertFileSize(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists || !('size' in info) || info.size == null) return;
  if (info.size > MAX_BYTES) {
    throw new Error(`Each file must be under ${Math.round(MAX_BYTES / (1024 * 1024))} MB`);
  }
}

async function uploadOne(
  userId: string,
  feedbackId: string,
  index: number,
  att: LocalFeedbackAttachment
): Promise<string> {
  await assertFileSize(att.uri);
  const response = await fetch(att.uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error(`File too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB)`);
  }
  const ext = extensionForMime(att.mimeType);
  const path = `${userId}/${feedbackId}/${Date.now()}_${index}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: att.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function submitFounderFeedback(args: {
  body: string;
  attachments: LocalFeedbackAttachment[];
  userEmailSnapshot: string | null;
}): Promise<void> {
  const trimmed = args.body.trim();
  if (trimmed.length < 1) {
    throw new Error('Please write a message');
  }
  if (trimmed.length > FOUNDER_FEEDBACK_MAX_BODY) {
    throw new Error('Message is too long');
  }
  if (args.attachments.length > FOUNDER_FEEDBACK_MAX_ATTACHMENTS) {
    throw new Error(`Maximum ${FOUNDER_FEEDBACK_MAX_ATTACHMENTS} attachments`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('You must be signed in');
  }

  const feedbackId = generateUUID();
  const paths: string[] = [];
  for (let i = 0; i < args.attachments.length; i++) {
    const p = await uploadOne(user.id, feedbackId, i, args.attachments[i]!);
    paths.push(p);
  }

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';

  const { error: insertError } = await supabase.from('founder_feedback').insert({
    id: feedbackId,
    user_id: user.id,
    body: trimmed,
    attachment_paths: paths,
    user_email_snapshot: args.userEmailSnapshot,
    platform: Platform.OS,
    app_version: String(appVersion),
  });

  if (insertError) {
    throw insertError;
  }
}
