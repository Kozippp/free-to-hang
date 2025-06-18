import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload an image to Supabase Storage
 */
export async function uploadImage(
  uri: string, 
  bucket: string = 'avatars', 
  folder: string = 'profiles'
): Promise<UploadResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Create unique filename with user ID folder structure
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    console.log('Uploading image:', { filePath, fileName, type: `image/${fileExt}`, uri });

    // Try method 1: Direct REST API with FormData (preferred for React Native)
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

      console.log('Attempting upload to:', uploadUrl);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (uploadResponse.ok) {
        console.log('Upload successful via REST API');
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        console.log('Image uploaded successfully:', publicUrl);
        return {
          url: publicUrl,
          path: filePath
        };
      } else {
        const errorText = await uploadResponse.text();
        console.log('REST API upload failed, trying fallback method:', errorText);
        throw new Error(`REST API failed: ${uploadResponse.status}`);
      }
    } catch (restError) {
      console.log('REST API method failed, trying Supabase client method:', restError);
      
      // Method 2: Fallback using Supabase client with ArrayBuffer
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log('File size:', uint8Array.length, 'bytes');

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, uint8Array, {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (error) {
        console.error('Supabase client upload error:', error);
        throw error;
      }

      console.log('Upload successful via Supabase client');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      console.log('Image uploaded successfully:', publicUrl);
      return {
        url: publicUrl,
        path: filePath
      };
    }

  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(
  path: string, 
  bucket: string = 'avatars'
): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Pick an image from device gallery
 */
export async function pickImage(): Promise<string | null> {
  try {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
}

/**
 * Take a photo with camera
 */
export async function takePhoto(): Promise<string | null> {
  try {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access camera is required');
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    throw error;
  }
} 