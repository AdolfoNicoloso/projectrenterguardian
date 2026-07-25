import React, { useState, useEffect } from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { getAuthenticatedMediaFileUrl } from '../../utils/fileUrl';
import type { ThemeColors } from '../../theme/colors';
import type { Photo } from '../../types';
import { propertySpacesStyles as styles } from './propertySpacesStyles';

export function SpacePhotoThumb({
  photo,
  colors,
  onOpen,
}: {
  photo: Photo;
  colors: ThemeColors;
  onOpen: (uri: string, title?: string) => void;
}) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthenticatedMediaFileUrl(photo.file, 'thumb')
      .then((url) => {
        if (!cancelled) setThumbUri(url);
      })
      .catch(() => {
        if (!cancelled) setThumbUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.file]);

  const open = async () => {
    try {
      const uri =
        displayUri ||
        (await getAuthenticatedMediaFileUrl(photo.file, 'display'));
      setDisplayUri(uri);
      onOpen(uri, photo.id);
    } catch {
      if (thumbUri) onOpen(thumbUri, photo.id);
    }
  };

  return (
    <Pressable
      onPress={() => {
        void open();
      }}
      accessibilityRole="imagebutton"
      accessibilityLabel="Open photo"
      style={[styles.thumb, { backgroundColor: colors.backgroundTertiary }]}
    >
      {thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={styles.thumbImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={photo.id}
        />
      ) : null}
    </Pressable>
  );
}
