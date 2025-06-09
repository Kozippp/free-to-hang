import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface UploadResult {
  url?: string;
  error?: string;
}

export async function uploadImage(
  uri: string, 
  bucket: string = 'avatars', 
  path?: string
): Promise<UploadResult> {
  try {
    console.log('Starting image upload:', { uri, bucket, path });

    if (!uri) {
      throw new Error('No image URI provided');
    }

    // Generate unique filename if path not provided
    const fileName = path || `avatar-${Date.now()}.jpg`;
    console.log('Using filename:', fileName);

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    console.log('File read as base64, length:', base64.length);

    // Convert base64 to array buffer
    const arrayBuffer = decode(base64);
    console.log('Converted to array buffer, byte length:', arrayBuffer.byteLength);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    console.log('Public URL generated:', publicUrl);

    return { url: publicUrl };

  } catch (error) {
    console.error('Upload error:', error);
    return { error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function deleteImage(fileName: string, bucket: string = 'avatars'): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

export function getPublicUrl(fileName: string, bucket: string = 'avatars'): string {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  return publicUrl;
} 