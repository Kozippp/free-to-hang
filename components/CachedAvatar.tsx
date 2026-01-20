import React from 'react';
import { Image, ImageProps, TouchableOpacity } from 'react-native';
import { useCachedAvatar } from '@/utils/avatarCache';

interface CachedAvatarProps extends Omit<ImageProps, 'source'> {
  userId?: string | null;
  uri?: string | null;
  fallbackUri?: string | null;
  onPress?: () => void;
}

export default function CachedAvatar({
  userId,
  uri,
  fallbackUri,
  onPress,
  ...imageProps
}: CachedAvatarProps) {
  const cachedUri = useCachedAvatar(userId ?? null, uri ?? null);
  const finalUri = cachedUri || uri || fallbackUri || undefined;

  if (!finalUri) {
    return null;
  }

  const avatarImage = (
    <Image
      {...imageProps}
      source={{ uri: finalUri }}
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {avatarImage}
      </TouchableOpacity>
    );
  }

  return avatarImage;
}
