import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import type { Photo } from '../types';
import { getAuthenticatedMediaFileUrl } from '../utils/fileUrl';
import { formatGalleryNotesText } from '../utils/notes';
import { photosService } from '../services/photosService';
import type { ThemeColors } from '../theme/colors';
import { PRGPhotoGallery, type GalleryPhoto } from './PRGPhotoGallery';

interface PRGPhotoGridProps {
  photos: Photo[];
  selectedIds: string[];
  onPhotoPress: (photo: Photo) => void;
  onPhotoSelect: (photoId: string) => void;
  onBulkAction?: (action: string) => void;
  showSelection?: boolean;
  /** Long-press opens the SharePoint-style gallery. */
  enablePreviewOnLongPress?: boolean;
  /** Tap opens the SharePoint-style gallery (skips onPhotoPress). */
  enablePreviewOnTap?: boolean;
  /** Label for gallery header (defaults to Unassigned / space id). */
  spaceLabelForPhoto?: (photo: Photo) => string;
  /** Shown as Edit in gallery when preview is open. */
  onEditPhoto?: (photoId: string) => void;
}

type PhotoImageProps = {
  photo: Photo;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  showSelection: boolean;
  containerStyle?: ViewStyle;
  colors: ThemeColors;
};

const PhotoImage = memo(function PhotoImage({
  photo,
  isSelected,
  onPress,
  onLongPress,
  showSelection,
  containerStyle,
  colors,
}: PhotoImageProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showMediaFallback, setShowMediaFallback] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Defer load slightly so first paint isn't blocked by N URL resolves.
    const id = setTimeout(() => {
      if (mountedRef.current) setShouldLoad(true);
    }, 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 2;

    const loadImage = async () => {
      try {
        const url = await getAuthenticatedMediaFileUrl(photo.file, 'thumb');
        if (!cancelled) {
          setImageUri(url);
        }
      } catch {
        if (!cancelled && retryCount < maxRetries) {
          retryCount += 1;
          setTimeout(() => {
            if (!cancelled) {
              void loadImage();
            }
          }, 1000 * retryCount);
        } else if (!cancelled) {
          setShowMediaFallback(true);
        }
      }
    };

    void loadImage();

    return () => {
      cancelled = true;
    };
  }, [photo.file, photo.id, shouldLoad]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const onImageError = useCallback(() => {
    if (imageUri && imageUri.includes('getFile')) {
      getAuthenticatedMediaFileUrl(photo.file, 'thumb')
        .then((newUrl) => {
          if (newUrl !== imageUri) {
            setImageUri(newUrl);
          } else {
            setShowMediaFallback(true);
          }
        })
        .catch(() => {
          setShowMediaFallback(true);
        });
    } else {
      setShowMediaFallback(true);
    }
  }, [imageUri, photo.file]);

  return (
    <TouchableOpacity
      style={[styles.photoContainer, containerStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          { width: '100%', height: '100%' },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {showMediaFallback ? (
          <View
            style={[
              styles.photo,
              styles.mediaPlaceholder,
              { backgroundColor: colors.borderSecondary },
            ]}
          >
            <Text
              style={[styles.mediaPlaceholderPlay, { color: colors.onPrimary }]}
            >
              ▶
            </Text>
            <Text
              style={[styles.mediaPlaceholderLabel, { color: colors.onPrimary }]}
            >
              Unavailable
            </Text>
          </View>
        ) : imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.photo, { backgroundColor: colors.borderSecondary }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={photo.id}
            onError={onImageError}
          />
        ) : (
          <View
            style={[
              styles.photo,
              styles.photoLoading,
              { backgroundColor: colors.border },
            ]}
          />
        )}
      </Animated.View>
      {showSelection ? (
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.onPrimary },
            isSelected && styles.checkboxSelected,
            isSelected && {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
        >
          {isSelected ? (
            <View
              style={[styles.checkmark, { backgroundColor: colors.onPrimary }]}
            />
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export const PRGPhotoGrid: React.FC<PRGPhotoGridProps> = ({
  photos,
  selectedIds,
  onPhotoPress,
  onPhotoSelect,
  showSelection = false,
  enablePreviewOnLongPress = false,
  enablePreviewOnTap = false,
  spaceLabelForPhoto,
  onEditPhoto,
}) => {
  const { colors } = useTheme();
  const isDesktop = useDesktopLayout();
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  // Mobile: 3 columns; desktop web: 5 columns for denser browsing.
  const photoWidthStyle: ViewStyle = { width: isDesktop ? '20%' : '33.33%' };

  const labelFor = useCallback(
    (photo: Photo) => {
      if (spaceLabelForPhoto) return spaceLabelForPhoto(photo);
      return photo.space ? 'Assigned' : 'Unassigned';
    },
    [spaceLabelForPhoto]
  );

  const galleryPhotos: GalleryPhoto[] = useMemo(
    () =>
      photos.map((p) => ({
        id: p.id,
        file: p.file,
        spaceLabel: labelFor(p),
        notesText: formatGalleryNotesText(p.notes_entries, p.notes),
      })),
    [photos, labelFor]
  );

  const openPreview = useCallback(
    (photo: Photo) => {
      const idx = photos.findIndex((p) => p.id === photo.id);
      setGalleryIndex(idx >= 0 ? idx : 0);
      setGalleryVisible(true);
    },
    [photos]
  );

  const handleLongPress = useCallback(
    (photo: Photo) => {
      if (showSelection) {
        onPhotoSelect(photo.id);
      } else if (enablePreviewOnLongPress) {
        openPreview(photo);
      }
    },
    [showSelection, onPhotoSelect, enablePreviewOnLongPress, openPreview]
  );

  const handlePress = useCallback(
    (photo: Photo) => {
      if (enablePreviewOnTap && !showSelection) {
        openPreview(photo);
        return;
      }
      onPhotoPress(photo);
    },
    [enablePreviewOnTap, showSelection, openPreview, onPhotoPress]
  );

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          No photos
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {photos.map((photo) => {
          const isSelected = selectedIds.includes(photo.id);
          return (
            <PhotoImage
              key={photo.id}
              photo={photo}
              isSelected={isSelected}
              onPress={() => handlePress(photo)}
              onLongPress={() => handleLongPress(photo)}
              showSelection={showSelection}
              containerStyle={photoWidthStyle}
              colors={colors}
            />
          );
        })}
      </View>

      {(enablePreviewOnLongPress || enablePreviewOnTap) && (
        <PRGPhotoGallery
          visible={galleryVisible}
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryVisible(false)}
          onEdit={
            onEditPhoto
              ? (photoId) => {
                  setGalleryVisible(false);
                  onEditPhoto(photoId);
                }
              : undefined
          }
          resolveNotes={async (photoId) => {
            const photo = await photosService.getPhoto(photoId);
            return formatGalleryNotesText(photo.notes_entries, photo.notes);
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  photoContainer: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoLoading: {},
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaPlaceholderPlay: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
  mediaPlaceholderLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  checkbox: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {},
  checkmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
});
