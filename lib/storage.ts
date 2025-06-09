import { supabase } from './supabase';

export interface UploadResult {
  url?: string;
  error?: string;
}

export const uploadImage = async (
  uri: string,
  folder: string = 'avatars',
  fileName?: string
): Promise<UploadResult> => {
  try {
    console.log('Starting image upload for URI:', uri);
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication error:', userError);
      return { error: 'User not authenticated' };
    }

    console.log('User authenticated, proceeding with upload...');

    // Convert URI to blob
    let blob: Blob;
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      blob = await response.blob();
      console.log('Image converted to blob, size:', blob.size);
    } catch (fetchError) {
      console.error('Error converting image to blob:', fetchError);
      return { error: 'Failed to process image' };
    }

    // Generate filename if not provided
    const timestamp = Date.now();
    const filename = fileName || `avatar_${timestamp}.jpg`;
    const filePath = `${user.id}/${filename}`;
    
    console.log('Uploading to path:', filePath);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(folder)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { error: error.message };
    }

    console.log('Upload successful, getting public URL...');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(folder)
      .getPublicUrl(filePath);

    console.log('Public URL generated:', urlData.publicUrl);
    
    return { url: urlData.publicUrl };
  } catch (error) {
    console.error('Upload error:', error);
    return { error: 'Failed to upload image' };
  }
};

export const deleteImage = async (
  filePath: string,
  folder: string = 'avatars'
): Promise<{ error?: string }> => {
  try {
    const { error } = await supabase.storage
      .from(folder)
      .remove([filePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return { error: error.message };
    }

    return {};
  } catch (error) {
    console.error('Delete error:', error);
    return { error: 'Failed to delete image' };
  }
}; 